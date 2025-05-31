#!/bin/bash
set -euo pipefail

# 1. Configuração inicial
echo "🚀 Iniciando instalação no Render..."
export PATH="$HOME/.local/bin:$PATH"
mkdir -p ~/.local/bin

# 2. Verificar e configurar Python
echo "🐍 Configurando Python..."
if ! command -v python3 &> /dev/null; then
    echo "→ Instalando Python3..."
    apt-get update && apt-get install -y python3 python3-pip
fi

# 3. Instalar yt-dlp globalmente (sem --user)
echo "📥 Instalando yt-dlp..."
python3 -m pip install --upgrade pip
python3 -m pip install yt-dlp

# 4. Instalar FFmpeg
echo "🎬 Instalando FFmpeg..."
apt-get install -y ffmpeg

# 5. Verificar instalações
echo "🔍 Verificando instalações..."
echo -n "→ Python: " && python3 --version
echo -n "→ pip: " && python3 -m pip --version
echo -n "→ yt-dlp: " && yt-dlp --version || { echo "yt-dlp não instalado"; exit 1; }
echo -n "→ FFmpeg: " && ffmpeg -version | head -n1 || { echo "FFmpeg não instalado"; exit 1; }

# 6. Instalar dependências Node.js
echo "📦 Instalando dependências Node.js..."
npm install --production

echo "✅ Instalação concluída com sucesso!"
