const { test } = require('node:test');
const assert = require('node:assert/strict');

test('imports a pasted tabular schedule with time range', async () => {
  const { parseScheduleCsv } = await import('../src/csv.js');
  const result = parseScheduleCsv(
    'День\tВремя\tПредмет\tАудитория\nПонедельник\t9:00–10:30\tМатематика\t204',
  );
  assert.deepEqual(result, [
    {
      kind: 'schedule',
      payload: { day: 0, time: '09:00', end: '10:30', title: 'Математика', location: '204' },
    },
  ]);
});

test('imports semicolon CSV and Kazakh weekday', async () => {
  const { parseScheduleCsv } = await import('../src/csv.js');
  const result = parseScheduleCsv('апта күні;басталуы;аяқталуы;пән\nСейсенбі;11.00;12.30;Физика');
  assert.equal(result[0].payload.day, 1);
  assert.equal(result[0].payload.time, '11:00');
});

test('rejects invalid and oversized imports', async () => {
  const { parseScheduleCsv } = await import('../src/csv.js');
  assert.throws(
    () => parseScheduleCsv('день,начало,конец,предмет\nПонедельник,12:00,11:00,Физика'),
    /проверьте/,
  );
  const rows = Array.from({ length: 101 }, () => '0,09:00,10:00,Физика').join('\n');
  assert.throws(() => parseScheduleCsv(`день,начало,конец,предмет\n${rows}`), /не более 100/);
});
