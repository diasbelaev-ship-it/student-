const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');

async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
    socket.on('error', reject);
  });
}

test('legacy schema migrates in place, backs up database and group files, and can be restored', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'studia-migration-'));
  const databasePath = path.join(directory, 'legacy.db');
  const filesPath = path.join(directory, 'group-files');
  const backupPath = path.join(directory, 'backups');
  const port = await freePort();
  mkdirSync(filesPath);
  writeFileSync(path.join(filesPath, 'shared.txt'), 'preserve this file');
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`
    CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,name TEXT NOT NULL,session_date TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
    CREATE TABLE items(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE proposals(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,action TEXT NOT NULL,target_id INTEGER,item TEXT,expires_at INTEGER NOT NULL);
    CREATE INDEX items_owner_kind ON items(user_id,kind);
  `);
  const email = `legacy-${crypto.randomUUID()}@example.test`;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = `${salt}:${crypto.scryptSync('Legacy-password-2026!', salt, 64).toString('hex')}`;
  const userId = Number(
    legacy
      .prepare('INSERT INTO users(email,password_hash,name) VALUES(?,?,?)')
      .run(email, hash, 'Старый студент').lastInsertRowid,
  );
  legacy
    .prepare('INSERT INTO items(user_id,kind,payload) VALUES(?,?,?)')
    .run(userId, 'course', JSON.stringify({ title: 'Сохранённый предмет', teacher: '', room: '' }));
  legacy.close();

  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      STUDIA_DB_PATH: databasePath,
      STUDIA_GROUP_FILES_PATH: filesPath,
      STUDIA_BACKUP_PATH: backupPath,
      GEMINI_API_KEY: '',
    },
    stdio: 'ignore',
  });
  try {
    let response;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        response = await fetch(`http://127.0.0.1:${port}/api/me`);
        if (response.status === 401) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(response?.status, 401, 'server boots after migration');
    const backups = readdirSync(backupPath);
    assert.equal(backups.length, 1);
    const backupDirectory = path.join(backupPath, backups[0]);
    assert.equal(
      require('node:fs').readFileSync(
        path.join(backupDirectory, 'group-files', 'shared.txt'),
        'utf8',
      ),
      'preserve this file',
    );
    const db = new DatabaseSync(databasePath);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 4);
    assert.equal(
      db.prepare('SELECT name,email_verified FROM users WHERE id=?').get(userId).email_verified,
      1,
    );
    assert.equal(
      db
        .prepare("SELECT COUNT(*) AS total FROM items WHERE user_id=? AND kind='course'")
        .get(userId).total,
      1,
    );
    assert.equal(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='group_files'").get()
        .name,
      'group_files',
    );
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    db.close();
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
    }
  }

  const denied = spawnSyncRestore(databasePath, backupPath);
  assert.notEqual(denied.status, 0, 'restore requires explicit --yes');
  const snapshot = path.join(backupPath, readdirSync(backupPath)[0], path.basename(databasePath));
  writeFileSync(path.join(filesPath, 'shared.txt'), 'changed after backup');
  const restored = spawnSyncRestore(databasePath, snapshot, true);
  assert.equal(restored.status, 0, restored.stderr);
  assert.equal(readdirSync(backupPath).length, 2, 'retention preserves source during restore');
  assert.equal(
    require('node:fs').readFileSync(path.join(filesPath, 'shared.txt'), 'utf8'),
    'preserve this file',
  );
  const after = new DatabaseSync(databasePath);
  assert.equal(after.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  after.close();
  const restart = spawnSync(process.execPath, ['-e', "require('./server/app').createApp()"], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      STUDIA_DB_PATH: databasePath,
      STUDIA_GROUP_FILES_PATH: '',
      STUDIA_BACKUP_PATH: backupPath,
      BACKUP_KEEP: '1',
      GEMINI_API_KEY: '',
    },
    encoding: 'utf8',
  });
  assert.equal(restart.status, 0, restart.stderr);
  assert.equal(readdirSync(backupPath).length, 3, 'migration preserves earlier safety snapshots');
  rmSync(directory, { recursive: true, force: true });
});

function spawnSyncRestore(databasePath, backup, approve = false) {
  return spawnSync(
    process.execPath,
    ['server/backup.js', 'restore', backup, ...(approve ? ['--yes'] : [])],
    {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        STUDIA_DB_PATH: databasePath,
        STUDIA_BACKUP_PATH: path.join(path.dirname(databasePath), 'backups'),
        STUDIA_GROUP_FILES_PATH: '',
        BACKUP_KEEP: '1',
        GEMINI_API_KEY: '',
      },
      encoding: 'utf8',
    },
  );
}
