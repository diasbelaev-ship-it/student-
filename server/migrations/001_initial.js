module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        session_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        target_id INTEGER,
        item TEXT,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS items_owner_kind ON items(user_id,kind);
      CREATE TABLE IF NOT EXISTS study_groups (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        invite_code TEXT NOT NULL UNIQUE,
        creator_id INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(group_id,user_id)
      );
      CREATE TABLE IF NOT EXISTS group_messages (
        id INTEGER PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        body TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS group_messages_latest ON group_messages(group_id,id);
      CREATE TABLE IF NOT EXISTS group_tasks (
        id INTEGER PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        due_date TEXT NOT NULL,
        course TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS group_files (
        id INTEGER PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  },
};
