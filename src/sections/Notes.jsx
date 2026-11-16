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

function Notes({ items, open, remove, navigate }) {
  const list = by(items, 'note'),
    [filter, setFilter] = useState('');
  const filtered = list.filter((x) =>
    `${x.payload.title} ${x.payload.body} ${x.payload.folder}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  return (
    <>
      <div className='search-box'>
        <Icon.Search size={18} />
        <input
          placeholder='Поиск по конспектам'
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {filtered.length ? (
        <div className='tile-grid'>
          {filtered.map((x) => (
            <article className='note-tile' key={x.id}>
              <div className='tile-top'>
                <span className='soft-icon'>
                  <Icon.NotebookPen size={19} />
                </span>
                <CardActions item={x} open={open} remove={remove} />
              </div>
              <small>{x.payload.folder || 'Без папки'}</small>
              <h3>{x.payload.title}</h3>
              <CourseBadge item={x} items={items} navigate={navigate} />
              <p>{x.payload.body || 'Откройте запись и добавьте текст конспекта.'}</p>
              <span className='tile-date'>{prettyDate(x.updated_at.slice(0, 10))}</span>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title='Конспекты ещё не добавлены'
          text='Сохраняйте идеи и лекции, чтобы быстро находить их позже.'
        />
      )}
    </>
  );
}

export { Notes };
