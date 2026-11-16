const fs = require('node:fs');
const path = require('node:path');

function migrate(db, databasePath, createBackup) {
  const directory = __dirname;
  const migrations = fs
    .readdirSync(directory)
    .filter((name) => /^\d{3}_[a-z0-9_-]+\.js$/i.test(name))
    .sort()
    .map((name) => ({
      version: Number(name.slice(0, 3)),
      migration: require(path.join(directory, name)),
    }));
  let currentVersion = Number(db.prepare('PRAGMA user_version').get().user_version);
  const targetVersion = migrations.at(-1)?.version || currentVersion;
  if (
    currentVersion < targetVersion &&
    fs.existsSync(databasePath) &&
    fs.statSync(databasePath).size
  ) {
    createBackup(db, databasePath);
  }
  for (const { version, migration } of migrations) {
    if (version <= currentVersion) continue;
    db.exec('BEGIN EXCLUSIVE');
    try {
      migration.up(db);
      db.exec(`PRAGMA user_version=${version}`);
      db.exec('COMMIT');
      currentVersion = version;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return currentVersion;
}

module.exports = { migrate };
