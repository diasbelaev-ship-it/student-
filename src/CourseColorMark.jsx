import { courseToneClass, getCourseTone } from './course-colors';

export default function CourseColorMark({ course, title, index = 0, className = '' }) {
  const label = title || course?.payload?.title || 'Предмет';
  const tone = getCourseTone(course, index, label);
  const initial = [...String(label).trim()][0]?.toLocaleUpperCase('ru') || 'П';
  return (
    <span
      className={`course-color-mark ${courseToneClass(tone)} ${className}`.trim()}
      aria-hidden='true'
    >
      {initial}
    </span>
  );
}
