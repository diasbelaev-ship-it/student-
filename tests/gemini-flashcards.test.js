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

test('Gemini generates English study flashcards as a confirmable batch', async () => {
  const number = await freePort(),
    dir = mkdtempSync(path.join(tmpdir(), 'studia-ai-cards-'));
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
    serverErrors = (serverErrors + chunk.toString()).slice(-3000);
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
      name: 'Карточки',
      email: `ai-cards-${Date.now()}@example.test`,
      password: 'Test-password-2026!',
    });
    assert.equal(signup.status, 201);
    cookie = signup.cookie;

    const answer = await request('/api/ai', 'POST', {
      message: 'сгенерируй в разделе карточки подходящие карты для изучения английского',
    });
    assert.equal(answer.status, 200, `${answer.data.error}\n${serverErrors}`);
    assert.equal(answer.data.proposal?.action, 'batch', JSON.stringify(answer.data));
    assert.ok(answer.data.proposal.items.length >= 4, 'multiple cards prepared');
    assert.ok(
      answer.data.proposal.items.every(
        (item) => item.kind === 'flashcard' && item.payload.title && item.payload.answer,
      ),
    );
    assert.ok(
      answer.data.proposal.items.every(
        (item) =>
          item.payload.deck &&
          item.payload.example &&
          item.payload.exampleTranslation &&
          item.payload.note,
      ),
      'cards include a deck, contextual example, translation and usage note',
    );
    assert.ok(
      answer.data.proposal.items.every((item) => !item.payload.courseId),
      'no fabricated course linkage',
    );
    assert.equal(
      (await request('/api/items')).data.length,
      0,
      'no cards written before confirmation',
    );

    const confirmed = await request('/api/ai/confirm', 'POST', {
      proposalId: answer.data.proposal.id,
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.data.result.created.length, answer.data.proposal.items.length);
    assert.equal((await request('/api/items')).data.length, answer.data.proposal.items.length);

    const legacy = await request('/api/items', 'POST', {
      kind: 'flashcard',
      payload: { title: 'come across', answer: 'случайно встретить или найти', deck: 'Английский' },
    });
    assert.equal(legacy.status, 201);
    const enrich = await request('/api/ai', 'POST', {
      message:
        'Дополни мою существующую карточку come across: добавь уровень, пример с переводом и подсказку по употреблению. Слово и ответ оставь прежними.',
    });
    assert.equal(enrich.status, 200, `${enrich.data.error}\n${serverErrors}`);
    assert.equal(enrich.data.proposal?.action, 'batchUpdate', JSON.stringify(enrich.data));
    assert.ok(enrich.data.proposal.updates.some((change) => change.targetId === legacy.data.id));
    assert.equal(
      (await request('/api/items')).data.find((item) => item.id === legacy.data.id).payload.example,
      '',
      'no enrichment before confirmation',
    );
    const enriched = await request('/api/ai/confirm', 'POST', {
      proposalId: enrich.data.proposal.id,
    });
    assert.equal(enriched.status, 200);
    const updated = (await request('/api/items')).data.find((item) => item.id === legacy.data.id);
    assert.equal(updated.payload.title, legacy.data.payload.title);
    assert.equal(updated.payload.answer, legacy.data.payload.answer);
    assert.ok(
      updated.payload.example && updated.payload.exampleTranslation && updated.payload.note,
    );
  } finally {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
