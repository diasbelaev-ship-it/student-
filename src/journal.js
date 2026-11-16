import { courseKey } from './course-links.js';

export const subjectKey = courseKey;
export const isUnnamedLesson = (value) =>
  /^пара\s*\d+\s*[—–-]\s*предмет\s+не\s+указан$/i.test(String(value || '').trim());

export function buildJournal(items) {
  const courses = new Map(
    items.filter((item) => item.kind === 'course').map((item) => [item.id, item]),
  );
  const coursesByName = new Map(
    [...courses.values()].map((item) => [subjectKey(item.payload.title), item]),
  );
  const groups = new Map();
  function ensure(name, linkedId) {
    const title = String(name || '')
      .trim()
      .replace(/\s+/g, ' ');
    const course = courses.get(Number(linkedId)) || coursesByName.get(subjectKey(title));
    const key = course ? `course:${course.id}` : subjectKey(title);
    if (!key) return null;
    if (!groups.has(key))
      groups.set(key, {
        key,
        title: course?.payload.title || title,
        courseId: course?.id || null,
        classCount: 0,
        fromSchedule: false,
        assessments: [],
      });
    return groups.get(key);
  }
  for (const course of courses.values()) ensure(course.payload.title, course.id);
  for (const item of items.filter((record) => record.kind === 'schedule')) {
    const linked = courses.get(Number(item.payload.courseId));
    if (!linked && isUnnamedLesson(item.payload.title)) continue;
    const group = ensure(linked?.payload.title || item.payload.title, linked?.id);
    if (group) {
      group.classCount++;
      group.fromSchedule = true;
    }
  }
  for (const item of items.filter((record) => record.kind === 'assessment')) {
    const linked = courses.get(Number(item.payload.courseId));
    const group = ensure(linked?.payload.title || item.payload.subject, linked?.id);
    if (group) group.assessments.push(item);
  }
  return [...groups.values()]
    .map((group) => {
      group.assessments.sort(
        (a, b) => (b.payload.date || '').localeCompare(a.payload.date || '') || b.id - a.id,
      );
      const earned = group.assessments.reduce((sum, item) => sum + Number(item.payload.score), 0);
      const possible = group.assessments.reduce(
        (sum, item) => sum + Number(item.payload.maxScore),
        0,
      );
      return { ...group, percent: possible ? Math.round((earned / possible) * 100) : null };
    })
    .sort(
      (a, b) =>
        Number(b.fromSchedule) - Number(a.fromSchedule) || a.title.localeCompare(b.title, 'ru'),
    );
}
