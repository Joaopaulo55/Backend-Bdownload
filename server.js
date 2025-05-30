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

// Rota para processar o link e baixar o vídeo diretamente
app.post("/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL é obrigatória." });

  // Sanitização básica
  const sanitizedUrl = url.replace(/[;&|$<>]/g, "");
  
  try {
    // 1. Primeiro obtém informações do vídeo
    const infoCmd = `yt-dlp --dump-json --no-playlist "${sanitizedUrl}"`;
    const info = JSON.parse(await executeCommand(infoCmd));
    
    // 2. Encontra o melhor formato MP4 (vídeo + áudio)
    const bestFormat = info.formats.find(f => 
      f.ext === 'mp4' && 
      f.acodec !== 'none' && 
      f.vcodec !== 'none'
    )?.format_id || 'best';

    // 3. Gera nome do arquivo seguro
    const safeTitle = info.title.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${safeTitle}.mp4`;

    // 4. Configura os headers para forçar download no navegador
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');

    // 5. Stream direto do yt-dlp para o navegador do usuário
    const downloadCmd = `yt-dlp -f ${bestFormat} -o - --no-playlist "${sanitizedUrl}"`;
    const child = exec(downloadCmd);
    
    child.stdout.pipe(res); // Pipe direto para a resposta
    
    child.on('error', (err) => {
      console.error('Erro no download:', err);
      res.status(500).end();
    });

  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// Função auxiliar para executar comandos
function executeCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(stderr || err);
      else resolve(stdout);
    });
  });
}

app.listen(PORT, () => {
  console.log(`Servidor pronto para downloads na porta ${PORT}`);
});