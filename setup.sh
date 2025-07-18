#!/bin/bash

echo "🔧 Instalando dependências..."

sudo apt update && sudo apt install -y ffmpeg curl python3-pip

echo "⬇️ Instalando yt-dlp..."
pip3 install -U yt-dlp

echo "📦 Instalando pacotes Node.js..."
npm install

echo "🚀 Iniciando servidor..."
node server.js

