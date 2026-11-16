import palette from './course-colors.json';

export const COURSE_COLORS = palette;

export function getCourseTone(course, fallbackIndex = 0, title = '') {
  const savedColor = course?.payload?.color;
  const savedTone = COURSE_COLORS.find(
    (color) => color.hex.toLowerCase() === String(savedColor || '').toLowerCase(),
  );
  if (savedTone) return savedTone;

  const id = Number(course?.id);
  if (Number.isInteger(id) && id > 0) return COURSE_COLORS[(id - 1) % COURSE_COLORS.length];
  if (title) {
    const hash = [...String(title).trim().toLocaleLowerCase('ru')].reduce(
      (value, char) => (value * 31 + char.codePointAt(0)) >>> 0,
      7,
    );
    return COURSE_COLORS[hash % COURSE_COLORS.length];
  }
  return COURSE_COLORS[
    ((fallbackIndex % COURSE_COLORS.length) + COURSE_COLORS.length) % COURSE_COLORS.length
  ];
}

export const courseToneClass = (tone) => `course-tone-${tone.key}`;
