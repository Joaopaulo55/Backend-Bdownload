// install-deps.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

console.log(chalk.blue('Instalando dependências externas...'));

try {
  // Verificar e instalar yt-dlp se necessário
  try {
    execSync('yt-dlp --version');
    console.log(chalk.green('✓ yt-dlp já instalado'));
  } catch {
    console.log(chalk.yellow('Instalando yt-dlp...'));
    execSync('pip install yt-dlp || brew install yt-dlp || sudo apt-get install yt-dlp');
  }

  // Verificar ffmpeg (será fornecido pelo ffmpeg-static)
  try {
    execSync('ffmpeg -version');
    console.log(chalk.green('✓ ffmpeg já instalado'));
  } catch {
    console.log(chalk.yellow('ffmpeg será fornecido pelo ffmpeg-static'));
  }

  // Criar diretórios necessários
  const dirs = ['logs', 'downloads'];
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
      console.log(chalk.green(`✓ Diretório ${dir} criado`));
    }
  });

  console.log(chalk.green.bold('✓ Todas as dependências instaladas com sucesso'));
} catch (error) {
  console.error(chalk.red.bold('✗ Erro ao instalar dependências:'));
  console.error(chalk.red(error.message));
  process.exit(1);
}
