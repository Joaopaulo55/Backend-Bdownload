const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { google } = require('googleapis');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();

// Configuração do rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por IP
  handler: (req, res) => {
    logger.warn('Limite de taxa excedido', { ip: req.ip });
    res.status(429).json({ error: 'Muitas requisições. Por favor, tente novamente mais tarde.' });
  }
});

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://seusite.com' : '*',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(limiter);

// Configuração direta da API Key do YouTube (substitua pela sua chave)
const YT_API_KEY = 'SUA_CHAVE_DA_API_DO_YOUTUBE_AQUI';

// Middleware para verificar cookies (apenas para YouTube)
const verifyCookies = (req, res, next) => {
  if (req.path.includes('/youtube/') && !req.cookies.ytAuth) {
    logger.warn('Tentativa de acesso sem cookie válido', { ip: req.ip, path: req.path });
    return res.status(403).json({ error: 'Cookies inválido' });
  }
  next();
};

app.use(verifyCookies);

// Validador de URL
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// 🔍 Pesquisa de vídeos no YouTube com paginação (mantido específico para YouTube)
app.get('/api/youtube/search', async (req, res) => {
  const { q: query, pageToken } = req.query;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    const youtube = google.youtube({ version: 'v3', auth: YT_API_KEY });
    const response = await youtube.search.list({
      q: query,
      part: 'snippet',
      maxResults: 10,
      type: 'video',
      pageToken: pageToken || ''
    });

    const videos = response.data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.high.url,
      channel: item.snippet.channelTitle,
      link: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));

    res.json({ 
      results: videos,
      nextPageToken: response.data.nextPageToken,
      prevPageToken: response.data.prevPageToken
    });
  } catch (error) {
    logger.error('Erro na API do YouTube', { error: error.message });
    res.status(500).json({ error: 'Erro na API do YouTube' });
  }
});

// 🎵 Stream de áudio (MP3) com yt-dlp para múltiplas plataformas
app.get('/api/stream/audio', async (req, res) => {
  const { url } = req.query;
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'URL inválida' });
  }

  try {
    // Obter informações para extrair o título
    const infoCommand = `yt-dlp --skip-download --print-json "${url}"`;
    const { stdout: infoStdout } = await execPromise(infoCommand);
    const info = JSON.parse(infoStdout);
    
    const title = info.title.replace(/[^\w\s]/gi, '');
    const filename = `${title}.mp3`;
    
    // Configurar headers de resposta
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.header('Content-Type', 'audio/mpeg');
    
    // Stream direto usando yt-dlp
    const command = `yt-dlp -x --audio-format mp3 -o - "${url}"`;
    const { stdout } = await exec(command);
    
    stdout.on('error', (error) => {
      logger.error('Erro no stream de áudio', { url, error: error.message });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro no stream de áudio' });
      }
    });
    
    stdout.pipe(res);
  } catch (error) {
    logger.error('Erro ao streamar áudio', { url, error: error.message });
    res.status(500).json({ error: 'Erro ao streamar áudio', details: error.message });
  }
});

// 🎞️ Stream de vídeo com yt-dlp para múltiplas plataformas
app.get('/api/stream/video', async (req, res) => {
  const { url, quality = 'best' } = req.query;
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'URL inválida' });
  }

  try {
    // Obter informações para extrair o título
    const infoCommand = `yt-dlp --skip-download --print-json "${url}"`;
    const { stdout: infoStdout } = await execPromise(infoCommand);
    const info = JSON.parse(infoStdout);
    
    const title = info.title.replace(/[^\w\s]/gi, '');
    const filename = `${title}.mp4`;
    
    // Configurar headers de resposta
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.header('Content-Type', 'video/mp4');
    
    // Stream direto usando yt-dlp
    const command = `yt-dlp -f "${quality}" -o - "${url}"`;
    const { stdout } = await exec(command);
    
    stdout.on('error', (error) => {
      logger.error('Erro no stream de vídeo', { url, error: error.message });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro no stream de vídeo' });
      }
    });
    
    stdout.pipe(res);
  } catch (error) {
    logger.error('Erro ao streamar vídeo', { url, quality, error: error.message });
    res.status(500).json({ error: 'Erro ao streamar vídeo', details: error.message });
  }
});

// 📁 Rota para obter informações do vídeo de qualquer plataforma
app.get('/api/video/info', async (req, res) => {
  const { url } = req.query;
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'URL inválida' });
  }

  try {
    // Usar yt-dlp para obter informações em JSON
    const command = `yt-dlp --skip-download --print-json "${url}"`;
    const { stdout } = await execPromise(command);
    const info = JSON.parse(stdout);

    // Formatar resposta
    const response = {
      title: info.title,
      description: info.description,
      duration: info.duration,
      thumbnails: info.thumbnails,
      ageRestricted: info.age_limit && info.age_limit >= 18,
      formats: info.formats.map(format => ({
        format_id: format.format_id,
        ext: format.ext,
        resolution: format.resolution,
        fps: format.fps,
        filesize: format.filesize,
        url: format.url
      })),
      platform: info.extractor
    };

    res.json(response);
  } catch (error) {
    logger.error('Erro ao obter informações do vídeo', { url, error: error.message });
    res.status(500).json({ error: 'Erro ao obter informações do vídeo', details: error.message });
  }
});

// 🔗 Rota para obter URL direta de download de qualquer plataforma
app.get('/api/get-download-url', async (req, res) => {
  const { url, type = 'video', quality = 'best' } = req.query;
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'URL inválida' });
  }

  try {
    // Obter informações do vídeo
    const infoCommand = `yt-dlp --skip-download --print-json "${url}"`;
    const { stdout: infoStdout } = await execPromise(infoCommand);
    const info = JSON.parse(infoStdout);

    // Determinar o formato adequado
    let format;
    if (type === 'audio') {
      const audioCommand = `yt-dlp -f "bestaudio" -g "${url}"`;
      const { stdout: audioUrl } = await execPromise(audioCommand);
      format = { url: audioUrl.trim(), ext: 'mp3' };
    } else {
      const videoCommand = `yt-dlp -f "${quality}" -g "${url}"`;
      const { stdout: videoUrl } = await execPromise(videoCommand);
      format = { url: videoUrl.trim(), ext: 'mp4' };
    }

    res.json({
      url: format.url,
      title: info.title.replace(/[^\w\s]/gi, ''),
      extension: format.ext,
      platform: info.extractor
    });
  } catch (error) {
    logger.error('Erro ao obter URL de download', { url, type, error: error.message });
    res.status(500).json({ error: 'Erro ao obter URL de download', details: error.message });
  }
});

// Rota para verificar/definir cookies (específico para YouTube)
app.post('/api/youtube/auth', (req, res) => {
  const { cookies } = req.body;
  if (!cookies) {
    return res.status(400).json({ error: 'Cookies são necessários' });
  }

  if (!validateCookies(cookies)) {
    logger.warn('Tentativa de autenticação com cookies inválidos');
    return res.status(403).json({ error: 'Cookies inválido' });
  }

  res.cookie('ytAuth', cookies, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400000 // 1 dia
  });

  res.json({ status: 'Autenticado com sucesso' });
});

// Função para validar cookies do YouTube
function validateCookies(cookies) {
  if (typeof cookies !== 'string') return false;
  
  const requiredCookies = [
    'LOGIN_INFO',
    'YSC',
    'VISITOR_INFO1_LIVE'
  ];
  
  return requiredCookies.some(cookie => cookies.includes(cookie));
}

// Rota para logout/remover cookies (YouTube)
app.post('/api/youtube/logout', (req, res) => {
  res.clearCookie('ytAuth', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ status: 'Logout realizado com sucesso' });
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
  logger.error('Erro interno do servidor', { 
    error: err.message, 
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.get('/', (_, res) => {
  res.send('✅ Multi-Platform Streamer API ativa! Suporta YouTube, Vimeo, TikTok, Instagram e mais!');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  logger.info(`Server online na porta ${PORT}`);
});