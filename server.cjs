const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const dotenv = require('dotenv');
const path = require('path');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

app.use(cors({ origin: APP_URL, credentials: true }));
// Aumenta os limites do body para suportar screenshot base64
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

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

// === Schemas auxiliares para e-mail ===
const recipientSchema = new mongoose.Schema({
  alias: { type: String, required: true },
  emailEnc: { type: String, required: true }, // iv:cipher:tag (base64)
}, { timestamps: true });

const Recipient = mongoose.model('Recipient', recipientSchema);

const emailLogSchema = new mongoose.Schema({
  status: { type: String, enum: ['success', 'error'], required: true },
  to: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Recipient' }],
  cc: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Recipient' }],
  bcc: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Recipient' }],
  messageId: { type: String },
  error: { type: String },
}, { timestamps: true });

const EmailLog = mongoose.model('EmailLog', emailLogSchema);

// === Criptografia de e-mails (AES-256-GCM) ===
const RECIPIENTS_SECRET = process.env.RECIPIENTS_SECRET;
function getSecretKey() {
  const key = Buffer.from(RECIPIENTS_SECRET || '', 'base64');
  if (key.length !== 32) throw new Error('RECIPIENTS_SECRET deve ser base64 de 32 bytes');
  return key;
}

function encryptEmail(email) {
  const key = getSecretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(email, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

function decryptEmail(enc) {
  const [ivB64, encB64, tagB64] = (enc || '').split(':');
  if (!ivB64 || !encB64 || !tagB64) throw new Error('Formato inválido de e-mail criptografado');
  const key = getSecretKey();
  const iv = Buffer.from(ivB64, 'base64');
  const encrypted = Buffer.from(encB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

// === Nodemailer ===
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

transporter.verify()
  .then(() => console.log('📧 SMTP configurado corretamente'))
  .catch((err) => console.error('⚠️ Erro na configuração SMTP:', err?.message || err));

// === Autenticação ===
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios' });
  }
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    try {
      const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 60 * 60 * 1000 });
      return res.status(200).json({ success: true, message: 'Autenticado' });
    } catch {
      return res.status(500).json({ success: false, message: 'Falha ao autenticar' });
    }
  }
  return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
});

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ success: false, message: 'Não autenticado' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Sessão inválida' });
  }
}

// === Destinatários (somente id e alias ao frontend) ===
app.get('/api/email/recipients', requireAuth, async (req, res) => {
  try {
    const recs = await Recipient.find({}).select('alias');
    return res.status(200).json({ success: true, data: recs.map(r => ({ id: r._id.toString(), alias: r.alias })) });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro ao carregar destinatários' });
  }
});

app.post('/api/email/recipients', requireAuth, async (req, res) => {
  try {
    const { alias, email } = req.body || {};
    if (!alias || !email) return res.status(400).json({ success: false, message: 'Alias e e-mail são obrigatórios' });
    const emailEnc = encryptEmail(email);
    const rec = await Recipient.create({ alias, emailEnc });
    return res.status(201).json({ success: true, data: { id: rec._id.toString(), alias: rec.alias } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Erro ao adicionar destinatário' });
  }
});

function buildReportHtml(items, hasScreenshot) {
  const rows = (Array.isArray(items) ? items : []).map(item => `
    <tr>
      <td style="border:1px solid #e5e7eb;padding:8px;color:#1f2937">${item.Codigo ?? ''}</td>
      <td style="border:1px solid #e5e7eb;padding:8px;color:#1f2937">${item.Material ?? ''}</td>
      <td style="border:1px solid #e5e7eb;padding:8px;color:#1f2937">${item.Plano ?? ''}</td>
      <td style="border:1px solid #e5e7eb;padding:8px;color:#1f2937">${item.Toneladas ?? ''}</td>
      <td style="border:1px solid #e5e7eb;padding:8px;color:#1f2937">${item.AProduzir ?? ''}</td>
      <td style="border:1px solid #e5e7eb;padding:8px;color:#1f2937">${item.Kpis ?? ''}</td>
      <td style="border:1px solid #e5e7eb;padding:8px;color:#1f2937">${item.Progresso ?? ''}</td>
      <td style="border:1px solid #e5e7eb;padding:8px;color:#1f2937">${item.TempoEst ?? ''}</td>
    </tr>
  `).join('');

  const screenshotBlock = hasScreenshot ? `
    <div style="margin-top:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb">
      <h3 style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,'Noto Sans',sans-serif;font-size:16px;color:#1f2937;margin:0 0 8px 0">Captura da tela atual</h3>
      <img src="cid:sigp-screenshot" alt="Tela SIGP" style="max-width:100%;border-radius:6px;border:1px solid #e5e7eb" />
    </div>
  ` : '';

  const tableBlock = hasScreenshot ? '' : `
    <div style="margin-top:16px">
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead>
          <tr style="background:#1f2937;color:#ffffff">
            <th style="border:1px solid #4b5563;padding:8px;text-align:left">Código</th>
            <th style="border:1px solid #4b5563;padding:8px;text-align:left">Material</th>
            <th style="border:1px solid #4b5563;padding:8px;text-align:left">Plano de Produção</th>
            <th style="border:1px solid #4b5563;padding:8px;text-align:left">Toneladas</th>
            <th style="border:1px solid #4b5563;padding:8px;text-align:left">A Produzir</th>
            <th style="border:1px solid #4b5563;padding:8px;text-align:left">KPIs</th>
            <th style="border:1px solid #4b5563;padding:8px;text-align:left">Progresso</th>
            <th style="border:1px solid #4b5563;padding:8px;text-align:left">Tempo Est.</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,'Noto Sans',sans-serif;background:#ffffff;color:#111827">
    <h2 style="font-size:20px;margin:0;color:#111827">📊 Relatório de Produção – SIGP</h2>
    <p style="margin:12px 0;color:#374151">Segue o relatório de produção com a captura da tela${hasScreenshot ? '' : ' e a tabela consolidada'}.</p>
    ${screenshotBlock}
    ${tableBlock}
  </div>`;
}

app.post('/api/email/send', requireAuth, async (req, res) => {
  try {
    const { toIds = [], ccIds = [], bccIds = [], screenshotBase64, tableData = [] } = req.body || {};
    if (!Array.isArray(toIds) || toIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Informe ao menos um destinatário' });
    }

    const [toRecs, ccRecs, bccRecs] = await Promise.all([
      Recipient.find({ _id: { $in: toIds } }),
      Recipient.find({ _id: { $in: ccIds } }),
      Recipient.find({ _id: { $in: bccIds } }),
    ]);

    const toEmails = toRecs.map(r => decryptEmail(r.emailEnc));
    const ccEmails = ccRecs.map(r => decryptEmail(r.emailEnc));
    const bccEmails = bccRecs.map(r => decryptEmail(r.emailEnc));

    const html = buildReportHtml(tableData, Boolean(screenshotBase64));

    const attachments = [];
    if (screenshotBase64 && typeof screenshotBase64 === 'string') {
      const base64 = screenshotBase64.includes(',') ? screenshotBase64.split(',').pop() : screenshotBase64;
      const isJpeg = screenshotBase64.startsWith('data:image/jpeg');
      const filename = isJpeg ? 'relatorio-sigp.jpg' : 'relatorio-sigp.png';
      const contentType = isJpeg ? 'image/jpeg' : 'image/png';
      attachments.push({ filename, content: base64, encoding: 'base64', cid: 'sigp-screenshot', contentType });
    }

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: toEmails,
      cc: ccEmails.length ? ccEmails : undefined,
      bcc: bccEmails.length ? bccEmails : undefined,
      subject: '📊 Relatório de Produção – SIGP',
      html,
      attachments,
    });

    await EmailLog.create({ status: 'success', to: toIds, cc: ccIds, bcc: bccIds, messageId: info.messageId });
    return res.status(200).json({ success: true, message: 'Relatório enviado com sucesso' });
  } catch (err) {
    console.error('❌ Erro no envio de e-mail:', err);
    try {
      const { toIds = [], ccIds = [], bccIds = [] } = req.body || {};
      await EmailLog.create({ status: 'error', to: toIds, cc: ccIds, bcc: bccIds, error: err?.message || 'Erro desconhecido' });
    } catch (_) {}
    return res.status(500).json({ success: false, message: 'Falha ao enviar o relatório. Tente novamente mais tarde.' });
  }
});

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
