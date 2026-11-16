const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');

async function port() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const value = server.address().port;
      server.close(() => resolve(value));
    });
    server.on('error', reject);
  });
}
test('Gemini answers through the authenticated server endpoint', async () => {
  const number = await port(),
    dir = mkdtempSync(path.join(tmpdir(), 'studia-ai-test-'));
  const childEnv = {
    ...process.env,
    PORT: String(number),
    STUDIA_DB_PATH: path.join(dir, 'test.db'),
  };
  delete childEnv.GEMINI_API_KEY;
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: childEnv,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let serverErrors = '';
  child.stderr.on('data', (chunk) => {
    serverErrors += String(chunk).replace(/AQ\.[A-Za-z0-9_-]+/g, '[redacted]');
  });
  const base = `http://127.0.0.1:${number}`;
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(base + '/api/me')).status === 401) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, 'server started');
    const signup = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        name: 'Тестовый студент',
        email: `ai-test-${Date.now()}@example.test`,
        password: 'Test-password-2026!',
      }),
    });
    assert.equal(signup.status, 201);
    const cookie = signup.headers.get('set-cookie').split(';')[0];
    const answer = await fetch(base + '/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: cookie,
      },
      body: JSON.stringify({
        message: 'Привет! Предложи короткий план учёбы на сегодня без изменения записей.',
      }),
    });
    const result = await answer.json();
    assert.equal(
      answer.status,
      200,
      `Gemini endpoint: ${result.error || answer.status}; ${serverErrors.slice(-300)}`,
    );
    assert.ok(result.message.length > 10);
    assert.equal(result.proposal, null);
  } finally {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
