const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');

async function freePort() {
  return new Promise((resolve) => {
    const socket = net.createServer();
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

test('Gemini group actions require membership and explicit confirmation', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'studia-ai-groups-'));
  const port = await freePort();
  const dueDate = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
  const responses = [
    {
      expectPromptParts: ['Доступные учебные группы', 'История · 21', 'без переписки и файлов'],
      message: 'Подготовлен общий срок.',
      proposal: {
        action: 'groupTask',
        groupId: 1,
        groupTask: { title: 'Сдать доклад', dueDate, course: 'История' },
      },
    },
    {
      message: 'Подготовлено сообщение.',
      proposal: {
        action: 'groupMessage',
        groupId: 1,
        groupMessage: { body: 'Встречаемся после пары в библиотеке.' },
      },
    },
    {
      message: 'Чужая группа.',
      proposal: { action: 'groupTask', groupId: 999, groupTask: { title: 'Чужой срок', dueDate } },
    },
  ];
  const child = spawn(
    process.execPath,
    ['--require', path.resolve(__dirname, 'fake-gemini.cjs'), 'server/index.js'],
    {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(port),
        STUDIA_DB_PATH: path.join(dir, 'test.db'),
        STUDIA_GROUP_FILES_PATH: path.join(dir, 'files'),
        GEMINI_API_KEY: 'test-only',
        STUDIA_TEST_AI_RESPONSES: JSON.stringify(responses),
      },
      stdio: 'ignore',
    },
  );
  const base = `http://127.0.0.1:${port}`;
  async function request(route, method = 'GET', body, cookie) {
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
      data: response.status === 204 ? null : await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await request('/api/me')).status === 401) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready);
    const password = 'Test-password-2026!';
    const first = await request('/api/auth/register', 'POST', {
      name: 'Алия',
      email: 'aliya-ai@example.test',
      password,
    });
    const other = await request('/api/auth/register', 'POST', {
      name: 'Другой',
      email: 'other-ai@example.test',
      password,
    });
    assert.equal(first.status, 201);
    const group = await request('/api/groups', 'POST', { name: 'История · 21' }, first.cookie);
    assert.equal(group.status, 201);
    const askTask = await request(
      '/api/ai',
      'POST',
      { message: 'Добавь группе История · 21 дедлайн доклада' },
      first.cookie,
    );
    assert.equal(askTask.status, 200, askTask.data.error);
    assert.equal(askTask.data.proposal.action, 'groupTask');
    assert.equal(
      (await request(`/api/groups/${group.data.id}`, 'GET', undefined, first.cookie)).data.tasks
        .length,
      0,
    );
    assert.equal(
      (
        await request(
          '/api/ai/confirm',
          'POST',
          { proposalId: askTask.data.proposal.id },
          other.cookie,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          '/api/ai/confirm',
          'POST',
          { proposalId: askTask.data.proposal.id },
          first.cookie,
        )
      ).status,
      200,
    );
    assert.equal(
      (await request(`/api/groups/${group.data.id}`, 'GET', undefined, first.cookie)).data.tasks[0]
        .title,
      'Сдать доклад',
    );
    const askMessage = await request(
      '/api/ai',
      'POST',
      { message: 'Напиши группе: Встречаемся после пары в библиотеке.' },
      first.cookie,
    );
    assert.equal(askMessage.status, 200, askMessage.data.error);
    assert.equal(
      (await request(`/api/groups/${group.data.id}`, 'GET', undefined, first.cookie)).data.messages
        .length,
      0,
    );
    assert.equal(
      (
        await request(
          '/api/ai/confirm',
          'POST',
          { proposalId: askMessage.data.proposal.id },
          first.cookie,
        )
      ).status,
      200,
    );
    assert.equal(
      (await request(`/api/groups/${group.data.id}`, 'GET', undefined, first.cookie)).data
        .messages[0].body,
      'Встречаемся после пары в библиотеке.',
    );
    const invalid = await request(
      '/api/ai',
      'POST',
      { message: 'Добавь дедлайн в чужую группу' },
      first.cookie,
    );
    assert.equal(invalid.status, 502);
  } finally {
    await new Promise((resolve) => {
      child.once('exit', resolve);
      child.kill();
      setTimeout(resolve, 3000).unref();
    });
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
