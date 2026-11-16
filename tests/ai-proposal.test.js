const { test } = require('node:test');
const assert = require('node:assert/strict');

let preview;
test.before(async () => {
  ({ proposalPreview: preview } = await import('../src/ai-proposal.js'));
});

test('schedule proposal is shown in readable Russian fields', () => {
  const result = preview({
    action: 'create',
    item: {
      kind: 'schedule',
      payload: { title: 'Математика', day: 1, time: '09:00', end: '10:00', location: '' },
    },
  });
  assert.equal(result.title, 'Математика');
  assert.equal(result.section, 'Расписание');
  assert.deepEqual(
    result.fields.map((field) => [field.label, field.value]),
    [
      ['День недели', 'Вторник'],
      ['Время', '09:00–10:00'],
      ['Аудитория / ссылка', 'Не указано'],
    ],
  );
});

test('update preview shows changed values only', () => {
  const target = {
    kind: 'task',
    payload: { title: 'Сдать работу', status: 'todo', priority: 'normal', date: '2026-10-20' },
  };
  const result = preview(
    { action: 'update', item: { kind: 'task', payload: { ...target.payload, priority: 'high' } } },
    target,
  );
  assert.deepEqual(
    result.fields.map((field) => [field.label, field.previous, field.value]),
    [['Приоритет', 'Обычный', 'Высокий']],
  );
});

test('flashcard enrichment preview separates example and usage note', () => {
  const target = {
    kind: 'flashcard',
    payload: { title: 'come across', answer: 'случайно встретить', deck: 'Английский' },
  };
  const item = {
    kind: 'flashcard',
    payload: {
      ...target.payload,
      level: 'B1',
      example: 'I came across an old photo.',
      exampleTranslation: 'Мне попалась старая фотография.',
      note: 'come across something',
    },
  };
  const result = preview({ action: 'update', item }, target);
  assert.equal(result.title, 'come across');
  assert.deepEqual(
    result.fields.map((field) => field.label),
    ['Уровень', 'Пример в контексте', 'Перевод примера', 'Подсказка по употреблению'],
  );
});

test('journal mark proposal is labeled separately from GPA', () => {
  const result = preview({
    action: 'create',
    item: {
      kind: 'assessment',
      payload: {
        title: 'Контрольная №1',
        subject: 'Математика',
        score: 18,
        maxScore: 20,
        type: 'test',
      },
    },
  });
  assert.equal(result.section, 'Журнал оценок');
  assert.ok(
    result.fields.some((field) => field.label === 'Получено баллов' && field.value === '18'),
  );
});

test('delete and focus proposals remain explicit', () => {
  const deletion = preview({ action: 'delete' }, { kind: 'note', payload: { title: 'Черновик' } });
  assert.equal(deletion.title, 'Черновик');
  assert.equal(deletion.confirmLabel, 'Удалить запись');
  assert.equal(deletion.fields.length, 0);
  const focus = preview({
    action: 'focus',
    item: { kind: 'focus', payload: { minutes: 30, label: 'Математика' } },
  });
  assert.deepEqual(
    focus.fields.map((field) => field.value),
    ['30 мин', 'Математика'],
  );
});

test('GPA settings show the scale and changed credit weights before confirmation', () => {
  const target = {
    kind: 'gpaSetting',
    payload: { title: 'Настройки GPA', scale: 'linear', credits: { алгебра: 3 } },
  };
  const item = {
    kind: 'gpaSetting',
    payload: { ...target.payload, scale: 'bands', credits: { алгебра: 4 } },
  };
  const result = preview({ action: 'update', item }, target);
  assert.equal(result.section, 'Калькулятор GPA');
  assert.deepEqual(
    result.fields.map((field) => [field.label, field.value]),
    [
      ['Шкала GPA', 'Примерная ступенчатая'],
      ['Кредиты предметов', 'алгебра: 4 кр.'],
    ],
  );
});
