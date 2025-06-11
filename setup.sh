#!/bin/bash

# Verifica se estamos no Render (usando a variável de ambiente $RENDER)
if [ -n "$RENDER" ]; then
  echo "🔵 Ambiente Render.com detectado - Configurando dependências..."

  # Instala Node.js (se não estiver disponível)
  if ! command -v node &> /dev/null; then
    echo "⬇️ Instalando Node.js via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install --lts
    nvm use --lts
  fi

  # Instala Python (já incluso no Render, mas garantimos o pip)
  echo "🐍 Configurando Python/pip..."
  python -m ensurepip --upgrade
  pip install --upgrade pip

  # Instala yt-dlp (sem sudo, no ambiente local do usuário)
  echo "⬇️ Instalando yt-dlp..."
  pip install --user yt-dlp

  # Instala ffmpeg (via binário estático, pois não temos sudo)
  echo "⬇️ Baixando ffmpeg estático..."
  mkdir -p ./bin
  curl -o ffmpeg.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
  tar -xf ffmpeg.tar.xz --strip-components=1 -C ./bin ffmpeg-*/ffmpeg
  rm ffmpeg.tar.xz
  chmod +x ./bin/ffmpeg
  export PATH="$PATH:$(pwd)/bin"  # Adiciona ffmpeg ao PATH temporariamente

else
  # Caso NÃO esteja no Render (para testes locais)
  echo "🔴 Ambiente local detectado - Usando apt-get (requer sudo)..."
  sudo apt-get update -y
  sudo apt-get install -y nodejs npm python3 python3-pip ffmpeg
  pip install yt-dlp
fi

# Instala dependências do Node (express, cors, express-rate-limit, etc.)
echo "📦 Instalando dependências do Node.js..."
npm install

# Cria arquivos necessários
echo "📂 Criando arquivos de logs e cookies..."
touch logs.txt cookies.txt

# Verifica as instalações
echo "✅ Versões instaladas:"
node -v
npm -v
python --version
pip --version
yt-dlp --version
./bin/ffmpeg -version | head -n 1 2>/dev/null || echo "ffmpeg não está no PATH (local)."

echo "🚀 Setup concluído!"
