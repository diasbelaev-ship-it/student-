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
test('accounts, session, validation and data isolation', async () => {
  const port = await freePort();
  const dir = mkdtempSync(path.join(tmpdir(), 'studia-api-test-'));
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      STUDIA_DB_PATH: path.join(dir, 'test.db'),
      GEMINI_API_KEY: '',
    },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  async function request(route, method = 'GET', body, session) {
    const response = await fetch(base + route, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        ...(session ? { Cookie: session } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = response.status === 204 ? null : await response.json();
    return {
      status: response.status,
      data,
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        const r = await request('/api/me');
        if (r.status === 401) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, 'server started');
    const suffix = crypto.randomUUID().slice(0, 8),
      password = 'Test-password-2026!';
    const first = await request('/api/auth/register', 'POST', {
      name: 'Первый студент',
      email: `first-${suffix}@example.test`,
      password,
    });
    assert.equal(first.status, 201);
    assert.ok(first.cookie?.startsWith('studia_session='));
    const second = await request('/api/auth/register', 'POST', {
      name: 'Второй студент',
      email: `second-${suffix}@example.test`,
      password,
    });
    assert.equal(second.status, 201);
    const item = await request(
      '/api/items',
      'POST',
      {
        kind: 'task',
        payload: { title: 'Сдать проект', date: '2026-10-20', status: 'todo', priority: 'high' },
      },
      first.cookie,
    );
    assert.equal(item.status, 201);
    assert.equal(item.data.payload.title, 'Сдать проект');
    assert.equal((await request('/api/items', 'GET', undefined, first.cookie)).data.length, 1);
    assert.deepEqual((await request('/api/items', 'GET', undefined, second.cookie)).data, []);
    assert.equal(
      (
        await request(
          `/api/items/${item.data.id}`,
          'PUT',
          { kind: 'task', payload: { title: 'Чужая правка', status: 'done', priority: 'low' } },
          second.cookie,
        )
      ).status,
      404,
    );
    assert.equal(
      (await request(`/api/items/${item.data.id}`, 'DELETE', undefined, second.cookie)).status,
      404,
    );
    const course = await request(
      '/api/items',
      'POST',
      {
        kind: 'course',
        payload: { title: 'Математика', teacher: 'Преподаватель', room: '204', color: '#B96B58' },
      },
      first.cookie,
    );
    assert.equal(course.status, 201);
    assert.equal(
      course.data.payload.color,
      '#B96B58',
      'valid palette color is persisted with the course',
    );
    assert.equal(
      (
        await request(
          '/api/items',
          'POST',
          { kind: 'course', payload: { title: 'Неверный цвет', color: '#FFFFFF' } },
          first.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          '/api/items',
          'POST',
          {
            kind: 'task',
            payload: {
              title: 'Чужая привязка',
              status: 'todo',
              priority: 'normal',
              courseId: course.data.id,
            },
          },
          second.cookie,
        )
      ).status,
      400,
    );
    const linked = await request(
      '/api/items',
      'POST',
      {
        kind: 'schedule',
        payload: {
          title: 'Математика',
          day: 0,
          time: '09:00',
          end: '10:30',
          location: '204',
          courseId: course.data.id,
        },
      },
      first.cookie,
    );
    assert.equal(linked.status, 201);
    assert.equal(linked.data.payload.courseId, course.data.id);
    assert.equal(
      (await request(`/api/items/${course.data.id}`, 'DELETE', undefined, first.cookie)).status,
      204,
    );
    const afterDelete = await request('/api/items', 'GET', undefined, first.cookie);
    assert.equal(
      afterDelete.data.find((x) => x.id === linked.data.id).payload.courseId,
      undefined,
      'deleting a course keeps its records without an orphan link',
    );
    assert.equal(
      (
        await request(
          '/api/items',
          'POST',
          { kind: 'grade', payload: { title: 'Математика', grade: 5, credits: 3 } },
          first.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          '/api/items',
          'POST',
          {
            kind: 'reminder',
            payload: { title: 'Экзамен', date: '2026-02-30', time: '12:00', alertMinutes: 15 },
          },
          first.cookie,
        )
      ).status,
      400,
    );
    const assessment = await request(
      '/api/items',
      'POST',
      {
        kind: 'assessment',
        payload: {
          title: 'Контрольная №1',
          subject: 'Математика',
          score: 18,
          maxScore: 20,
          type: 'test',
          date: '2026-10-15',
          note: '',
        },
      },
      first.cookie,
    );
    assert.equal(assessment.status, 201);
    assert.equal(assessment.data.payload.score, 18);
    for (const [kind, payload] of [
      [
        'assessment',
        {
          title: 'Экзамен',
          subject: 'Математика',
          score: 80,
          maxScore: 100,
          type: 'exam',
          courseId: course.data.id,
        },
      ],
      ['goal', { title: 'Освоить тему', progress: 25, courseId: course.data.id }],
      ['habit', { title: 'Повторять', frequency: 'daily', completed: 1, courseId: course.data.id }],
      ['expense', { title: 'Пособие', amount: 500, date: '2026-10-15', courseId: course.data.id }],
    ]) {
      assert.equal(
        (await request('/api/items', 'POST', { kind, payload }, first.cookie)).status,
        400,
        'deleted course cannot be linked',
      );
      assert.equal(
        (await request('/api/items', 'POST', { kind, payload }, second.cookie)).status,
        400,
        'another user cannot link a course',
      );
    }
    const connectedCourse = await request(
      '/api/items',
      'POST',
      { kind: 'course', payload: { title: 'Физика', teacher: '', room: '' } },
      first.cookie,
    );
    assert.equal(connectedCourse.status, 201);
    for (const [kind, payload] of [
      [
        'assessment',
        { title: 'Экзамен', subject: 'Физика', score: 80, maxScore: 100, type: 'exam' },
      ],
      ['goal', { title: 'Освоить тему', progress: 25 }],
      ['habit', { title: 'Повторять', frequency: 'daily', completed: 1 }],
      ['expense', { title: 'Пособие', amount: 500, date: '2026-10-15' }],
    ]) {
      const linkedRecord = await request(
        '/api/items',
        'POST',
        { kind, payload: { ...payload, courseId: connectedCourse.data.id } },
        first.cookie,
      );
      assert.equal(linkedRecord.status, 201, `${kind} can be linked to own course`);
      assert.equal(linkedRecord.data.payload.courseId, connectedCourse.data.id);
    }
    assert.equal(
      (await request('/api/items', 'GET', undefined, second.cookie)).data.length,
      0,
      'journal marks stay private',
    );
    assert.equal(
      (
        await request(
          '/api/items',
          'POST',
          {
            kind: 'assessment',
            payload: {
              title: 'Ошибка',
              subject: 'Математика',
              score: 21,
              maxScore: 20,
              type: 'test',
            },
          },
          first.cookie,
        )
      ).status,
      400,
      'earned score cannot exceed maximum',
    );
    const gpaSetting = await request(
      '/api/items',
      'POST',
      {
        kind: 'gpaSetting',
        payload: { title: 'Настройки GPA', scale: 'linear', credits: { математика: 3 } },
      },
      first.cookie,
    );
    assert.equal(gpaSetting.status, 201);
    assert.equal(gpaSetting.data.payload.credits.математика, 3);
    assert.equal(
      (
        await request(
          `/api/items/${gpaSetting.data.id}`,
          'PUT',
          {
            kind: 'gpaSetting',
            payload: { title: 'Настройки GPA', scale: 'bands', credits: { математика: 4 } },
          },
          second.cookie,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          '/api/items',
          'POST',
          {
            kind: 'gpaSetting',
            payload: { title: 'Настройки GPA', scale: 'linear', credits: { математика: 0 } },
          },
          first.cookie,
        )
      ).status,
      400,
    );
    const richCard = {
      title: 'to figure out',
      answer: 'разобраться, понять',
      deck: 'Английский · повседневные фразы',
      level: 'B1',
      pronunciation: '/ˈfɪɡjər aʊt/',
      example: 'I need to figure out how this works.',
      exampleTranslation: 'Мне нужно разобраться, как это работает.',
      note: 'figure out a problem — разобраться с проблемой',
    };
    const card = await request(
      '/api/items',
      'POST',
      { kind: 'flashcard', payload: richCard },
      first.cookie,
    );
    assert.equal(card.status, 201);
    assert.deepEqual(card.data.payload, richCard);
    assert.equal(
      (await request('/api/items', 'GET', undefined, second.cookie)).data.length,
      0,
      'cards stay private',
    );
    assert.equal(
      (
        await request(
          '/api/items',
          'POST',
          {
            kind: 'flashcard',
            payload: { title: 'test', answer: 'ответ', example: 'x'.repeat(601) },
          },
          first.cookie,
        )
      ).status,
      400,
    );
    const legacyCard = await request(
      '/api/items',
      'POST',
      { kind: 'flashcard', payload: { title: 'book', answer: 'книга', deck: 'Английский' } },
      first.cookie,
    );
    assert.equal(legacyCard.status, 201, 'simple cards remain supported');
    assert.equal(
      (await request('/api/ai', 'POST', { message: 'Составь план' }, first.cookie)).status,
      503,
    );
    assert.equal(
      (
        await request(
          '/api/me',
          'PATCH',
          { name: 'Новый профиль', sessionDate: '2026-12-18' },
          first.cookie,
        )
      ).data.user.sessionDate,
      '2026-12-18',
    );
    assert.equal((await request('/api/auth/logout', 'POST', undefined, first.cookie)).status, 204);
    assert.equal((await request('/api/me', 'GET', undefined, first.cookie)).status, 401);
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
