#!/bin/bash

# Atualiza o sistema
sudo apt update && sudo apt upgrade -y

# Instala Node.js e npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instala o yt-dlp (necessário para downloads)
sudo apt install -y python3-pip
sudo pip3 install yt-dlp

# Instala as dependências do projeto
npm install

# Inicia o servidor (opcional)
node server.js
