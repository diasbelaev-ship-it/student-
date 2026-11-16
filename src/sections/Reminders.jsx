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

function Reminders({ items, open, remove, toast, navigate, onTestReminder }) {
  const list = by(items, 'reminder').sort((a, b) =>
    `${a.payload.date}${a.payload.time}`.localeCompare(`${b.payload.date}${b.payload.time}`),
  );
  const [sound, setSound] = useState(reminderSoundEnabled);
  const [permission, setPermission] = useState(
    'Notification' in window ? Notification.permission : 'unsupported',
  );
  useEffect(() => {
    const update = () =>
      setPermission('Notification' in window ? Notification.permission : 'unsupported');
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, []);
  async function enable() {
    if (!('Notification' in window))
      return toast(
        'Браузер не поддерживает системные уведомления. Напоминание появится внутри сайта.',
      );
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      toast(
        result === 'granted'
          ? 'Уведомления разрешены. Нажмите «Проверить», чтобы увидеть пример.'
          : result === 'denied'
            ? 'Уведомления заблокированы в настройках браузера.'
            : 'Разрешение не предоставлено.',
      );
    } catch {
      toast('Не удалось запросить разрешение. Проверьте настройки уведомлений браузера.');
    }
  }
  async function toggleSound() {
    if (sound) {
      setSound(false);
      localStorage.setItem('studia-sound', 'off');
      toast('Звуковой сигнал выключен');
      return;
    }
    if (!(await unlockReminderSound()))
      return toast('Браузер не разрешил звук. Проверьте настройки звука и нажмите ещё раз.');
    setSound(true);
    localStorage.setItem('studia-sound', 'on');
    playReminderSound();
    toast('Звук включён. Вы должны были услышать два сигнала.');
  }
  async function test() {
    onTestReminder();
    const played = sound && (await unlockReminderSound()) && playReminderSound();
    const shown = await showReminderNotification(
      'Проверка Studia',
      'Так будет выглядеть напоминание',
      'studia-reminder-test',
    );
    toast(
      shown
        ? `Пробное уведомление отправлено${played ? ' со звуком' : ''}.`
        : 'Системное уведомление недоступно. Проверьте разрешение браузера; напоминания внутри сайта всё равно появятся.',
    );
  }
  const status =
    permission === 'granted'
      ? 'Системные уведомления разрешены'
      : permission === 'denied'
        ? 'Системные уведомления заблокированы браузером'
        : permission === 'unsupported'
          ? 'Системные уведомления не поддерживаются'
          : 'Нужно разрешить уведомления в браузере';
  return (
    <>
      <div className='toolbar'>
        <div className='toolbar-note'>
          <Icon.BellRing size={17} />
          <span>
            {status}. Напоминания работают, пока сайт открыт; после сна вкладки пропущенное
            предупреждение появится до начала события и ещё 5 минут после него.
          </span>
        </div>
        <div className='toolbar-buttons'>
          <button className='button secondary' onClick={toggleSound}>
            {sound ? 'Выключить звук' : 'Включить звук'}
          </button>
          <button className='button secondary' onClick={enable}>
            Разрешить уведомления
          </button>
          <button className='button secondary' onClick={test}>
            Проверить
          </button>
        </div>
      </div>
      <div className='list-panel'>
        {list.length ? (
          list.map((x) => (
            <article className='list-item' key={x.id}>
              <span className='list-icon'>
                <Icon.Bell size={19} />
              </span>
              <div>
                <b>{x.payload.title}</b>
                <p>
                  {prettyDate(x.payload.date)} · {x.payload.time} · за {x.payload.alertMinutes} мин.
                </p>
                <CourseBadge item={x} items={items} navigate={navigate} />
              </div>
              <CardActions item={x} open={open} remove={remove} />
            </article>
          ))
        ) : (
          <Empty
            title='Напоминаний пока нет'
            text='Добавьте событие и выберите время предупреждения.'
          />
        )}
      </div>
    </>
  );
}

export { Reminders };
