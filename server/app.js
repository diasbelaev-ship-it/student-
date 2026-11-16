const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { db, groupFilesPath, migrateDatabase, scheduleBackups } = require('./db');
const { fail } = require('./schemas');
const { auth, registerAuthRoutes } = require('./auth');
const { registerItemRoutes } = require('./items');
const { registerAiRoutes } = require('./ai');
const { registerGroupRoutes } = require('./groups');
const { registerChatRoutes } = require('./chats');
const { pruneAttempts, createRateLimiter } = require('./rate-limit');
const { resolveBindAddress } = require('./runtime-host');

function createApp() {
  migrateDatabase();
  const app = express();
  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const proxyValue = process.env.TRUST_PROXY;
  if (proxyValue && proxyValue !== 'false') {
    const proxyHops = Number(proxyValue);
    if (!Number.isInteger(proxyHops) || proxyHops < 0)
      throw new Error('TRUST_PROXY должен быть false или числом доверенных прокси.');
    if (proxyHops > 0) app.set('trust proxy', proxyHops);
  }
  app.disable('x-powered-by');
  app.use(
    helmet({
      hsts: process.env.NODE_ENV === 'production',
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'"],
          'connect-src':
            process.env.NODE_ENV === 'production'
              ? ["'self'"]
              : ["'self'", 'ws:', 'http://localhost:*'],
          'frame-ancestors': ["'none'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
        },
      },
    }),
  );
  app.use((req, res, next) => {
    res.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const requestOrigin = req.get('origin');
    const changesData = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (changesData && req.get('sec-fetch-site') === 'cross-site')
      return fail(res, 403, 'Запрос с другого сайта запрещён');
    if (changesData && requestOrigin) {
      let sameHost = false;
      try {
        sameHost = new URL(requestOrigin).host === req.get('host');
      } catch {}
      if (requestOrigin !== origin && !sameHost)
        return fail(res, 403, 'Запрос с другого сайта запрещён');
    }
    next();
  });
  // Only requests that send photos need the larger body limit.
  app.post('/api/ai', express.json({ limit: '12mb' }));
  app.use('/api', express.json({ limit: '300kb' }), cookieParser());
  const attempts = new Map();
  const cleanupTimer = setInterval(
    () => {
      const now = Date.now();
      pruneAttempts(attempts, now);
      db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now);
      db.prepare('DELETE FROM proposals WHERE expires_at<=?').run(now);
      db.prepare('DELETE FROM email_tokens WHERE expires_at<=? OR used_at IS NOT NULL').run(now);
      db.prepare('UPDATE users SET failed_logins=0,locked_until=NULL WHERE locked_until<=?').run(
        now,
      );
    },
    60 * 60 * 1000,
  );
  cleanupTimer.unref();
  const now = Date.now();
  db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now);
  db.prepare('DELETE FROM proposals WHERE expires_at<?').run(now);
  db.prepare('DELETE FROM email_tokens WHERE expires_at<? OR used_at IS NOT NULL').run(now);
  db.prepare('UPDATE users SET failed_logins=0,locked_until=NULL WHERE locked_until<?').run(now);
  const limit = createRateLimiter(attempts, fail);
  registerAuthRoutes(app, limit);
  registerItemRoutes(app, auth);
  registerAiRoutes(app, auth, limit, fail);
  registerGroupRoutes({ app, db, auth, fail, storage: groupFilesPath() });
  registerChatRoutes({ app, db, auth, limit });
  app.use('/api', (req, res) => fail(res, 404, 'Маршрут API не найден'));
  app.use('/api', (error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error?.type === 'entity.too.large')
      return fail(res, 413, 'Запрос превышает допустимый размер');
    if (error?.type === 'entity.parse.failed') return fail(res, 400, 'Некорректный JSON');
    if (error?.status === 400 || error?.status === 415)
      return fail(res, error.status, 'Некорректный формат запроса');
    if (error?.status === 404) return fail(res, 404, 'Ресурс не найден');
    console.error('Ошибка API:', error?.name || 'Error');
    return fail(res, 500, 'Внутренняя ошибка сервера');
  });
  if (existsSync('dist')) {
    app.use(express.static('dist'));
    app.get('*', (req, res) => res.sendFile(path.resolve('dist/index.html')));
  }
  return app;
}

function startServer() {
  const port = Number(process.env.PORT || 3001);
  const app = createApp();
  scheduleBackups();
  return app.listen(port, resolveBindAddress(), () =>
    console.log(`Studia API: http://localhost:${port}`),
  );
}

module.exports = { createApp, startServer };
