import * as shared from '../app-shared.jsx';
const {
  React,
  useEffect,
  useMemo,
  useState,
  Activity,
  ArrowRight,
  ArrowUpRight,
  Atom,
  Bell,
  BellRing,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  CheckSquare2,
  Circle,
  ClipboardList,
  Columns3,
  ExternalLink,
  GraduationCap,
  Hourglass,
  Info,
  Layers3,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Microscope,
  NotebookPen,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Ruler,
  Search,
  Send,
  Smartphone,
  Sparkles,
  Sprout,
  Target,
  Timer,
  Trash2,
  Upload,
  UserCheck,
  UserRound,
  Users,
  Wallet,
  X,
  api,
  send,
  days,
  forms,
  initialValues,
  sections,
  today,
  ScheduleImport,
  DashboardHome,
  AiProposalCard,
  FlashcardsView,
  JournalView,
  GpaView,
  CourseWorkspace,
  FocusWorkspace,
  GroupWorkspace,
  MaterialLibrary,
  courseForRecord,
  courseDefaults,
  CourseColorMark,
  COURSE_COLORS,
  courseToneClass,
  getCourseTone,
  dueReminders,
  reminderDeliveryKey,
  playReminderSound,
  showReminderNotification,
  unlockReminderSound,
  Icon,
  prettyDate,
  plural,
  deliveredAlerts,
  subtitle,
  by,
  courseLinkedKinds,
  description,
  reminderSoundEnabled,
} = shared;
import * as ui from '../components/SharedComponents.jsx';
const { CourseBadge, Metric, Empty, CardActions } = ui;

function Courses({ items, open, remove, update, navigate }) {
  const courses = by(items, 'course');
  const [selectedId, setSelectedId] = useState(null);
  const selected = courses.find((x) => x.id === selectedId);
  const linked = (kind) => by(items, kind).filter((x) => Number(x.payload.courseId) === selectedId);
  if (!courses.length)
    return (
      <div className='course-empty'>
        <span className='course-empty-icon'>
          <Icon.BookOpen size={30} />
        </span>
        <h2>У каждого дела — свой предмет</h2>
        <p>
          Создайте предмет один раз. Затем пары, дедлайны, оценки и конспекты будут собраны рядом, а
          не разбросаны по разделам.
        </p>
        <button className='button primary' onClick={() => open({ kind: 'course' })}>
          <Icon.Plus size={17} />
          Добавить первый предмет
        </button>
      </div>
    );
  if (!selected)
    return (
      <>
        <div className='course-intro'>
          Выберите предмет, чтобы увидеть его занятия, ближайшие задачи, оценки и материалы.
        </div>
        <div className='course-grid'>
          {courses.map((course, index) => {
            const related = items.filter((x) => Number(x.payload.courseId) === course.id),
              openTasks = related.filter(
                (x) => x.kind === 'task' && x.payload.status !== 'done',
              ).length;
            return (
              <button
                className='course-tile'
                key={course.id}
                onClick={() => setSelectedId(course.id)}
              >
                <CourseColorMark course={course} index={index} className='course-tile-icon' />
                <strong>{course.payload.title}</strong>
                <small>{course.payload.teacher || 'Преподаватель не указан'}</small>
                <span className='course-tile-meta'>
                  {openTasks} {plural(openTasks, ['задача', 'задачи', 'задач'])} ·{' '}
                  {related.filter((x) => x.kind === 'note').length} конспектов{' '}
                  <Icon.ArrowRight size={16} />
                </span>
              </button>
            );
          })}
        </div>
      </>
    );
  const groups = [
    ['schedule', 'Расписание', Icon.CalendarDays],
    ['task', 'Задачи', Icon.CheckSquare2],
    ['grade', 'GPA', Icon.GraduationCap],
    ['note', 'Конспекты', Icon.NotebookPen],
    ['material', 'Материалы', Icon.Library],
    ['attendance', 'Посещаемость', Icon.UserCheck],
  ];
  const name = selected.payload.title.trim().toLowerCase();
  const suggestions = items
    .filter(
      (x) =>
        courseLinkedKinds.has(x.kind) &&
        !x.payload.courseId &&
        [x.payload.title, x.payload.folder, x.payload.subject].some(
          (value) => typeof value === 'string' && value.toLowerCase().includes(name),
        ),
    )
    .slice(0, 8);
  const selectedTone = getCourseTone(
    selected,
    courses.findIndex((course) => course.id === selected.id),
  );
  return (
    <div className='course-detail'>
      <div className='course-detail-top'>
        <button className='course-back' onClick={() => setSelectedId(null)}>
          <Icon.ArrowRight size={16} />
          Все предметы
        </button>
        <div className='course-detail-actions'>
          <button
            className='button secondary'
            onClick={() => open({ kind: 'course', item: selected })}
          >
            <Icon.Pencil size={16} />
            Редактировать
          </button>
          <button className='button secondary' onClick={() => remove(selected)}>
            <Icon.Trash2 size={16} />
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
              'Добавьте преподавателя и аудиторию при необходимости'}
          </p>
        </div>
      </div>
      <div className='course-quick-actions'>
        {[
          ['task', 'Задача'],
          ['schedule', 'Пара'],
          ['note', 'Конспект'],
          ['grade', 'Оценка'],
        ].map(([kind, label]) => (
          <button key={kind} onClick={() => open({ kind, defaults: { courseId: selected.id } })}>
            <Icon.Plus size={15} />
            {label}
          </button>
        ))}
      </div>
      {suggestions.length > 0 && (
        <div className='course-suggestions'>
          <b>Возможно, это тоже относится к предмету</b>
          <p>Старые записи не менялись. Привяжите только нужные.</p>
          {suggestions.map((x) => (
            <div key={x.id}>
              <span>
                {x.payload.title}
                <small>{sections.find((s) => s.id === x.kind)?.label}</small>
              </span>
              <button onClick={() => update(x, { courseId: selected.id })}>Привязать</button>
            </div>
          ))}
        </div>
      )}
      <div className='course-groups'>
        {groups.map(([kind, label, Glyph]) => {
          const list = linked(kind);
          return (
            <section className='panel course-group' key={kind}>
              <div className='course-group-head'>
                <div>
                  <Glyph size={18} />
                  <h3>{label}</h3>
                  <small>{list.length}</small>
                </div>
                <button
                  onClick={() => open({ kind, defaults: { courseId: selected.id } })}
                  aria-label={`Добавить: ${label}`}
                >
                  <Icon.Plus size={17} />
                </button>
              </div>
              {list.length ? (
                list.slice(0, 5).map((x) => (
                  <div className='course-record' key={x.id}>
                    <div>
                      <b>{x.payload.title}</b>
                      <small>
                        {kind === 'schedule'
                          ? `${days[x.payload.day]}, ${x.payload.time}–${x.payload.end}`
                          : kind === 'task'
                            ? x.payload.date
                              ? prettyDate(x.payload.date)
                              : 'Без срока'
                            : kind === 'grade'
                              ? `GPA ${Number(x.payload.grade).toFixed(2)} · ${x.payload.credits} кр.`
                              : kind === 'attendance'
                                ? prettyDate(x.payload.date)
                                : kind === 'note'
                                  ? x.payload.folder || 'Конспект'
                                  : kind === 'material'
                                    ? x.payload.subject || 'Материал'
                                    : ''}
                      </small>
                    </div>
                    <CardActions item={x} open={open} remove={remove} />
                  </div>
                ))
              ) : (
                <p className='course-group-empty'>Пока ничего нет — добавьте первую запись.</p>
              )}
              {list.length > 5 && (
                <button className='course-see-all' onClick={() => navigate(kind)}>
                  Все записи <Icon.ArrowRight size={14} />
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export { Courses };
