#!/bin/bash
set -e  # Faz o script parar em caso de erro

# Função para verificar versões
check_version() {
  local name=$1
  local cmd=$2
  local version_arg=${3:---version}
  
  echo -n "Verificando $name... "
  if command -v $cmd &> /dev/null; then
    $cmd $version_arg 2>&1 | head -n 1 || echo "Erro ao verificar versão"
  else
    echo "NÃO INSTALADO"
    return 1
  fi
}

# 1. Atualizar sistema
echo "Atualizando pacotes do sistema..."
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Instalar dependências básicas
echo "Instalando dependências..."
sudo apt-get install -y python3-pip ffmpeg

# 3. Instalar Node.js (se não estiver instalado)
if ! command -v node &> /dev/null; then
  echo "Instalando Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# 4. Instalar yt-dlp (com verificação)
echo "Instalando yt-dlp..."
python3 -m pip install --upgrade --user yt-dlp

# Adicionar ao PATH se necessário
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  echo "Adicionando ~/.local/bin ao PATH..."
  export PATH="$HOME/.local/bin:$PATH"
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
  source ~/.bashrc
fi

# 5. Instalar dependências do Node
echo "Instalando dependências do Node..."
npm install

# 6. Verificar todas as instalações
echo ""
echo "Verificando instalações:"
check_version "Node.js" "node" "-v"
check_version "npm" "npm" "-v"
check_version "Python" "python3" "--version"
check_version "pip" "pip3" "--version"
check_version "ffmpeg" "ffmpeg" "-version"
check_version "yt-dlp" "yt-dlp" "--version"

echo ""
echo "✅ Todas as dependências foram verificadas com sucesso!"
echo "🛠️  Para iniciar o servidor, execute: npm start"
