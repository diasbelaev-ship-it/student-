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

test('direct chats are private to participants and validate messages', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'studia-direct-chat-'));
  const port = await freePort();
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      STUDIA_DB_PATH: path.join(directory, 'test.db'),
      STUDIA_GROUP_FILES_PATH: path.join(directory, 'files'),
      GEMINI_API_KEY: '',
    },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  const request = async (route, method = 'GET', body, cookie) => {
    const response = await fetch(base + route, {
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
      cookie: response.headers.get('set-cookie')?.split(';')[0],
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
    assert.ok(ready, 'server started');
    const suffix = crypto.randomUUID().slice(0, 8);
    const password = 'Student-password-2026!';
    const createUser = (name, email) =>
      request('/api/auth/register', 'POST', { name, email, password });
    const alice = await createUser('Айгерим', `aigerim-${suffix}@example.test`);
    const dias = await createUser('Диас', `dias-${suffix}@example.test`);
    const outsider = await createUser('Другой студент', `other-${suffix}@example.test`);
    assert.equal(alice.status, 201);
    assert.equal(dias.status, 201);
    assert.equal(outsider.status, 201);

    const created = await request(
      '/api/chats',
      'POST',
      { email: `DIAS-${suffix}@EXAMPLE.TEST` },
      alice.cookie,
    );
    assert.equal(created.status, 201);
    const chatId = created.data.id;
    const duplicate = await request(
      '/api/chats',
      'POST',
      { email: `dias-${suffix}@example.test` },
      alice.cookie,
    );
    assert.equal(duplicate.data.id, chatId, 'a pair has only one conversation');
    assert.deepEqual((await request('/api/chats', 'GET', undefined, alice.cookie)).data[0].peer, {
      id: dias.data.user.id,
      name: 'Диас',
    });
    assert.equal((await request('/api/chats', 'GET', undefined, outsider.cookie)).data.length, 0);
    assert.equal(
      (await request(`/api/chats/${chatId}/messages`, 'GET', undefined, outsider.cookie)).status,
      404,
    );
    assert.equal(
      (await request('/api/chats', 'POST', { email: alice.data.user.email }, alice.cookie)).status,
      404,
    );

    assert.equal(
      (await request(`/api/chats/${chatId}/messages`, 'POST', { body: '   ' }, alice.cookie))
        .status,
      400,
    );
    assert.equal(
      (
        await request(
          `/api/chats/${chatId}/messages`,
          'POST',
          { body: 'x'.repeat(3001) },
          alice.cookie,
        )
      ).status,
      400,
    );
    const sent = await request(
      `/api/chats/${chatId}/messages`,
      'POST',
      { body: 'Сәлем, как дела?' },
      alice.cookie,
    );
    assert.equal(sent.status, 201);
    assert.equal(sent.data.userName, 'Айгерим');
    const received = await request(`/api/chats/${chatId}/messages`, 'GET', undefined, dias.cookie);
    assert.equal(received.data[0].body, 'Сәлем, как дела?');
    assert.equal(
      (
        await request(
          `/api/chats/${chatId}/messages?after=${sent.data.id}`,
          'GET',
          undefined,
          dias.cookie,
        )
      ).data.length,
      0,
    );
    assert.equal(
      (await request(`/api/chats/${chatId}/messages?after=invalid`, 'GET', undefined, dias.cookie))
        .status,
      400,
    );

    const answer = await request(
      `/api/chats/${chatId}/messages`,
      'POST',
      { body: 'Сәлем!' },
      dias.cookie,
    );
    const updates = await request(
      `/api/chats/${chatId}/messages?after=${sent.data.id}`,
      'GET',
      undefined,
      alice.cookie,
    );
    assert.equal(updates.data[0].id, answer.data.id);
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
