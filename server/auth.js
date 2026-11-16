const crypto = require('node:crypto');
const { z } = require('zod');
const { db } = require('./db');
const { parse, required, date, fail } = require('./schemas');
const { sendAuthLink } = require('./mailer');

const VERIFY_TTL = 24 * 60 * 60 * 1000;
const RESET_TTL = 30 * 60 * 1000;
const LOCK_DURATION = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 10;
const SQLITE_CONSTRAINT_UNIQUE = 2067;
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const passwordHash = (password, salt = crypto.randomBytes(16).toString('hex')) =>
  `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const FAKE_PASSWORD_HASH = passwordHash('studia-invalid-account-password');

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || '').split(':');
  if (!salt || !/^[a-f0-9]{128}$/i.test(expected || '')) {
    crypto.scryptSync(password, 'studia-invalid-account-salt', 64);
    return false;
  }
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

const account = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  sessionDate: row.session_date,
  emailVerified: Boolean(row.email_verified),
});

function setSession(req, res, userId) {
  const previousToken = req.cookies?.studia_session;
  if (typeof previousToken === 'string' && previousToken)
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(previousToken));
  const token = crypto.randomBytes(32).toString('base64url');
  const lifetime = 14 * 86400000;
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(
    sha(token),
    userId,
    Date.now() + lifetime,
  );
  res.cookie('studia_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: lifetime,
  });
}

const credentials = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(128),
});
const emailSchema = z.object({ email: z.string().trim().email().max(120) });
const resetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(128),
});

function auth(req, res, next) {
  const token = req.cookies.studia_session;
  if (typeof token !== 'string' || !token) return fail(res, 401, 'Войдите в аккаунт');
  const session = db
    .prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?')
    .get(sha(token), Date.now());
  if (!session) return fail(res, 401, 'Войдите в аккаунт');
  req.userId = session.user_id;
  next();
}

function createAuthToken(userId, purpose) {
  const token = crypto.randomBytes(32).toString('base64url');
  const storedPurpose = purpose === 'verify_email' ? 'verify' : 'reset';
  db.prepare('DELETE FROM email_tokens WHERE user_id=? AND purpose=?').run(userId, storedPurpose);
  db.prepare('INSERT INTO email_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,?,?,?)').run(
    sha(token),
    userId,
    storedPurpose,
    Date.now() + (storedPurpose === 'verify' ? VERIFY_TTL : RESET_TTL),
  );
  return token;
}

async function sendToken(user, purpose) {
  const token = createAuthToken(user.id, purpose);
  const base = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
  const mode = purpose === 'verify_email' ? 'verify' : 'reset';
  return sendAuthLink({
    email: user.email,
    purpose,
    url: `${base}/#${mode}=${encodeURIComponent(token)}`,
  });
}

function consumeToken(token, purpose) {
  const row = db
    .prepare(
      'UPDATE email_tokens SET used_at=? WHERE token_hash=? AND purpose=? AND expires_at>? AND used_at IS NULL RETURNING user_id',
    )
    .get(Date.now(), sha(token), purpose === 'verify_email' ? 'verify' : 'reset', Date.now());
  return row?.user_id ?? null;
}

function registerAuthRoutes(app, limit) {
  app.post('/api/auth/register', limit('register', 12), async (req, res) => {
    const data = parse(credentials.extend({ name: required(60) }), req.body, res);
    if (!data) return;
    const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
    try {
      if (
        requireVerification &&
        process.env.NODE_ENV === 'production' &&
        (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS)
      )
        return fail(res, 503, 'Подтверждение email пока недоступно. Настройте почтовый сервер.');
      const existingUser = db
        .prepare('SELECT * FROM users WHERE email=?')
        .get(data.email.toLowerCase());
      if (existingUser) {
        if (!requireVerification) return fail(res, 409, 'Этот email уже зарегистрирован');
        await sendAuthLink({ email: existingUser.email, purpose: 'account_exists' });
        return res.status(202).json({
          message: 'Если регистрация возможна, инструкция будет отправлена на email.',
          verificationRequired: true,
        });
      }
      const row = db
        .prepare('INSERT INTO users(email,password_hash,name,email_verified) VALUES(?,?,?,?)')
        .run(
          data.email.toLowerCase(),
          passwordHash(data.password),
          data.name,
          requireVerification ? 0 : 1,
        );
      const user = db.prepare('SELECT * FROM users WHERE id=?').get(row.lastInsertRowid);
      if (requireVerification) {
        await sendToken(user, 'verify_email');
        return res.status(202).json({
          message: 'Если регистрация возможна, инструкция будет отправлена на email.',
          verificationRequired: true,
        });
      }
      setSession(req, res, user.id);
      res.status(201).json({ user: account(user), verificationRequired: false });
    } catch (error) {
      if (error.errcode === SQLITE_CONSTRAINT_UNIQUE) {
        if (requireVerification)
          return res.status(202).json({
            message: 'Если регистрация возможна, инструкция будет отправлена на email.',
            verificationRequired: true,
          });
        return fail(res, 409, 'Этот email уже зарегистрирован');
      }
      fail(res, 503, 'Не удалось создать аккаунт. Попробуйте позже.');
    }
  });

  app.post('/api/auth/login', limit('login', 30), (req, res) => {
    const data = parse(credentials, req.body, res);
    if (!data) return;
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(data.email.toLowerCase());
    const now = Date.now();
    if (user?.locked_until > now) {
      verifyPassword(data.password, FAKE_PASSWORD_HASH);
      return fail(res, 401, 'Неверный email или пароль');
    }
    const isValid = verifyPassword(data.password, user?.password_hash || FAKE_PASSWORD_HASH);
    if (!user || !isValid) {
      if (user) {
        const failures = (user.locked_until ? 0 : user.failed_logins) + 1;
        const lockedUntil = failures >= MAX_LOGIN_FAILURES ? now + LOCK_DURATION : null;
        db.prepare('UPDATE users SET failed_logins=?,locked_until=? WHERE id=?').run(
          failures,
          lockedUntil,
          user.id,
        );
      }
      return fail(res, 401, 'Неверный email или пароль');
    }
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.email_verified)
      return fail(res, 403, 'Подтвердите email, чтобы войти');
    db.prepare('UPDATE users SET failed_logins=0,locked_until=NULL WHERE id=?').run(user.id);
    setSession(req, res, user.id);
    res.json({ user: account(user) });
  });

  app.post('/api/auth/logout', auth, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(req.cookies.studia_session));
    res.clearCookie('studia_session', { path: '/' });
    res.sendStatus(204);
  });
  app.get('/api/me', auth, (req, res) =>
    res.json({ user: account(db.prepare('SELECT * FROM users WHERE id=?').get(req.userId)) }),
  );

  app.patch('/api/me', auth, (req, res) => {
    const data = parse(
      z.object({ name: required(60), sessionDate: date.nullable() }),
      req.body,
      res,
    );
    if (!data) return;
    db.prepare('UPDATE users SET name=?,session_date=? WHERE id=?').run(
      data.name,
      data.sessionDate,
      req.userId,
    );
    res.json({ user: account(db.prepare('SELECT * FROM users WHERE id=?').get(req.userId)) });
  });

  app.post('/api/auth/forgot', limit('auth-mail', 12), async (req, res) => {
    const data = parse(emailSchema, req.body, res);
    if (!data) return;
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(data.email.toLowerCase());
    if (user?.email_verified) {
      try {
        await sendToken(user, 'reset_password');
      } catch {
        console.error('Не удалось отправить письмо для восстановления пароля.');
      }
    }
    res.status(202).json({ message: 'Если аккаунт существует, инструкция отправлена на email.' });
  });

  app.post('/api/auth/resend-verification', limit('auth-mail', 12), async (req, res) => {
    const data = parse(emailSchema, req.body, res);
    if (!data) return;
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(data.email.toLowerCase());
    if (user && !user.email_verified) {
      try {
        await sendToken(user, 'verify_email');
      } catch {
        console.error('Не удалось отправить письмо для подтверждения email.');
      }
    }
    res
      .status(202)
      .json({ message: 'Если аккаунту требуется подтверждение, письмо будет отправлено.' });
  });

  app.post('/api/auth/verify', limit('auth-token', 20), (req, res) => {
    const data = parse(z.object({ token: z.string().min(20).max(200) }), req.body, res);
    if (!data) return;
    const userId = consumeToken(data.token, 'verify_email');
    if (!userId) return fail(res, 400, 'Ссылка подтверждения недействительна или устарела');
    db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(userId);
    res.json({ message: 'Email подтверждён. Теперь можно войти.' });
  });

  app.post('/api/auth/reset', limit('auth-token', 20), (req, res) => {
    const data = parse(resetSchema, req.body, res);
    if (!data) return;
    const userId = consumeToken(data.token, 'reset_password');
    if (!userId) return fail(res, 400, 'Ссылка сброса пароля недействительна или устарела');
    db.prepare('UPDATE users SET password_hash=?,failed_logins=0,locked_until=NULL WHERE id=?').run(
      passwordHash(data.password),
      userId,
    );
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
    db.prepare("DELETE FROM email_tokens WHERE user_id=? AND purpose='reset'").run(userId);
    res.json({ message: 'Пароль обновлён. Войдите с новым паролем.' });
  });

  const changePassword = (req, res) => {
    const data = parse(
      z.object({
        currentPassword: z.string().min(8).max(128),
        newPassword: z.string().min(8).max(128),
      }),
      req.body,
      res,
    );
    if (!data) return;
    const user = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.userId);
    if (!verifyPassword(data.currentPassword, user.password_hash))
      return fail(res, 400, 'Текущий пароль указан неверно');
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(
      passwordHash(data.newPassword),
      req.userId,
    );
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.userId);
    db.prepare("DELETE FROM email_tokens WHERE user_id=? AND purpose='reset'").run(req.userId);
    res.clearCookie('studia_session', { path: '/' });
    setSession(req, res, req.userId);
    res.json({ message: 'Пароль изменён. Сессии обновлены.' });
  };
  app.patch('/api/me/password', auth, changePassword);
  app.post('/api/me/password', auth, changePassword);
}

module.exports = {
  auth,
  account,
  sha,
  passwordHash,
  verifyPassword,
  setSession,
  registerAuthRoutes,
};
