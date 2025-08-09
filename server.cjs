const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração do multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos Excel (.xlsx, .xls) são permitidos'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Conectar ao MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Conectado ao MongoDB'))
  .catch((err) => {
    console.error('❌ Erro ao conectar ao MongoDB:', err);
    process.exit(1);
  });

// Schema do MongoDB
const producaoSchema = new mongoose.Schema({
  CodMaterialProducao: { type: Number, required: true, index: true },
  MaterialProducao: { type: String, required: true },
  PlanoCaixasFardos: { type: Number, required: true },
  Tons: { type: Number, required: true },
  BolsasProduzido: { type: Number, default: 0 }
}, { timestamps: true });

const Producao = mongoose.model('Producao', producaoSchema);

// Função para processar Excel inicial
const processExcelData = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  return jsonData
    .map((row, index) => {
      const codMaterial = row.CodMaterialProducao || row['Código Material'] || row.Codigo;
      const materialProducao = row.MaterialProducao || row.Material;
      const planoCaixas = row.PlanoCaixasFardos || row['Plano Caixas'] || row.Caixas;
      const tons = row.Tons || row.Toneladas;
      const bolsasProduzido = row.BolsasProduzido || 0;

      if (!codMaterial || !materialProducao || planoCaixas === undefined || tons === undefined) {
        throw new Error(`Linha ${index + 2}: Dados obrigatórios faltando`);
      }

      return {
        CodMaterialProducao: Number(codMaterial),
        MaterialProducao: String(materialProducao).trim(),
        PlanoCaixasFardos: Number(planoCaixas),
        Tons: Number(tons),
        BolsasProduzido: Number(bolsasProduzido) || 0
      };
    })
    .filter(item =>
      !isNaN(item.CodMaterialProducao) &&
      item.MaterialProducao &&
      !isNaN(item.PlanoCaixasFardos) &&
      !isNaN(item.Tons)
    );
};

// Upload inicial do plano de produção
app.post('/api/producoes', upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Nenhum arquivo foi enviado' });

    const dadosProducao = processExcelData(req.file.buffer);

    await Producao.deleteMany({});
    const insertResult = await Producao.insertMany(dadosProducao);

    res.status(200).json({
      success: true,
      message: `Plano de produção atualizado com sucesso! ${insertResult.length} registros inseridos.`,
      data: insertResult
    });
  } catch (err) {
    console.error('❌ Erro no upload:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Buscar todos os dados
app.get('/api/producoes', async (req, res) => {
  try {
    const producoes = await Producao.find({}).select('-__v').sort({ CodMaterialProducao: 1 });
    res.status(200).json({ success: true, data: producoes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar dados' });
  }
});

// Atualizar produção somando valores
app.put('/api/producoes/atualizar', upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Nenhum arquivo foi enviado' });

    console.log('🔄 Processando atualização de produção:', req.file.originalname);

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const atualizacoesBrutas = jsonData
      .map(row => ({
        CodMaterialSap: Number(row.CodMaterialSap || row['Código SAP'] || row.Codigo),
        Qtd_real_origem: Number(row.Qtd_real_origem || row.Quantidade || row.Produzido)
      }))
      .filter(item => !isNaN(item.CodMaterialSap) && item.Qtd_real_origem > 0);

    // Agrupar valores duplicados
    const atualizacoesAgrupadas = atualizacoesBrutas.reduce((acc, item) => {
      if (!acc[item.CodMaterialSap]) {
        acc[item.CodMaterialSap] = { CodMaterialSap: item.CodMaterialSap, valores: [] };
      }
      acc[item.CodMaterialSap].valores.push(item.Qtd_real_origem);
      return acc;
    }, {});

    // Converter para array e calcular soma
    const atualizacoes = Object.values(atualizacoesAgrupadas).map(item => {
      const soma = item.valores.reduce((a, b) => a + b, 0);
      console.log(`📌 Material ${item.CodMaterialSap}: valores = [${item.valores.join(', ')}] → soma = ${soma}`);
      return { CodMaterialSap: item.CodMaterialSap, Qtd_real_origem: soma };
    });

    console.log(`📊 ${atualizacoes.length} códigos de materiais agrupados para atualização`);

    // Zerar antes de atualizar
    await Producao.updateMany({}, { $set: { BolsasProduzido: 0 } });

    let atualizados = 0;
    let naoEncontrados = 0;

    for (const atualizacao of atualizacoes) {
      const result = await Producao.updateOne(
        { CodMaterialProducao: atualizacao.CodMaterialSap },
        { $set: { BolsasProduzido: atualizacao.Qtd_real_origem } }
      );

      if (result.matchedCount > 0) {
        atualizados++;
      } else {
        naoEncontrados++;
        console.log(`⚠️ Não encontrado: ${atualizacao.CodMaterialSap}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Produção atualizada com sucesso! ${atualizados} atualizados, ${naoEncontrados} não encontrados.`,
      data: { atualizados, naoEncontrados }
    });
  } catch (error) {
    console.error('❌ Erro na atualização:', error);
    res.status(500).json({ success: false, message: error.message || 'Erro ao atualizar produção' });
  }
});

// Status da API
app.get('/api/status', async (req, res) => {
  const totalRegistros = await Producao.countDocuments();
  const ultimaAtualizacao = await Producao.findOne({}, {}, { sort: { updatedAt: -1 } });
  res.status(200).json({
    success: true,
    status: 'API funcionando',
    totalRegistros,
    ultimaAtualizacao: ultimaAtualizacao?.updatedAt || null
  });
});

// Middleware de erro
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  res.status(500).json({ success: false, message: err.message || 'Erro interno do servidor' });
});

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Rota não encontrada' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
