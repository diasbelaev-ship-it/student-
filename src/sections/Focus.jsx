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

function Focus({ save, toast, user }) {
  const [settings] = useState(() => {
      try {
        const value = JSON.parse(localStorage.getItem(`studia-focus-settings-${user.id}`) || '{}');
        return {
          minutes:
            Number.isInteger(value.minutes) && value.minutes >= 1 && value.minutes <= 180
              ? value.minutes
              : 25,
          label: typeof value.label === 'string' ? value.label.slice(0, 160) : 'Учёба',
        };
      } catch {
        return { minutes: 25, label: 'Учёба' };
      }
    }),
    [mode, setMode] = useState('work'),
    [seconds, setSeconds] = useState(settings.minutes * 60),
    [running, setRunning] = useState(false),
    [label, setLabel] = useState(settings.label);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (seconds !== 0) return;
    setRunning(false);
    if (mode === 'work') {
      save('study', {
        title: label || 'Фокус-сессия',
        minutes: settings.minutes,
        date: today(),
      }).catch((e) => toast(e.message));
      setMode('break');
      setSeconds(5 * 60);
      toast(`${settings.minutes} минут выполнено. Время короткого отдыха!`);
    } else {
      setMode('work');
      setSeconds(settings.minutes * 60);
      toast('Отдых окончен. Готовы к следующему циклу?');
    }
  }, [seconds]);
  function change(next) {
    setMode(next);
    setSeconds(next === 'work' ? settings.minutes * 60 : 5 * 60);
    setRunning(false);
  }
  return (
    <div className='focus-panel'>
      <span className='kicker'>ПОМОГАЕМ ДЕРЖАТЬ ФОКУС</span>
      <h2>Одна задача. Один момент.</h2>
      <div className='focus-tabs'>
        <button className={mode === 'work' ? 'active' : ''} onClick={() => change('work')}>
          Работа · {settings.minutes} мин
        </button>
        <button className={mode === 'break' ? 'active' : ''} onClick={() => change('break')}>
          Перерыв · 5 мин
        </button>
      </div>
      <div className='timer-ring'>
        <span>
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:
          {String(seconds % 60).padStart(2, '0')}
        </span>
      </div>
      <input
        className='focus-label'
        value={label}
        maxLength={160}
        onChange={(e) => setLabel(e.target.value)}
        aria-label='Над чем работаете'
      />
      <div className='focus-actions'>
        <button className='button primary' onClick={() => setRunning(!running)}>
          {running ? (
            <>
              <Icon.Pause size={18} />
              Пауза
            </>
          ) : (
            <>
              <Icon.Play size={18} />
              Начать
            </>
          )}
        </button>
        <button
          className='button secondary'
          onClick={() => {
            setRunning(false);
            setSeconds(mode === 'work' ? settings.minutes * 60 : 5 * 60);
          }}
        >
          <Icon.RotateCcw size={17} />
          Сбросить
        </button>
      </div>
      <p>Завершённая работа автоматически сохраняется в «Учебном времени».</p>
    </div>
  );
}

export { Focus };
