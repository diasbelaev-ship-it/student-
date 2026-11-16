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
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

test('AI confirmation path covers every data section, profile, focus and safe edits', async () => {
  const examples = [
    ['course', { title: 'Физика', teacher: 'Преподаватель', room: '204' }],
    ['schedule', { title: 'Физика', day: 0, time: '09:00', end: '10:00', location: '204' }],
    ['task', { title: 'Сдать доклад', date: '2026-10-20', status: 'todo', priority: 'normal' }],
    [
      'assessment',
      {
        title: 'Контрольная',
        subject: 'Физика',
        score: 80,
        maxScore: 100,
        type: 'test',
        date: '2026-10-15',
        note: '',
        courseId: 1,
      },
    ],
    ['grade', { title: 'Физика', grade: 3.5, credits: 3, type: 'course' }],
    ['gpaSetting', { title: 'Настройки GPA', scale: 'linear', credits: { физика: 3 } }],
    ['note', { title: 'Законы Ньютона', body: 'Первый закон инерции', folder: 'Физика' }],
    ['reminder', { title: 'Экзамен', date: '2026-12-01', time: '09:00', alertMinutes: 15 }],
    ['flashcard', { title: 'momentum', answer: 'импульс', deck: 'Физика', level: 'B1' }],
    ['material', { title: 'Учебник', subject: 'Физика', url: '', notes: 'Глава 1' }],
    ['attendance', { title: 'Физика', date: '2026-10-15', status: 'present' }],
    [
      'goal',
      { title: 'Подготовиться к экзамену', targetDate: '2026-12-01', progress: 20, courseId: 1 },
    ],
    ['habit', { title: 'Повторять формулы', frequency: 'daily', completed: 2, courseId: 1 }],
    ['study', { title: 'Решать задачи', minutes: 45, date: '2026-10-15' }],
    ['expense', { title: 'Тетрадь', amount: 500, date: '2026-10-15', courseId: 1 }],
  ];
  const answers = examples.map(([kind, payload]) => ({
    message: 'Подготовлено для подтверждения.',
    proposal: { action: 'create', item: { kind, payload } },
  }));
  answers.push(
    {
      message: 'Обновить две записи.',
      proposal: {
        action: 'batchUpdate',
        updates: [
          { targetId: 3, item: { kind: 'task', payload: { priority: 'high' } } },
          {
            targetId: 7,
            item: { kind: 'note', payload: { body: 'Первый и второй законы Ньютона' } },
          },
        ],
      },
    },
    {
      message: 'Изменить профиль.',
      proposal: { action: 'profile', profile: { sessionDate: '2026-12-18' } },
    },
    {
      message: 'Настроить таймер.',
      proposal: { action: 'focus', focus: { minutes: 30, label: 'Физика' } },
    },
    { message: 'Удалить материал.', proposal: { action: 'delete', targetId: 10 } },
    {
      message: 'Изменить задачу.',
      proposal: {
        action: 'update',
        targetId: 3,
        item: {
          kind: 'task',
          payload: { title: 'Сдать доклад', date: '2026-10-20', status: 'todo', priority: 'low' },
        },
      },
    },
    {
      expectPromptParts: [
        'Количество записей по разделам',
        'gpaSetting',
        'Настройки GPA',
        'Законы Ньютона',
        'Тетрадь',
      ],
      message: 'Данные разных разделов доступны.',
      proposal: null,
    },
    { message: 'Удалить предмет.', proposal: { action: 'delete', targetId: 1 } },
    {
      message: 'Изменить имя.',
      proposal: { action: 'profile', profile: { name: 'Новое имя' } },
    },
    {
      message: 'Переименовать конспект.',
      proposal: {
        action: 'update',
        targetId: 7,
        item: { kind: 'note', payload: { title: 'Механика' } },
      },
    },
    {
      expectPromptParts: ['Длинный конспект 30', 'Подготовиться к экзамену', 'Тетрадь'],
      expectMaxPromptBytes: 82 * 1024,
      message: 'Контекст укладывается в лимит.',
      proposal: null,
    },
  );
  const port = await freePort(),
    dir = mkdtempSync(path.join(tmpdir(), 'studia-ai-coverage-'));
  let serverErrors = '';
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
        STUDIA_TEST_AI_RESPONSES: JSON.stringify(answers),
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );
  child.stderr.on('data', (chunk) => {
    serverErrors = (serverErrors + chunk.toString()).replace(/AQ\.[A-Za-z0-9_-]+/g, '[redacted]');
  });
  const base = `http://127.0.0.1:${port}`;
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
      data: response.status === 204 ? null : await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + '/api/me')).status === 401) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'temporary server started');
    const signup = await request('/api/auth/register', 'POST', {
      name: 'Тест',
      email: `ai-coverage-${Date.now()}@example.test`,
      password: 'Test-password-2026!',
    });
    assert.equal(signup.status, 201);
    cookie = signup.cookie;
    for (const [kind] of examples) {
      const proposed = await request('/api/ai', 'POST', {
        message: `Подготовь запись в разделе ${kind}`,
      });
      assert.equal(proposed.status, 200, `${kind}: ${proposed.data.error}`);
      assert.equal(proposed.data.proposal?.item?.kind, kind);
      assert.equal(
        (await request('/api/items')).data.some((item) => item.kind === kind),
        false,
        `${kind} must wait for confirmation`,
      );
      const confirmed = await request('/api/ai/confirm', 'POST', {
        proposalId: proposed.data.proposal.id,
      });
      assert.equal(confirmed.status, 200, `${kind}: ${confirmed.data.error}`);
      assert.equal(confirmed.data.result.kind, kind);
    }
    const batch = await request('/api/ai', 'POST', {
      message: 'Измени задачу и конспект одним пакетом',
    });
    assert.equal(batch.status, 200, batch.data.error);
    assert.equal(batch.data.proposal.action, 'batchUpdate');
    assert.equal(batch.data.proposal.updates.length, 2);
    assert.equal(
      (await request('/api/items')).data.find((item) => item.id === 3).payload.priority,
      'normal',
    );
    const batchSaved = await request('/api/ai/confirm', 'POST', {
      proposalId: batch.data.proposal.id,
    });
    assert.equal(batchSaved.status, 200, batchSaved.data.error);
    assert.equal(batchSaved.data.result.changed.length, 2);
    assert.equal(
      (await request('/api/items')).data.find((item) => item.id === 3).payload.priority,
      'high',
    );

    const profile = await request('/api/ai', 'POST', { message: 'Поменяй дату сессии' });
    assert.equal(profile.status, 200, `${profile.data.error || ''}\n${serverErrors}`);
    assert.equal(
      (await request('/api/ai/confirm', 'POST', { proposalId: profile.data.proposal.id })).data
        .result.user.sessionDate,
      '2026-12-18',
    );
    const focus = await request('/api/ai', 'POST', { message: 'Настрой фокус' });
    assert.equal(
      (await request('/api/ai/confirm', 'POST', { proposalId: focus.data.proposal.id })).data.result
        .focus.minutes,
      30,
    );
    const deletion = await request('/api/ai', 'POST', { message: 'Удали материал' });
    assert.ok((await request('/api/items')).data.some((item) => item.id === 10));
    assert.equal(
      (await request('/api/ai/confirm', 'POST', { proposalId: deletion.data.proposal.id })).data
        .result.deletedId,
      10,
    );

    const stale = await request('/api/ai', 'POST', { message: 'Понизь приоритет задачи' });
    const task = (await request('/api/items')).data.find((item) => item.id === 3);
    assert.equal(
      (
        await request('/api/items/3', 'PUT', {
          kind: 'task',
          payload: { ...task.payload, status: 'doing' },
        })
      ).status,
      200,
    );
    assert.equal(
      (await request('/api/ai/confirm', 'POST', { proposalId: stale.data.proposal.id })).status,
      404,
      'stale proposal cannot overwrite a newer edit',
    );
    assert.equal(
      (await request('/api/items')).data.find((item) => item.id === 3).payload.status,
      'doing',
    );
    for (let index = 0; index < 121; index++) {
      const filler = await request('/api/items', 'POST', {
        kind: 'task',
        payload: { title: `Повторение ${index}`, status: 'todo', priority: 'normal' },
      });
      assert.equal(filler.status, 201);
    }
    const overview = await request('/api/ai', 'POST', {
      message: 'Что есть в моих разных разделах?',
    });
    assert.equal(overview.status, 200, overview.data.error);
    assert.equal(overview.data.message, 'Данные разных разделов доступны.');

    const courseDeletion = await request('/api/ai', 'POST', { message: 'Удали предмет Физика' });
    assert.equal(courseDeletion.status, 200, courseDeletion.data.error);
    const courseDeleted = await request('/api/ai/confirm', 'POST', {
      proposalId: courseDeletion.data.proposal.id,
    });
    assert.equal(courseDeleted.status, 200, courseDeleted.data.error);
    assert.equal(courseDeleted.data.result.deletedId, 1);
    const afterDeletion = (await request('/api/items')).data;
    assert.equal(
      afterDeletion.some((item) => item.id === 1),
      false,
    );
    const assessment = afterDeletion.find((item) => item.kind === 'assessment');
    assert.equal(assessment.payload.score, 80);
    assert.equal(assessment.payload.courseId, undefined);

    const rename = await request('/api/ai', 'POST', { message: 'Измени имя в профиле' });
    assert.equal(rename.status, 200, rename.data.error);
    const edited = await request('/api/me', 'PATCH', {
      name: 'Тест',
      sessionDate: '2027-01-21',
    });
    assert.equal(edited.status, 200, edited.data.error);
    const renamed = await request('/api/ai/confirm', 'POST', {
      proposalId: rename.data.proposal.id,
    });
    assert.equal(renamed.status, 404, 'stale profile proposal cannot overwrite a newer edit');
    const accountAfterEdit = await request('/api/me');
    assert.equal(accountAfterEdit.data.user.name, 'Тест');
    assert.equal(accountAfterEdit.data.user.sessionDate, '2027-01-21');

    const noteRename = await request('/api/ai', 'POST', {
      message: 'Переименуй конспект в Механика',
    });
    assert.equal(noteRename.status, 200, noteRename.data.error);
    const noteUpdated = await request('/api/ai/confirm', 'POST', {
      proposalId: noteRename.data.proposal.id,
    });
    assert.equal(noteUpdated.status, 200, noteUpdated.data.error);
    assert.equal(noteUpdated.data.result.payload.title, 'Механика');
    assert.equal(noteUpdated.data.result.payload.body, 'Первый и второй законы Ньютона');
    assert.equal(noteUpdated.data.result.payload.folder, 'Физика');

    for (let index = 1; index <= 30; index++) {
      const note = await request('/api/items', 'POST', {
        kind: 'note',
        payload: { title: `Длинный конспект ${index}`, body: 'я'.repeat(1800) },
      });
      assert.equal(note.status, 201, note.data.error);
    }
    const boundedContext = await request('/api/ai', 'POST', { message: 'Что есть в Studia?' });
    assert.equal(boundedContext.status, 200, boundedContext.data.error);
    assert.equal(boundedContext.data.message, 'Контекст укладывается в лимит.');
  } finally {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
