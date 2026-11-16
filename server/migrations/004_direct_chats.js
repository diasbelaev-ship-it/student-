module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS direct_chats (
        id INTEGER PRIMARY KEY,
        user_low_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_high_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_message_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (user_low_id < user_high_id),
        UNIQUE (user_low_id, user_high_id)
      );
      CREATE TABLE IF NOT EXISTS direct_messages (
        id INTEGER PRIMARY KEY,
        chat_id INTEGER NOT NULL REFERENCES direct_chats(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 3000),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS direct_chats_low_user ON direct_chats(user_low_id,last_message_at);
      CREATE INDEX IF NOT EXISTS direct_chats_high_user ON direct_chats(user_high_id,last_message_at);
      CREATE INDEX IF NOT EXISTS direct_messages_chat_latest ON direct_messages(chat_id,id);
    `);
  },
};
