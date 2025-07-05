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
  }, 5000); // A cada 5 segundos
};

// Inicia o keep-alive
keepAlive();

// API Key do YouTube (substitua pela sua)
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

    // Limpa processos pendentes se a conexão for fechada
    process.on('exit', () => {
      if (!process.killed) process.kill();
    });
  });
};

// Função para simular progresso (usada para sincronizar com a barra de progresso do frontend)
const simulateProgress = (duration, callback) => {
  let progress = 0;
  const interval = setInterval(() => {
    progress += 10;
    callback(progress);
    if (progress >= 100) {
      clearInterval(interval);
    }
  }, duration / 10);
};

// Utilidades com melhor tratamento de erros
const getDirectUrl = async (url) => {
  try {
    return await executeCommand(
      `yt-dlp -f best -g "${url}" --cookies ${cookiesFile}`
    );
  } catch (error) {
    throw new Error(`Falha ao obter URL direta: ${error.message}`);
  }
};

const extractInfo = async (url) => {
  try {
    const stdout = await executeCommand(
      `yt-dlp -j "${url}" --cookies ${cookiesFile}`
    );
    
    const data = JSON.parse(stdout);
    return {
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
    };
  } catch (error) {
    throw new Error(`Falha ao extrair informações: ${error.message}`);
  }
};

const searchYouTube = async (query) => {
  try {
    // Primeiro tenta com a API oficial do YouTube
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
      
      // Fallback para yt-dlp se a API falhar
      const stdout = await executeCommand(
        `yt-dlp "ytsearch5:${query}" --print "%(title)s|%(id)s|%(url)s"`
      );
      
      const lines = stdout.trim().split('\n');
      return lines.map(line => {
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

// Rotas com melhor tratamento de erros
app.post('/stream', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) {
      throw new Error('URL ausente');
    }

    // Envia progresso para o frontend
    const sendProgress = (progress) => {
      res.write(`data: ${JSON.stringify({ progress })}\n\n`);
    };

    // Configura headers para SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Simula progresso (substitua pela lógica real)
    simulateProgress(5000, sendProgress);

    const cmd = `yt-dlp -f best -o - "${url}" --cookies ${cookiesFile}`;
    const process = exec(cmd);

    // Tratamento para quando o cliente fecha a conexão
    req.on('close', () => {
      if (!process.killed) process.kill();
      console.log('Streaming interrompido pelo cliente');
    });

    process.on('error', (err) => {
      throw new Error(`Erro no processo de streaming: ${err.message}`);
    });

    // Quando o stream estiver pronto, envia para o cliente
    process.stdout.on('data', (data) => {
      res.write(`data: ${JSON.stringify({ videoData: data.toString('base64') })}\n\n`);
    });

    process.stdout.on('end', () => {
      res.write('data: { "progress": 100, "status": "complete" }\n\n');
      res.end();
    });

  } catch (error) {
    error.type = 'STREAM_ERROR';
    next(error);
  }
});

app.post('/download', async (req, res, next) => {
  try {
    const { url, format } = req.body;
    if (!url || !format) {
      throw new Error('URL e formato são obrigatórios');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Envia progresso inicial
    res.write('event: progress\ndata: {"progress": 0, "message": "Preparando download..."}\n\n');

    // Simula progresso (substitua pela lógica real)
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 300));
      res.write(`event: progress\ndata: ${JSON.stringify({ 
        progress: i,
        message: `Download em progresso... ${i}%`
      })}\n\n`);
    }

    // Envia URL de download quando concluído
    const directUrl = await getDirectUrl(url);
    res.write(`event: complete\ndata: ${JSON.stringify({
      progress: 100,
      download: directUrl,
      message: 'Download concluído com sucesso'
    })}\n\n`);

    res.end();
  } catch (error) {
    res.write(`event: error\ndata: ${JSON.stringify({
      error: error.message,
      details: 'Falha no download'
    })}\n\n`);
    res.end();
  }
});

app.post('/info', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) {
      throw new Error('URL ausente');
    }

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
    if (!q) {
      throw new Error('Termo de busca ausente');
    }

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
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const outFile = path.join(tempDir, `temp_${Date.now()}.${format}`);
    const cmd = format === 'mp3'
      ? `yt-dlp -x --audio-format mp3 -o "${outFile}" "${url}" --cookies ${cookiesFile}`
      : `yt-dlp -f best -o "${outFile}" "${url}" --cookies ${cookiesFile}`;

    // Configura SSE para progresso
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (progress) => {
      res.write(`event: progress\ndata: ${JSON.stringify({ progress })}\n\n`);
    
    
    // Simula progresso (substitua pela lógica real)
    simulateProgress(5000, sendProgress);

    await executeCommand(cmd);

    // Verifica se o arquivo foi criado
    if (!fs.existsSync(outFile)) {
      throw new Error('Arquivo de saída não foi gerado');
    }

    // Envia o arquivo quando pronto
    res.write(`data: ${JSON.stringify({ 
      progress: 100,
      file: `converted.${format}`,
      status: 'ready'
    })}\n\n`);

    // Configura o cabeçalho apropriado para o tipo de arquivo
    res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="converted.${format}"`);

    // Stream do arquivo com remoção após envio
    const fileStream = fs.createReadStream(outFile);
    fileStream.pipe(res);
    
    fileStream.on('close', () => {
      fs.unlink(outFile, (err) => {
        if (err) console.error(`Erro ao remover arquivo temporário: ${err.message}`);
      });
    });

    fileStream.on('error', (err) => {
      throw new Error(`Erro ao enviar arquivo: ${err.message}`);
    });

  } catch (error) {
    error.type = 'CONVERSION_ERROR';
    error.details = 'Falha na conversão do arquivo';
    next(error);
  }
});

// Rota para keep-alive e notificações
app.get('/notifications', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Envia um número aleatório a cada 5 segundos
  const interval = setInterval(() => {
    const randomNumber = Math.floor(Math.random() * 20) + 1;
    res.write(`data: ${JSON.stringify({ number: randomNumber })}\n\n`);
  }, 5000);

  // Limpa o intervalo quando a conexão é fechada
  req.on('close', () => {
    clearInterval(interval);
  });
});

// Rota de saúde do servidor
app.get('/health', (req, res) => {
  res.json({ 
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Rota 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    type: 'NOT_FOUND'
  });
});

// Middleware de erro
app.use(errorHandler);

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`Servidor Bdownload Is On  porta ${PORT}`);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
  console.error(`[ERRO NÃO TRATADO] ${err.message}`);
});

process.on('uncaughtException', (err) => {
  console.error(`[EXCEÇÃO NÃO CAPTURADA] ${err.message}`);
  process.exit(1);
});