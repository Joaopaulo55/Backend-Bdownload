// server.js - Y2Mate Backend com Streaming Direto e Múltiplas Plataformas (Versão Aprimorada)

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const sanitize = require('sanitize-filename');
const validator = require('validator');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');
const TEMP_DIR = path.join(__dirname, 'temp');
const LOG_FILE = path.join(__dirname, 'server.log');

// Configuração de logs
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Garante que o diretório temporário existe
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Middlewares avançados
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: logStream }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: 'Muitas requisições deste IP, tente novamente mais tarde.',
  skip: (req) => req.ip === '127.0.0.1' // Ignora localhost
}));

// Validação de URL aprimorada
function validarURL(url) {
  if (!validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true
  })) {
    return false;
  }

  // Lista de domínios suportados
  const dominiosPermitidos = [
    'youtube.com',
    'youtu.be',
    'vimeo.com',
    'dailymotion.com',
    'facebook.com',
    'instagram.com',
    'twitter.com'
  ];

  try {
    const urlObj = new URL(url);
    return dominiosPermitidos.some(dominio => urlObj.hostname.includes(dominio));
  } catch (_) {
    return false;
  }
}

// Verificação de cookies com cache
let cookiesCache = { validos: false, mensagem: 'Não verificado ainda', timestamp: 0 };

async function verificarCookies() {
  const now = Date.now();
  // Cache de 1 hora
  if (now - cookiesCache.timestamp < 3600000) {
    return cookiesCache;
  }

  return new Promise((resolve) => {
    const testeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const comando = `yt-dlp -g --cookies ${COOKIES_PATH} "${testeUrl}"`;
    
    exec(comando, { timeout: 30000 }, (err, stdout, stderr) => {
      const resultado = {
        validos: !(err || !stdout || stderr.includes('ERROR')),
        mensagem: err || stderr.includes('ERROR') ? 'Cookies inválidos ou expirados.' : 'Cookies válidos.',
        timestamp: now
      };
      
      cookiesCache = resultado;
      resolve(resultado);
    });
  });
}

// User-Agent aleatório para evitar bloqueios
function getUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

// Limpeza de arquivos temporários
function limparTemporarios() {
  fs.readdir(TEMP_DIR, (err, files) => {
    if (err) return;
    
    const agora = Date.now();
    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      // Remove arquivos com mais de 1 hora
      if (agora - stats.mtimeMs > 3600000) {
        fs.unlinkSync(filePath);
      }
    });
  });
}

// Agendando limpeza a cada hora
setInterval(limparTemporarios, 3600000);

// Rotas
app.get('/', (_, res) => {
  res.json({
    status: 'online',
    version: '2.0.0',
    endpoints: [
      { path: '/cookie-status', method: 'GET', description: 'Verifica status dos cookies' },
      { path: '/formats', method: 'POST', description: 'Lista formatos disponíveis' },
      { path: '/download', method: 'POST', description: 'Gera link de download' },
      { path: '/stream', method: 'GET', description: 'Streaming direto' }
    ]
  });
});

app.get('/cookie-status', async (_, res) => {
  try {
    const status = await verificarCookies();
    res.json(status);
  } catch (error) {
    res.status(500).json({ 
      sucesso: false, 
      erro: 'Erro ao verificar cookies',
      detalhes: error.message 
    });
  }
});

app.post('/formats', async (req, res) => {
  try {
    const url = req.body.url;
    if (!validarURL(url)) {
      return res.status(400).json({ 
        sucesso: false, 
        erro: 'URL inválida ou não suportada.' 
      });
    }

    const cookiesStatus = await verificarCookies();
    const comando = `yt-dlp -J --no-playlist ${cookiesStatus.validos ? `--cookies ${COOKIES_PATH}` : ''} --user-agent "${getUserAgent()}" "${url}"`;

    exec(comando, { maxBuffer: 1024 * 1024 * 10, timeout: 30000 }, (err, stdout, stderr) => {
      if (err || !stdout) {
        console.error(`Erro ao obter formatos: ${stderr || err.message}`);
        return res.status(500).json({ 
          sucesso: false, 
          erro: 'Erro ao obter formatos.', 
          detalhes: stderr || err.message 
        });
      }

      try {
        const data = JSON.parse(stdout);
        const formats = (data.formats || [])
          .filter(f => f.filesize && f.filesize > 0) // Filtra formatos inválidos
          .map(f => ({
            id: f.format_id,
            ext: f.ext,
            resolucao: f.resolution || `${f.height || '?'}p`,
            tamanho: f.filesize,
            tipo: f.vcodec === 'none' ? 'audio' : (f.acodec === 'none' ? 'video' : 'completo'),
            bitrate: f.tbr || null,
            codec: {
              video: f.vcodec,
              audio: f.acodec
            }
          }))
          .sort((a, b) => {
            // Ordena por qualidade/resolução
            const aRes = parseInt(a.resolucao) || 0;
            const bRes = parseInt(b.resolucao) || 0;
            return bRes - aRes;
          });

        res.json({ 
          sucesso: true, 
          title: data.title, 
          duration: data.duration, 
          thumbnail: data.thumbnail, 
          formats, 
          cookies: cookiesStatus 
        });
      } catch (e) {
        console.error(`Erro ao parsear formatos: ${e.message}`);
        res.status(500).json({ 
          sucesso: false, 
          erro: 'Erro ao interpretar formatos.', 
          detalhes: e.message 
        });
      }
    });
  } catch (error) {
    res.status(500).json({ 
      sucesso: false, 
      erro: 'Erro interno no servidor',
      detalhes: error.message 
    });
  }
});

app.post('/download', async (req, res) => {
  try {
    const { url, format } = req.body;
    if (!validarURL(url) || !format) {
      return res.status(400).json({ 
        sucesso: false, 
        erro: 'Parâmetros inválidos.' 
      });
    }

    const cookiesStatus = await verificarCookies();
    const comando = `yt-dlp -f ${format} -g --no-playlist ${cookiesStatus.validos ? `--cookies ${COOKIES_PATH}` : ''} --user-agent "${getUserAgent()}" "${url}"`;

    exec(comando, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err || !stdout) {
        console.error(`Erro ao gerar link: ${stderr || err.message}`);
        return res.status(500).json({ 
          sucesso: false, 
          erro: 'Erro ao gerar link.', 
          detalhes: stderr || err.message 
        });
      }
      
      const links = stdout.trim().split('\n');
      const videoLink = links.find(link => link.includes('googlevideo.com')) || links[0];
      
      res.json({ 
        sucesso: true, 
        link: videoLink, 
        cookies: cookiesStatus,
        expires: new Date(Date.now() + 6 * 3600000).toISOString() // 6 horas de validade
      });
    });
  } catch (error) {
    res.status(500).json({ 
      sucesso: false, 
      erro: 'Erro interno no servidor',
      detalhes: error.message 
    });
  }
});

// Streaming aprimorado com suporte a range requests
app.get('/stream', async (req, res) => {
  try {
    const { url, format } = req.query;
    if (!validarURL(url) || !format) {
      return res.status(400).send('Parâmetros inválidos');
    }

    const cookiesStatus = await verificarCookies();
    const comando = `yt-dlp -f ${format} -g --no-playlist ${cookiesStatus.validos ? `--cookies ${COOKIES_PATH}` : ''} --user-agent "${getUserAgent()}" "${url}"`;

    exec(comando, { timeout: 30000 }, async (err, stdout, stderr) => {
      if (err || !stdout) {
        console.error(`Erro ao obter link de stream: ${stderr || err.message}`);
        return res.status(500).send('Erro ao obter link do stream');
      }

      const videoURL = stdout.trim().split('\n').pop();
      const requestId = uuidv4();
      const filename = `stream_${requestId}.${format.split('+')[0]}`;

      try {
        const headers = { 
          'User-Agent': getUserAgent(),
          'Range': req.headers.range || 'bytes=0-' // Suporte a range requests
        };

        const resposta = await axios.get(videoURL, {
          responseType: 'stream',
          headers: headers,
          timeout: 30000
        });

        // Configura headers para streaming
        res.setHeader('Content-Type', resposta.headers['content-type'] || 'video/mp4');
        res.setHeader('Content-Length', resposta.headers['content-length']);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache');
        
        if (resposta.headers['content-disposition']) {
          res.setHeader('Content-Disposition', resposta.headers['content-disposition']);
        } else {
          res.setHeader('Content-Disposition', `inline; filename="${sanitize(filename)}"`);
        }

        // Pipe com tratamento de erros
        resposta.data.on('error', (err) => {
          console.error(`Erro no stream ${requestId}: ${err.message}`);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });

        resposta.data.pipe(res);
      } catch (streamErr) {
        console.error(`Erro no streaming ${requestId}: ${streamErr.message}`);
        res.status(500).send('Erro ao fazer streaming do vídeo');
      }
    });
  } catch (error) {
    console.error(`Erro no endpoint /stream: ${error.message}`);
    res.status(500).send('Erro interno no servidor');
  }
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    sucesso: false, 
    erro: 'Erro interno no servidor',
    detalhes: process.env.NODE_ENV === 'development' ? err.message : null
  });
});

// Inicialização segura do servidor
const server = app.listen(PORT, () => {
  console.log(`Servidor ativo: http://localhost:${PORT}`);
  console.log(`Logs sendo salvos em: ${LOG_FILE}`);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (err) => {
  console.error('Erro não capturado:', err);
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] UNCAUGHT EXCEPTION: ${err.stack}\n`);
  // Encerra o processo apenas se não estiver em produção
  if (process.env.NODE_ENV !== 'production') process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Rejeição não tratada em:', promise, 'motivo:', reason);
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] UNHANDLED REJECTION: ${reason}\n`);
});

// Encerramento gracioso
process.on('SIGTERM', () => {
  console.log('Recebido SIGTERM. Encerrando servidor...');
  server.close(() => {
    console.log('Servidor encerrado.');
    process.exit(0);
  });
});