const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração segura de CORS para GitHub Pages
const allowedOrigins = [
  'https://joaopaulo55.github.io',
  'http://localhost:3000' // Para desenvolvimento
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Rota para obter informações do vídeo (que o front-end espera)
app.post("/formats", (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL é obrigatória." });

  // Comando seguro com sanitização básica
  const sanitizedUrl = url.replace(/[;&|$]/g, "");
  const cmd = `yt-dlp --dump-json --no-playlist "${sanitizedUrl}"`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: `Erro: ${stderr}` });
    }

    try {
      const info = JSON.parse(stdout);
      const formats = info.formats.map(f => ({
        id: f.format_id,
        ext: f.ext,
        res: f.resolution || 'audio',
        vcodec: f.vcodec,
        acodec: f.acodec
      }));

      res.json({
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration_string,
        formats
      });
    } catch (parseErr) {
      res.status(500).json({ error: "Erro ao processar informações do vídeo" });
    }
  });
});

// Rota de download modificada para hospedagem remota
app.post("/download", (req, res) => {
  const { url, format } = req.body;
  if (!url || !format) return res.status(400).json({ error: "Parâmetros inválidos" });

  const sanitizedUrl = url.replace(/[;&|$]/g, "");
  const sanitizedFormat = format.replace(/[^0-9a-zA-Z-]/g, "");
  const filename = `video_${Date.now()}.mp4`;
  
  const cmd = `yt-dlp -f ${sanitizedFormat} -o "${filename}" --no-playlist "${sanitizedUrl}"`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: `Erro: ${stderr}` });
    }
    
    // Em vez de enviar o arquivo diretamente, retornamos a URL (para hospedagens remotas)
    res.json({ 
      message: "Download concluído",
      downloadUrl: `/downloads/${filename}` // Você precisaria configurar isso
    });
  });
});

// Rota para servir arquivos estáticos (se necessário)
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});