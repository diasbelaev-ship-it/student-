import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
const { default: backupTools } = await import('../server/backup.js');

try {
  console.log(`Резервная копия создана: ${backupTools.backup()}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
