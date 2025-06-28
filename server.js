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

async function verificarCookies() {
  return new Promise((resolve) => {
    const testeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const comando = `yt-dlp -g --cookies ${COOKIES_PATH} "${testeUrl}"`;
    exec(comando, (err, stdout, stderr) => {
      if (err || stderr.includes('ERROR')) {
        resolve({
          validos: false,
          mensagem: 'Cookies inválidos ou expirados. Alguns formatos podem não estar disponíveis.'
        });
      } else {
        resolve({
          validos: true,
          mensagem: 'Cookies válidos. Formatos premium disponíveis.'
        });
      }
    });
  });
}

// ================================
// Rotas
// ================================

app.get('/', (req, res) => {
  res.send('API estilo Y2mate está ativa!');
});

app.get('/cookie-status', async (req, res) => {
  try {
    const status = await verificarCookies();
    res.json(status);
  } catch (err) {
    res.status(500).json({
      validos: false,
      mensagem: 'Erro ao verificar cookies: ' + err.message
    });
  }
});

app.get('/buscar', async (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 2) {
    return res.status(400).json({ 
      sucesso: false,
      erro: 'Termo de busca muito curto (mínimo 2 caracteres)',
      codigo: 'BUSCA_CURTA'
    });
  }

  try {
    if (YT_API_KEY) {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&key=${YT_API_KEY}&maxResults=10`;
      const resposta = await axios.get(url);
      const itens = resposta.data.items;

      return res.json({
        sucesso: true,
        resultados: itens.map(v => ({
          videoId: v.id.videoId,
          titulo: v.snippet.title,
          canal: v.snippet.channelTitle,
          thumb: v.snippet.thumbnails.high?.url || '',
          plataforma: 'YouTube',
          duracao: '--:--',
          url: `https://www.youtube.com/watch?v=${v.id.videoId}`
        }))
      });
    }

    // Fallback para scraping se a API do YouTube não estiver disponível
    const { data } = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    const resultados = [];
    
    $('a#video-title').slice(0, 10).each((_, el) => {
      const titulo = $(el).text().trim();
      const href = $(el).attr('href');
      if (!href) return;
      
      const videoId = href.split('v=')[1]?.split('&')[0];
      if (!videoId) return;
      
      resultados.push({
        videoId,
        titulo,
        canal: 'YouTube',
        plataforma: 'YouTube',
        thumb: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        duracao: '--:--',
        url: `https://www.youtube.com${href}`
      });
    });

    if (resultados.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Nenhum resultado encontrado',
        codigo: 'SEM_RESULTADOS'
      });
    }

    res.json({ sucesso: true, resultados });
  } catch (err) {
    console.error('Erro ao buscar vídeos:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Falha ao buscar vídeos',
      detalhes: err.message,
      codigo: 'ERRO_BUSCA'
    });
  }
});

app.post('/formats', async (req, res) => {
  let url = normalizarURLYoutube(req.body.url);
  if (!validarURL(url)) {
    return res.status(400).json({ 
      sucesso: false,
      erro: 'URL inválida',
      codigo: 'URL_INVALIDA'
    });
  }

  try {
    const cookiesStatus = await verificarCookies();
    const comando = `yt-dlp -J --no-playlist ${cookiesStatus.validos ? `--cookies ${COOKIES_PATH}` : ''} "${url}"`;
    
    exec(comando, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
      if (err) {
        console.error('Erro ao obter formatos:', err.message, stderr);
        return res.status(500).json({
          sucesso: false,
          erro: 'Erro ao obter formatos do vídeo',
          detalhes: err.message,
          codigo: 'ERRO_FORMATOS'
        });
      }

      try {
        const data = JSON.parse(stdout);
        const formats = (data.formats || []).map(f => ({
          id: f.format_id,
          ext: f.ext,
          resolucao: f.resolution || `${f.height || 'A'}p`,
          tamanho: f.filesize,
          tipo: f.vcodec === 'none' ? 'audio' : (f.acodec === 'none' ? 'video' : 'completo'),
          vcodec: f.vcodec,
          acodec: f.acodec
        }));

        res.json({
          sucesso: true,
          title: data.title,
          duration: data.duration,
          thumbnail: data.thumbnail,
          formats,
          cookies: cookiesStatus
        });
      } catch (parseError) {
        console.error('Erro ao interpretar resposta:', parseError);
        res.status(500).json({
          sucesso: false,
          erro: 'Erro ao processar dados do vídeo',
          detalhes: parseError.message,
          codigo: 'ERRO_PROCESSAMENTO'
        });
      }
    });
  } catch (err) {
    console.error('Erro geral:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno no servidor',
      detalhes: err.message,
      codigo: 'ERRO_INTERNO'
    });
  }
});

app.post('/download', async (req, res) => {
  let url = normalizarURLYoutube(req.body.url);
  const format = req.body.format;
  
  if (!validarURL(url) {
    return res.status(400).json({ 
      sucesso: false,
      erro: 'URL inválida',
      codigo: 'URL_INVALIDA'
    });
  }
  
  if (!format) {
    return res.status(400).json({ 
      sucesso: false,
      erro: 'Formato não especificado',
      codigo: 'FORMATO_INVALIDO'
    });
  }

  try {
    const cookiesStatus = await verificarCookies();
    const comando = `yt-dlp -f ${format} -g --no-playlist ${cookiesStatus.validos ? `--cookies ${COOKIES_PATH}` : ''} "${url}"`;
    
    exec(comando, (err, stdout, stderr) => {
      if (err) {
        console.error('Erro ao gerar link de download:', err.message, stderr);
        return res.status(500).json({
          sucesso: false,
          erro: 'Erro ao gerar link de download',
          detalhes: err.message,
          codigo: 'ERRO_DOWNLOAD'
        });
      }
      
      const link = stdout.trim().split('\n').pop();
      if (!link) {
        return res.status(404).json({
          sucesso: false,
          erro: 'Link de download não encontrado',
          codigo: 'LINK_NAO_ENCONTRADO'
        });
      }
      
      res.json({ 
        sucesso: true,
        link,
        cookies: cookiesStatus
      });
    });
  } catch (err) {
    console.error('Erro geral:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno no servidor',
      detalhes: err.message,
      codigo: 'ERRO_INTERNO'
    });
  }
});

app.get('/redirect-download', async (req, res) => {
  let url = normalizarURLYoutube(req.query.url);
  const format = req.query.format;
  
  if (!validarURL(url) || !format) {
    return res.status(400).send('Parâmetros inválidos');
  }

  try {
    const cookiesStatus = await verificarCookies();
    const comando = `yt-dlp -f ${format} -g --no-playlist ${cookiesStatus.validos ? `--cookies ${COOKIES_PATH}` : ''} "${url}"`;
    
    exec(comando, (err, stdout, stderr) => {
      if (err) {
        console.error('Erro ao redirecionar:', err.message, stderr);
        return res.status(500).send('Erro ao redirecionar para download');
      }
      
      const link = stdout.trim().split('\n').pop();
      if (!link) {
        return res.status(404).send('Link de download não encontrado');
      }
      
      res.redirect(link);
    });
  } catch (err) {
    console.error('Erro geral:', err);
    res.status(500).send('Erro interno no servidor');
  }
});

app.get('/video/:id', (req, res) => {
  const id = req.params.id;
  res.send(`<!DOCTYPE html><html><body><iframe width="100%" height="360" src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen></iframe></body></html>`);
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({
    sucesso: false,
    erro: 'Erro interno no servidor',
    codigo: 'ERRO_INTERNO'
  });
});

app.listen(PORT, () => console.log(`Servidor ativo em http://localhost:${PORT}`));