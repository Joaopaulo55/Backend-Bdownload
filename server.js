// ================================
// BACKEND - server.js (Node.js + Express + yt-dlp)
// ================================
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do cookies.txt
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');

app.use(cors({ origin: ['https://joaopaulo55.github.io'] }));
app.use(express.json());

// Obtem formatos do vídeo (com cookies)
app.post('/formats', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL não fornecida' });

  exec(`yt-dlp --cookies ${COOKIES_PATH} -J --no-playlist "${url}"`, (err, stdout) => {
    if (err) return res.status(500).json({ error: 'Erro ao obter informações do vídeo' });
    try {
      const data = JSON.parse(stdout);
      const formats = data.formats
        .filter(f => f.format_id && (f.ext === 'mp4' || f.ext === 'webm' || f.ext === 'm4a'))
        .map(f => ({
          id: f.format_id,
          resolution: f.resolution || `${f.height || 'audio'}p`,
          ext: f.ext,
          acodec: f.acodec,
          vcodec: f.vcodec
        }));

      if (!formats.length) return res.json({
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        message: 'Nenhum formato disponível para download'
      });

      res.json({
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        formats
      });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao processar resposta do yt-dlp' });
    }
  });
});

// Gera link de download (com cookies)
app.post('/download', (req, res) => {
  const { url, format } = req.body;
  if (!url || !format) return res.status(400).json({ error: 'URL ou formato ausente' });

  exec(`yt-dlp --cookies ${COOKIES_PATH} -f ${format} -g --no-playlist "${url}"`, (err, stdout) => {
    if (err) return res.status(500).json({ error: 'Erro ao gerar link de download' });
    const directUrl = stdout.trim().split('\n').pop();
    if (!directUrl) return res.status(500).json({ error: 'Link não encontrado' });
    res.json({ downloadUrl: directUrl });
  });
});

// Health check (atualizado para verificar cookies)
app.get('/health', (req, res) => {
  exec(`yt-dlp --cookies ${COOKIES_PATH} --version`, (err) => {
    res.status(err ? 500 : 200).json({ status: err ? 'unhealthy' : 'healthy' });
  });
});

app.listen(PORT, () => console.log(`Servidor pronto na porta ${PORT}`));