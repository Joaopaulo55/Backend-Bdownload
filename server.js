const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const TMP_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

function sanitizeFilename(name) {
  return name.replace(/[\/\\?%*:|"<>]/g, '-');
}

// 🎧 Download MP3 real (não stream)
app.get('/download/audio', (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("URL ausente");

  const filename = `audio-${uuidv4()}.mp3`;
  const filepath = path.join(TMP_DIR, filename);

  const command = `yt-dlp -f bestaudio --extract-audio --audio-format mp3 -o "${filepath}" "${url}"`;

  exec(command, (err) => {
    if (err) return res.status(500).send("Erro no download");
    res.download(filepath, () => fs.unlinkSync(filepath));
  });
});

// 🎞️ Download de vídeo com resolução personalizada (opcional)
app.get('/download/video', (req, res) => {
  const url = req.query.url;
  const quality = req.query.quality || 'best';
  if (!url) return res.status(400).send("URL ausente");

  const filename = `video-${uuidv4()}.mp4`;
  const filepath = path.join(TMP_DIR, filename);

  const command = `yt-dlp -f ${quality} -o "${filepath}" "${url}"`;

  exec(command, (err) => {
    if (err) return res.status(500).send("Erro no download");
    res.download(filepath, () => fs.unlinkSync(filepath));
  });
});

// 🔎 Buscar informações do vídeo (título, duração, qualidades)
app.get('/search', (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).send("Falta o parâmetro 'query'");

  const command = `yt-dlp "ytsearch5:${query}" --dump-json`;

  exec(command, (err, stdout) => {
    if (err) return res.status(500).send("Erro na busca");
    const results = stdout.trim().split('\n').map(line => JSON.parse(line));
    res.json(results.map(video => ({
      title: video.title,
      url: video.webpage_url,
      duration: video.duration,
      thumbnail: video.thumbnail
    })));
  });
});

// 📂 Suporte a links diretos de outras plataformas
app.get('/download/universal', (req, res) => {
  const url = req.query.url;
  const format = req.query.format || 'video';
  if (!url) return res.status(400).send("URL ausente");

  const id = uuidv4();
  const ext = format === 'audio' ? 'mp3' : 'mp4';
  const output = path.join(TMP_DIR, `download-${id}.${ext}`);

  let command = `yt-dlp -o "${output}" `;
  command += format === 'audio'
    ? '--extract-audio --audio-format mp3 '
    : '-f best ';
  command += `"${url}"`;

  exec(command, (err) => {
    if (err) return res.status(500).send("Erro no download universal");
    res.download(output, () => fs.unlinkSync(output));
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
