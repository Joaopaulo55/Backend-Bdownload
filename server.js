const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ytdlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 🔍 Buscar no YouTube
app.get('/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query ausente' });

  try {
    const result = await ytdlp(query, {
      dumpSingleJson: true,
      flatPlaylist: true
    });

    if (result.entries) {
      res.json(result.entries.slice(0, 10).map(video => ({
        id: video.id,
        title: video.title,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        duration: video.duration,
        is_playlist: true
      })));
    } else {
      const formats = result.formats?.filter(f => f.vcodec && f.acodec);
      const qualities = formats?.map(f => ({
        resolution: f.format_note || f.height + 'p',
        ext: f.ext,
        format_id: f.format_id
      }));
      res.json({
        id: result.id,
        title: result.title,
        url: result.webpage_url,
        duration: result.duration,
        thumbnail: result.thumbnail,
        qualities
      });
    }

  } catch (err) {
    res.status(500).json({ error: 'Erro na busca', detalhes: err.message });
  }
});

// 🎧 Download de áudio (com conversão para MP3)
app.get('/download/audio', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL ausente' });

  const tempFile = `/tmp/${uuidv4()}.webm`;
  const outputFile = `/tmp/${uuidv4()}.mp3`;

  try {
    await ytdlp.exec(url, {
      output: tempFile,
      extractAudio: true,
      audioFormat: 'webm',
      audioQuality: 0
    });

    ffmpeg(tempFile)
      .audioBitrate(128)
      .toFormat('mp3')
      .on('end', () => {
        res.download(outputFile, 'audio.mp3', () => {
          fs.unlinkSync(tempFile);
          fs.unlinkSync(outputFile);
        });
      })
      .on('error', (err) => {
        console.error(err);
        res.status(500).json({ error: 'Erro na conversão para MP3' });
      })
      .save(outputFile);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao baixar áudio', detalhes: err.message });
  }
});

// 🎞️ Download de vídeo com qualidade específica
app.get('/download/video', async (req, res) => {
  const { url, quality } = req.query;
  if (!url) return res.status(400).json({ error: 'URL ausente' });

  try {
    res.header('Content-Disposition', `attachment; filename="video.mp4"`);

    const process = ytdlp.raw(url, {
      format: quality || 'bestvideo+bestaudio',
      output: '-',
      quiet: true
    });

    process.stdout.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao baixar vídeo', detalhes: err.message });
  }
});

// 📂 Download de playlist (áudio ou vídeo)
app.get('/download/playlist', async (req, res) => {
  const { url, type } = req.query;
  if (!url) return res.status(400).json({ error: 'URL ausente' });

  const formatType = type === 'audio' ? 'bestaudio' : 'bestvideo+bestaudio';

  try {
    res.header('Content-Disposition', `attachment; filename="playlist.zip"`);

    const process = ytdlp.raw(url, {
      format: formatType,
      yesPlaylist: true,
      output: '-',
      quiet: true
    });

    process.stdout.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao baixar playlist', detalhes: err.message });
  }
});

// 🌐 Universal Download para qualquer site (sem busca)
app.get('/download/universal', async (req, res) => {
  const { url, format } = req.query;
  if (!url) return res.status(400).json({ error: 'URL ausente' });

  try {
    res.setHeader('Content-Disposition', `attachment; filename="video.${format === 'audio' ? 'mp3' : 'mp4'}"`);

    const process = ytdlp.raw(url, {
      output: '-',
      format: format === 'audio' ? 'bestaudio' : 'bestvideo+bestaudio',
      quiet: true
    });

    process.stdout.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Erro no download universal', detalhes: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🎥 Server 4.0 completo rodando na porta ${PORT}`);
});
