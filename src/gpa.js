import { buildJournal } from './journal.js';

export const GPA_BANDS = [
  [95, 4],
  [90, 3.67],
  [85, 3.33],
  [80, 3],
  [75, 2.67],
  [70, 2.33],
  [65, 2],
  [60, 1.67],
  [55, 1.33],
  [50, 1],
  [0, 0],
];

export function scoreToGpa(percent, scale = 'linear') {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  if (scale === 'bands') return GPA_BANDS.find(([minimum]) => safe >= minimum)[1];
  return safe / 25;
}

export function buildGpaEstimate(items, setting = {}) {
  const scale = setting.scale === 'bands' ? 'bands' : 'linear';
  const savedCredits = setting.credits || {};
  const rows = buildJournal(items)
    .filter((group) => group.assessments.length)
    .map((group) => {
      const earned = group.assessments.reduce((sum, item) => sum + Number(item.payload.score), 0);
      const possible = group.assessments.reduce(
        (sum, item) => sum + Number(item.payload.maxScore),
        0,
      );
      const percent = possible ? (earned / possible) * 100 : 0;
      const legacyKey = group.courseId
        ? group.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru')
        : group.key;
      const creditKey = Object.hasOwn(savedCredits, group.key) ? group.key : legacyKey;
      const explicitlyWeighted = Object.hasOwn(savedCredits, creditKey);
      const credits = explicitlyWeighted ? Number(savedCredits[creditKey]) : 1;
      return {
        key: group.key,
        creditKey,
        title: group.title,
        percent,
        point: scoreToGpa(percent, scale),
        credits,
        explicitlyWeighted,
        assessments: group.assessments.length,
      };
    });
  const totalCredits = rows.reduce((sum, row) => sum + row.credits, 0);
  const value = totalCredits
    ? rows.reduce((sum, row) => sum + row.point * row.credits, 0) / totalCredits
    : null;
  return {
    rows,
    totalCredits,
    value,
    allCreditsSet: rows.length > 0 && rows.every((row) => row.explicitlyWeighted),
    scale,
  };
}
