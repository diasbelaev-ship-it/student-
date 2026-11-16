const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
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

async function launch(databasePath, directory) {
  const port = await freePort();
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      CLIENT_ORIGIN: 'http://localhost:5173',
      TRUST_PROXY: 'false',
      STUDIA_DB_PATH: databasePath,
      STUDIA_BACKUP_PATH: path.join(directory, 'backups'),
      STUDIA_GROUP_FILES_PATH: path.join(directory, 'group-files'),
      REQUIRE_EMAIL_VERIFICATION: 'false',
    },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  const request = async (
    route,
    method = 'GET',
    body,
    cookie,
    origin = 'http://localhost:5173',
    fetchSite,
  ) => {
    const response = await fetch(base + route, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(origin ? { Origin: origin } : {}),
        ...(fetchSite ? { 'Sec-Fetch-Site': fetchSite } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      data: response.status === 204 ? null : await response.json().catch(() => null),
      headers: response.headers,
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  };
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await request('/api/me')).status === 401) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  assert.ok(ready, 'server starts with an isolated persistent database');
  return {
    server,
    request,
    async stop() {
      if (server.exitCode === null && server.signalCode === null) {
        const exited = new Promise((resolve) => server.once('exit', resolve));
        server.kill();
        await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
      }
    },
  };
}

test('production headers and user records survive an application restart', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'studia-persist-'));
  const databasePath = path.join(directory, 'studia.db');
  let app;
  try {
    app = await launch(databasePath, directory);
    const headers = await app.request('/api/me');
    assert.ok(headers.headers.get('content-security-policy'));
    assert.ok(headers.headers.get('strict-transport-security'));
    assert.equal(headers.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(
      headers.headers.get('permissions-policy'),
      'camera=(), microphone=(self), geolocation=()',
    );
    assert.equal(
      (
        await app.request(
          '/api/auth/register',
          'POST',
          {
            name: 'Студент',
            email: `persist-${crypto.randomUUID()}@example.test`,
            password: 'Student-password-2026!',
          },
          undefined,
          null,
        )
      ).status,
      201,
      'non-browser clients can send requests without Origin',
    );
    const crossSite = await app.request(
      '/api/auth/register',
      'POST',
      {
        name: 'Студент',
        email: `cross-${crypto.randomUUID()}@example.test`,
        password: 'Student-password-2026!',
      },
      undefined,
      null,
      'cross-site',
    );
    assert.equal(crossSite.status, 403);

    const email = `persist-${crypto.randomUUID()}@example.test`;
    const password = 'Student-password-2026!';
    const registered = await app.request('/api/auth/register', 'POST', {
      name: 'Студент',
      email,
      password,
    });
    assert.equal(registered.status, 201);
    assert.match(registered.headers.get('set-cookie'), /Secure/i);
    let cookie = registered.cookie;

    const records = [
      { kind: 'course', payload: { title: 'Математика', color: '#B96B58' } },
      {
        kind: 'schedule',
        payload: { title: 'Математика', day: 0, time: '09:00', end: '10:00', courseId: 1 },
      },
      {
        kind: 'task',
        payload: {
          title: 'Подготовить работу',
          date: '2026-11-10',
          status: 'todo',
          priority: 'high',
          courseId: 1,
        },
      },
      {
        kind: 'grade',
        payload: { title: 'Математика', grade: 3.6, credits: 4, type: 'course', courseId: 1 },
      },
    ];
    const first = await app.request('/api/items', 'POST', records[0], cookie);
    assert.equal(first.status, 201);
    const courseId = first.data.id;
    records.slice(1).forEach((record) => {
      record.payload.courseId = courseId;
    });
    for (const record of records.slice(1))
      assert.equal((await app.request('/api/items', 'POST', record, cookie)).status, 201);
    await app.stop();

    app = await launch(databasePath, directory);
    const login = await app.request('/api/auth/login', 'POST', { email, password });
    assert.equal(login.status, 200);
    cookie = login.cookie;
    const persisted = await app.request('/api/items?limit=200', 'GET', undefined, cookie);
    assert.equal(persisted.status, 200);
    assert.deepEqual(
      new Set(persisted.data.items.map((item) => item.kind)),
      new Set(['course', 'schedule', 'task', 'grade']),
    );
    assert.equal(persisted.data.items.find((item) => item.kind === 'course').id, courseId);
  } finally {
    await app?.stop();
    rmSync(directory, { recursive: true, force: true });
  }
});
