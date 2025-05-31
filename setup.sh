#!/bin/bash
set -euo pipefail

# Configurações para o Render
export PYTHONUSERBASE=$HOME/.local
export PATH=$HOME/.local/bin:$PATH
mkdir -p ~/.local/bin

echo "🚀 Iniciando instalação no Render..."

# 1. Instalação do yt-dlp (método alternativo)
install_ytdlp() {
    echo "📥 Baixando yt-dlp diretamente..."
    wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O ~/.local/bin/yt-dlp
    chmod a+rx ~/.local/bin/yt-dlp
    
    # Verifica instalação
    if ~/.local/bin/yt-dlp --version; then
        echo "✅ yt-dlp instalado com sucesso"
    else
        echo "❌ Falha na instalação do yt-dlp"
        exit 1
    fi
}

# 2. Instala FFmpeg se necessário
install_ffmpeg() {
    if ! command -v ffmpeg &> /dev/null; then
        echo "🎬 Instalando FFmpeg..."
        apt-get update && apt-get install -y ffmpeg
    fi
    echo "→ FFmpeg versão: $(ffmpeg -version | head -n1)"
}

# 3. Instala dependências do Node
install_node_deps() {
    echo "📦 Instalando dependências Node.js..."
    npm install --production --no-audit --fund=false
}

# Executa todas as instalações
install_ytdlp
install_ffmpeg
install_node_deps

echo "✅ Configuração concluída com sucesso!"
echo "Versões instaladas:"
echo "→ Node: $(node -v)"
echo "→ npm: $(npm -v)"
echo "→ yt-dlp: $(~/.local/bin/yt-dlp --version)"
echo "→ FFmpeg: $(ffmpeg -version | head -n1)"
