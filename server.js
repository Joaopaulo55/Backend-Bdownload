// ================================
// BACKEND - server.js estilo Y2mate
// ================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const cheerio = require('cheerio');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Funções Auxiliares
function validarURL(url) {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

function spoofHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  };
}

function formatarDuracaoISO(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '--:--';
  const [, h, m, s] = match.map(Number);
  return h ? `${h}:${String(m || 0).padStart(2, '0')}:${String(s || 0).padStart(2, '0')}` : `${m || 0}:${String(s || 0).padStart(2, '0')}`;
}

// ================================
// Rotas
// ================================

app.get('/', (req, res) => {
  res.send('API estilo Y2mate está ativa!');
});

// Pesquisa YouTube (com scraping caso não tenha API)
app.get('/buscar', async (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 2) return res.status(400).json({ erro: 'Termo muito curto' });

  const apiKey = process.env.YT_API_KEY;
  if (apiKey) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&key=${apiKey}&maxResults=10`;
      const resposta = await axios.get(url);
      const itens = resposta.data.items;

      return res.json(itens.map(v => ({
        videoId: v.id.videoId,
        titulo: v.snippet.title,
        canal: v.snippet.channelTitle,
        thumb: v.snippet.thumbnails.high.url,
        url: `https://www.youtube.com/watch?v=${v.id.videoId}`
      })));
    } catch {
      // fallback abaixo
    }
  }

  try {
    const { data } = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`);
    const $ = cheerio.load(data);
    const resultados = [];
    $('a#video-title').slice(0, 10).each((_, el) => {
      const titulo = $(el).text().trim();
      const href = $(el).attr('href');
      const videoId = href.split('v=')[1];
      resultados.push({
        videoId,
        titulo,
        url: `https://www.youtube.com${href}`
      });
    });
    res.json(resultados);
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao buscar vídeos' });
  }
});

// Obter formatos disponíveis
app.post('/formats', async (req, res) => {
  const { url } = req.body;
  if (!validarURL(url)) return res.status(400).json({ erro: 'URL inválida' });

  const comando = `yt-dlp -J --no-playlist --cookies ${COOKIES_PATH} "${url}"`;
  exec(comando, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout) => {
    if (err) return res.status(500).json({ erro: 'Erro ao obter formatos' });
    const data = JSON.parse(stdout);
    const formats = (data.formats || []).map(f => ({
      id: f.format_id,
      ext: f.ext,
      resolucao: f.resolution || `${f.height || 'A'}p`,
      tamanho: f.filesize,
      tipo: f.vcodec === 'none' ? 'audio' : (f.acodec === 'none' ? 'video' : 'completo')
    }));
    res.json({ titulo: data.title, duracao: data.duration, thumb: data.thumbnail, formats });
  });
});

// Gerar link direto para download
app.post('/download', async (req, res) => {
  const { url, format } = req.body;
  if (!validarURL(url) || !format) return res.status(400).json({ erro: 'Parâmetros inválidos' });
  const comando = `yt-dlp -f ${format} -g --no-playlist "${url}"`;
  exec(comando, (err, stdout) => {
    if (err) return res.status(500).json({ erro: 'Erro ao gerar link' });
    const link = stdout.trim().split('\n').pop();
    res.json({ link });
  });
});

// Redirecionar para link direto (como Y2mate faz)
app.get('/direct', async (req, res) => {
  const { url, format } = req.query;
  if (!validarURL(url) || !format) return res.status(400).send('Parâmetros inválidos');
  const comando = `yt-dlp -f ${format} -g --no-playlist "${url}"`;
  exec(comando, (err, stdout) => {
    if (err) return res.status(500).send('Erro ao gerar link');
    const link = stdout.trim().split('\n').pop();
    res.redirect(link);
  });
});

// Exibir vídeo (embed player)
app.get('/video/:id', (req, res) => {
  const id = req.params.id;
  res.send(`<!DOCTYPE html><html><body><iframe width="100%" height="360" src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen></iframe></body></html>`);
});

app.listen(PORT, () => console.log(`Servidor ativo em http://localhost:${PORT}`));
