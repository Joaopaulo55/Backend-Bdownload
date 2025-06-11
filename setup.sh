#!/bin/bash

echo "🔵 Iniciando setup do projeto no Render..."

# Configura ambiente
set -e  # Exit immediately if a command exits with a non-zero status

# Configura Python/pip
echo "🐍 Configurando Python..."
python3 -m ensurepip --upgrade || echo "⚠️ Falha ao atualizar pip"
python3 -m pip install --upgrade pip || echo "⚠️ Falha ao atualizar pip"

# Instala yt-dlp (modificado para Render)
echo "⬇️ Instalando yt-dlp..."
if [ -n "$RENDER" ]; then
  # Ambiente Render - instala globalmente
  python3 -m pip install yt-dlp || { echo "❌ Falha ao instalar yt-dlp"; exit 1; }
else
  # Ambiente local - instala como usuário
  python3 -m pip install --user yt-dlp || { echo "❌ Falha ao instalar yt-dlp"; exit 1; }
  export PATH="$PATH:$HOME/.local/bin"
fi

# Instala dependências do Node
echo "📦 Instalando dependências do Node.js..."
npm install || { echo "❌ Falha ao instalar dependências Node"; exit 1; }

# Configura ffmpeg via ffmpeg-static
echo "⬇️ Configurando ffmpeg..."
FFMPEG_PATH=$(npm bin)/ffmpeg-static
if [ -f "$FFMPEG_PATH" ]; then
  export PATH="$PATH:$FFMPEG_PATH"
else
  echo "⚠️ ffmpeg-static não encontrado, será usado o do sistema"
fi

# Cria arquivos necessários
echo "📂 Criando arquivos de configuração..."
touch logs.txt cookies.txt || echo "⚠️ Falha ao criar arquivos"

# Verifica instalações
echo "✅ Verificando instalações:"
echo -n "Node: "; node -v || echo "❌ Node não instalado"
echo -n "NPM: "; npm -v || echo "❌ NPM não instalado"
echo -n "Python: "; python3 --version || echo "❌ Python não instalado"
echo -n "yt-dlp: "; yt-dlp --version || echo "❌ yt-dlp não instalado"
echo -n "ffmpeg: "; ffmpeg -version || echo "⚠️ ffmpeg será fornecido via ffmpeg-static"

echo "🚀 Setup concluído com sucesso!"
