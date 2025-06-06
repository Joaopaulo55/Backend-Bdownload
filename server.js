// ================================
// BACKEND - server.js (Node.js + Express + yt-dlp)
// ================================
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do cookies.txt
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');

// Sistema de logs
let logs = [];

function registrarLog(tipo, mensagem) {
  const log = {
    tipo, // info, erro, alerta
    mensagem,
    timestamp: new Date().toISOString()
  };
  logs.push(log);
  if (logs.length > 200) logs.shift(); // evita uso excessivo de memória

  // Salva em arquivo (opcional)
  try {
    fs.writeFileSync(path.join(__dirname, 'logs.json'), JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error('Erro ao salvar logs:', e);
  }
}

app.use(cors({ origin: ['https://joaopaulo55.github.io'] }));
app.use(express.json());

// Obtem formatos do vídeo (com cookies)
app.post('/formats', (req, res) => {
  const { url } = req.body;
  if (!url) {
    registrarLog('erro', 'URL não fornecida em /formats');
    return res.status(400).json({ error: 'URL não fornecida' });
  }

  registrarLog('info', `Verificação de formatos para: ${url}`);
  
  exec(`yt-dlp --cookies ${COOKIES_PATH} -J --no-playlist "${url}"`, (err, stdout) => {
    if (err) {
      registrarLog('erro', `Falha ao obter formatos: ${err.message}`);
      return res.status(500).json({ error: 'Erro ao obter informações do vídeo' });
    }
    
    try {
      const data = JSON.parse(stdout);
      const formats = data.formats
        .filter(f => f.format_id && (f.ext === 'mp4' || f.ext === 'webm' || f.ext === 'm4a'))
        .map(f => ({
          id: f.format_id,
          resolution: f.resolution || `${f.height || 'audio'}p`,
          ext: f.ext,
          acodec: f.acodec,
          vcodec: f.vcodec
        }));

      if (!formats.length) {
        registrarLog('alerta', `Nenhum formato disponível para: ${url}`);
        return res.json({
          title: data.title,
          thumbnail: data.thumbnail,
          duration: data.duration,
          message: 'Nenhum formato disponível para download'
        });
      }

      registrarLog('info', `Formatos encontrados para: ${data.title}`);
      res.json({
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        formats
      });
    } catch (e) {
      registrarLog('erro', `Erro ao processar resposta do yt-dlp: ${e.message}`);
      res.status(500).json({ error: 'Erro ao processar resposta do yt-dlp' });
    }
  });
});

// Gera link de download (com cookies)
app.post('/download', (req, res) => {
  const { url, format } = req.body;
  if (!url || !format) {
    registrarLog('erro', 'URL ou formato ausente em /download');
    return res.status(400).json({ error: 'URL ou formato ausente' });
  }

  registrarLog('info', `Solicitado download do formato ${format} para ${url}`);
  
  exec(`yt-dlp --cookies ${COOKIES_PATH} -f ${format} -g --no-playlist "${url}"`, (err, stdout) => {
    if (err) {
      registrarLog('erro', `Falha ao gerar link de download: ${err.message}`);
      return res.status(500).json({ error: 'Erro ao gerar link de download' });
    }
    
    const directUrl = stdout.trim().split('\n').pop();
    if (!directUrl) {
      registrarLog('erro', 'Link de download não encontrado');
      return res.status(500).json({ error: 'Link não encontrado' });
    }
    
    registrarLog('info', `Download gerado com sucesso para ${url}`);
    res.json({ downloadUrl: directUrl });
  });
});

// Health check (atualizado para verificar cookies)
app.get('/status', (req, res) => {
  exec(`yt-dlp --cookies ${COOKIES_PATH} --version`, (err) => {
    registrarLog(err ? 'erro' : 'info', `Verificação de status executada`);
    res.status(err ? 500 : 200).json({ status: err ? 'Offline ❌' : 'Online ✅' });
  });
});

// Endpoint para visualizar logs
app.get('/logs', (req, res) => {
  res.json(logs.slice(-100).reverse());
});

app.listen(PORT, () => {
  registrarLog('info', `Servidor iniciado na porta ${PORT}`);
  console.log(`Servidor pronto na porta ${PORT}`);
});