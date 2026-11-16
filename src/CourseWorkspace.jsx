import React from 'react';
import {
  Activity,
  ArrowRight,
  BellRing,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Columns3,
  GraduationCap,
  Layers3,
  Library,
  NotebookPen,
  Plus,
  Target,
  Timer,
  UserCheck,
  Wallet,
  Pencil,
  Trash2,
} from 'lucide-react';
import { days } from './config';
import { courseDefaults, courseKey, recordsForCourse } from './course-links';
import { buildJournal, isUnnamedLesson } from './journal';
import CourseColorMark from './CourseColorMark';
import { courseToneClass, getCourseTone } from './course-colors';

const groups = [
  ['schedule', 'Расписание', CalendarDays],
  ['task', 'Дедлайны', Columns3],
  ['assessment', 'Журнал оценок', ClipboardList],
  ['grade', 'Ручной GPA', GraduationCap],
  ['note', 'Конспекты', NotebookPen],
  ['material', 'Материалы', Library],
  ['flashcard', 'Карточки', Layers3],
  ['reminder', 'Напоминания', BellRing],
  ['attendance', 'Посещаемость', UserCheck],
  ['study', 'Учебное время', ChartNoAxesCombined],
  ['goal', 'Цели', Target],
  ['habit', 'Привычки', Activity],
  ['expense', 'Расходы', Wallet],
];

function detail(item) {
  const p = item.payload;
  if (item.kind === 'schedule') return `${days[Number(p.day)]}, ${p.time}–${p.end}`;
  if (item.kind === 'assessment') return `${p.score} / ${p.maxScore} баллов`;
  if (item.kind === 'task') return p.date || 'Без срока';
  if (item.kind === 'reminder') return `${p.date} · ${p.time}`;
  if (item.kind === 'grade') return `GPA ${Number(p.grade).toFixed(2)} · ${p.credits} кр.`;
  if (item.kind === 'study') return `${p.minutes} мин · ${p.date}`;
  if (item.kind === 'expense') return `${Number(p.amount).toLocaleString('ru-RU')} ₸`;
  if (item.kind === 'attendance')
    return `${p.date} · ${p.status === 'present' ? 'был' : p.status === 'absent' ? 'пропуск' : 'уважительно'}`;
  if (item.kind === 'goal') return `${p.progress}%`;
  if (item.kind === 'habit') return `${p.completed} выполнений`;
  return p.folder || p.deck || p.subject || '';
}

export default function CourseWorkspace({
  items,
  open,
  remove,
  navigate,
  selectedCourseId,
  setSelectedCourseId,
}) {
  const courses = items.filter((item) => item.kind === 'course');
  const knownNames = new Set(courses.map((item) => courseKey(item.payload.title)));
  const unlinkedSubjects = [
    ...new Map(
      items
        .filter(
          (item) =>
            item.kind === 'schedule' &&
            !isUnnamedLesson(item.payload.title) &&
            !knownNames.has(courseKey(item.payload.title)) &&
            !item.payload.courseId,
        )
        .map((item) => [courseKey(item.payload.title), item.payload.title.trim()]),
    ).values(),
  ];
  const selected = courses.find((course) => course.id === selectedCourseId);
  const journal = buildJournal(items);
  const suggestions = unlinkedSubjects.length > 0 && (
    <div className='course-imported-subjects'>
      <strong>Предметы из расписания</strong>
      <p>
        Создайте карточку предмета по уже добавленной паре — занятие и совпадающие оценки появятся в
        ней без повторного ввода.
      </p>
      <div>
        {unlinkedSubjects.map((name) => (
          <button
            key={courseKey(name)}
            onClick={() => open({ kind: 'course', defaults: { title: name } })}
          >
            <Plus size={14} />
            {name}
          </button>
        ))}
      </div>
    </div>
  );
  if (!courses.length)
    return (
      <>
        <div className='course-empty'>
          <span className='course-empty-icon'>
            <BookOpen size={30} />
          </span>
          <h2>Начните с предмета</h2>
          <p>
            Тогда расписание, оценки, задачи, конспекты и другие записи смогут собираться в одном
            месте. Старые записи не пропадут.
          </p>
          <button className='button primary' onClick={() => open({ kind: 'course' })}>
            <Plus size={17} />
            Добавить предмет
          </button>
        </div>
        {suggestions}
      </>
    );
  if (!selected)
    return (
      <>
        <div className='course-intro'>
          Откройте предмет, чтобы увидеть связанные записи из разных разделов. Записи с точно
          совпадающим названием предмета тоже отображаются здесь.
        </div>
        {suggestions}
        <div className='course-grid'>
          {courses.map((course, index) => {
            const related = recordsForCourse(items, course);
            const pending = related.filter(
              (item) => item.kind === 'task' && item.payload.status !== 'done',
            ).length;
            return (
              <button
                className={`course-tile ${courseToneClass(getCourseTone(course, index))}`}
                key={course.id}
                onClick={() => setSelectedCourseId(course.id)}
              >
                <CourseColorMark course={course} index={index} className='course-tile-icon' />
                <strong>{course.payload.title}</strong>
                <small>{course.payload.teacher || 'Преподаватель не указан'}</small>
                <span className='course-tile-meta'>
                  {related.length} записей · {pending} открытых задач <ArrowRight size={16} />
                </span>
              </button>
            );
          })}
        </div>
      </>
    );

  const related = recordsForCourse(items, selected);
  const markGroup = journal.find((group) => group.courseId === selected.id);
  const selectedTone = getCourseTone(
    selected,
    courses.findIndex((course) => course.id === selected.id),
  );
  const pending = related.filter(
    (item) => item.kind === 'task' && item.payload.status !== 'done',
  ).length;
  const minutes = related
    .filter((item) => item.kind === 'study')
    .reduce((sum, item) => sum + Number(item.payload.minutes), 0);
  const add = (kind) => open({ kind, defaults: courseDefaults(kind, selected) });
  return (
    <div className='course-detail'>
      <div className='course-detail-top'>
        <button className='course-back' onClick={() => setSelectedCourseId(null)}>
          <ArrowRight size={16} />
          Все предметы
        </button>
        <div className='course-detail-actions'>
          <button
            className='button secondary'
            onClick={() => open({ kind: 'course', item: selected })}
          >
            <Pencil size={16} />
            Редактировать
          </button>
          <button className='button secondary' onClick={() => remove(selected)}>
            <Trash2 size={16} />
            Удалить
          </button>
        </div>
      </div>
      <div className={`course-detail-heading ${courseToneClass(selectedTone)}`}>
        <CourseColorMark
          course={selected}
          index={courses.findIndex((course) => course.id === selected.id)}
          className='course-tile-icon'
        />
        <div>
          <h2>{selected.payload.title}</h2>
          <p>
            {[selected.payload.teacher, selected.payload.room].filter(Boolean).join(' · ') ||
              'Все материалы и дела по этому предмету'}
          </p>
        </div>
      </div>
      <div className='course-connected-stats'>
        <div>
          <strong>{related.length}</strong>
          <span>записей</span>
        </div>
        <div>
          <strong>{pending}</strong>
          <span>открытых задач</span>
        </div>
        <div>
          <strong>
            {markGroup?.percent === null || markGroup?.percent === undefined
              ? '—'
              : `${markGroup.percent}%`}
          </strong>
          <span>по оценкам журнала</span>
        </div>
        <div>
          <strong>{minutes}</strong>
          <span>минут учёбы</span>
        </div>
      </div>
      <div className='course-quick-actions'>
        {[
          ['schedule', 'Пара'],
          ['task', 'Задача'],
          ['assessment', 'Оценка'],
          ['note', 'Конспект'],
          ['material', 'Материал'],
          ['reminder', 'Напоминание'],
        ].map(([kind, label]) => (
          <button key={kind} onClick={() => add(kind)}>
            <Plus size={15} />
            {label}
          </button>
        ))}
      </div>
      <div className='course-groups'>
        {groups.map(([kind, label, Glyph]) => {
          const list = related.filter((item) => item.kind === kind);
          return (
            <section className='panel course-group' key={kind}>
              <div className='course-group-head'>
                <div>
                  <Glyph size={18} />
                  <h3>{label}</h3>
                  <small>{list.length}</small>
                </div>
                <button onClick={() => add(kind)} aria-label={`Добавить: ${label}`}>
                  <Plus size={17} />
                </button>
              </div>
              {list.length ? (
                list.slice(0, 4).map((item) => (
                  <div className='course-record' key={item.id}>
                    <div>
                      <b>{item.payload.title}</b>
                      <small>{detail(item)}</small>
                    </div>
                    <button
                      className='course-record-edit'
                      onClick={() => open({ kind, item })}
                      aria-label={`Редактировать: ${item.payload.title}`}
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                ))
              ) : (
                <p className='course-group-empty'>Пока нет записей</p>
              )}
              <button
                className='course-see-all'
                onClick={() => navigate(kind === 'assessment' ? 'journal' : kind)}
              >
                {list.length > 4 ? 'Все записи' : `Открыть ${label.toLocaleLowerCase('ru')}`}{' '}
                <ArrowRight size={14} />
              </button>
            </section>
          );
        })}
      </div>
    </div>
  );
}
