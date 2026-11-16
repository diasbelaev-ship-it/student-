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
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function pngBytes(size) {
  const bytes = Buffer.alloc(size);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  return bytes;
}

test('AI accepts validated image-only and follow-up image requests without storing image data', async () => {
  const port = await freePort();
  const dir = mkdtempSync(path.join(tmpdir(), 'studia-ai-images-'));
  const largeImage = pngBytes(310 * 1024).toString('base64');
  const followUpImage = pngBytes(24).toString('base64');
  const responses = [
    {
      expectPromptParts: ['терпеливый репетитор', 'помоги решить его по шагам'],
      expectInlineData: [{ mimeType: 'image/png', minLength: 400_000 }],
      expectImageTurns: [
        { role: 'user', mimeType: 'image/png', textContains: 'помоги решить его по шагам' },
      ],
      forbidPromptParts: [largeImage],
      message: 'На изображении видны учебные материалы.',
      proposal: null,
    },
    {
      expectPromptParts: ['В истории есть предыдущее сообщение с изображением'],
      expectInlineData: [{ mimeType: 'image/png', data: followUpImage }],
      expectImageTurns: [{ role: 'user', mimeType: 'image/png', data: followUpImage }],
      message: 'На прошлом фото показаны учебные записи.',
      proposal: null,
    },
    { fakeStatus: 429 },
    { fakeStatus: 403 },
    { fakeStatus: 400, fakeError: { error: { details: [{ reason: 'API_KEY_INVALID' }] } } },
    { fakeStatus: 404 },
    { fakeNetworkError: true },
    { fakeCandidate: { finishReason: 'MAX_TOKENS' } },
    { fakeStatus: 503 },
    {
      fakeCandidate: {
        finishReason: 'STOP',
        content: {
          parts: [
            { thought: true, text: 'внутренняя часть' },
            { text: '```json\n{"message":"Ответ после сбоя"}\n```' },
          ],
        },
      },
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
    const registered = await request('/api/auth/register', 'POST', {
      name: 'Студент изображений',
      email: `images-${suffix}@example.test`,
      password: 'Test-password-2026!',
    });
    assert.equal(registered.status, 201);

    const empty = await request('/api/ai', 'POST', { message: '', images: [] }, registered.cookie);
    assert.equal(empty.status, 400, 'empty message without an image is rejected');

    const valid = await request(
      '/api/ai',
      'POST',
      { message: '', images: [{ mimeType: 'image/png', data: largeImage }] },
      registered.cookie,
    );
    assert.equal(valid.status, 200, 'AI body parser accepts image payloads larger than 300 KB');
    assert.match(valid.data.message, /учебные материалы/);

    const followUp = await request(
      '/api/ai',
      'POST',
      {
        message: 'Что было на прошлом фото?',
        history: [
          { role: 'user', text: '', images: [{ mimeType: 'image/png', data: followUpImage }] },
          { role: 'assistant', text: 'Я вижу конспект.' },
        ],
      },
      registered.cookie,
    );
    assert.equal(followUp.status, 200, 'a recent image can be referenced in the next turn');

    for (const [expectedStatus, expectedMessage] of [
      [503, /квоту/],
      [502, /API-ключ/],
      [502, /API-ключ/],
      [502, /GEMINI_MODEL/],
      [503, /сетевой доступ/],
      [502, /несколько коротких/],
    ]) {
      const failure = await request('/api/ai', 'POST', { message: 'Проверка' }, registered.cookie);
      assert.equal(failure.status, expectedStatus);
      assert.match(failure.data.error, expectedMessage);
    }

    const recovered = await request('/api/ai', 'POST', { message: 'Проверка' }, registered.cookie);
    assert.equal(recovered.status, 200, 'temporary Gemini 503 is retried once');
    assert.equal(recovered.data.message, 'Ответ после сбоя');

    const wrongSignature = await request(
      '/api/ai',
      'POST',
      { message: 'Проверь фото', images: [{ mimeType: 'image/jpeg', data: followUpImage }] },
      registered.cookie,
    );
    assert.equal(wrongSignature.status, 400, 'MIME type must match the file signature');

    const oversized = await request(
      '/api/ai',
      'POST',
      {
        message: 'Большое фото',
        images: [{ mimeType: 'image/png', data: pngBytes(2 * 1024 * 1024 + 1).toString('base64') }],
      },
      registered.cookie,
    );
    assert.equal(oversized.status, 400, 'single images above 2 MiB are rejected');

    const rows = await request('/api/items', 'GET', undefined, registered.cookie);
    assert.deepEqual(rows.data, [], 'images are sent transiently and are not persisted as records');
  } finally {
    child.kill();
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
      setTimeout(resolve, 3000).unref();
    });
    rmSync(dir, { recursive: true, force: true });
  }
});
