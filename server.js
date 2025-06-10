// ================================
// BACKEND - server.js (Refatorado)
// ================================
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');
const LOG_FILE = path.join(__dirname, 'logs.txt');
const JPAINEL_ENDPOINT = 'https://jpainel-backend.onrender.com/api/logs';

app.use(cors());
app.use(express.json());

let logs = [];

function registrarLog(tipo, mensagem, extra = '', ip = '') {
  const timestamp = new Date().toISOString();
  const logEntry = { tipo, mensagem, extra, timestamp, ip };
  logs.push(logEntry);
  if (logs.length > 500) logs.shift();

  const entry = `[${timestamp}] [${tipo}] IP:${ip} ${mensagem}${extra ? ' - ' + extra : ''}\n`;
  fs.appendFile(LOG_FILE, entry, err => {
    if (err) console.error('Erro ao escrever log:', err);
  });

  axios.post(JPAINEL_ENDPOINT, logEntry).catch(() => {});
}

function spoofHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Referer': 'https://www.google.com'
  };
}

function validarCookies() {
  if (!fs.existsSync(COOKIES_PATH)) return false;
  const content = fs.readFileSync(COOKIES_PATH, 'utf-8');
  return content.includes('youtube.com') && content.includes('SID');
}

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  req.clientIp = ip;
  registrarLog('INFO', `[${req.method}] ${req.path}`, '', ip);
  next();
});

app.post('/formats', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL não fornecida' });

  const cookiesValidos = validarCookies();
  const cookiesParam = cookiesValidos ? `--cookies "${COOKIES_PATH}"` : '';

  const comandos = [
    `yt-dlp -J --no-playlist ${cookiesParam} --user-agent \"${spoofHeaders()['User-Agent']}\" \"${url}\"`,
    `youtube-dl -J --no-playlist ${cookiesParam} -U -f best \"${url}\"`
  ];

  let output;
  for (let comando of comandos) {
    try {
      output = await new Promise((resolve, reject) => {
        exec(comando, (err, stdout, stderr) => {
          if (err) return reject(stderr);
          resolve(stdout);
        });
      });
      break;
    } catch (erroExecucao) {
      registrarLog('ERRO', 'Falha em um dos métodos', erroExecucao, req.clientIp);
    }
  }

  if (!output) {
    registrarLog('ERRO', 'Todos os métodos falharam', '', req.clientIp);
    return res.status(500).json({ error: 'Falha ao obter informações do vídeo' });
  }

  try {
    const data = JSON.parse(output);
    const formats = (data.formats || []).map(f => ({
      id: f.format_id,
      resolution: f.resolution || `${f.height || 'audio'}p`,
      ext: f.ext,
      acodec: f.acodec,
      vcodec: f.vcodec
    })).filter(f => f.id);

    res.json({
      title: data.title,
      thumbnail: data.thumbnail,
      duration: data.duration,
      formats,
      cookies: cookiesValidos ? 'válidos' : 'inválidos'
    });
  } catch (err) {
    registrarLog('ERRO', 'Erro ao processar JSON', err.message, req.clientIp);
    res.status(500).json({ error: 'Erro ao processar resposta' });
  }
});

app.post('/download', (req, res) => {
  const { url, format } = req.body;
  const cookiesValidos = validarCookies();
  const cookiesParam = cookiesValidos ? `--cookies \"${COOKIES_PATH}\"` : '';
  const comando = `yt-dlp -f ${format} -g --no-playlist ${cookiesParam} --user-agent \"${spoofHeaders()['User-Agent']}\" \"${url}\"`;

  exec(comando, (err, stdout, stderr) => {
    if (err) {
      registrarLog('ERRO', 'Falha ao gerar link de download', stderr, req.clientIp);
      return res.status(500).json({ error: 'Erro ao gerar download', stderr });
    }
    const link = stdout.trim().split('\n').pop();
    if (!link) return res.status(500).json({ error: 'Link não encontrado' });
    registrarLog('SUCESSO', 'Link de download pronto', link, req.clientIp);
    res.json({ downloadUrl: link });
  });
});

app.get('/health', (req, res) => {
  const comando = `yt-dlp --version`;
  const start = Date.now();
  exec(comando, (err, stdout, stderr) => {
    const tempo = Date.now() - start;
    if (err) return res.status(500).json({ status: 'Erro', stderr });
    res.json({ status: 'ok', yt_dlp_version: stdout.trim(), responseTime: tempo + 'ms' });
  });
});

app.get('/logs/json', (req, res) => {
  res.json({ count: logs.length, logs });
});

app.listen(PORT, () => {
  registrarLog('INICIO', `Servidor online na porta ${PORT}`);
  console.log(`Servidor ativo na porta ${PORT}`);
});
