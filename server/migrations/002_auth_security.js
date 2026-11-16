module.exports = {
  up(db) {
    db.exec(`
      ALTER TABLE users ADD COLUMN failed_logins INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN locked_until INTEGER;
      ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;
      CREATE TABLE email_tokens (
        id INTEGER PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
        expires_at INTEGER NOT NULL,
        used_at INTEGER
      );
      CREATE INDEX email_tokens_owner_purpose ON email_tokens(user_id,purpose);
    `);
  },
};
