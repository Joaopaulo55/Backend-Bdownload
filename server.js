const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do CORS
app.use(cors({
  origin: ['https://joaopaulo55.github.io', 'http://localhost:3000']
}));

app.use(express.json());

// Middleware para verificar o yt-dlp
app.use((req, res, next) => {
  exec('yt-dlp --version', (error) => {
    if (error) {
      console.error('yt-dlp não está disponível');
      return res.status(500).json({ 
        error: "Serviço temporariamente indisponível",
        details: "O servidor está sendo configurado. Tente novamente em alguns instantes."
      });
    }
    next();
  });
});

// Rota de download aprimorada
app.post("/download", (req, res) => {
  const { url } = req.body;
  
  if (!url || !url.includes('youtu')) {
    return res.status(400).json({ 
      error: "URL inválida",
      solution: "Forneça uma URL válida do YouTube"
    });
  }

  const sanitizedUrl = url.replace(/[;&|$<>]/g, "");
  const cmd = `yt-dlp --dump-json --no-playlist "${sanitizedUrl}"`;

  exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
    if (err) {
      console.error(`Erro no yt-dlp: ${stderr}`);
      return res.status(500).json({
        error: "Não foi possível processar o vídeo",
        common_fixes: [
          "Verifique se a URL está correta",
          "O vídeo pode estar restrito"
        ],
        technical_details: stderr.toString()
      });
    }

    try {
      const info = JSON.parse(stdout);
      const safeTitle = info.title.replace(/[^a-zA-Z0-9]/g, '_');
      
      res.json({
        title: info.title,
        formats: info.formats.map(f => ({
          id: f.format_id,
          quality: f.resolution || 'audio',
          ext: f.ext
        }))
      });
    } catch (e) {
      console.error('Erro ao parsear resposta:', e);
      res.status(500).json({
        error: "Resposta inesperada do servidor",
        likely_cause: "Problema temporário com a plataforma de vídeo",
        action: "Tente novamente ou use outro vídeo"
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});