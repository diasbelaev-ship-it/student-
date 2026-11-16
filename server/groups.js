const express = require('express');
const { z } = require('zod');
const { isUtf8 } = require('node:buffer');
const { mkdirSync, writeFileSync, unlinkSync, existsSync } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const title = z.string().trim().min(2, 'Укажите название').max(100);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    return (
      parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d
    );
  }, 'Некорректная дата');
const allowedFiles = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'text/plain': '.txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};
const fileLimit = 5 * 1024 * 1024;
const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);

function registerGroupRoutes({ app, db, auth, fail, storage }) {
  mkdirSync(storage, { recursive: true });
  const idOf = (req) =>
    Number.isSafeInteger(Number(req.params.id)) && Number(req.params.id) > 0
      ? Number(req.params.id)
      : null;
  const member = (groupId, userId) =>
    db.prepare('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?').get(groupId, userId);
  const gate = (req, res, next) => {
    req.groupId = idOf(req);
    if (!req.groupId || !member(req.groupId, req.userId))
      return fail(res, 404, 'Группа не найдена');
    next();
  };
  const validate = (schema, body, res) => {
    const result = schema.safeParse(body);
    if (!result.success) {
      fail(res, 400, result.error.issues[0]?.message || 'Некорректные данные');
      return null;
    }
    return result.data;
  };
  const groupFor = (id, userId) =>
    db
      .prepare(
        `SELECT g.id,g.name,g.description,g.creator_id AS creatorId,g.invite_code AS inviteCode,g.created_at AS createdAt,
    (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) AS memberCount,
    (SELECT COUNT(*) FROM group_messages WHERE group_id=g.id) AS messageCount,
    (SELECT body FROM group_messages WHERE group_id=g.id ORDER BY id DESC LIMIT 1) AS latestMessage
    FROM study_groups g JOIN group_members m ON m.group_id=g.id WHERE g.id=? AND m.user_id=?`,
      )
      .get(id, userId);

  app.get('/api/groups', auth, (req, res) =>
    res.json(
      db
        .prepare(
          `SELECT g.id,g.name,g.description,g.created_at AS createdAt,
    (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) AS memberCount,
    (SELECT body FROM group_messages WHERE group_id=g.id ORDER BY id DESC LIMIT 1) AS latestMessage
    FROM study_groups g JOIN group_members m ON m.group_id=g.id WHERE m.user_id=? ORDER BY g.id DESC`,
        )
        .all(req.userId),
    ),
  );

  app.get('/api/groups/overview', auth, (req, res) => {
    const groupCount = db
      .prepare('SELECT COUNT(*) AS total FROM group_members WHERE user_id=?')
      .get(req.userId).total;
    const tasks = db
      .prepare(
        `SELECT gt.id,gt.group_id AS groupId,g.name AS groupName,gt.title,gt.due_date AS dueDate
      FROM group_tasks gt JOIN group_members m ON m.group_id=gt.group_id JOIN study_groups g ON g.id=gt.group_id
      WHERE m.user_id=? AND gt.due_date>=date('now','localtime') ORDER BY gt.due_date,gt.id LIMIT 3`,
      )
      .all(req.userId);
    res.json({ groupCount, tasks });
  });

  app.get('/api/groups/materials', auth, (req, res) => {
    const files = db
      .prepare(
        `SELECT gf.id,gf.group_id AS groupId,g.name AS groupName,gf.name,gf.mime,gf.size,
      gf.created_at AS createdAt,u.name AS author FROM group_files gf
      JOIN group_members m ON m.group_id=gf.group_id JOIN study_groups g ON g.id=gf.group_id
      JOIN users u ON u.id=gf.user_id WHERE m.user_id=? ORDER BY gf.id DESC LIMIT 200`,
      )
      .all(req.userId);
    res.json(files);
  });

  app.post('/api/groups', auth, (req, res) => {
    const data = validate(
      z.object({ name: title, description: z.string().trim().max(400).default('') }),
      req.body,
      res,
    );
    if (!data) return;
    if (
      db.prepare('SELECT COUNT(*) AS total FROM group_members WHERE user_id=?').get(req.userId)
        .total >= 30
    )
      return fail(res, 400, 'Можно состоять не более чем в 30 группах');
    const code = crypto.randomBytes(9).toString('base64url');
    db.exec('BEGIN');
    try {
      const row = db
        .prepare(
          'INSERT INTO study_groups(name,description,invite_code,creator_id) VALUES(?,?,?,?)',
        )
        .run(data.name, data.description, code, req.userId);
      db.prepare('INSERT INTO group_members(group_id,user_id) VALUES(?,?)').run(
        row.lastInsertRowid,
        req.userId,
      );
      db.exec('COMMIT');
      res.status(201).json(groupFor(row.lastInsertRowid, req.userId));
    } catch {
      db.exec('ROLLBACK');
      fail(res, 500, 'Не удалось создать группу');
    }
  });

  app.post('/api/groups/join', auth, (req, res) => {
    const data = validate(z.object({ code: z.string().trim().min(8).max(40) }), req.body, res);
    if (!data) return;
    const group = db.prepare('SELECT id FROM study_groups WHERE invite_code=?').get(data.code);
    if (!group) return fail(res, 404, 'Проверьте код приглашения');
    if (
      !member(group.id, req.userId) &&
      db.prepare('SELECT COUNT(*) AS total FROM group_members WHERE user_id=?').get(req.userId)
        .total >= 30
    )
      return fail(res, 400, 'Можно состоять не более чем в 30 группах');
    if (
      !member(group.id, req.userId) &&
      db.prepare('SELECT COUNT(*) AS total FROM group_members WHERE group_id=?').get(group.id)
        .total >= 100
    )
      return fail(res, 400, 'В группе уже 100 участников');
    db.prepare('INSERT OR IGNORE INTO group_members(group_id,user_id) VALUES(?,?)').run(
      group.id,
      req.userId,
    );
    res.json(groupFor(group.id, req.userId));
  });

  app.get('/api/groups/:id', auth, gate, (req, res) => {
    res.json({
      group: groupFor(req.groupId, req.userId),
      members: db
        .prepare(
          'SELECT u.id,u.name FROM group_members m JOIN users u ON u.id=m.user_id WHERE m.group_id=? ORDER BY m.joined_at',
        )
        .all(req.groupId),
      messages: db
        .prepare(
          'SELECT gm.id,gm.body,gm.created_at AS createdAt,u.id AS userId,u.name AS userName FROM group_messages gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=? ORDER BY gm.id DESC LIMIT 100',
        )
        .all(req.groupId)
        .reverse(),
      tasks: db
        .prepare(
          'SELECT gt.id,gt.user_id AS userId,gt.title,gt.due_date AS dueDate,gt.course,gt.created_at AS createdAt,u.name AS author FROM group_tasks gt JOIN users u ON u.id=gt.user_id WHERE gt.group_id=? ORDER BY gt.due_date,gt.id',
        )
        .all(req.groupId),
      files: db
        .prepare(
          'SELECT gf.id,gf.user_id AS userId,gf.name,gf.mime,gf.size,gf.created_at AS createdAt,u.name AS author FROM group_files gf JOIN users u ON u.id=gf.user_id WHERE gf.group_id=? ORDER BY gf.id DESC',
        )
        .all(req.groupId),
    });
  });

  app.post('/api/groups/:id/messages', auth, gate, (req, res) => {
    const data = validate(
      z.object({ body: z.string().trim().min(1, 'Напишите сообщение').max(2000) }),
      req.body,
      res,
    );
    if (!data) return;
    const row = db
      .prepare('INSERT INTO group_messages(group_id,user_id,body) VALUES(?,?,?)')
      .run(req.groupId, req.userId, data.body);
    res
      .status(201)
      .json(
        db
          .prepare(
            'SELECT gm.id,gm.body,gm.created_at AS createdAt,u.id AS userId,u.name AS userName FROM group_messages gm JOIN users u ON u.id=gm.user_id WHERE gm.id=?',
          )
          .get(row.lastInsertRowid),
      );
  });

  app.post('/api/groups/:id/tasks', auth, gate, (req, res) => {
    const data = validate(
      z.object({ title, dueDate: date, course: z.string().trim().max(100).default('') }),
      req.body,
      res,
    );
    if (!data) return;
    const row = db
      .prepare('INSERT INTO group_tasks(group_id,user_id,title,due_date,course) VALUES(?,?,?,?,?)')
      .run(req.groupId, req.userId, data.title, data.dueDate, data.course);
    res
      .status(201)
      .json(
        db
          .prepare(
            'SELECT gt.id,gt.user_id AS userId,gt.title,gt.due_date AS dueDate,gt.course,gt.created_at AS createdAt,u.name AS author FROM group_tasks gt JOIN users u ON u.id=gt.user_id WHERE gt.id=?',
          )
          .get(row.lastInsertRowid),
      );
  });

  app.delete('/api/groups/:id/tasks/:taskId', auth, gate, (req, res) => {
    const task = db
      .prepare('SELECT user_id FROM group_tasks WHERE id=? AND group_id=?')
      .get(req.params.taskId, req.groupId);
    if (!task) return fail(res, 404, 'Дедлайн не найден');
    const owner = db
      .prepare('SELECT creator_id FROM study_groups WHERE id=?')
      .get(req.groupId).creator_id;
    if (task.user_id !== req.userId && owner !== req.userId)
      return fail(res, 403, 'Удалить может автор или создатель группы');
    db.prepare('DELETE FROM group_tasks WHERE id=? AND group_id=?').run(
      req.params.taskId,
      req.groupId,
    );
    res.sendStatus(204);
  });

  app.post(
    '/api/groups/:id/files',
    auth,
    gate,
    express.raw({ type: 'application/octet-stream', limit: fileLimit }),
    (req, res) => {
      let name, mime;
      try {
        name = decodeURIComponent(req.get('x-file-name') || '');
      } catch {
        return fail(res, 400, 'Некорректное имя файла');
      }
      mime = req.get('x-file-type') || '';
      name = path.basename(name).trim();
      if (!name || name.length > 180 || /[\\/\x00-\x1f]/.test(name))
        return fail(res, 400, 'Некорректное имя файла');
      if (!allowedFiles[mime] || path.extname(name).toLowerCase() !== allowedFiles[mime])
        return fail(res, 400, 'Недопустимый формат файла');
      if (!Buffer.isBuffer(req.body) || !req.body.length || req.body.length > fileLimit)
        return fail(res, 400, 'Файл должен быть от 1 байта до 5 МБ');
      if (
        db.prepare('SELECT COUNT(*) AS total FROM group_files WHERE group_id=?').get(req.groupId)
          .total >= 100
      )
        return fail(res, 400, 'В группе уже 100 файлов');
      const bytes = req.body;
      const valid =
        mime === 'application/pdf'
          ? bytes.subarray(0, 5).toString() === '%PDF-'
          : mime === 'image/png'
            ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
            : mime === 'image/jpeg'
              ? bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))
              : mime === 'image/webp'
                ? bytes.subarray(0, 4).toString() === 'RIFF' &&
                  bytes.subarray(8, 12).toString() === 'WEBP'
                : mime === 'text/plain'
                  ? !bytes.includes(0) && !bytes.equals(utf8Bom) && isUtf8(bytes)
                  : bytes.subarray(0, 4).equals(Buffer.from('504b0304', 'hex'));
      if (!valid) return fail(res, 400, 'Содержимое не соответствует формату файла');
      const storedName = crypto.randomUUID() + allowedFiles[mime];
      const target = path.join(storage, storedName);
      try {
        writeFileSync(target, bytes, { flag: 'wx' });
        const row = db
          .prepare(
            'INSERT INTO group_files(group_id,user_id,name,mime,size,stored_name) VALUES(?,?,?,?,?,?)',
          )
          .run(req.groupId, req.userId, name, mime, bytes.length, storedName);
        res.status(201).json({ id: row.lastInsertRowid, name, mime, size: bytes.length });
      } catch {
        if (existsSync(target)) unlinkSync(target);
        fail(res, 500, 'Не удалось сохранить файл');
      }
    },
  );

  app.get('/api/groups/:id/files/:fileId', auth, gate, (req, res) => {
    const file = db
      .prepare('SELECT name,mime,stored_name FROM group_files WHERE id=? AND group_id=?')
      .get(req.params.fileId, req.groupId);
    if (!file) return fail(res, 404, 'Файл не найден');
    const target = path.join(storage, file.stored_name);
    if (!existsSync(target)) return fail(res, 404, 'Файл отсутствует на сервере');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'none'; sandbox");
    res.type(file.mime).download(target, file.name);
  });

  app.delete('/api/groups/:id/files/:fileId', auth, gate, (req, res) => {
    const file = db
      .prepare('SELECT user_id,stored_name FROM group_files WHERE id=? AND group_id=?')
      .get(req.params.fileId, req.groupId);
    if (!file) return fail(res, 404, 'Файл не найден');
    const owner = db
      .prepare('SELECT creator_id FROM study_groups WHERE id=?')
      .get(req.groupId).creator_id;
    if (file.user_id !== req.userId && owner !== req.userId)
      return fail(res, 403, 'Удалить может автор или создатель группы');
    db.prepare('DELETE FROM group_files WHERE id=? AND group_id=?').run(
      req.params.fileId,
      req.groupId,
    );
    const target = path.join(storage, file.stored_name);
    if (existsSync(target)) unlinkSync(target);
    res.sendStatus(204);
  });
}

module.exports = { registerGroupRoutes };
