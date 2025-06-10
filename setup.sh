#!/bin/bash

# ============================================
# INSTALADOR PARA RENDER.COM - VERSÃO SEGURA
# ============================================

set -euo pipefail  # Modo estrito: aborta em erros

# Cores para saída
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis de configuração
MIN_NODE_VERSION=16
REQUIRED_PYTHON_VERSION=3.6

# ==================== FUNÇÕES ====================

show_header() {
    echo -e "${BLUE}"
    echo "============================================"
    echo "  INSTALADOR PARA RENDER.COM - VERSÃO SEGURA"
    echo "============================================"
    echo -e "${NC}"
    echo -e "${YELLOW}ℹ️  Modo Render.com detectado - usando instalações locais${NC}"
}

verify_nodejs() {
    echo -e "\n${YELLOW}🟢 Verificando Node.js...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js não encontrado. Render.com deve ter Node.js pré-instalado.${NC}"
        exit 1
    fi

    local node_version
    node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    
    if [ "$node_version" -lt "$MIN_NODE_VERSION" ]; then
        echo -e "${RED}❌ Versão do Node.js ($(node -v)) é inferior à v${MIN_NODE_VERSION}.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Node.js $(node -v) detectado${NC}"
    echo -e "${GREEN}✓ npm $(npm -v) detectado${NC}"
}

verify_python() {
    echo -e "\n${YELLOW}🐍 Verificando Python...${NC}"
    
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}❌ Python3 não encontrado. Render.com deve ter Python pré-instalado.${NC}"
        exit 1
    fi

    local python_version
    python_version=$(python3 -V | cut -d' ' -f2)
    
    if [ "$(printf '%s\n' "$REQUIRED_PYTHON_VERSION" "$python_version" | sort -V | head -n1)" != "$REQUIRED_PYTHON_VERSION" ]; then
        echo -e "${RED}❌ Versão do Python ($python_version) é inferior à ${REQUIRED_PYTHON_VERSION}.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Python $(python3 -V) detectado${NC}"
    echo -e "${GREEN}✓ pip $(pip3 --version | cut -d' ' -f2) detectado${NC}"
}

verify_ffmpeg() {
    echo -e "\n${YELLOW}🎬 Verificando FFmpeg...${NC}"
    
    if ! command -v ffmpeg &> /dev/null; then
        echo -e "${YELLOW}⚠️  FFmpeg não encontrado. Algumas funcionalidades podem não funcionar.${NC}"
        # Não sai com erro pois o FFmpeg pode não ser essencial
    else
        echo -e "${GREEN}✓ FFmpeg $(ffmpeg -version | head -n1 | cut -d' ' -f3) detectado${NC}"
    fi
}

install_yt_tools() {
    echo -e "\n${YELLOW}📺 Instalando ferramentas de vídeo (localmente)...${NC}"
    
    # Instala yt-dlp localmente
    echo "Instalando yt-dlp..."
    pip3 install --user -U yt-dlp
    
    # Instala youtube-dl localmente (opcional)
    echo "Instalando youtube-dl..."
    pip3 install --user -U youtube-dl

    echo -e "\n${GREEN}✓ Versões instaladas:${NC}"
    echo -e "yt-dlp: $(~/.local/bin/yt-dlp --version)"
    echo -e "youtube-dl: $(~/.local/bin/youtube-dl --version)"
}

setup_environment() {
    echo -e "\n${YELLOW}⚙️ Configurando ambiente...${NC}"
    
    # Adiciona pip local ao PATH se necessário
    if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
        echo "Adicionando ~/.local/bin ao PATH"
        export PATH="$HOME/.local/bin:$PATH"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
    fi
    
    # Cria diretórios necessários
    mkdir -p downloads tmp
}

verify_installations() {
    echo -e "\n${BLUE}🔎 Verificando instalações...${NC}"
    
    echo -e "\n${GREEN}✅ Configuração concluída com sucesso!${NC}"
    echo -e "\n${BLUE}=== RESUMO DAS VERSÕES ===${NC}"
    echo -e "Node.js: $(node -v)"
    echo -e "npm: $(npm -v)"
    echo -e "Python: $(python3 -V)"
    echo -e "pip: $(pip3 --version | cut -d' ' -f2)"
    command -v ffmpeg &> /dev/null && echo -e "FFmpeg: $(ffmpeg -version | head -n1 | cut -d' ' -f3)" || echo -e "FFmpeg: Não instalado"
    echo -e "yt-dlp: $(~/.local/bin/yt-dlp --version 2>/dev/null || echo "Não disponível")"
    echo -e "youtube-dl: $(~/.local/bin/youtube-dl --version 2>/dev/null || echo "Não disponível")"
    echo -e "${BLUE}=========================${NC}"
}

# ==================== EXECUÇÃO PRINCIPAL ====================

main() {
    show_header
    verify_nodejs
    verify_python
    verify_ffmpeg
    install_yt_tools
    setup_environment
    verify_installations
    
    echo -e "\n${GREEN}✨ Configuração concluída com sucesso! ✨${NC}"
    echo -e "\n${YELLOW}ℹ️  Observações:"
    echo -e "- No Render.com, algumas dependências devem ser pré-instaladas"
    echo -e "- FFmpeg pode não estar disponível em todos os planos"
    echo -e "- Configure as variáveis de ambiente no painel do Render${NC}"
}

main "$@"
