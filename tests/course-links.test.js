const { test } = require('node:test');
const assert = require('node:assert/strict');

test('course workspace connects records by owned course ID and exact legacy names', async () => {
  const { courseForRecord, recordsForCourse, courseDefaults } =
    await import('../src/course-links.js');
  const course = { id: 7, kind: 'course', payload: { title: 'Высшая математика' } };
  const records = [
    course,
    { id: 8, kind: 'schedule', payload: { title: 'Высшая математика', day: 0 } },
    { id: 9, kind: 'assessment', payload: { title: 'Тест', subject: 'Старое имя', courseId: 7 } },
    { id: 10, kind: 'task', payload: { title: 'Контрольная', courseId: 7 } },
    { id: 11, kind: 'study', payload: { title: 'Подготовка', courseId: 7 } },
    { id: 12, kind: 'expense', payload: { title: 'Учебник', courseId: 7 } },
    { id: 13, kind: 'task', payload: { title: 'Высшая математика' } },
  ];
  assert.deepEqual(
    recordsForCourse(records, course).map((item) => item.id),
    [8, 9, 10, 11, 12],
  );
  assert.equal(courseForRecord(records[1], [course]).id, 7);
  assert.equal(
    courseForRecord(records[6], [course]),
    null,
    'arbitrary task title does not imply a course',
  );
  assert.deepEqual(courseDefaults('assessment', course), {
    courseId: 7,
    subject: 'Высшая математика',
  });
});

test('journal keeps linked marks and lessons together after a course rename', async () => {
  const { buildJournal } = await import('../src/journal.js');
  const items = [
    { id: 7, kind: 'course', payload: { title: 'Новая математика' } },
    { id: 8, kind: 'schedule', payload: { title: 'Старая математика', courseId: 7 } },
    {
      id: 9,
      kind: 'assessment',
      payload: { title: 'Тест', subject: 'Старая математика', courseId: 7, score: 8, maxScore: 10 },
    },
  ];
  const groups = buildJournal(items);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, 'Новая математика');
  assert.equal(groups[0].courseId, 7);
  assert.equal(groups[0].classCount, 1);
  assert.equal(groups[0].percent, 80);
});
