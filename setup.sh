#!/bin/bash

# Instala Node.js (se necessário - o Render já faz isso)
if [ -z "$RENDER" ]; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt install -y nodejs
fi

# Instala o yt-dlp (necessário para downloads)
if [ -z "$RENDER" ]; then
  sudo apt install -y python3-pip
  sudo pip3 install yt-dlp
fi

# Instala as dependências do projeto
npm install
