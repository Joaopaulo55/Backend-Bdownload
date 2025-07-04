import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Restrito
const allowedOrigins = ['https://joaopaulo55.github.io', 'https://bdownload.netlify.app'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));

app.use(bodyParser.json());

// Utilidades
const getDirectUrl = (url) => new Promise((resolve, reject) => {
  exec(`yt-dlp -f best -g "${url}" --cookies cookies/youtube.txt`, (err, stdout) => {
    if (err) return reject(err);
    resolve(stdout.trim());
  });
});

const extractInfo = (url) => new Promise((resolve, reject) => {
  exec(`yt-dlp -j "${url}" --cookies cookies/youtube.txt`, (err, stdout) => {
    if (err) return reject(err);
    try {
      const data = JSON.parse(stdout);
      resolve({
        title: data.title,
        duration: data.duration,
        thumbnail: data.thumbnail,
        formats: data.formats.map(f => ({
          format: f.format,
          url: f.url,
          ext: f.ext,
          height: f.height,
          filesize: f.filesize
        }))
      });
    } catch (e) {
      reject(e);
    }
  });
});

const searchYouTube = (query) => new Promise((resolve, reject) => {
  exec(`yt-dlp "ytsearch5:${query}" --print "%(title)s|%(id)s|%(url)s"`, (err, stdout) => {
    if (err) return reject(err);
    const lines = stdout.trim().split('\n');
    const results = lines.map(line => {
      const [title, id, url] = line.split('|');
      return { title: title.trim(), id: id.trim(), url: url.trim() };
    });
    resolve(results);
  });
});

// Rotas
app.post('/stream', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL ausente' });

  try {
    const cmd = `yt-dlp -f best -o - "${url}" --cookies cookies/youtube.txt`;
    const process = exec(cmd);
    res.setHeader('Content-Type', 'video/mp4');
    process.stdout.pipe(res);
  } catch {
    res.status(500).json({ error: 'Erro ao fazer streaming.' });
  }
});

app.post('/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL ausente' });

  try {
    const direct = await getDirectUrl(url);
    res.json({ download: direct });
  } catch {
    res.status(500).json({ error: 'Erro ao obter link.' });
  }
});

app.post('/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL ausente' });

  try {
    const info = await extractInfo(url);
    res.json(info);
  } catch {
    res.status(500).json({ error: 'Erro ao obter info.' });
  }
});

app.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Termo ausente' });

  try {
    const results = await searchYouTube(q);
    res.json(results);
  } catch {
    res.status(500).json({ error: 'Erro na busca.' });
  }
});

app.post('/convert', async (req, res) => {
  const { url, format } = req.body;
  if (!url || !['mp3', 'mp4'].includes(format)) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  const outFile = `temp_${Date.now()}.${format}`;
  const cmd = format === 'mp3'
    ? `yt-dlp -x --audio-format mp3 -o "${outFile}" "${url}" --cookies cookies/youtube.txt`
    : `yt-dlp -f best -o "${outFile}" "${url}" --cookies cookies/youtube.txt`;

  exec(cmd, (err) => {
    if (err) return res.status(500).json({ error: 'Erro na conversão.' });
    res.download(outFile, () => fs.unlinkSync(outFile));
  });
});

// Início
app.listen(PORT, () => {
  console.log(`Servidor Y2Mate rodando na porta ${PORT}`);
});
