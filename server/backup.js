const fs = require('node:fs');
const path = require('node:path');
const { db, databasePath, openDatabase, createBackup, groupFilesPath } = require('./db');
const { containsPath, copyGroupFiles } = require('./backup-files');

function checkIntegrity(filePath) {
  const check = openDatabase(filePath);
  try {
    const result = check.prepare('PRAGMA integrity_check').get();
    if (result.integrity_check !== 'ok') throw new Error(`Integrity check failed for ${filePath}`);
  } finally {
    check.close();
  }
}

function backup(options) {
  const directory = createBackup(db, databasePath, options);
  checkIntegrity(path.join(directory, path.basename(databasePath)));
  return directory;
}

function restore(sourceArgument, approved) {
  if (!approved)
    throw new Error('Восстановление заменит текущие данные. Повторите команду с --yes.');
  if (!sourceArgument) throw new Error('Укажите путь к папке резервной копии или файлу базы.');
  const source = path.resolve(sourceArgument);
  const sourceDatabase = fs.statSync(source).isDirectory()
    ? path.join(source, path.basename(databasePath))
    : source;
  if (!fs.existsSync(sourceDatabase)) throw new Error('Файл базы в резервной копии не найден.');
  const sourceInfo = fs.statSync(sourceDatabase, { bigint: true });
  const liveInfo = fs.statSync(databasePath, { bigint: true });
  if (
    path.relative(sourceDatabase, databasePath) === '' ||
    (sourceInfo.ino && sourceInfo.ino === liveInfo.ino && sourceInfo.dev === liveInfo.dev)
  )
    throw new Error('Укажите резервную копию вместо текущей базы.');
  checkIntegrity(sourceDatabase);

  const groupFiles = groupFilesPath();
  const backupGroupFiles = path.join(path.dirname(sourceDatabase), 'group-files');
  const restoreGroupFiles = fs.existsSync(backupGroupFiles);
  if (
    restoreGroupFiles &&
    (containsPath(groupFiles, databasePath) ||
      containsPath(groupFiles, sourceDatabase) ||
      containsPath(groupFiles, backupGroupFiles) ||
      containsPath(backupGroupFiles, groupFiles))
  )
    throw new Error('Папки текущих данных и резервной копии пересекаются.');

  // Retention must not prune the snapshot being restored before it can be read.
  const safetyDirectory = backup({ prune: false });
  const safetyDatabase = path.join(safetyDirectory, path.basename(databasePath));
  const safetyGroupFiles = path.join(safetyDirectory, 'group-files');
  db.exec('PRAGMA wal_checkpoint(FULL)');
  db.close();
  let replacedGroupFiles = false;
  try {
    fs.copyFileSync(sourceDatabase, databasePath);
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${databasePath}${suffix}`;
      if (fs.existsSync(sidecar)) fs.rmSync(sidecar, { force: true });
    }
    if (restoreGroupFiles) {
      replacedGroupFiles = true;
      fs.rmSync(groupFiles, { recursive: true, force: true });
      copyGroupFiles(backupGroupFiles, groupFiles);
    }
    checkIntegrity(databasePath);
  } catch (error) {
    fs.copyFileSync(safetyDatabase, databasePath);
    if (replacedGroupFiles) {
      fs.rmSync(groupFiles, { recursive: true, force: true });
      if (fs.existsSync(safetyGroupFiles)) copyGroupFiles(safetyGroupFiles, groupFiles);
    }
    throw error;
  }
  return { sourceDatabase, safetyDatabase };
}

if (require.main === module) {
  try {
    const [action, source, ...flags] = process.argv.slice(2);
    if (action === 'backup') {
      console.log(`Резервная копия создана: ${backup()}`);
    } else if (action === 'restore') {
      const result = restore(source, flags.includes('--yes'));
      console.log(`Данные восстановлены. Страховая копия: ${result.safetyDatabase}`);
    } else {
      throw new Error(
        'Использование: node scripts/backup.mjs или node scripts/restore.mjs <папка> --yes',
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { backup, restore, checkIntegrity };
