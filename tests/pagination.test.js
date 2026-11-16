const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');

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

test('items cursor pagination covers 450 rows, filters, since queries and legacy clients', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'studia-pages-'));
  const databasePath = path.join(directory, 'pagination.db');
  const port = await freePort();
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), STUDIA_DB_PATH: databasePath, GEMINI_API_KEY: '' },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  const request = async (url, method = 'GET', body, cookie) => {
    const response = await fetch(base + url, {
      method,
      headers: {
        Origin: 'http://localhost:5173',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      data: response.status === 204 ? null : await response.json(),
    };
  };
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await request('/api/me')).status === 401) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'server starts with a migrated database');
    const email = `pages-${crypto.randomUUID()}@example.test`;
    const account = await request('/api/auth/register', 'POST', {
      name: 'Студент',
      email,
      password: 'Student-password-2026!',
    });
    assert.equal(account.status, 201);
    const registration = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ email, password: 'Student-password-2026!' }),
    });
    const session = registration.headers.get('set-cookie')?.split(';')[0];
    assert.ok(session);

    const db = new DatabaseSync(databasePath);
    const user = db.prepare('SELECT id FROM users WHERE email=?').get(email);
    const timestamp = '2026-10-29 12:00:00';
    db.prepare('UPDATE items SET updated_at=? WHERE user_id=?').run(timestamp, user.id);
    const add = db.prepare('INSERT INTO items(user_id,kind,payload,updated_at) VALUES(?,?,?,?)');
    for (let index = 0; index < 450; index++)
      add.run(
        user.id,
        index % 2 ? 'task' : 'note',
        JSON.stringify({ title: `Запись ${index}` }),
        timestamp,
      );
    db.close();

    const all = [];
    let cursor = null;
    let requests = 0;
    do {
      const query = new URLSearchParams({ limit: '123' });
      if (cursor) query.set('cursor', cursor);
      const page = await request(`/api/items?${query}`, 'GET', undefined, session);
      assert.equal(page.status, 200);
      assert.equal(Array.isArray(page.data.items), true);
      all.push(...page.data.items);
      cursor = page.data.nextCursor;
      requests++;
    } while (cursor);
    assert.equal(requests, 4);
    assert.equal(all.length, 450);
    assert.equal(new Set(all.map((item) => item.id)).size, 450);
    assert.deepEqual(
      all.map((item) => item.id),
      all.map((item) => item.id).sort((a, b) => b - a),
      'equal timestamps are ordered by descending ID across pages',
    );
    const legacy = await request('/api/items', 'GET', undefined, session);
    assert.equal(legacy.data.items.length, 200);
    assert.ok(legacy.data.nextCursor);

    const filtered = await request(
      '/api/items?kind=task,note&limit=500',
      'GET',
      undefined,
      session,
    );
    assert.equal(filtered.status, 200);
    assert.equal(filtered.data.items.length, 450);
    assert.ok(filtered.data.items.every((item) => ['task', 'note'].includes(item.kind)));
    const repeatedKind = await request(
      '/api/items?kind=task,task&limit=500',
      'GET',
      undefined,
      session,
    );
    assert.equal(repeatedKind.status, 200);
    assert.equal(repeatedKind.data.items.length, 225);
    const changed = await request(
      '/api/items?updatedSince=2000-01-01%2000%3A00%3A00&limit=500',
      'GET',
      undefined,
      session,
    );
    assert.equal(changed.data.items.length, 450);
    assert.equal((await request('/api/items?limit=501', 'GET', undefined, session)).status, 400);
    assert.equal((await request('/api/items?cursor=bad', 'GET', undefined, session)).status, 400);
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
