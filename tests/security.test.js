const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { once } = require('node:events');

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

async function startServer(env = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'studia-security-'));
  const port = await freePort();
  const dbPath = path.join(directory, 'security.db');
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      STUDIA_DB_PATH: dbPath,
      GEMINI_API_KEY: '',
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  let output = '';
  server.stdout.on('data', (chunk) => (output += chunk.toString()));
  const base = `http://127.0.0.1:${port}`;
  const request = async (route, method = 'GET', body, cookie, origin = 'http://localhost:5173') => {
    const response = await fetch(base + route, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(origin ? { Origin: origin } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    return {
      status: response.status,
      data,
      cookie: response.headers.get('set-cookie')?.split(';')[0],
      headers: response.headers,
    };
  };
  for (let index = 0; index < 100; index++) {
    try {
      if ((await request('/api/me')).status === 401) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return {
    server,
    directory,
    dbPath,
    base,
    request,
    get output() {
      return output;
    },
  };
}

test('security headers, CSRF origin guard, lockout and password rotation', async () => {
  const app = await startServer();
  try {
    const headers = await app.request('/api/me');
    assert.equal(headers.status, 401);
    assert.ok(headers.headers.get('content-security-policy'));
    assert.equal(headers.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.headers.get('cache-control'), 'no-store');
    assert.equal(
      (await app.request('/api/me', 'GET', undefined, 'studia_session=j%3A%7B%7D')).status,
      401,
      'cookie-parser JSON values cannot be used as session tokens',
    );
    const malformed = await fetch(app.base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":',
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: 'Некорректный JSON' });
    const missing = await app.request('/api/missing-endpoint');
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.data, { error: 'Маршрут API не найден' });
    assert.equal(
      (
        await app.request(
          '/api/auth/register',
          'POST',
          {
            name: 'Студент',
            email: 'lock@example.test',
            password: 'Student-password-1!',
          },
          undefined,
          'https://evil.example',
        )
      ).status,
      403,
    );

    const password = 'Student-password-2026!';
    const registered = await app.request('/api/auth/register', 'POST', {
      name: 'Студент',
      email: 'lock@example.test',
      password,
    });
    assert.equal(registered.status, 201);
    const duplicate = await app.request('/api/auth/register', 'POST', {
      name: 'Повторная регистрация',
      email: 'LOCK@example.test',
      password,
    });
    assert.equal(duplicate.status, 409);
    for (let attempt = 0; attempt < 10; attempt++) {
      assert.equal(
        (
          await app.request('/api/auth/login', 'POST', {
            email: 'lock@example.test',
            password: 'Wrong-password-2026!',
          })
        ).status,
        401,
      );
    }
    assert.equal(
      (
        await app.request('/api/auth/login', 'POST', {
          email: 'lock@example.test',
          password,
        })
      ).status,
      401,
    );

    const db = new DatabaseSync(app.dbPath);
    db.prepare('UPDATE users SET locked_until=? WHERE email=?').run(
      Date.now() - 1,
      'lock@example.test',
    );
    db.close();
    assert.equal(
      (
        await app.request('/api/auth/login', 'POST', {
          email: 'lock@example.test',
          password: 'Wrong-password-2026!',
        })
      ).status,
      401,
    );
    const login = await app.request(
      '/api/auth/login',
      'POST',
      {
        email: 'lock@example.test',
        password,
      },
      'studia_session=j%3A%7B%7D',
    );
    assert.equal(login.status, 200, 'one failed login after expiry does not immediately relock');
    const expiredProposal = crypto.randomUUID();
    const proposalDb = new DatabaseSync(app.dbPath);
    const owner = proposalDb.prepare('SELECT id FROM users WHERE email=?').get('lock@example.test');
    proposalDb
      .prepare('INSERT INTO proposals(id,user_id,action,item,expires_at) VALUES(?,?,?,?,?)')
      .run(
        expiredProposal,
        owner.id,
        'create',
        JSON.stringify({ kind: 'task', payload: { title: 'Не должно сохраниться' } }),
        Date.now() - 1,
      );
    const oldResetToken = 'previous-reset-link-123456789';
    proposalDb
      .prepare('INSERT INTO email_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,?,?,?)')
      .run(
        crypto.createHash('sha256').update(oldResetToken).digest('hex'),
        owner.id,
        'reset',
        Date.now() + 60000,
      );
    proposalDb.close();
    assert.equal(
      (await app.request('/api/ai/confirm', 'POST', { proposalId: expiredProposal }, login.cookie))
        .status,
      404,
    );
    const patchWrongPassword = await app.request(
      '/api/me/password',
      'PATCH',
      {
        currentPassword: 'Wrong-password-2026!',
        newPassword: 'New-student-password-2026!',
      },
      login.cookie,
    );
    assert.equal(patchWrongPassword.status, 400);
    const changed = await app.request(
      '/api/me/password',
      'POST',
      {
        currentPassword: password,
        newPassword: 'New-student-password-2026!',
      },
      login.cookie,
    );
    assert.equal(changed.status, 200);
    assert.notEqual(changed.cookie, login.cookie);
    assert.equal((await app.request('/api/me', 'GET', undefined, login.cookie)).status, 401);
    assert.equal(
      (
        await app.request('/api/auth/reset', 'POST', {
          token: oldResetToken,
          password: 'Another-password-2026!',
        })
      ).status,
      400,
      'changing the password invalidates earlier recovery links',
    );
    assert.equal(
      (
        await app.request('/api/auth/login', 'POST', {
          email: 'lock@example.test',
          password,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await app.request('/api/auth/login', 'POST', {
          email: 'lock@example.test',
          password: 'New-student-password-2026!',
        })
      ).status,
      200,
    );
  } finally {
    if (app.server.exitCode === null && app.server.signalCode === null) {
      const exited = once(app.server, 'exit');
      app.server.kill();
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
    }
    rmSync(app.directory, { recursive: true, force: true });
  }
});

test('verification and recovery tokens are single use and do not reveal account existence', async () => {
  const app = await startServer({ REQUIRE_EMAIL_VERIFICATION: 'true' });
  try {
    const email = `verify-${crypto.randomUUID()}@example.test`;
    const password = 'Student-password-2026!';
    const registered = await app.request('/api/auth/register', 'POST', {
      name: 'Студент',
      email,
      password,
    });
    assert.equal(registered.status, 202);
    assert.equal(registered.data.verificationRequired, true);
    assert.equal(registered.cookie, undefined);
    const duplicateRegistration = await app.request('/api/auth/register', 'POST', {
      name: 'Ещё студент',
      email,
      password,
    });
    assert.equal(duplicateRegistration.status, registered.status);
    assert.deepEqual(duplicateRegistration.data, registered.data);
    let token;
    for (let index = 0; index < 30 && !token; index++) {
      token = app.output.match(/#verify=([A-Za-z0-9_-]+)/)?.[1];
      if (!token) await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(token, 'development mailer writes the verification link');
    assert.equal((await app.request('/api/auth/login', 'POST', { email, password })).status, 403);
    assert.equal((await app.request('/api/auth/verify', 'POST', { token })).status, 200);
    assert.equal((await app.request('/api/auth/verify', 'POST', { token })).status, 400);
    const loggedIn = await app.request('/api/auth/login', 'POST', { email, password });
    assert.equal(loggedIn.status, 200);
    assert.equal(loggedIn.data.user.emailVerified, true);

    assert.equal(
      (await app.request('/api/auth/forgot', 'POST', { email: 'absent@example.test' })).status,
      202,
    );
    const forgotAbsent = await app.request('/api/auth/forgot', 'POST', {
      email: 'missing@example.test',
    });
    const forgotExisting = await app.request('/api/auth/forgot', 'POST', { email });
    assert.equal(forgotExisting.status, 202);
    assert.deepEqual(forgotAbsent.data, forgotExisting.data);
    let resetToken;
    for (let index = 0; index < 30 && !resetToken; index++) {
      resetToken = app.output.match(/#reset=([A-Za-z0-9_-]+)/)?.[1];
      if (!resetToken) await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(resetToken, 'development mailer writes the reset link');
    assert.equal(
      (
        await app.request('/api/auth/reset', 'POST', {
          token: resetToken,
          password: 'Another-password-2026!',
        })
      ).status,
      200,
    );
    assert.equal((await app.request('/api/me', 'GET', undefined, loggedIn.cookie)).status, 401);
    assert.equal(
      (
        await app.request('/api/auth/reset', 'POST', {
          token: resetToken,
          password: 'Another-password-2026!',
        })
      ).status,
      400,
    );
    const expired = new DatabaseSync(app.dbPath);
    expired
      .prepare('INSERT INTO email_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,?,?,?)')
      .run(
        crypto.createHash('sha256').update('expired-reset-token-123456789').digest('hex'),
        expired.prepare('SELECT id FROM users WHERE email=?').get(email).id,
        'reset',
        Date.now() - 1,
      );
    expired.close();
    assert.equal(
      (
        await app.request('/api/auth/reset', 'POST', {
          token: 'expired-reset-token-123456789',
          password: 'New-password-2026!',
        })
      ).status,
      400,
    );
  } finally {
    if (app.server.exitCode === null && app.server.signalCode === null) {
      const exited = once(app.server, 'exit');
      app.server.kill();
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
    }
    rmSync(app.directory, { recursive: true, force: true });
  }
});
