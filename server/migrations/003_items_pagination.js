module.exports = {
  up(db) {
    db.exec(
      'CREATE INDEX IF NOT EXISTS items_owner_kind_updated_id ON items(user_id,kind,updated_at DESC,id DESC)',
    );
  },
};
