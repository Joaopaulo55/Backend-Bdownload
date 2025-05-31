const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3000;

// Configurações essenciais
app.use(cors({ origin: ['https://joaopaulo55.github.io'] }));
app.use(express.json());

// Rota direta de download
app.post('/download', async (req, res) => {
  try {
    const { url } = req.body;
    
    // Validação básica
    if (!url?.includes('youtu')) {
      return res.status(400).json({ error: 'URL do YouTube inválida' });
    }

    // Nome do arquivo seguro
    const filename = `video_${Date.now()}.mp4`;
    
    // Comando otimizado
    const cmd = `yt-dlp -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' -o ${filename} --no-playlist "${url.replace(/[;&|$]/g, '')}"`;
    
    // Stream direto para o navegador
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('Erro no download:', stderr);
        return res.status(500).json({ 
          error: 'Erro ao baixar vídeo',
          solution: 'Tente novamente ou use outro vídeo'
        });
      }
      
      // Envia o arquivo diretamente
      res.sendFile(filename, { root: __dirname }, (err) => {
        if (err) console.error('Erro ao enviar arquivo:', err);
        // Limpeza
        exec(`rm -f ${filename}`);
      });
    });

  } catch (error) {
    console.error('Erro inesperado:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Health check simplificado
app.get('/health', (req, res) => {
  exec('yt-dlp --version', (err) => {
    res.status(err ? 500 : 200).json({ 
      status: err ? 'unhealthy' : 'healthy',
      ytDlp: err ? 'not available' : 'available'
    });
  });
});

app.listen(PORT, () => console.log(`Servidor pronto na porta ${PORT}`));