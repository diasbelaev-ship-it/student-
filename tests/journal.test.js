const { test } = require('node:test');
const assert = require('node:assert/strict');

let buildJournal;
test.before(async () => {
  ({ buildJournal } = await import('../src/journal.js'));
});

test('schedule subjects appear once in journal and marks are grouped by subject', () => {
  const items = [
    { id: 1, kind: 'schedule', payload: { title: 'Математика', day: 0 } },
    { id: 2, kind: 'schedule', payload: { title: '  математика  ', day: 2 } },
    {
      id: 3,
      kind: 'assessment',
      payload: { title: 'Тест №1', subject: 'Математика', score: 18, maxScore: 20, type: 'test' },
    },
    { id: 4, kind: 'grade', payload: { title: 'Физика', grade: 3.5, credits: 3 } },
  ];
  const groups = buildJournal(items);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, 'Математика');
  assert.equal(groups[0].classCount, 2);
  assert.equal(groups[0].assessments[0].id, 3);
  assert.equal(groups[0].percent, 90);
});

test('journal follows timetable changes without deleting existing marks', () => {
  const schedule = { id: 1, kind: 'schedule', payload: { title: 'Английский' } };
  const mark = {
    id: 2,
    kind: 'assessment',
    payload: { title: 'Диалог', subject: 'Английский', score: 8, maxScore: 10 },
  };
  assert.equal(buildJournal([schedule])[0].fromSchedule, true);
  assert.equal(buildJournal([]).length, 0);
  const retained = buildJournal([mark]);
  assert.equal(retained.length, 1);
  assert.equal(retained[0].fromSchedule, false);
  assert.equal(retained[0].assessments.length, 1);
});

test('unnamed numbered lessons stay out of subject list without hiding existing marks', () => {
  const lessons = [3, 4, 5].map((number, index) => ({
    id: index + 1,
    kind: 'schedule',
    payload: { title: `Пара ${number} — предмет не указан`, day: 1 },
  }));
  const algebra = { id: 4, kind: 'schedule', payload: { title: 'Алгебра', day: 1 } };
  assert.deepEqual(
    buildJournal([...lessons, algebra]).map((group) => group.title),
    ['Алгебра'],
  );
  const mark = {
    id: 5,
    kind: 'assessment',
    payload: {
      title: 'Контрольная',
      subject: 'Пара 3 — предмет не указан',
      score: 8,
      maxScore: 10,
    },
  };
  assert.equal(buildJournal([...lessons, algebra, mark]).length, 2);
});
