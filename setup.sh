#!/bin/bash

echo "🔵 Iniciando setup do projeto..."

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
python3 -m ensurepip --upgrade || echo "⚠️ Falha ao atualizar pip"
python3 -m pip install --upgrade pip || echo "⚠️ Falha ao atualizar pip"

# Instala yt-dlp (usando pacote npm como fallback)
echo "⬇️ Instalando yt-dlp..."
if ! command -v yt-dlp &> /dev/null; then
  python3 -m pip install yt-dlp || {
    echo "⚠️ Tentando instalar via npm..."
    npm install yt-dlp-exec --save || {
      echo "❌ Falha crítica ao instalar yt-dlp";
      exit 1;
    }
  }
fi

# Instala dependências do Node
echo "📦 Instalando dependências do Node.js..."
npm install --legacy-peer-deps --no-audit --fund=false || {
  echo "⚠️ Tentando instalação forçada..."
  npm install --force || {
    echo "❌ Falha ao instalar dependências Node";
    exit 1;
  }
}

# Configura ffmpeg
echo "⬇️ Configurando ffmpeg..."
FFMPEG_PATH=$(npm root)/ffmpeg-static
if [ -f "$FFMPEG_PATH" ]; then
  echo "✓ Usando ffmpeg-static do npm"
  ln -sf "$FFMPEG_PATH" /usr/local/bin/ffmpeg || true
elif ! command -v ffmpeg &> /dev/null; then
  echo "⚠️ ffmpeg não encontrado - alguns recursos podem não funcionar"
fi

# Cria arquivos necessários
echo "📂 Criando arquivos de configuração..."
touch logs.txt cookies.txt
chmod 644 cookies.txt

# Verifica instalações
echo "✅ Verificando instalações:"
echo -n "Node: "; node -v
echo -n "NPM: "; npm -v
echo -n "Python: "; python3 --version || echo "❌"
echo -n "yt-dlp: "; command -v yt-dlp && yt-dlp --version || echo "❌"
echo -n "ffmpeg: "; command -v ffmpeg && ffmpeg -version || echo "⚠️"
echo -n "Cheerio: "; npm list cheerio >/dev/null && echo "✓" || echo "❌"

echo "🚀 Setup concluído com sucesso!"
