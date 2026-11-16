const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 24) throw new Error('Для запуска Studia требуется Node.js 24 или новее.');

const { DatabaseSync } = require('node:sqlite');
const { existsSync, mkdirSync, readdirSync, rmSync, statSync } = require('node:fs');
const path = require('node:path');
const { containsPath, snapshotGroupFiles } = require('./backup-files');
const { migrate } = require('./migrations');

const databasePath = path.resolve(process.env.STUDIA_DB_PATH || 'data/studia.db');
const hadDatabase = existsSync(databasePath) && statSync(databasePath).size > 0;
mkdirSync(path.dirname(databasePath), { recursive: true });

function openDatabase(filePath) {
  const connection = new DatabaseSync(filePath);
  connection.exec('PRAGMA foreign_keys=ON;');
  return connection;
}

const db = openDatabase(databasePath);
db.exec('PRAGMA journal_mode=WAL;');

function groupFilesPath(sourcePath = databasePath) {
  if (process.env.STUDIA_GROUP_FILES_PATH) return path.resolve(process.env.STUDIA_GROUP_FILES_PATH);
  return path.resolve(path.dirname(sourcePath), 'group-files');
}

function backupDirectories(root, prefix) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter(
      (entry) =>
        entry.name.startsWith(prefix) &&
        /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(entry.name.slice(prefix.length)),
    )
    .map((entry) => ({ name: entry.name, path: path.join(root, entry.name) }))
    .sort(
      (a, b) => statSync(b.path).mtimeMs - statSync(a.path).mtimeMs || b.name.localeCompare(a.name),
    );
}

function createBackup(connection = db, sourcePath = databasePath, { prune = true } = {}) {
  const projectDatabasePath = path.resolve('data/studia.db');
  const isProjectDatabase = path.resolve(sourcePath) === projectDatabasePath;
  const root = path.resolve(
    process.env.STUDIA_BACKUP_PATH ||
      (isProjectDatabase ? 'backups' : path.join(path.dirname(sourcePath), 'backups')),
  );
  const retention = Number(process.env.BACKUP_KEEP || process.env.BACKUP_RETENTION || 14);
  if (!Number.isSafeInteger(retention) || retention < 1)
    throw new Error('BACKUP_KEEP должен быть целым числом не меньше 1.');
  const groupFiles = groupFilesPath(sourcePath);
  if (containsPath(groupFiles, root))
    throw new Error('Резервные копии должны находиться вне папки файлов групп.');
  mkdirSync(root, { recursive: true });
  const backupPrefix = `${path.basename(sourcePath, path.extname(sourcePath))}-`;
  const previous = backupDirectories(root, backupPrefix)[0];
  let instant = Date.now();
  let backupDirectory;
  do {
    const timestamp = new Date(instant++).toISOString().replace(/[:.]/g, '-');
    backupDirectory = path.join(root, `${backupPrefix}${timestamp}`);
  } while (existsSync(backupDirectory));
  mkdirSync(backupDirectory, { recursive: true });
  const databaseFile = path.join(backupDirectory, path.basename(sourcePath));
  connection.exec(`VACUUM INTO '${databaseFile.replaceAll("'", "''")}'`);
  const integrity = openDatabase(databaseFile);
  const result = integrity.prepare('PRAGMA integrity_check').get();
  integrity.close();
  if (result.integrity_check !== 'ok')
    throw new Error('Нарушена целостность резервной копии базы.');
  if (existsSync(groupFiles)) {
    const groupBackup = path.join(backupDirectory, 'group-files');
    snapshotGroupFiles(
      groupFiles,
      groupBackup,
      previous ? path.join(previous.path, 'group-files') : null,
    );
  }
  if (prune) {
    const backups = backupDirectories(root, backupPrefix);
    for (const old of backups.slice(retention)) rmSync(old.path, { recursive: true, force: true });
  }
  return backupDirectory;
}

function migrateDatabase() {
  migrate(db, databasePath, (connection, sourcePath) => {
    if (hadDatabase) createBackup(connection, sourcePath, { prune: false });
  });
}

function scheduleBackups() {
  if (process.env.BACKUP_ENABLED !== 'true') return null;
  const interval = 24 * 60 * 60 * 1000;
  const timer = setInterval(() => {
    try {
      console.info(`Резервная копия Studia создана: ${createBackup()}`);
    } catch (error) {
      console.error('Не удалось создать автоматическую копию Studia:', error.message);
    }
  }, interval);
  timer.unref();
  return timer;
}

module.exports = {
  db,
  databasePath,
  openDatabase,
  createBackup,
  migrateDatabase,
  scheduleBackups,
  groupFilesPath,
};
