#!/bin/bash
set -euo pipefail

# Configurações específicas para o Render
export PATH="$HOME/.local/bin:$PATH"
mkdir -p ~/.local/bin

# Função para verificar e instalar dependências
install_deps() {
    echo "🔍 Verificando e instalando dependências..."
    
    # 1. Verifica e instala Python e pip
    if ! command -v python3 &> /dev/null; then
        echo "🐍 Instalando Python3..."
        apt-get update && apt-get install -y python3 python3-pip
    fi
    
    # 2. Verifica e instala FFmpeg
    if ! command -v ffmpeg &> /dev/null; then
        echo "🎬 Instalando FFmpeg..."
        apt-get install -y ffmpeg
    fi
    
    # 3. Instala yt-dlp
    echo "📥 Instalando yt-dlp..."
    python3 -m pip install --user --upgrade yt-dlp
    
    # 4. Verifica instalação do yt-dlp
    if ! command -v yt-dlp &> /dev/null; then
        echo "❌ Falha na instalação do yt-dlp"
        exit 1
    fi
}

# Função para verificar versões
check_versions() {
    echo "🔄 Verificando versões instaladas..."
    echo -n "→ Node: " && node -v
    echo -n "→ npm: " && npm -v
    echo -n "→ Python: " && python3 --version
    echo -n "→ pip: " && python3 -m pip --version
    echo -n "→ FFmpeg: " && ffmpeg -version | head -n1
    echo -n "→ yt-dlp: " && yt-dlp --version
}

# Instalação principal
echo "🚀 Iniciando configuração para o Render..."
install_deps
check_versions

# Instala dependências do Node
echo "📦 Instalando dependências Node.js..."
npm install --production

echo "✅ Configuração concluída com sucesso!"
