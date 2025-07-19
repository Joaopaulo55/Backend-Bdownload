#!/bin/bash

# Verifica se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "Node.js não encontrado. Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "Node.js instalado com sucesso."
else
    echo "Node.js já está instalado."
fi

# Verifica se o npm está instalado
if ! command -v npm &> /dev/null; then
    echo "npm não encontrado. Instalando npm..."
    sudo apt-get install -y npm
    echo "npm instalado com sucesso."
else
    echo "npm já está instalado."
fi

# Verifica se o yt-dlp está instalado
if ! command -v yt-dlp &> /dev/null; then
    echo "yt-dlp não encontrado. Instalando yt-dlp..."
    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    sudo chmod a+rx /usr/local/bin/yt-dlp
    echo "yt-dlp instalado com sucesso."
else
    echo "yt-dlp já está instalado."
fi

# Instala as dependências do package.json
echo "Instalando dependências do projeto..."
npm install

# Verifica se houve erro na instalação
if [ $? -ne 0 ]; then
    echo "Erro ao instalar dependências. Tentando instalar manualmente..."
    
    # Instala cada dependência manualmente
    declare -a dependencies=(
        "cookie-parser@1.4.6"
        "cors@2.8.5"
        "express@4.18.2"
        "express-rate-limit@6.7.0"
        "googleapis@120.0.0"
        "winston@3.10.0"
        "ytdl-core@4.11.5"
    )
    
    for dep in "${dependencies[@]}"; do
        echo "Instalando $dep..."
        npm install $dep --save
    done
    
    # Instala devDependencies
    declare -a devDependencies=(
        "nodemon@3.0.2"
    )
    
    for devDep in "${devDependencies[@]}"; do
        echo "Instalando $devDep..."
        npm install $devDep --save-dev
    done
fi

echo "Configuração concluída com sucesso!"
