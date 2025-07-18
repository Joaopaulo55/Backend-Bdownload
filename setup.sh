#!/bin/bash

echo "🔧 Iniciando instalação do backend..."

# 1. Atualiza e instala dependências básicas
sudo apt update && sudo apt install -y ffmpeg curl python3-pip

# 2. Instala yt-dlp (caso precise usar diretamente também)
pip install -U yt-dlp

# 3. Instala dependências do projeto
npm install

# 4. Inicia o servidor (modo produção)
echo "🚀 Iniciando o servidor na porta 3001..."
node server.js
