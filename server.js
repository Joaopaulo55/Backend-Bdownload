// ================================
// BACKEND - server.js (Node.js + Express + yt-dlp + logs detalhados)
// ================================
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');
const LOG_FILE = path.join(__dirname, 'logs.txt');

// Configuração CORS para permitir o JPainel e o site principal
app.use(cors({ 
  origin: [
    'https://joaopaulo55.github.io',
    'https://joaopaulo55.github.io/Jpainel/'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Sistema de logs em memória e arquivo
let logs = [];

function registrarLog(tipo, mensagem, extra = '') {
  const timestamp = new Date().toISOString();
  const logEntry = {
    tipo,
    mensagem,
    extra,
    timestamp
  };
  
  // Adiciona ao array em memória
  logs.push(logEntry);
  if (logs.length > 500) logs.shift(); // Limite de 500 logs em memória
  
  // Escreve no arquivo de log
  const entry = `[${timestamp}] [${tipo}] ${mensagem}${extra ? ' - ' + extra : ''}\n`;
  fs.appendFile(LOG_FILE, entry, err => {
    if (err) console.error('Erro ao escrever log:', err);
  });
}

// Middleware para registrar todas as requisições
app.use((req, res, next) => {
  registrarLog('INFO', `[${req.method}] ${req.path}`);
  next();
});

// Obtem formatos do vídeo (YouTube, TikTok, Instagram, etc)
app.post('/formats', (req, res) => {
  const { url } = req.body;
  if (!url) {
    registrarLog('ERRO', 'URL não fornecida na rota /formats');
    return res.status(400).json({ error: 'URL não fornecida' });
  }

  const command = `yt-dlp -J --no-playlist --cookies "${COOKIES_PATH}" --user-agent "Mozilla/5.0" "${url}"`;
  registrarLog('INFO', 'Exec comando /formats', command);

  exec(command, (err, stdout, stderr) => {
    if (err) {
      registrarLog('ERRO', 'Erro yt-dlp JSON', stderr);
      return res.status(500).json({ error: 'Erro ao obter informações do vídeo' });
    }

    try {
      const data = JSON.parse(stdout);
      const formats = data.formats?.map(f => ({
        id: f.format_id,
        resolution: f.resolution || `${f.height || 'audio'}p`,
        ext: f.ext,
        acodec: f.acodec,
        vcodec: f.vcodec
      })).filter(f => f.id);

      if (!formats || formats.length === 0) {
        registrarLog('ALERTA', 'Nenhum formato disponível', url);
        return res.json({
          title: data.title,
          thumbnail: data.thumbnail,
          duration: data.duration,
          message: 'Nenhum formato disponível para download'
        });
      }

      registrarLog('SUCESSO', 'Informações obtidas com sucesso', data.title);
      res.json({
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        formats
      });

    } catch (parseErr) {
      registrarLog('ERRO', 'Erro ao processar JSON do yt-dlp', parseErr.message);
      res.status(500).json({ error: 'Erro ao processar dados do vídeo' });
    }
  });
});

// Gera link de download
app.post('/download', (req, res) => {
  const { url, format } = req.body;
  if (!url || !format) {
    registrarLog('ERRO', 'URL ou formato ausente na rota /download');
    return res.status(400).json({ error: 'URL ou formato ausente' });
  }

  const command = `yt-dlp -f ${format} -g --no-playlist --cookies "${COOKIES_PATH}" --user-agent "Mozilla/5.0" "${url}"`;
  registrarLog('INFO', 'Exec comando /download', command);

  exec(command, (err, stdout, stderr) => {
    if (err) {
      registrarLog('ERRO', 'Erro yt-dlp no download', stderr);
      return res.status(500).json({ error: 'Erro ao gerar link de download' });
    }

    const directUrl = stdout.trim().split('\n').pop();
    if (!directUrl) {
      registrarLog('ERRO', 'Link de download não encontrado');
      return res.status(500).json({ error: 'Link de download não encontrado' });
    }

    registrarLog('SUCESSO', 'Link de download gerado com sucesso', directUrl);
    res.json({ downloadUrl: directUrl });
  });
});

// Health check completo (substitui o endpoint /status anterior)
app.get('/health', (req, res) => {
  const startTime = Date.now();
  
  exec(`yt-dlp --cookies ${COOKIES_PATH} --version`, (err, stdout, stderr) => {
    const responseTime = Date.now() - startTime;
    
    if (err) {
      registrarLog('ERRO', 'Health check falhou', stderr);
      return res.status(500).json({ 
        status: 'unhealthy',
        yt_dlp: 'not available',
        responseTime: `${responseTime}ms`,
        logsCount: logs.length,
        lastError: logs.find(l => l.tipo === 'ERRO')?.timestamp || null
      });
    }
    
    registrarLog('INFO', 'Health check OK');
    res.status(200).json({ 
      status: 'healthy',
      yt_dlp: stdout.trim(),
      responseTime: `${responseTime}ms`,
      uptime: process.uptime(),
      logsCount: logs.length,
      memoryUsage: process.memoryUsage()
    });
  });
});

// Endpoint de logs melhorado
app.get('/logs', (req, res) => {
  const { limit = 100, type, search } = req.query;
  let filteredLogs = [...logs].reverse();
  
  if (type) {
    filteredLogs = filteredLogs.filter(log => log.tipo === type.toUpperCase());
  }
  
  if (search) {
    const searchTerm = search.toLowerCase();
    filteredLogs = filteredLogs.filter(log => 
      log.mensagem.toLowerCase().includes(searchTerm) || 
      (log.extra && log.extra.toLowerCase().includes(searchTerm))
    );
  }
  
  res.json({
    count: filteredLogs.length,
    logs: filteredLogs.slice(0, parseInt(limit)),
    lastUpdated: new Date().toISOString()
  });
});

// Novo endpoint para estatísticas
app.get('/stats', (req, res) => {
  const errorCount = logs.filter(l => l.tipo === 'ERRO').length;
  const warningCount = logs.filter(l => l.tipo === 'ALERTA').length;
  const successCount = logs.filter(l => l.tipo === 'SUCESSO').length;
  
  res.json({
    totalLogs: logs.length,
    errors: errorCount,
    warnings: warningCount,
    successes: successCount,
    lastError: logs.find(l => l.tipo === 'ERRO')?.timestamp || null,
    lastWarning: logs.find(l => l.tipo === 'ALERTA')?.timestamp || null,
    lastSuccess: logs.find(l => l.tipo === 'SUCESSO')?.timestamp || null,
    mostCommonError: getMostCommonMessage('ERRO'),
    mostCommonWarning: getMostCommonMessage('ALERTA')
  });
});

// Função auxiliar para mensagens mais comuns
function getMostCommonMessage(type) {
  const messages = logs
    .filter(l => l.tipo === type)
    .map(l => l.mensagem);
  
  if (messages.length === 0) return null;
  
  const counts = {};
  messages.forEach(msg => counts[msg] = (counts[msg] || 0) + 1);
  
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return {
    message: sorted[0][0],
    count: sorted[0][1]
  };
}

// Endpoint para visualizar arquivo de log completo
app.get('/logs/file', (req, res) => {
  fs.readFile(LOG_FILE, 'utf8', (err, data) => {
    if (err) {
      registrarLog('ERRO', 'Falha ao ler arquivo de log', err.message);
      return res.status(500).json({ error: 'Erro ao ler arquivo de log' });
    }
    res.type('text/plain').send(data);
  });
});

app.listen(PORT, () => {
  registrarLog('INICIO', `Servidor iniciado na porta ${PORT}`);
  console.log(`Servidor pronto na porta ${PORT}`);
});