const { z } = require('zod');
const { parse } = require('./schemas');

const emailSchema = z.object({ email: z.string().trim().email().max(120) });
const messageSchema = z.object({ body: z.string().trim().min(1, 'Напишите сообщение').max(3000) });

function registerChatRoutes({ app, db, auth, limit }) {
  const participant = (chatId, userId) =>
    db
      .prepare('SELECT id FROM direct_chats WHERE id=? AND (user_low_id=? OR user_high_id=?)')
      .get(chatId, userId, userId);

  const chatFor = (chatId, userId) =>
    db
      .prepare(
        `SELECT c.id,c.created_at AS createdAt,c.last_message_at AS lastMessageAt,
          u.id AS peerId,u.name AS peerName,
          (SELECT body FROM direct_messages WHERE chat_id=c.id ORDER BY id DESC LIMIT 1) AS latestBody,
          (SELECT user_id FROM direct_messages WHERE chat_id=c.id ORDER BY id DESC LIMIT 1) AS latestUserId
        FROM direct_chats c
        JOIN users u ON u.id=CASE WHEN c.user_low_id=? THEN c.user_high_id ELSE c.user_low_id END
        WHERE c.id=? AND (c.user_low_id=? OR c.user_high_id=?)`,
      )
      .get(userId, chatId, userId, userId);

  const idOf = (value) =>
    Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;

  app.get('/api/chats', auth, (req, res) => {
    const rows = db
      .prepare(
        `SELECT c.id,c.created_at AS createdAt,c.last_message_at AS lastMessageAt,
          u.id AS peerId,u.name AS peerName,
          (SELECT body FROM direct_messages WHERE chat_id=c.id ORDER BY id DESC LIMIT 1) AS latestBody,
          (SELECT user_id FROM direct_messages WHERE chat_id=c.id ORDER BY id DESC LIMIT 1) AS latestUserId
        FROM direct_chats c
        JOIN users u ON u.id=CASE WHEN c.user_low_id=? THEN c.user_high_id ELSE c.user_low_id END
        WHERE c.user_low_id=? OR c.user_high_id=?
        ORDER BY c.last_message_at DESC,c.id DESC LIMIT 100`,
      )
      .all(req.userId, req.userId, req.userId);
    res.json(
      rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        lastMessageAt: row.lastMessageAt,
        peer: { id: row.peerId, name: row.peerName },
        latestMessage: row.latestBody ? { body: row.latestBody, userId: row.latestUserId } : null,
      })),
    );
  });

  app.post('/api/chats', auth, limit('direct-chat-lookup', 8), (req, res) => {
    const data = parse(emailSchema, req.body, res);
    if (!data) return;
    const other = db
      .prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE')
      .get(data.email.toLowerCase());
    if (!other || other.id === req.userId)
      return res.status(404).json({ error: 'Студент не найден' });

    const [low, high] = [req.userId, other.id].sort((a, b) => a - b);
    const existing = db
      .prepare('SELECT id FROM direct_chats WHERE user_low_id=? AND user_high_id=?')
      .get(low, high);
    if (existing) return res.json(chatFor(existing.id, req.userId));

    const existingCount = db
      .prepare('SELECT COUNT(*) AS total FROM direct_chats WHERE user_low_id=? OR user_high_id=?')
      .get(req.userId, req.userId).total;
    if (existingCount >= 100) return res.status(429).json({ error: 'Достигнут лимит в 100 бесед' });

    db.prepare(
      'INSERT INTO direct_chats(user_low_id,user_high_id) VALUES(?,?) ON CONFLICT(user_low_id,user_high_id) DO NOTHING',
    ).run(low, high);
    const chat = db
      .prepare('SELECT id FROM direct_chats WHERE user_low_id=? AND user_high_id=?')
      .get(low, high);
    res.status(201).json(chatFor(chat.id, req.userId));
  });

  app.get('/api/chats/:id/messages', auth, (req, res) => {
    const chatId = idOf(req.params.id);
    if (!chatId || !participant(chatId, req.userId))
      return res.status(404).json({ error: 'Беседа не найдена' });
    const after = req.query.after;
    if (after !== undefined && (!/^\d+$/.test(after) || !Number.isSafeInteger(Number(after))))
      return res.status(400).json({ error: 'Некорректный курсор сообщений' });
    const rows =
      after === undefined
        ? db
            .prepare(
              `SELECT m.id,m.body,m.created_at AS createdAt,u.id AS userId,u.name AS userName
           FROM direct_messages m JOIN users u ON u.id=m.user_id
           WHERE m.chat_id=? ORDER BY m.id DESC LIMIT 100`,
            )
            .all(chatId)
            .reverse()
        : db
            .prepare(
              `SELECT m.id,m.body,m.created_at AS createdAt,u.id AS userId,u.name AS userName
           FROM direct_messages m JOIN users u ON u.id=m.user_id
           WHERE m.chat_id=? AND m.id>? ORDER BY m.id ASC LIMIT 100`,
            )
            .all(chatId, Number(after));
    res.json(rows);
  });

  app.post('/api/chats/:id/messages', auth, limit('direct-chat-message', 90), (req, res) => {
    const chatId = idOf(req.params.id);
    if (!chatId || !participant(chatId, req.userId))
      return res.status(404).json({ error: 'Беседа не найдена' });
    const data = parse(messageSchema, req.body, res);
    if (!data) return;
    const result = db
      .prepare('INSERT INTO direct_messages(chat_id,user_id,body) VALUES(?,?,?)')
      .run(chatId, req.userId, data.body);
    db.prepare('UPDATE direct_chats SET last_message_at=CURRENT_TIMESTAMP WHERE id=?').run(chatId);
    const row = db
      .prepare(
        `SELECT m.id,m.body,m.created_at AS createdAt,u.id AS userId,u.name AS userName
         FROM direct_messages m JOIN users u ON u.id=m.user_id WHERE m.id=?`,
      )
      .get(result.lastInsertRowid);
    res.status(201).json(row);
  });
}

module.exports = { registerChatRoutes };
