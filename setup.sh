#!/bin/bash

echo "🔵 Iniciando setup do projeto no Render..."

# Configura ambiente
set -e  # Exit immediately if a command exits with a non-zero status

# Configura Python/pip
echo "🐍 Configurando Python..."
python3 -m ensurepip --upgrade || echo "⚠️ Falha ao atualizar pip"
python3 -m pip install --upgrade pip || echo "⚠️ Falha ao atualizar pip"

# Instala yt-dlp
echo "⬇️ Instalando yt-dlp..."
if [ -n "$RENDER" ]; then
  # Ambiente Render - instala globalmente
  sudo python3 -m pip install yt-dlp || { 
    echo "⚠️ Tentando instalação sem sudo..."
    python3 -m pip install yt-dlp || { 
      echo "❌ Falha crítica ao instalar yt-dlp"; 
      exit 1; 
    }
  }
else
  # Ambiente local - instala como usuário
  python3 -m pip install --user yt-dlp || { 
    echo "❌ Falha ao instalar yt-dlp localmente"; 
    exit 1; 
  }
  export PATH="$PATH:$HOME/.local/bin"
fi

# Instala dependências do Node (com fallbacks robustos)
echo "📦 Instalando dependências do Node.js..."
npm install --legacy-peer-deps || { 
  echo "⚠️ Tentando instalação normal..."
  npm install || { 
    echo "❌ Falha ao instalar dependências Node"; 
    exit 1; 
  }
}

# Verifica se o cheerio está instalado
echo "🔍 Verificando se o cheerio está instalado..."
if ! npm list cheerio > /dev/null 2>&1; then
  echo "⚠️ cheerio não encontrado. Instalando manualmente..."
  npm install cheerio@latest --save || {
    echo "❌ Falha ao instalar cheerio";
    exit 1;
  }
fi

# Configura ffmpeg (abordagem mais robusta)
echo "⬇️ Configurando ffmpeg..."
try_ffmpeg() {
  # Tenta usar o ffmpeg-static do npm
  FFMPEG_PATH=$(npm root)/ffmpeg-static
  if [ -f "$FFMPEG_PATH" ]; then
    echo "✓ Usando ffmpeg-static do npm"
    ln -s "$FFMPEG_PATH" /usr/local/bin/ffmpeg || true
    return 0
  fi
  
  # Tenta instalar via apt-get (se disponível)
  if command -v apt-get &> /dev/null; then
    echo "⚠️ Instalando ffmpeg via apt-get"
    sudo apt-get update && sudo apt-get install -y ffmpeg && return 0
  fi
  
  # Tenta usar qualquer ffmpeg disponível no sistema
  if command -v ffmpeg &> /dev/null; then
    echo "⚠️ Usando ffmpeg do sistema"
    return 0
  fi
  
  return 1
}

try_ffmpeg || echo "⚠️ ffmpeg não pôde ser configurado - alguns recursos podem não funcionar"

# Cria arquivos necessários
echo "📂 Criando arquivos de configuração..."
touch logs.txt cookies.txt || echo "⚠️ Falha ao criar arquivos"

# Verifica instalações
echo "✅ Verificando instalações:"
echo -n "Node: "; node -v || echo "❌ Node não instalado"
echo -n "NPM: "; npm -v || echo "❌ NPM não instalado"
echo -n "Python: "; python3 --version || echo "❌ Python não instalado"
echo -n "yt-dlp: "; yt-dlp --version || echo "❌ yt-dlp não instalado"
echo -n "ffmpeg: "; command -v ffmpeg && ffmpeg -version || echo "⚠️ ffmpeg não disponível"
echo -n "Cheerio: "; npm list cheerio > /dev/null && echo "✓" || echo "❌"

echo "🚀 Setup concluído com sucesso!"
