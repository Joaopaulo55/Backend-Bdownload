// server.js - Y2Mate Backend com Streaming Direto e Múltiplas Plataformas

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 150 }));

function validarURL(url) {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

async function verificarCookies() {
  return new Promise((resolve) => {
    const testeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const comando = `yt-dlp -g --cookies ${COOKIES_PATH} "${testeUrl}"`;
    exec(comando, (err, stdout, stderr) => {
      if (err || !stdout || stderr.includes('ERROR')) {
        return resolve({ validos: false, mensagem: 'Cookies inválidos ou expirados.' });
      }
      resolve({ validos: true, mensagem: 'Cookies válidos.' });
    });
  });
}

function getUserAgent() {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114 Safari/537.36';
}

app.get('/', (_, res) => {
  res.send('✅ API de download com streaming está online!');
});

app.get('/cookie-status', async (_, res) => {
  const status = await verificarCookies();
  res.json(status);
});

app.post('/formats', async (req, res) => {
  const url = req.body.url;
  if (!validarURL(url)) return res.status(400).json({ sucesso: false, erro: 'URL inválida.' });

  const cookiesStatus = await verificarCookies();
  const comando = `yt-dlp -J --no-playlist ${cookiesStatus.validos ? `--cookies ${COOKIES_PATH}` : ''} --user-agent "${getUserAgent()}" "${url}"`;

  exec(comando, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
    if (err || !stdout) {
      return res.status(500).json({ sucesso: false, erro: 'Erro ao obter formatos.', detalhes: stderr || err.message });
    }

    try {
      const data = JSON.parse(stdout);
      const formats = (data.formats || []).map(f => ({
        id: f.format_id,
        ext: f.ext,
        resolucao: f.resolution || `${f.height || '?'}p`,
        tamanho: f.filesize,
        tipo: f.vcodec === 'none' ? 'audio' : (f.acodec === 'none' ? 'video' : 'completo'),
      }));

      res.json({ sucesso: true, title: data.title, duration: data.duration, thumbnail: data.thumbnail, formats, cookies: cookiesStatus });
    } catch (e) {
      res.status(500).json({ sucesso: false, erro: 'Erro ao interpretar formatos.', detalhes: e.message });
    }
  });
});

app.post('/download', async (req, res) => {
  const { url, format } = req.body;
  if (!validarURL(url) || !format) return res.status(400).json({ sucesso: false, erro: 'Parâmetros inválidos.' });

  const cookiesStatus = await verificarCookies();
  const comando = `yt-dlp -f ${format} -g --no-playlist ${cookiesStatus.validos ? `--cookies ${COOKIES_PATH}` : ''} --user-agent "${getUserAgent()}" "${url}"`;

  exec(comando, (err, stdout, stderr) => {
    if (err || !stdout) {
      return res.status(500).json({ sucesso: false, erro: 'Erro ao gerar link.', detalhes: stderr || err.message });
    }
    const link = stdout.trim().split('\n').pop();
    res.json({ sucesso: true, link, cookies: cookiesStatus });
  });
});

// 🎥 Streaming Direto
app.get('/stream', async (req, res) => {
  const url = req.query.url;
  const format = req.query.format;
  if (!validarURL(url) || !format) return res.status(400).send('Parâmetros inválidos');

  const cookiesStatus = await verificarCookies();
  const comando = `yt-dlp -f ${format} -g --no-playlist ${cookiesStatus.validos ? `--cookies ${COOKIES_PATH}` : ''} --user-agent "${getUserAgent()}" "${url}"`;

  exec(comando, async (err, stdout, stderr) => {
    if (err || !stdout) {
      return res.status(500).send('Erro ao obter link do stream');
    }

    const videoURL = stdout.trim().split('\n').pop();

    try {
      const resposta = await axios.get(videoURL, {
        responseType: 'stream',
        headers: { 'User-Agent': getUserAgent() }
      });

      res.setHeader('Content-Type', resposta.headers['content-type'] || 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
      resposta.data.pipe(res);
    } catch (streamErr) {
      console.error('Erro no streaming:', streamErr.message);
      res.status(500).send('Erro ao fazer streaming do vídeo');
    }
  });
});

app.listen(PORT, () => console.log(`Servidor ativo: http://localhost:${PORT}`));
