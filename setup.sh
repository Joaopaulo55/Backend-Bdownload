#!/bin/bash

echo "🔵 Iniciando setup do projeto Y2Mate..."

# Configura ambiente
set -e

# Verifica versão do Node.js
echo "🔍 Verificando versão do Node.js..."
NODE_VERSION=$(node -v)
if [[ ! "$NODE_VERSION" =~ ^v20\. ]]; then
  echo "❌ Versão do Node.js incompatível: $NODE_VERSION. Use Node.js 20.x."
  exit 1
fi

# Configura Python/pip
echo "🐍 Configurando Python..."
if ! command -v python3 &> /dev/null; then
  echo "❌ Python3 não encontrado. Instale Python3 antes de continuar."
  exit 1
fi

python3 -m ensurepip --upgrade || echo "⚠️ Falha ao atualizar pip"
python3 -m pip install --upgrade pip || echo "⚠️ Falha ao atualizar pip"

# Instala yt-dlp (priorizando instalação via pip)
echo "⬇️ Instalando yt-dlp..."
if ! command -v yt-dlp &> /dev/null; then
  echo "ℹ️ Tentando instalar via pip..."
  python3 -m pip install yt-dlp || {
    echo "⚠️ Falha ao instalar via pip, tentando via npm..."
    npm install yt-dlp-exec@latest || {
      echo "❌ Falha ao instalar yt-dlp via npm"
      echo "⚠️ O sistema pode não funcionar corretamente sem yt-dlp"
    }
  }
else
  echo "✓ yt-dlp já instalado"
fi

# Instala dependências do Node (incluindo novas para monitoramento)
echo "📦 Instalando dependências do Node.js..."
REQUIRED_DEPS=(
  "express"
  "cors"
  "axios"
  "dotenv"
  "express-rate-limit"
  "helmet"
  "morgan"
  "uuid"
  "sanitize-filename"
  "validator"
  "compression"
  "winston"
  "winston-daily-rotate-file"
  "express-status-monitor"
)

npm install "${REQUIRED_DEPS[@]}" --save || {
  echo "⚠️ Tentando instalação forçada..."
  npm install --force || {
    echo "❌ Falha ao instalar dependências Node"
    exit 1
  }
}

# Configura ffmpeg
echo "⬇️ Configurando ffmpeg..."
FFMPEG_PATH=$(npm root -g)/ffmpeg-static/ffmpeg
if [ -f "$FFMPEG_PATH" ]; then
  echo "✓ Usando ffmpeg-static do npm"
  ln -sf "$FFMPEG_PATH" /usr/local/bin/ffmpeg || true
elif ! command -v ffmpeg &> /dev/null; then
  echo "⚠️ ffmpeg não encontrado - alguns recursos podem não funcionar"
fi

# Cria diretórios necessários
echo "📂 Criando diretórios de logs e temp..."
mkdir -p logs temp

# Verifica cookies
echo "🍪 Verificando arquivo cookies.txt..."
if [ -f "cookies.txt" ]; then
  echo "📝 cookies.txt encontrado. Baixos com cookies habilitados" >> logs/setup.log
  echo "✓ cookies.txt encontrado - logs atualizados"
else
  cat << "EOF"

  ███    ██ ██   ██  ██████   ██   ██  █████  
  ████   ██ ██   ██ ██    ██  ██   ██ ██   ██ 
  ██ ██  ██ ███████ ██    ██  ███████ ███████ 
  ██  ██ ██ ██   ██ ██    ██  ██   ██ ██   ██ 
  ██   ████ ██   ██  ██████   ██   ██ ██   ██ 

EOF
  echo "❌ Não há cookies.txt" >> logs/setup.log
fi

# Verificações finais
echo "✅ Verificando instalações:"
echo -n "Node: "; node -v
echo -n "NPM: "; npm -v
echo -n "Python: "; python3 --version || echo "❌"
echo -n "yt-dlp: "; command -v yt-dlp && yt-dlp --version || echo "❌"
echo -n "ffmpeg: "; command -v ffmpeg && ffmpeg -version || echo "⚠️"

# Verifica dependências Node
for dep in "${REQUIRED_DEPS[@]}"; do
  echo -n "$dep: "
  npm list "$dep" >/dev/null 2>&1 && echo "✓" || echo "❌"
done

echo "🚀 Setup concluído com sucesso!"
