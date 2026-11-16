import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
const { default: backupTools } = await import('../server/backup.js');

try {
  const [source, ...flags] = process.argv.slice(2);
  const result = backupTools.restore(source, flags.includes('--yes'));
  console.log(`Данные восстановлены. Страховая копия: ${result.safetyDatabase}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
