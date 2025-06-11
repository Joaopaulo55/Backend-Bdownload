#!/bin/bash

echo "🔵 Iniciando setup do projeto..."

# Verifica se estamos no Render
if [ -n "$RENDER" ]; then
  echo "🔵 Ambiente Render.com detectado"

  # Configura Python/pip
  echo "🐍 Configurando Python..."
  python -m ensurepip --upgrade
  pip install --upgrade pip

  # Instala yt-dlp (localmente)
  echo "⬇️ Instalando yt-dlp..."
  pip install --user yt-dlp

  # Instala ffmpeg estático
  echo "⬇️ Baixando ffmpeg estático..."
  mkdir -p bin
  wget https://github.com/eugeneware/ffmpeg-static/releases/download/b5.0.1/linux-x64 -O bin/ffmpeg
  chmod +x bin/ffmpeg
  export PATH="$PATH:$(pwd)/bin"

else
  # Ambiente local
  echo "🔴 Ambiente local detectado"
  sudo apt-get update -y
  sudo apt-get install -y ffmpeg python3-pip
  pip install yt-dlp
fi

# Instala dependências do Node
echo "📦 Instalando dependências do Node.js..."
npm install

# Cria arquivos necessários
echo "📂 Criando arquivos de configuração..."
touch logs.txt cookies.txt

# Verifica instalações
echo "✅ Verificando instalações:"
node -v
npm -v
python3 --version
yt-dlp --version
./bin/ffmpeg -version 2>/dev/null || echo "ffmpeg não encontrado"

echo "🚀 Setup concluído com sucesso!"
