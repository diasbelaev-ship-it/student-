const { db } = require('./db');
const { parse, schemas, itemSchema, fail } = require('./schemas');

const normalize = (value) => ({
  kind: value.kind,
  payload: schemas[value.kind].parse(value.payload),
});

const itemFor = (id, userId) =>
  db
    .prepare('SELECT id,kind,payload,created_at,updated_at FROM items WHERE id=? AND user_id=?')
    .get(id, userId);

const present = (row) => ({ ...row, payload: JSON.parse(row.payload) });

const ownsCourse = (item, userId) =>
  !item.payload.courseId || itemFor(item.payload.courseId, userId)?.kind === 'course';

function unlinkCourse(id, userId) {
  const rows = db
    .prepare('SELECT id,payload FROM items WHERE user_id=? AND kind!=?')
    .all(userId, 'course');
  for (const row of rows) {
    const payload = JSON.parse(row.payload);
    if (Number(payload.courseId) !== Number(id)) continue;
    delete payload.courseId;
    db.prepare(
      'UPDATE items SET payload=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?',
    ).run(JSON.stringify(payload), row.id, userId);
  }
}

function registerItemRoutes(app, auth) {
  app.get('/api/items', auth, (req, res) => {
    const paginated = ['cursor', 'kind', 'limit', 'updatedSince'].some((key) => key in req.query);
    const baseQuery = 'SELECT id,kind,payload,created_at,updated_at FROM items WHERE user_id=?';
    const rawLimit = req.query.limit === undefined ? '200' : String(req.query.limit);
    const limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
      return fail(res, 400, 'Лимит должен быть от 1 до 500');
    const conditions = ['user_id=?'];
    const params = [req.userId];
    if (req.query.kind !== undefined) {
      const kinds = [
        ...new Set(
          String(req.query.kind)
            .split(',')
            .map((kind) => kind.trim())
            .filter(Boolean),
        ),
      ];
      if (!kinds.length || kinds.some((kind) => !Object.hasOwn(schemas, kind)))
        return fail(res, 400, 'Неизвестный раздел');
      conditions.push(`kind IN (${kinds.map(() => '?').join(',')})`);
      params.push(...kinds);
    }
    if (req.query.updatedSince !== undefined) {
      const updatedSince = String(req.query.updatedSince);
      if (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(updatedSince))
        return fail(res, 400, 'Некорректное значение updatedSince');
      conditions.push('updated_at>?');
      params.push(updatedSince.replace('T', ' '));
    }
    if (req.query.cursor !== undefined) {
      let cursor;
      try {
        cursor = JSON.parse(Buffer.from(String(req.query.cursor), 'base64url').toString('utf8'));
      } catch {
        return fail(res, 400, 'Некорректный курсор');
      }
      if (
        typeof cursor?.updatedAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(cursor.updatedAt) ||
        !Number.isSafeInteger(cursor.id) ||
        cursor.id < 1
      )
        return fail(res, 400, 'Некорректный курсор');
      conditions.push('(updated_at<? OR (updated_at=? AND id<?))');
      params.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
    }
    const rows = db
      .prepare(
        `${baseQuery.replace(' WHERE user_id=?', ` WHERE ${conditions.join(' AND ')}`)} ORDER BY updated_at DESC,id DESC LIMIT ?`,
      )
      .all(...params, limit + 1);
    if (!paginated && rows.length <= limit) return res.json(rows.map(present));
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(present);
    const last = items.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(JSON.stringify({ updatedAt: last.updated_at, id: last.id }), 'utf8').toString(
            'base64url',
          )
        : null;
    res.json({ items, nextCursor, hasMore, limit });
  });

  app.post('/api/items', auth, (req, res) => {
    const data = parse(itemSchema, req.body, res);
    if (!data) return;
    const item = normalize(data);
    if (!ownsCourse(item, req.userId)) return fail(res, 400, 'Предмет не найден в вашем аккаунте');
    const row = db
      .prepare('INSERT INTO items(user_id,kind,payload) VALUES(?,?,?)')
      .run(req.userId, item.kind, JSON.stringify(item.payload));
    res.status(201).json(present(itemFor(row.lastInsertRowid, req.userId)));
  });

  app.put('/api/items/:id', auth, (req, res) => {
    const current = itemFor(req.params.id, req.userId);
    if (!current) return fail(res, 404, 'Запись не найдена');
    const data = parse(itemSchema, req.body, res);
    if (!data) return;
    const item = normalize(data);
    if (current.kind !== item.kind) return fail(res, 400, 'Раздел записи нельзя изменить');
    if (!ownsCourse(item, req.userId)) return fail(res, 400, 'Предмет не найден в вашем аккаунте');
    db.prepare(
      'UPDATE items SET kind=?,payload=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?',
    ).run(item.kind, JSON.stringify(item.payload), req.params.id, req.userId);
    res.json(present(itemFor(req.params.id, req.userId)));
  });

  app.delete('/api/items/:id', auth, (req, res) => {
    const target = itemFor(req.params.id, req.userId);
    if (!target) return fail(res, 404, 'Запись не найдена');
    db.exec('BEGIN');
    try {
      if (target.kind === 'course') unlinkCourse(target.id, req.userId);
      db.prepare('DELETE FROM items WHERE id=? AND user_id=?').run(target.id, req.userId);
      db.exec('COMMIT');
      res.sendStatus(204);
    } catch (e) {
      db.exec('ROLLBACK');
      fail(res, 500, 'Не удалось удалить запись');
    }
  });
}

module.exports = { normalize, itemFor, present, ownsCourse, unlinkCourse, registerItemRoutes };
