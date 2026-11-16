const { test } = require('node:test');
const assert = require('node:assert/strict');

let buildGpaEstimate, scoreToGpa;
test.before(async () => ({ buildGpaEstimate, scoreToGpa } = await import('../src/gpa.js')));

test('journal marks flow into estimated GPA and react to credit weights', () => {
  const items = [
    { id: 1, kind: 'schedule', payload: { title: 'Алгебра', day: 1 } },
    { id: 2, kind: 'schedule', payload: { title: 'Английский', day: 2 } },
    {
      id: 3,
      kind: 'assessment',
      payload: { title: 'Работа', subject: 'Алгебра', score: 90, maxScore: 100 },
    },
    {
      id: 4,
      kind: 'assessment',
      payload: { title: 'Тест', subject: 'Английский', score: 70, maxScore: 100 },
    },
  ];
  const equal = buildGpaEstimate(items);
  assert.equal(equal.rows.length, 2);
  assert.equal(equal.value, 3.2);
  assert.equal(equal.allCreditsSet, false);
  const weighted = buildGpaEstimate(items, {
    scale: 'linear',
    credits: { алгебра: 3, английский: 1 },
  });
  assert.equal(weighted.totalCredits, 4);
  assert.equal(weighted.value.toFixed(2), '3.40');
  assert.equal(weighted.allCreditsSet, true);
  items[2].payload.score = 100;
  assert.equal(buildGpaEstimate(items).value.toFixed(2), '3.40');
});

test('manual GPA records are not counted twice; step scale is explicit', () => {
  const items = [
    {
      id: 1,
      kind: 'assessment',
      payload: { title: 'Работа', subject: 'Алгебра', score: 93, maxScore: 100 },
    },
    { id: 2, kind: 'grade', payload: { title: 'Алгебра', grade: 4, credits: 3 } },
  ];
  assert.equal(buildGpaEstimate(items).rows.length, 1);
  assert.equal(scoreToGpa(93, 'bands'), 3.67);
  assert.equal(buildGpaEstimate(items, { scale: 'bands' }).value, 3.67);
});

test('linked GPA credit weights survive a subject rename', () => {
  const items = [
    { id: 7, kind: 'course', payload: { title: 'Новое название' } },
    {
      id: 8,
      kind: 'assessment',
      payload: {
        title: 'Работа',
        subject: 'Старое название',
        courseId: 7,
        score: 80,
        maxScore: 100,
      },
    },
  ];
  const estimate = buildGpaEstimate(items, { credits: { 'course:7': 4 } });
  assert.equal(estimate.rows.length, 1);
  assert.equal(estimate.rows[0].title, 'Новое название');
  assert.equal(estimate.rows[0].credits, 4);
  assert.equal(estimate.rows[0].explicitlyWeighted, true);
});
