// ================================
// BACKEND - server.js (Versão Corrigida)
// ================================
const express = require('express');
const cors = require('cors');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

// Verificação de ambiente
require('dotenv').config();
const chalk = require('chalk');

// Verificar todas as dependências no startup
function checkDependencies() {
  const requiredModules = [
    'express', 'cors', 'axios', 'ffmpeg-static', 
    'express-rate-limit', 'yt-dlp-exec'
  ];

  requiredModules.forEach(mod => {
    try {
      require.resolve(mod);
    } catch (err) {
      console.error(chalk.red.bold(`✗ Módulo ${mod} não encontrado`));
      process.exit(1);
    }
  });

  console.log(chalk.green.bold('✓ Todos os módulos Node.js estão disponíveis'));
}

checkDependencies();

const app = express();

const PORT = process.env.PORT || 3000;
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');
const LOG_FILE = path.join(__dirname, 'logs.txt');
const JPAINEL_ENDPOINT = 'https://jpainel-backend.onrender.com/api/logs';

// Configuração do rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite de 100 requisições por IP
});

// Configurações melhoradas de CORS
const corsOptions = {
  origin: ['https://joaopaulo55.github.io', 'https://joaopaulo55.github.io/Jpainel'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter); // Aplica rate limiting a todas as rotas

let logs = [];

// Funções auxiliares
function validarCookies() {
  try {
    if (!fs.existsSync(COOKIES_PATH)) return false;
    const content = fs.readFileSync(COOKIES_PATH, 'utf-8');
    return content.includes('youtube.com') && (content.includes('SID') || content.includes('LOGIN_INFO'));
  } catch (err) {
    registrarLog('ERRO', 'Falha ao validar cookies', err.message);
    return false;
  }
}

function spoofHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.google.com/'
  };
}

function registrarLog(tipo, mensagem, extra = '', ip = '') {
  const timestamp = new Date().toISOString();
  const logEntry = { tipo, mensagem, extra, timestamp, ip };
  
  if (logs.length >= 1000) logs = logs.slice(-900);
  logs.push(logEntry);

  const entry = `[${timestamp}] [${tipo}] IP:${ip} ${mensagem}${extra ? ' - ' + extra : ''}\n`;
  
  try {
    const stats = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE) : { size: 0 };
    if (stats.size > 10 * 1024 * 1024) fs.renameSync(LOG_FILE, `${LOG_FILE}.old`);
    fs.appendFileSync(LOG_FILE, entry);
  } catch (err) {
    console.error('Erro ao escrever log:', err);
  }

  if (JPAINEL_ENDPOINT) {
    axios.post(JPAINEL_ENDPOINT, logEntry, { timeout: 3000 })
      .catch(err => console.error('Erro ao enviar log:', err.message));
  }
}

// Verificador de dependências
let dependenciasCache = null;
let ultimaVerificacao = 0;

function verificarDependencias() {
  const agora = Date.now();
  if (dependenciasCache && agora - ultimaVerificacao < 60000) return dependenciasCache;

  try {
    const dependencias = {
      node: process.version,
      ytdlp: execSync('yt-dlp --version').toString().trim(),
      ffmpeg: execSync('ffmpeg -version 2>&1 | head -n 1').toString().trim(),
      python: execSync('python3 --version 2>&1').toString().trim(),
      lastChecked: new Date().toISOString()
    };
    dependenciasCache = { status: 'OK', dependencias };
    ultimaVerificacao = agora;
    return dependenciasCache;
  } catch (error) {
    dependenciasCache = { status: 'ERRO', error: error.message };
    return dependenciasCache;
  }
}

// Middlewares
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  req.clientIp = ip;
  
  if (req.body.url && !req.body.url.match(/^https?:\/\/[^\s/$.?#].[^\s]*$/i)) {
    return res.status(400).json({ error: 'URL inválida' });
  }

  registrarLog('ACESSO', `[${req.method}] ${req.path}`, '', ip);
  
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  next();
});

// Rotas
app.get('/health', (req, res) => {
  const start = Date.now();
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    dependencias: verificarDependencias(),
    responseTime: `${Date.now() - start}ms`
  });
});

app.get('/deps', (req, res) => {
  res.json(verificarDependencias());
});

function validarURL(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

app.post('/formats', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !validarURL(url)) {
      return res.status(400).json({ error: 'URL inválida ou não fornecida' });
    }

    const cookiesValidos = validarCookies();
    const cookiesParam = cookiesValidos ? `--cookies "${COOKIES_PATH}"` : '';
    const userAgent = spoofHeaders()['User-Agent'];

    const comandos = [
      `yt-dlp -J --no-playlist ${cookiesParam} --user-agent "${userAgent}" "${url}"`,
      `youtube-dl -J --no-playlist ${cookiesParam} --user-agent "${userAgent}" "${url}"`
    ];

    let output;
    for (let comando of comandos) {
      try {
        output = await new Promise((resolve, reject) => {
          exec(comando, { timeout: 30000 }, (err, stdout, stderr) => {
            if (err) return reject(stderr || err.message);
            resolve(stdout);
          });
        });
        break;
      } catch (erroExecucao) {
        registrarLog('ERRO', 'Falha em um dos métodos', erroExecucao, req.clientIp);
      }
    }

    if (!output) {
      registrarLog('ERRO', 'Todos os métodos falharam', url, req.clientIp);
      return res.status(500).json({ error: 'Falha ao obter informações do vídeo' });
    }

    const data = JSON.parse(output);
    res.json({
      title: data.title,
      thumbnail: data.thumbnail,
      duration: data.duration,
      formats: (data.formats || []).map(f => ({
        id: f.format_id,
        resolution: f.resolution || `${f.height || 'audio'}p`,
        ext: f.ext,
        acodec: f.acodec,
        vcodec: f.vcodec,
        filesize: f.filesize
      })).filter(f => f.id),
      cookies: cookiesValidos ? 'válidos' : 'inválidos'
    });
  } catch (err) {
    registrarLog('ERRO', 'Erro em /formats', err.message, req.clientIp);
    res.status(500).json({ error: 'Erro ao processar requisição', details: err.message });
  }
});

app.post('/download', (req, res) => {
  try {
    const { url, format } = req.body;
    
    if (!url || !validarURL(url)) {  // CORREÇÃO: Parêntese faltando
      return res.status(400).json({ error: 'URL inválida ou não fornecida' });
    }

    if (!format || !format.match(/^[a-zA-Z0-9_\-]+$/)) {
      return res.status(400).json({ error: 'Formato inválido' });
    }

    const cookiesValidos = validarCookies();
    const cookiesParam = cookiesValidos ? `--cookies "${COOKIES_PATH}"` : '';
    const userAgent = spoofHeaders()['User-Agent'];
    const comando = `yt-dlp -f ${format} -g --no-playlist ${cookiesParam} --user-agent "${userAgent}" "${url}"`;

    exec(comando, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        registrarLog('ERRO', 'Falha ao gerar link', `${url} | ${format} | ${stderr}`, req.clientIp);
        return res.status(500).json({ error: 'Erro ao gerar download', details: stderr || err.message });
      }
      
      const links = stdout.trim().split('\n');
      const link = links[links.length - 1];
      
      if (!link || !validarURL(link)) {
        registrarLog('ERRO', 'Link de download inválido', stdout, req.clientIp);
        return res.status(500).json({ error: 'Link de download inválido' });
      }
      
      registrarLog('SUCESSO', 'Download gerado', `${url} | ${format}`, req.clientIp);
      res.json({ downloadUrl: link });
    });
  } catch (err) {
    registrarLog('ERRO', 'Erro em /download', err.message, req.clientIp);
    res.status(500).json({ error: 'Erro ao processar requisição', details: err.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  registrarLog('ERRO', 'Erro não tratado', err.stack, req.clientIp);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Inicialização
function iniciarServidor() {
  try {
    const deps = verificarDependencias();
    if (deps.status === 'ERRO') {
      console.error('Erro nas dependências:', deps.error);
      process.exit(1);
    }

    const server = app.listen(PORT, () => {
      registrarLog('INICIO', `Servidor online na porta ${PORT}`);
      console.log(`Servidor ativo na porta ${PORT}`);
    });

    const shutdown = (signal) => {
      registrarLog('SHUTDOWN', `Recebido ${signal} - Encerrando`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 5000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
  } catch (error) {
    registrarLog('CRITICO', 'Falha na inicialização', error.stack);
    process.exit(1);
  }
}

iniciarServidor();