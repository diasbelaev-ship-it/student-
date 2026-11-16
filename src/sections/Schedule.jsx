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

function Schedule({ items, open, remove, refresh, toast, navigate }) {
  const classes = by(items, 'schedule');
  const [showImport, setShowImport] = useState(false);
  return (
    <>
      <div className='toolbar'>
        <div className='toolbar-note'>
          <Icon.Info size={17} />
          Пары из этого расписания автоматически отображаются как предметы в журнале оценок.
        </div>
        <button className='button secondary' onClick={() => setShowImport(true)}>
          <Icon.Upload size={17} />
          Перенести расписание
        </button>
      </div>
      <div className='week-grid'>
        {days.map((day, index) => {
          const list = classes
            .filter((x) => Number(x.payload.day) === index)
            .sort((a, b) => a.payload.time.localeCompare(b.payload.time));
          return (
            <div className='day-column surface-card' key={day}>
              <div className='day-heading'>
                <span>{day}</span>
                <small>{list.length}</small>
              </div>
              {list.map((x) => (
                <div className='class-card surface-quiet' key={x.id}>
                  <span className='class-clock'>
                    {x.payload.time}–{x.payload.end}
                  </span>
                  <b>{x.payload.title}</b>
                  <small>{x.payload.location || 'Место не указано'}</small>
                  <CourseBadge item={x} items={items} navigate={navigate} compact />
                  <CardActions item={x} open={open} remove={remove} />
                </div>
              ))}
              {!list.length && <span className='day-empty'>Свободно</span>}
            </div>
          );
        })}
      </div>
      <p className='help-text'>
        Импорт из Platonus разовый: Studia не хранит данные для входа и не синхронизируется с
        Platonus автоматически. Уже выставленные в журнале оценки при удалении пары сохраняются.
      </p>
      {showImport && (
        <ScheduleImport
          existing={classes}
          courses={by(items, 'course')}
          close={() => setShowImport(false)}
          refresh={refresh}
          toast={toast}
        />
      )}
    </>
  );
}

export { Schedule };
