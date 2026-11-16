const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, readdirSync, rmSync } = require('node:fs');
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

test('groups share chat, tasks and files only with members', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'studia-groups-'));
  const port = await freePort();
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      STUDIA_DB_PATH: path.join(dir, 'test.db'),
      STUDIA_GROUP_FILES_PATH: '',
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
    const data = response.status === 204 ? null : await response.json();
    return {
      status: response.status,
      data,
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  };
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
    assert.ok(ready, 'server started');
    const password = 'Student-password-2026!';
    const first = await request('/api/auth/register', 'POST', {
      name: 'Алия',
      email: 'aliya@example.test',
      password,
    });
    const second = await request('/api/auth/register', 'POST', {
      name: 'Диас',
      email: 'dias@example.test',
      password,
    });
    const outsider = await request('/api/auth/register', 'POST', {
      name: 'Сторонний',
      email: 'outside@example.test',
      password,
    });
    assert.equal(first.status, 201);
    const group = await request(
      '/api/groups',
      'POST',
      { name: 'Математика · 21 группа' },
      first.cookie,
    );
    assert.equal(group.status, 201);
    const id = group.data.id;
    assert.equal(
      (await request(`/api/groups/${id}`, 'GET', undefined, outsider.cookie)).status,
      404,
    );
    assert.equal(
      (
        await request(
          `/api/groups/${id}/messages`,
          'POST',
          { body: 'Чужое сообщение' },
          outsider.cookie,
        )
      ).status,
      404,
    );
    assert.equal(
      (await request('/api/groups/join', 'POST', { code: group.data.inviteCode }, second.cookie))
        .status,
      200,
    );
    assert.equal(
      (
        await request(
          `/api/groups/${id}/messages`,
          'POST',
          { body: 'Как готовимся к экзамену?' },
          second.cookie,
        )
      ).status,
      201,
    );
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const task = await request(
      `/api/groups/${id}/tasks`,
      'POST',
      { title: 'Сдать работу', dueDate: futureDate, course: 'Математика' },
      first.cookie,
    );
    assert.equal(task.status, 201);
    assert.equal(
      task.data.userId,
      first.data.user.id,
      'the task author is identified by account ID',
    );
    assert.equal(
      (
        await request(
          `/api/groups/${id}/tasks`,
          'POST',
          { title: 'Ошибка', dueDate: '2026-02-30' },
          second.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (await request(`/api/groups/${id}/tasks/${task.data.id}`, 'DELETE', undefined, second.cookie))
        .status,
      403,
    );
    const view = await request(`/api/groups/${id}`, 'GET', undefined, second.cookie);
    assert.equal(view.data.messages.length, 1);
    assert.equal(view.data.tasks.length, 1);
    assert.equal(view.data.tasks[0].userId, first.data.user.id);
    const overview = await request('/api/groups/overview', 'GET', undefined, second.cookie);
    assert.equal(overview.status, 200);
    assert.equal(overview.data.groupCount, 1);
    assert.equal(overview.data.tasks[0].title, 'Сдать работу');
    const uploadFile = (body) =>
      fetch(base + `/api/groups/${id}/files`, {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:5173',
          Cookie: first.cookie,
          'Content-Type': 'application/octet-stream',
          'X-File-Name': encodeURIComponent('notes.txt'),
          'X-File-Type': 'text/plain',
        },
        body,
      });
    const invalidUpload = await uploadFile(Buffer.from([0xff, 0xfe, 0xd0]));
    assert.equal(invalidUpload.status, 400);
    assert.deepEqual(await invalidUpload.json(), {
      error: 'Содержимое не соответствует формату файла',
    });
    assert.equal(readdirSync(path.join(dir, 'group-files')).length, 0);
    const upload = await uploadFile(Buffer.from('lecture notes'));
    assert.equal(upload.status, 201);
    assert.equal(
      readdirSync(path.join(dir, 'group-files')).length,
      1,
      'uploads use the same storage path as backups',
    );
    const file = await upload.json();
    assert.equal(
      (await request('/api/groups/materials', 'GET', undefined, second.cookie)).data[0].name,
      'notes.txt',
    );
    assert.equal(
      (await request('/api/groups/materials', 'GET', undefined, outsider.cookie)).data.length,
      0,
    );
    assert.equal(
      (
        await fetch(base + `/api/groups/${id}/files/${file.id}`, {
          headers: { Cookie: outsider.cookie },
        })
      ).status,
      404,
    );
    const download = await fetch(base + `/api/groups/${id}/files/${file.id}`, {
      headers: { Cookie: second.cookie },
    });
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('cache-control'), 'no-store');
    assert.equal(await download.text(), 'lecture notes');
    assert.equal(
      (await request(`/api/groups/${id}/files/${file.id}`, 'DELETE', undefined, second.cookie))
        .status,
      403,
    );
    assert.equal(
      (await request(`/api/groups/${id}/files/${file.id}`, 'DELETE', undefined, first.cookie))
        .status,
      204,
    );
    assert.equal(
      (
        await fetch(base + `/api/groups/${id}/files/${file.id}`, {
          headers: { Cookie: second.cookie },
        })
      ).status,
      404,
    );
    assert.equal((await request('/api/groups', 'GET', undefined, outsider.cookie)).data.length, 0);
  } finally {
    await new Promise((resolve) => {
      server.once('exit', resolve);
      server.kill();
      setTimeout(resolve, 3000).unref();
    });
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
