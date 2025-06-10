#!/bin/bash

# Atualiza os pacotes do sistema
echo "Atualizando pacotes do sistema..."
sudo apt-get update -y

# Instala o Node.js e npm (usando a versão LTS)
echo "Instalando Node.js e npm..."
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verifica as versões instaladas
echo "Versões instaladas:"
node -v
npm -v

# Instala as dependências do projeto
echo "Instalando dependências do projeto..."
npm install express cors axios

# Instala o yt-dlp (a versão mais recente)
echo "Instalando yt-dlp..."
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Instala o youtube-dl como fallback (opcional)
echo "Instalando youtube-dl como fallback..."
sudo curl -L https://yt-dl.org/downloads/latest/youtube-dl -o /usr/local/bin/youtube-dl
sudo chmod a+rx /usr/local/bin/youtube-dl

# Instala dependências necessárias para o yt-dlp funcionar
echo "Instalando dependências adicionais..."
sudo apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    atomicparsley

# Verifica as versões dos downloaders
echo "Versões dos downloaders:"
yt-dlp --version
youtube-dl --version

# Cria o arquivo de logs se não existir
echo "Criando arquivos necessários..."
touch logs.txt
touch cookies.txt

echo "Setup completo!"
