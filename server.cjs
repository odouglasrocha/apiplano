const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const dotenv = require('dotenv');
const path = require('path');
const nodemailer = require('nodemailer');
const https = require('https');
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

// Conexão secundária para a base "test" onde ficará a coleção "intermediario"
// Mantemos isolado para não impactar o restante das coleções existentes.
// Usar a mesma URI do MONGO_URI para a conexão intermediária, conforme solicitado
const MONGO_URI_INTERMEDIARIO = process.env.MONGO_URI;
let intermConn;
try {
  intermConn = mongoose.createConnection(MONGO_URI_INTERMEDIARIO, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  intermConn.on('connected', () => console.log('✅ Conexão secundária ativa para coleção "intermediario" (mesma URI que MONGO_URI)'));
  intermConn.on('error', (err) => console.error('❌ Erro na conexão secundária (test):', err?.message || err));
} catch (e) {
  console.error('⚠️ Falha ao iniciar conexão secundária para test:', e?.message || e);
}

// Schema do MongoDB
const producaoSchema = new mongoose.Schema({
  CodMaterialProducao: { type: Number, required: true, index: true },
  MaterialProducao: { type: String, required: true },
  PlanoCaixasFardos: { type: Number, required: true },
  Tons: { type: Number, required: true },
  BolsasProduzido: { type: Number, default: 0 }
}, { timestamps: true });

const Producao = mongoose.model('Producao', producaoSchema);

// === Schema para Estoque Intermediário (coleção: test.intermediario) ===
const intermediarioSchema = new mongoose.Schema({
  aromaKey: { type: String, required: true, index: true }, // ex.: 'BACON', 'CEBOLA', etc.
  qtdPacotes: { type: Number, required: true, min: 0 },
}, { timestamps: true, collection: 'intermediario' });

// O modelo é registrado na conexão secundária (base test)
const Intermediario = intermConn ? intermConn.model('Intermediario', intermediarioSchema) : null;

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

// === Intermediário Aroma: API para auto-salvamento de Quant. Pacote ===
// GET: retorna todas as quantidades salvas por aroma
app.get('/api/intermediario', async (req, res) => {
  try {
    if (!Intermediario) return res.status(500).json({ success: false, message: 'Modelo não inicializado' });
    const docs = await Intermediario.find({}).lean();
    return res.status(200).json({ success: true, data: docs });
  } catch (e) {
    return res.status(500).json({ success: false, message: e?.message || 'Erro ao carregar intermediário' });
  }
});

// PUT: upsert por aromaKey para substituir sempre o valor anterior
app.put('/api/intermediario/:aromaKey', async (req, res) => {
  try {
    if (!Intermediario) return res.status(500).json({ success: false, message: 'Modelo não inicializado' });
    const aromaKey = (req.params?.aromaKey || '').toUpperCase().trim();
    const rawVal = req.body?.qtdPacotes ?? req.body?.value;
    const qtdPacotes = Number(rawVal);

    if (!aromaKey) return res.status(400).json({ success: false, message: 'aromaKey é obrigatório' });
    if (!Number.isFinite(qtdPacotes) || qtdPacotes < 0) {
      return res.status(400).json({ success: false, message: 'qtdPacotes deve ser um número >= 0' });
    }

    const doc = await Intermediario.findOneAndUpdate(
      { aromaKey },
      { aromaKey, qtdPacotes },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return res.status(200).json({ success: true, data: doc });
  } catch (e) {
    return res.status(500).json({ success: false, message: e?.message || 'Erro ao salvar intermediário' });
  }
});

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

function buildReportHtml(items, hasScreenshot, summaryHtml, dateTimeStr) {
  // Tabela removida do corpo do e-mail conforme solicitado.

  const screenshotBlock = hasScreenshot ? `
    <div style="margin-top:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb">
      <h3 style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,'Noto Sans',sans-serif;font-size:16px;color:#1f2937;margin:0 0 8px 0">Captura da tela atual</h3>
      <img src="cid:sigp-screenshot" alt="Tela SIGP" style="max-width:100%;border-radius:6px;border:1px solid #e5e7eb" />
    </div>
  ` : '';

  const tableBlock = '';

  const summaryBlock = summaryHtml ? `
    <div style="margin:16px 0;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb">
      <h3 style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,'Noto Sans',sans-serif;font-size:16px;color:#1f2937;margin:0 0 8px 0">Resumo consolidado do plano</h3>
      <div style="font-size:14px;color:#374151">${summaryHtml}</div>
    </div>
  ` : '';

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,'Noto Sans',sans-serif;background:#ffffff;color:#111827">
    <h2 style="font-size:20px;margin:0;color:#111827">📊 Relatório de Produção – Embalagem Torcida</h2>
    <p style="margin:12px 0;color:#374151">Segue o relatório de produção e data e horário do dia: ${dateTimeStr}.${hasScreenshot ? ' A captura da tela foi anexada abaixo.' : ''}</p>
    ${summaryBlock}
    ${screenshotBlock}
    ${tableBlock}
    <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px">
      Sistema: <a href="${process.env.SYSTEM_URL || 'https://planing-ita.com/'}" style="color:#2563eb;text-decoration:none">${process.env.SYSTEM_URL || 'https://planing-ita.com/'}</a>
    </div>
  </div>`;
}

// === Teams Webhook Integration ===
function htmlToPlainText(html) {
  if (!html || typeof html !== 'string') return '';
  try {
    return html
      .replace(/<br\s*\/?>(?=\s)/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n')
      .replace(/<h\d\b[^>]*>/gi, '**')
      .replace(/<\/h\d>/gi, '**\n')
      .replace(/<strong\b[^>]*>/gi, '**')
      .replace(/<\/strong>/gi, '**')
      .replace(/<em\b[^>]*>/gi, '*')
      .replace(/<\/em>/gi, '*')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+\n/g, '\n')
      .trim();
  } catch (_) {
    return html;
  }
}

function htmlToTeamsConnectorText(html) {
  const plain = htmlToPlainText(html);
  // Converter para markdown que o Teams reconhece (listas com "- ") e reforçar quebras de linha
  let md = plain
    .replace(/(Itens TORCIDA somados no plano:)\s*/i, '$1\n')
    // Cada ocorrência de bullet vira início de linha com "- "
    .replace(/\s*•\s/g, '\n- ')
    // Garantir que a linha de resumo fique separada
    .replace(/\sResumo:/, '\n\nResumo:')
    // Normalizar múltiplas quebras
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return md;
}

async function sendTeamsMessage(summaryHtml, dateTimeStr) {
  const webhook = process.env.TEAMS_WEBHOOK_URL;
  if (!webhook) {
    return { ok: false, reason: 'TEAMS_WEBHOOK_URL não configurado' };
  }

  const title = '📊 Relatório de Produção – Embalagem Torcida';
  const intro = `Segue o relatório de produção e data e horário do dia: ${dateTimeStr}.`;
  const sectionTitle = 'Resumo consolidado do plano';
  const connectorText = htmlToTeamsConnectorText(summaryHtml || '');
  const systemUrl = process.env.SYSTEM_URL || 'https://planing-ita.com/';
  // Payload no formato Office 365 Connector Card (suportado por Incoming Webhook do Teams)
  const payload = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: title,
    title,
    themeColor: '0078D7',
    sections: [
      { text: intro, markdown: true },
      { title: sectionTitle, text: connectorText, markdown: true },
      { text: `Sistema: ${systemUrl}`, markdown: true }
    ],
    potentialAction: [
      {
        '@type': 'OpenUri',
        name: 'Abrir sistema',
        targets: [{ os: 'default', uri: systemUrl }]
      }
    ]
  };

  // Preferir fetch se disponível (Node >=18), caso contrário usar https
  if (typeof fetch === 'function') {
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Teams webhook falhou: ${resp.status} ${resp.statusText} ${body}`);
    }
    return { ok: true };
  }

  // Fallback com https
  const url = new URL(webhook);
  const data = JSON.stringify(payload);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
  };

  await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve();
        reject(new Error(`Teams webhook falhou: ${res.statusCode} ${body}`));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  return { ok: true };
}

app.post('/api/email/send', async (req, res) => {
  try {
    const { toIds = [], ccIds = [], bccIds = [], toEmails = [], ccEmails = [], bccEmails = [], screenshotBase64, tableData = [], summaryHtml, sendToTeams } = req.body || {};

    // Se e-mails diretos foram fornecidos, usa-os. Caso contrário, tenta resolver pelos IDs cadastrados.
    let finalTo = Array.isArray(toEmails) ? toEmails.filter(e => typeof e === 'string') : [];
    let finalCc = Array.isArray(ccEmails) ? ccEmails.filter(e => typeof e === 'string') : [];
    let finalBcc = Array.isArray(bccEmails) ? bccEmails.filter(e => typeof e === 'string') : [];

    if ((!finalTo || finalTo.length === 0) && Array.isArray(toIds) && toIds.length) {
      const [toRecs, ccRecs, bccRecs] = await Promise.all([
        Recipient.find({ _id: { $in: toIds } }),
        Recipient.find({ _id: { $in: ccIds } }),
        Recipient.find({ _id: { $in: bccIds } }),
      ]);
      finalTo = toRecs.map(r => decryptEmail(r.emailEnc));
      finalCc = ccRecs.map(r => decryptEmail(r.emailEnc));
      finalBcc = bccRecs.map(r => decryptEmail(r.emailEnc));
    }

    if (!finalTo || finalTo.length === 0) {
      return res.status(400).json({ success: false, message: 'Informe ao menos um destinatário (Para)' });
    }

    const nowStr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
    const html = buildReportHtml(tableData, Boolean(screenshotBase64), summaryHtml, nowStr);

    const attachments = [];
    if (screenshotBase64 && typeof screenshotBase64 === 'string') {
      const base64 = screenshotBase64.includes(',') ? screenshotBase64.split(',').pop() : screenshotBase64;
      const isJpeg = screenshotBase64.startsWith('data:image/jpeg');
      const filename = isJpeg ? 'relatorio-embalagem-torcida.jpg' : 'relatorio-embalagem-torcida.png';
      const contentType = isJpeg ? 'image/jpeg' : 'image/png';
      attachments.push({ filename, content: base64, encoding: 'base64', cid: 'sigp-screenshot', contentType });
    }

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: finalTo,
      cc: finalCc && finalCc.length ? finalCc : undefined,
      bcc: finalBcc && finalBcc.length ? finalBcc : undefined,
      subject: '📊 Relatório de Produção – Embalagem Torcida',
      html,
      attachments,
    });

    // Tenta enviar também para o Teams (canal via Webhook), caso configurado ou solicitado
    let teamsStatus = 'skipped';
    if (process.env.TEAMS_WEBHOOK_URL && (sendToTeams === true || sendToTeams === undefined)) {
      try {
        await sendTeamsMessage(summaryHtml, nowStr);
        teamsStatus = 'success';
      } catch (e) {
        teamsStatus = 'error';
        console.error('⚠️ Erro ao publicar no Teams:', e?.message || e);
      }
    }

    await EmailLog.create({ status: 'success', to: Array.isArray(toIds) ? toIds : [], cc: Array.isArray(ccIds) ? ccIds : [], bcc: Array.isArray(bccIds) ? bccIds : [], messageId: info.messageId });
    return res.status(200).json({ success: true, message: 'Relatório enviado com sucesso', teamsStatus });
  } catch (err) {
    console.error('❌ Erro no envio de e-mail:', err);
    try {
      const { toIds = [], ccIds = [], bccIds = [] } = req.body || {};
      await EmailLog.create({ status: 'error', to: Array.isArray(toIds) ? toIds : [], cc: Array.isArray(ccIds) ? ccIds : [], bcc: Array.isArray(bccIds) ? bccIds : [], error: err?.message || 'Erro desconhecido' });
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
