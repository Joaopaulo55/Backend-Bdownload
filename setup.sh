#!/bin/bash

echo "🔧 Instalando dependências..."

# Instalação em etapas com verificação de erro
sudo apt-get update -q -y && \
sudo apt-get install -q -y --no-install-recommends ffmpeg curl python3-pip && \
sudo apt-get clean && \
sudo rm -rf /var/lib/apt/lists/*

echo "⬇️ Instalando yt-dlp..."
pip3 install --no-cache-dir -U yt-dlp

echo "📦 Instalando pacotes Node.js..."
npm install --production --omit=dev

echo "🚀 Iniciando servidor..."
node server.js
