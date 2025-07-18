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

# Instala dependências do Node
echo "📦 Instalando dependências do Node.js..."
npm install || {
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
echo -n "ffmpeg: "; command -v ffmpeg && ffmpeg -version || echo "⚠️"

echo "🚀 Setup concluído com sucesso!"
