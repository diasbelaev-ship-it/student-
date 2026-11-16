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

test('Gemini proposes and confirms changes without bypassing user consent', async () => {
  const number = await freePort(),
    dir = mkdtempSync(path.join(tmpdir(), 'studia-ai-action-'));
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
    const data = await response.json();
    return {
      status: response.status,
      data,
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
      name: 'Тест',
      email: `ai-actions-${Date.now()}@example.test`,
      password: 'Test-password-2026!',
    });
    assert.equal(signup.status, 201);
    cookie = signup.cookie;
    const proposed = await request('/api/ai', 'POST', {
      message:
        'Добавь в Финансы расход: Обед в столовой, 1500 тенге, дата 2026-10-15. Подготовь запись для моего подтверждения.',
    });
    assert.equal(proposed.status, 200, proposed.data.error);
    assert.equal(proposed.data.proposal?.action, 'create');
    assert.equal(proposed.data.proposal?.item?.kind, 'expense');
    assert.equal(
      (await request('/api/items')).data.length,
      0,
      'proposal must not write before confirmation',
    );
    const firstCookie = cookie;
    cookie = null;
    const second = await request('/api/auth/register', 'POST', {
      name: 'Другой',
      email: `ai-other-${Date.now()}@example.test`,
      password: 'Test-password-2026!',
    });
    cookie = second.cookie;
    assert.equal(
      (await request('/api/ai/confirm', 'POST', { proposalId: proposed.data.proposal.id })).status,
      404,
      'other user cannot confirm proposal',
    );
    cookie = firstCookie;
    const confirmation = await request('/api/ai/confirm', 'POST', {
      proposalId: proposed.data.proposal.id,
    });
    assert.equal(confirmation.status, 200);
    assert.equal(confirmation.data.result.kind, 'expense');
    assert.equal((await request('/api/items')).data.length, 1);
    const profile = await request('/api/ai', 'POST', {
      message:
        'В профиле поставь дату начала сессии 2026-12-18. Подготовь изменение для подтверждения.',
    });
    assert.equal(profile.status, 200, profile.data.error);
    assert.equal(profile.data.proposal?.action, 'profile');
    assert.equal(
      (await request('/api/ai/confirm', 'POST', { proposalId: profile.data.proposal.id })).data
        .result.user.sessionDate,
      '2026-12-18',
    );
    const focus = await request('/api/ai', 'POST', {
      message:
        'Настрой таймер Фокус на 30 минут, тема Математика. Не запускай, только подготовь изменение для подтверждения.',
    });
    assert.equal(focus.status, 200, focus.data.error);
    assert.equal(focus.data.proposal?.action, 'focus');
    assert.equal(
      (await request('/api/ai/confirm', 'POST', { proposalId: focus.data.proposal.id })).data.result
        .focus.minutes,
      30,
    );
  } finally {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
