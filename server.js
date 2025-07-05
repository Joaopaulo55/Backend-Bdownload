import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de CORS Restrito
const allowedOrigins = ['https://joaopaulo55.github.io', 'https://bdownload.netlify.app'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  }
}));

app.use(bodyParser.json());

// Middleware para logs
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Verifica se a pasta de cookies existe
const cookiesDir = path.join(__dirname, 'cookies');
const cookiesFile = path.join(cookiesDir, 'youtube.txt');

if (!fs.existsSync(cookiesDir)) {
  fs.mkdirSync(cookiesDir, { recursive: true });
  console.log('Diretório de cookies criado');
}

if (!fs.existsSync(cookiesFile)) {
  console.warn('AVISO: Arquivo de cookies YouTube não encontrado em cookies/youtube.txt');
}

// Mantém o servidor ativo no Render
const keepAlive = () => {
  setInterval(() => {
    console.log('Keep-alive ping');
  }, 5000);
};
keepAlive();

// API Key do YouTube 
const YOUTUBE_API_KEY = 'AIzaSyB7Vx1waLthbIsvQr36eTABMS3CTbeHF_c';

// Utilitário para execução de comandos com tratamento de erros
const executeCommand = (command, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    const process = exec(command, { timeout }, (error, stdout, stderr) => {
      if (error) {
        const errMsg = stderr || error.message;
        if (errMsg.includes('timed out')) {
          reject(new Error('Tempo de execução excedido'));
        } else {
          reject(new Error(errMsg));
        }
        return;
      }
      resolve(stdout.trim());
    });

    process.on('exit', () => {
      if (!process.killed) process.kill();
    });
  });
};

// Detecta a plataforma do vídeo
const detectPlatform = (url) => {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('vimeo.com')) return 'vimeo';
  if (url.includes('dailymotion.com')) return 'dailymotion';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  return 'generic';
};

// Função para simular progresso
const simulateProgress = (duration, callback) => {
  let progress = 0;
  const interval = setInterval(() => {
    progress += 10;
    callback(progress);
    if (progress >= 100) clearInterval(interval);
  }, duration / 10);
};

// Obtém URL direta do vídeo
const getDirectUrl = async (url) => {
  try {
    const platform = detectPlatform(url);
    let command = `yt-dlp -f best -g "${url}"`;
    
    if (platform === 'youtube' && fs.existsSync(cookiesFile)) {
      command += ` --cookies ${cookiesFile}`;
    }
    
    return await executeCommand(command);
  } catch (error) {
    throw new Error(`Falha ao obter URL direta: ${error.message}`);
  }
};

// Extrai informações do vídeo
const extractInfo = async (url) => {
  try {
    const platform = detectPlatform(url);
    let command = `yt-dlp -j "${url}"`;
    
    if (platform === 'youtube' && fs.existsSync(cookiesFile)) {
      command += ` --cookies ${cookiesFile}`;
    }
    
    const stdout = await executeCommand(command);
    const data = JSON.parse(stdout);
    
    return {
      title: data.title,
      duration: data.duration,
      thumbnail: data.thumbnail,
      formats: data.formats
        .filter(f => f.filesize && f.filesize > 0)
        .map(f => ({
          format: f.format_id,
          url: f.url,
          ext: f.ext,
          height: f.height || 0,
          filesize: f.filesize
        }))
        .sort((a, b) => b.height - a.height)
    };
  } catch (error) {
    throw new Error(`Falha ao extrair informações: ${error.message}`);
  }
};

// Busca vídeos no YouTube
const searchYouTube = async (query) => {
  try {
    // Tenta com a API oficial do YouTube
    try {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`
      );
      
      return response.data.items.map(item => ({
        title: item.snippet.title,
        id: item.id.videoId,
        url: `https://youtube.com/watch?v=${item.id.videoId}`,
        thumbnail: item.snippet.thumbnails.default.url
      }));
    } catch (apiError) {
      console.warn('Falha na API do YouTube, usando yt-dlp como fallback');
      
      // Fallback para yt-dlp
      const stdout = await executeCommand(
        `yt-dlp "ytsearch5:${query}" --print "%(title)s|%(id)s|%(url)s"`
      );
      
      return stdout.trim().split('\n').map(line => {
        const [title, id, url] = line.split('|');
        return { 
          title: title?.trim() || 'Sem título', 
          id: id?.trim() || 'Sem ID', 
          url: url?.trim() || 'Sem URL' 
        };
      });
    }
  } catch (error) {
    throw new Error(`Falha na busca: ${error.message}`);
  }
};

// Middleware para tratamento centralizado de erros
const errorHandler = (err, req, res, next) => {
  console.error(`[ERRO] ${err.message}`);
  
  if (err.message.includes('Not allowed by CORS')) {
    return res.status(403).json({ 
      error: 'Acesso não permitido', 
      details: 'Origem não autorizada',
      type: 'CORS_ERROR'
    });
  }

  res.status(500).json({ 
    error: err.message,
    details: err.details || 'Erro interno no servidor',
    type: err.type || 'SERVER_ERROR'
  });
};

// Rotas
app.post('/stream', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) throw new Error('URL ausente');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (progress) => {
      res.write(`data: ${JSON.stringify({ progress })}\n\n`);
    };

    simulateProgress(5000, sendProgress);

    const platform = detectPlatform(url);
    let cmd = `yt-dlp -f best -o - "${url}"`;
    
    if (platform === 'youtube' && fs.existsSync(cookiesFile)) {
      cmd += ` --cookies ${cookiesFile}`;
    }

    const process = exec(cmd);

    req.on('close', () => {
      if (!process.killed) process.kill();
      console.log('Streaming interrompido pelo cliente');
    });

    process.stdout.on('data', (data) => {
      res.write(`data: ${JSON.stringify({ videoData: data.toString('base64') })}\n\n`);
    });

    process.stdout.on('end', () => {
      res.write('data: {"progress":100,"status":"complete"}\n\n');
      res.end();
    });

  } catch (error) {
    error.type = 'STREAM_ERROR';
    next(error);
  }
});

app.post('/download', async (req, res, next) => {
  try {
    const { url, format } = req.body; // Agora espera tanto url quanto format
    if (!url) throw new Error('URL ausente');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (progress) => {
      res.write(`data: ${JSON.stringify({ progress })}\n\n`);
    };

    simulateProgress(3000, sendProgress);

    // Modificado para usar o formato especificado
    let command = `yt-dlp -f ${format || 'best'} -g "${url}"`;
    
    if (detectPlatform(url) === 'youtube' && fs.existsSync(cookiesFile)) {
      command += ` --cookies ${cookiesFile}`;
    }

    const directUrl = await executeCommand(command);
    
    res.write(`data: ${JSON.stringify({ 
      progress: 100,
      download: directUrl,
      message: 'URL de download obtida com sucesso'
    })}\n\n`);
    res.end();

  } catch (error) {
    error.type = 'DOWNLOAD_ERROR';
    error.details = 'Falha ao obter URL de download';
    next(error);
  }
});

app.post('/info', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) throw new Error('URL ausente');

    const info = await extractInfo(url);
    res.json(info);

  } catch (error) {
    error.type = 'INFO_ERROR';
    error.details = 'Falha ao obter informações do vídeo';
    next(error);
  }
});

app.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) throw new Error('Termo de busca ausente');

    const results = await searchYouTube(q);
    res.json(results);

  } catch (error) {
    error.type = 'SEARCH_ERROR';
    error.details = 'Falha ao realizar busca';
    next(error);
  }
});

app.post('/convert', async (req, res, next) => {
  try {
    const { url, format } = req.body;
    if (!url || !['mp3', 'mp4'].includes(format)) {
      throw new Error('Dados inválidos para conversão');
    }

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const outFile = path.join(tempDir, `temp_${Date.now()}.${format}`);
    const platform = detectPlatform(url);
    
    let cmd = format === 'mp3'
      ? `yt-dlp -x --audio-format mp3 -o "${outFile}" "${url}"`
      : `yt-dlp -f best -o "${outFile}" "${url}"`;
    
    if (platform === 'youtube' && fs.existsSync(cookiesFile)) {
      cmd += ` --cookies ${cookiesFile}`;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (progress) => {
      res.write(`data: ${JSON.stringify({ progress })}\n\n`);
    };

    simulateProgress(5000, sendProgress);

    await executeCommand(cmd);

    if (!fs.existsSync(outFile)) throw new Error('Arquivo de saída não foi gerado');

    res.write(`data: ${JSON.stringify({ 
      progress: 100,
      file: `converted.${format}`,
      status: 'ready'
    })}\n\n`);

    res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="converted.${format}"`);

    const fileStream = fs.createReadStream(outFile);
    fileStream.pipe(res);
    
    fileStream.on('close', () => fs.unlink(outFile, () => {}));

  } catch (error) {
    error.type = 'CONVERSION_ERROR';
    error.details = 'Falha na conversão do arquivo';
    next(error);
  }
});

app.get('/notifications', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const interval = setInterval(() => {
    const randomNumber = Math.floor(Math.random() * 20) + 1;
    res.write(`data: ${JSON.stringify({ number: randomNumber })}\n\n`);
  }, 5000);

  req.on('close', () => clearInterval(interval));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    type: 'NOT_FOUND'
  });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error(`[ERRO NÃO TRATADO] ${err.message}`);
});

process.on('uncaughtException', (err) => {
  console.error(`[EXCEÇÃO NÃO CAPTURADA] ${err.message}`);
  process.exit(1);
});