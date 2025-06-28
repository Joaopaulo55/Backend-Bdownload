// ================================
// BACKEND - server.js estilo Y2mate (robusto, com verificação de cookies e tratamento de erro)
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
const YT_API_KEY = process.env.YT_API_KEY;

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

function formatarDuracaoISO(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '--:--';
  const [, h, m, s] = match.map(Number);
  return h ? `${h}:${String(m || 0).padStart(2, '0')}:${String(s || 0).padStart(2, '0')}` : `${m || 0}:${String(s || 0).padStart(2, '0')}`;
}

function normalizarURLYoutube(url) {
  if (!url.includes('youtube.com/shorts/') && !url.includes('youtu.be/')) return url;
  try {
    const u = new URL(url);
    let videoId = '';
    if (u.pathname.startsWith('/shorts/')) {
      videoId = u.pathname.split('/shorts/')[1].split('/')[0];
    } else if (u.hostname === 'youtu.be') {
      videoId = u.pathname.slice(1);
    }
    return `https://www.youtube.com/watch?v=${videoId}`;
  } catch {
    return url;
  }
}

function verificarCookies(callback) {
  const testeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const comando = `yt-dlp -g --cookies ${COOKIES_PATH} "${testeUrl}"`;
  exec(comando, (err, stdout, stderr) => {
    if (err || stderr.includes('ERROR')) {
      callback(false);
    } else {
      callback(true);
    }
  });
}

// ================================
// Rotas
// ================================

app.get('/', (req, res) => {
  res.send('API estilo Y2mate está ativa!');
});

app.get('/buscar', async (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 2) return res.status(400).json({ erro: 'Termo muito curto' });

  if (YT_API_KEY) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&key=${YT_API_KEY}&maxResults=10`;
      const resposta = await axios.get(url);
      const itens = resposta.data.items;

      return res.json({
        resultados: itens.map(v => ({
          videoId: v.id.videoId,
          titulo: v.snippet.title,
          canal: v.snippet.channelTitle,
          thumb: v.snippet.thumbnails.high.url,
          plataforma: 'YouTube',
          duracao: '--:--',
          url: `https://www.youtube.com/watch?v=${v.id.videoId}`
        }))
      });
    } catch (err) {
      console.error('Erro API YouTube:', err.message);
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
        plataforma: 'YouTube',
        url: `https://www.youtube.com${href}`
      });
    });
    res.json({ resultados });
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao buscar vídeos' });
  }
});

app.post('/formats', async (req, res) => {
  let url = normalizarURLYoutube(req.body.url);
  if (!validarURL(url)) return res.status(400).json({ erro: 'URL inválida' });

  verificarCookies((cookiesValidos) => {
    const comando = `yt-dlp -J --no-playlist --cookies ${COOKIES_PATH} "${url}"`;
    exec(comando, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout) => {
      if (err) {
        console.error('Erro ao obter formatos:', err.message);
        return res.status(500).json({ erro: 'Erro ao obter formatos' });
      }

      try {
        const data = JSON.parse(stdout);
        const formats = (data.formats || []).map(f => ({
          id: f.format_id,
          ext: f.ext,
          resolucao: f.resolution || `${f.height || 'A'}p`,
          tamanho: f.filesize,
          tipo: f.vcodec === 'none' ? 'audio' : (f.acodec === 'none' ? 'video' : 'completo')
        }));

        res.json({
          title: data.title,
          duration: data.duration,
          thumbnail: data.thumbnail,
          formats,
          cookies: cookiesValidos ? 'válidos' : 'inválidos'
        });
      } catch (parseError) {
        console.error('Erro ao interpretar resposta:', parseError);
        res.status(500).json({ erro: 'Erro ao processar dados do vídeo' });
      }
    });
  });
});

app.post('/download', async (req, res) => {
  let url = normalizarURLYoutube(req.body.url);
  const format = req.body.format;
  if (!validarURL(url) || !format) return res.status(400).json({ erro: 'Parâmetros inválidos' });

  const comando = `yt-dlp -f ${format} -g --no-playlist --cookies ${COOKIES_PATH} "${url}"`;
  exec(comando, (err, stdout) => {
    if (err) {
      console.error('Erro ao gerar link de download:', err.message);
      return res.status(500).json({ erro: 'Erro ao gerar link de download' });
    }
    const link = stdout.trim().split('\n').pop();
    res.json({ link });
  });
});

app.get('/redirect-download', async (req, res) => {
  let url = normalizarURLYoutube(req.query.url);
  const format = req.query.format;
  if (!validarURL(url) || !format) return res.status(400).send('Parâmetros inválidos');
  const comando = `yt-dlp -f ${format} -g --no-playlist --cookies ${COOKIES_PATH} "${url}"`;
  exec(comando, (err, stdout) => {
    if (err) {
      console.error('Erro ao redirecionar:', err.message);
      return res.status(500).send('Erro ao redirecionar para download');
    }
    const link = stdout.trim().split('\n').pop();
    res.redirect(link);
  });
});

app.get('/video/:id', (req, res) => {
  const id = req.params.id;
  res.send(`<!DOCTYPE html><html><body><iframe width="100%" height="360" src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen></iframe></body></html>`);
});

app.listen(PORT, () => console.log(`Servidor ativo em http://localhost:${PORT}`));
