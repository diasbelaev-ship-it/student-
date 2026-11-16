if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error('Для запуска Studia требуется Node.js 24 или новее.');
  process.exit(1);
}
if (require('node:fs').existsSync('.env')) process.loadEnvFile('.env');
const { startServer } = require('./app');
startServer();
