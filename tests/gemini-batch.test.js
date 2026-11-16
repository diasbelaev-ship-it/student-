const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const value = server.address().port;
      server.close(() => resolve(value));
    });
    server.on('error', reject);
  });
}

test('Gemini prepares multiple classes, skips existing ones and saves the batch only after confirmation', async () => {
  const number = await freePort(),
    dir = mkdtempSync(path.join(tmpdir(), 'studia-ai-batch-'));
  const childEnv = {
    ...process.env,
    PORT: String(number),
    STUDIA_DB_PATH: path.join(dir, 'test.db'),
  };
  delete childEnv.GEMINI_API_KEY;
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: childEnv,
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${number}`;
  let cookie;
  async function request(route, method = 'GET', body) {
    const response = await fetch(base + route, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(base + '/api/me')).status === 401) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'server started');
    const signup = await request('/api/auth/register', 'POST', {
      name: 'Проверка',
      email: `ai-batch-${Date.now()}@example.test`,
      password: 'Test-password-2026!',
    });
    assert.equal(signup.status, 201);
    cookie = signup.cookie;
    const first = await request('/api/items', 'POST', {
      kind: 'schedule',
      payload: { title: 'Алгебра', day: 1, time: '10:00', end: '11:00', location: '' },
    });
    assert.equal(first.status, 201);

    const answer = await request('/api/ai', 'POST', {
      message:
        'Добавь пять пар на вторник: 1) Алгебра 10:00–11:00, 2) Уйгурский язык 11:00–12:00, 3) Физика 12:00–13:00, 4) История 13:00–14:00, 5) Английский 14:00–15:00. Подготовь весь список одним предложением и не дублируй уже добавленную алгебру.',
    });
    assert.equal(answer.status, 200, answer.data.error);
    assert.equal(answer.data.proposal?.action, 'batch', JSON.stringify(answer.data));
    assert.equal(answer.data.proposal.items.length, 4);
    assert.deepEqual(answer.data.proposal.items.map((item) => item.payload.time).sort(), [
      '11:00',
      '12:00',
      '13:00',
      '14:00',
    ]);
    assert.ok(
      answer.data.proposal.items.every(
        (item) => item.kind === 'schedule' && item.payload.day === 1,
      ),
    );
    assert.equal(
      (await request('/api/items')).data.length,
      1,
      'proposal must not write before confirmation',
    );

    const ownerCookie = cookie;
    cookie = undefined;
    const other = await request('/api/auth/register', 'POST', {
      name: 'Другой',
      email: `ai-batch-other-${Date.now()}@example.test`,
      password: 'Test-password-2026!',
    });
    assert.equal(other.status, 201, other.data.error);
    cookie = other.cookie;
    assert.equal(
      (await request('/api/ai/confirm', 'POST', { proposalId: answer.data.proposal.id })).status,
      404,
    );
    cookie = ownerCookie;
    const confirmed = await request('/api/ai/confirm', 'POST', {
      proposalId: answer.data.proposal.id,
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.data.result.created.length, 4);
    const saved = (await request('/api/items')).data;
    assert.equal(saved.length, 5);
    assert.equal(saved.filter((item) => item.payload.title.toLowerCase() === 'алгебра').length, 1);
    const incomplete = await request('/api/ai', 'POST', {
      message:
        'Добавь ещё две пары в среду: Физика 10:00–11:00 и вторая пара 11:00–12:00, предмет для второй пока не знаю.',
    });
    assert.equal(incomplete.status, 200, incomplete.data.error);
    assert.equal(incomplete.data.proposal, null, 'unnamed lesson should not create a fake subject');
  } finally {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
