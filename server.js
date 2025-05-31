const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: ['https://joaopaulo55.github.io'] }));
app.use(express.json());

// Rota para obter informações e formatos do vídeo
app.post('/formats', (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: 'URL não fornecida' });

  exec(`yt-dlp -J --no-playlist "${url}"`, (err, stdout) => {
    if (err) {
      console.error('Erro yt-dlp:', err);
      return res.status(500).json({ error: 'Erro ao obter informações do vídeo' });
    }

    try {
      const data = JSON.parse(stdout);
      const formats = data.formats
        .filter(f => f.filesize && (f.ext === 'mp4' || f.ext === 'webm' || f.ext === 'm4a'))
        .map(f => ({
          id: f.format_id,
          resolution: f.resolution || f.height + 'p' || 'Áudio',
          ext: f.ext,
          acodec: f.acodec,
          vcodec: f.vcodec
        }));

      res.json({
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        formats
      });

    } catch (parseErr) {
      console.error('Erro ao processar JSON:', parseErr);
      res.status(500).json({ error: 'Erro ao processar dados do vídeo' });
    }
  });
});

// Rota para obter URL direta de download
app.post('/download', (req, res) => {
  const { url, format } = req.body;

  if (!url || !format) return res.status(400).json({ error: 'URL ou formato ausente' });

  const cmd = `yt-dlp -f ${format} -g --no-playlist "${url}"`;

  exec(cmd, (err, stdout) => {
    if (err) {
      console.error('Erro yt-dlp:', err);
      return res.status(500).json({ error: 'Erro ao gerar link de download' });
    }

    const directUrl = stdout.trim().split('\n').pop(); // para áudio + vídeo, podem vir 2 URLs
    res.json({ downloadUrl: directUrl });
  });
});

// Health check
app.get('/health', (req, res) => {
  exec('yt-dlp --version', (err) => {
    res.status(err ? 500 : 200).json({
      status: err ? 'unhealthy' : 'healthy',
      ytDlp: err ? 'not available' : 'available'
    });
  });
});

app.listen(PORT, () => console.log(`Servidor pronto na porta ${PORT}`));
