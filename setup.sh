#!/bin/bash
set -euo pipefail

# Configuração do ambiente
export PATH="$PATH:$HOME/.local/bin"
mkdir -p ~/.local/bin

# Instalação garantida do yt-dlp
echo "🔧 Instalando yt-dlp..."
python3 -m pip install --upgrade pip
python3 -m pip install yt-dlp --no-warn-script-location

# Link simbólico como fallback
ln -sf $(which yt-dlp) ~/.local/bin/yt-dlp 2>/dev/null || true

# Verificação final
echo "✅ Versões instaladas:"
echo -n "yt-dlp: " && yt-dlp --version || echo "Não instalado"
