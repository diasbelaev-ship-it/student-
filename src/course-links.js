export const courseKey = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('ru');

const matchField = {
  schedule: 'title',
  assessment: 'subject',
  grade: 'title',
  material: 'subject',
  attendance: 'title',
  note: 'folder',
};

export function courseForRecord(record, courses) {
  const direct = Number(record?.payload?.courseId);
  if (direct) return courses.find((course) => course.id === direct) || null;
  const field = matchField[record?.kind];
  const name = field && courseKey(record.payload[field]);
  if (!name) return null;
  return courses.find((course) => courseKey(course.payload.title) === name) || null;
}

export function recordsForCourse(items, course) {
  const courses = items.filter((item) => item.kind === 'course');
  return items.filter(
    (item) =>
      item.kind !== 'course' &&
      item.kind !== 'gpaSetting' &&
      courseForRecord(item, courses)?.id === course.id,
  );
}

export function courseDefaults(kind, course) {
  const defaults = { courseId: course.id };
  if (['schedule', 'grade', 'attendance'].includes(kind)) defaults.title = course.payload.title;
  if (kind === 'assessment') defaults.subject = course.payload.title;
  if (kind === 'material') defaults.subject = course.payload.title;
  if (kind === 'note') defaults.folder = course.payload.title;
  return defaults;
}
