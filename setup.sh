#!/bin/bash

# ============================================
# SETUP.SH - Configuração Robusta para Node.js
# ============================================

set -euo pipefail  # Habilita modo estrito: erros param execução, variáveis não definidas causam erro

# Cores para mensagens
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar e instalar dependências do sistema
install_system_deps() {
    echo -e "${YELLOW}🛠  Verificando dependências do sistema...${NC}"
    
    local pkgs=("curl" "wget" "git" "python3" "python3-pip" "ffmpeg")
    local missing=()
    
    for pkg in "${pkgs[@]}"; do
        if ! dpkg -l | grep -q " $pkg "; then
            missing+=("$pkg")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${YELLOW}📦 Instalando pacotes: ${missing[*]}${NC}"
        apt-get update && apt-get install -y "${missing[@]}"
    fi
}

# Função para configurar Node.js
setup_node() {
    echo -e "\n${YELLOW}🟢 Configurando Node.js...${NC}"
    
    # Verifica versão mínima do Node
    local min_node_version=16
    local node_version
    node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js não encontrado. Instale Node.js v${min_node_version}+ primeiro.${NC}"
        exit 1
    fi
    
    if [ "$node_version" -lt "$min_node_version" ]; then
        echo -e "${RED}❌ Versão do Node.js ($(node -v)) é inferior à v${min_node_version}.${NC}"
        exit 1
    fi
    
    # Corrige link simbólico se necessário
    if [ ! -f "/usr/bin/node" ] && [ -f "/usr/bin/nodejs" ]; then
        ln -sf /usr/bin/nodejs /usr/bin/node
    fi
    
    echo -e "${GREEN}✓ Node.js $(node -v) configurado${NC}"
}

# Função para instalar dependências do projeto
install_project_deps() {
    echo -e "\n${YELLOW}📦 Instalando dependências do projeto...${NC}"
    
    # Dependências de produção
    local prod_deps=(
        "express"
        "mongoose"
        "cors"
        "dotenv"
        "bcryptjs"
        "jsonwebtoken"
        "validator"
        "axios"
        "googleapis"
        "ws"
    )
    
    # Dependências de desenvolvimento
    local dev_deps=(
        "nodemon"
        "eslint"
        "prettier"
    )
    
    echo "Instalando dependências principais..."
    if ! npm install --save "${prod_deps[@]}"; then
        echo -e "${RED}❌ Falha ao instalar dependências principais${NC}"
        exit 1
    fi
    
    echo "Instalando dependências de desenvolvimento..."
    if ! npm install --save-dev "${dev_deps[@]}"; then
        echo -e "${YELLOW}⚠️  Aviso: Falha ao instalar algumas dependências de desenvolvimento${NC}"
    fi
}

# Função principal
main() {
    echo -e "\n${GREEN}🔧 Iniciando configuração do ambiente...${NC}"
    
    # Configuração específica para Render.com
    if [ -n "${RENDER:-}" ]; then
        echo -e "${YELLOW}🛠  Ambiente Render.com detectado${NC}"
        install_system_deps
        
        # Instala yt-dlp se necessário
        if ! command -v yt-dlp &> /dev/null; then
            pip3 install -U yt-dlp youtube-dl
        fi
    fi
    
    setup_node
    
    # Verifica npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm não encontrado. Instale o npm antes de continuar.${NC}"
        exit 1
    fi
    
    install_project_deps
    
    # Configuração de diretórios
    mkdir -p downloads tmp
    touch logs.txt && chmod 644 logs.txt
    
    echo -e "\n${GREEN}✅ Configuração concluída com sucesso!${NC}"
    echo -e "Versões instaladas:"
    echo -e "• Node.js: $(node -v)"
    echo -e "• npm: $(npm -v)"
    echo -e "\nPróximos passos:"
    echo -e "1. Crie um arquivo .env com suas configurações"
    echo -e "2. Execute o servidor com: ${YELLOW}npm start${NC}"
}

# Executa a função principal
main "$@"
