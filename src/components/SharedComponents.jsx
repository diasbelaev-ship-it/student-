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

function Auth({ onSuccess }) {
  const [{ initialMode, initialToken, clearHash }] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const mode = ['reset', 'verify'].find((key) => hash.has(key));
    const query = new URLSearchParams(window.location.search);
    return {
      initialMode: mode || query.get('auth'),
      initialToken: (mode ? hash.get(mode) : query.get('token')) || '',
      clearHash: Boolean(mode),
    };
  });
  useEffect(() => {
    if (clearHash)
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [clearHash]);
  const [mode, setMode] = useState(
      ['login', 'register', 'forgot', 'reset', 'verify'].includes(initialMode)
        ? initialMode
        : 'login',
    ),
    [values, setValues] = useState({ name: '', email: '', password: '' }),
    [token, setToken] = useState(initialToken),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'forgot') {
        const result = await send('/api/auth/forgot', 'POST', { email: values.email });
        setError(result.message);
      } else if (mode === 'verify') {
        const value = token.trim();
        const fragment = value.includes('#') ? value.slice(value.indexOf('#') + 1) : '';
        const code = new URLSearchParams(fragment).get('verify') || value;
        const result = await send('/api/auth/verify', 'POST', { token: code });
        setError(result.message);
        setMode('login');
      } else if (mode === 'reset') {
        await send('/api/auth/reset', 'POST', { token, password: values.password });
        setError('Пароль обновлён. Войдите с новым паролем.');
        setMode('login');
      } else {
        const result = await send(`/api/auth/${mode}`, 'POST', values);
        if (result.verificationRequired) {
          setError(
            result.message || 'Если регистрация возможна, инструкция будет отправлена на email.',
          );
          setMode('login');
        } else {
          onSuccess(result.user);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className='auth-page'>
      <div className='auth-copy'>
        <Logo />
        <div className='auth-message'>
          <span className='kicker light'>ВАШЕ ПРОСТРАНСТВО ДЛЯ УЧЁБЫ</span>
          <h1>
            Меньше хаоса.
            <br />
            <em>Больше движения.</em>
          </h1>
          <p>Расписание, дедлайны, конспекты и прогресс собраны в одном месте.</p>
        </div>
        <div className='auth-decoration'>
          <span>Ваш ритм учёбы</span>
          <div className='mini-schedule'>
            <small>Сегодня</small>
            <b>Всё под контролем</b>
            <span>Учитесь в своём ритме ↗</span>
          </div>
        </div>
      </div>
      <div className='auth-form-wrap'>
        <div className='auth-form'>
          <div className='auth-mobile-logo'>
            <Logo />
          </div>
          <span className='kicker'>РАДЫ ВИДЕТЬ ВАС</span>
          <h2>
            {
              {
                login: 'С возвращением',
                register: 'Создайте аккаунт',
                forgot: 'Восстановление доступа',
                reset: 'Новый пароль',
                verify: 'Подтверждение email',
              }[mode]
            }
          </h2>
          <p className='subtle'>
            {mode === 'login'
              ? 'Войдите и продолжайте с того места, где остановились.'
              : mode === 'register'
                ? 'Начните собирать учёбу в единый план.'
                : 'Выполните несколько шагов, чтобы восстановить доступ к аккаунту.'}
          </p>
          {['login', 'register'].includes(mode) && (
            <div className='auth-tabs'>
              <button
                className={mode === 'login' ? 'active' : ''}
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Вход
              </button>
              <button
                className={mode === 'register' ? 'active' : ''}
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
              >
                Регистрация
              </button>
            </div>
          )}
          <form onSubmit={submit}>
            {mode === 'register' && (
              <label>
                Ваше имя
                <input
                  required
                  minLength='2'
                  maxLength='60'
                  autoComplete='name'
                  value={values.name}
                  onChange={(e) => setValues({ ...values, name: e.target.value })}
                  placeholder='Например, Диас'
                />
              </label>
            )}
            {mode !== 'reset' && (
              <label>
                Email
                <input
                  required={mode !== 'verify'}
                  type='email'
                  name='email'
                  autoComplete={mode === 'login' || mode === 'register' ? 'username' : 'email'}
                  value={values.email}
                  onChange={(e) => setValues({ ...values, email: e.target.value })}
                  placeholder='student@example.com'
                />
              </label>
            )}
            {mode === 'verify' && (
              <label>
                Код из письма
                <input
                  required
                  minLength='20'
                  maxLength='2048'
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder='Вставьте ссылку или код подтверждения'
                />
              </label>
            )}
            {['login', 'register', 'reset'].includes(mode) && (
              <label>
                {mode === 'reset' ? 'Новый пароль' : 'Пароль'}
                <input
                  required
                  type='password'
                  name='password'
                  minLength='8'
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={values.password}
                  onChange={(e) => setValues({ ...values, password: e.target.value })}
                  placeholder='Не менее 8 символов'
                />
              </label>
            )}
            {error && (
              <p className='form-error' role='alert'>
                {error}
              </p>
            )}
            <button className='button primary full' disabled={busy}>
              {busy
                ? 'Подождите…'
                : {
                    login: 'Войти',
                    register: 'Создать аккаунт',
                    forgot: 'Отправить инструкцию',
                    reset: 'Обновить пароль',
                    verify: 'Подтвердить email',
                  }[mode]}
              <Icon.ArrowRight size={17} />
            </button>
          </form>
          {mode === 'login' && (
            <button
              className='text-button'
              onClick={() => {
                setMode('forgot');
                setError('');
              }}
            >
              Забыли пароль?
            </button>
          )}
          {mode === 'login' && error.includes('Подтвердите email') && (
            <button
              className='text-button'
              onClick={async () => {
                try {
                  await send('/api/auth/resend-verification', 'POST', { email: values.email });
                  setError('Если аккаунту требуется подтверждение, письмо будет отправлено.');
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              Отправить письмо повторно
            </button>
          )}
          {mode === 'verify' && (
            <button
              className='text-button'
              onClick={async () => {
                try {
                  await send('/api/auth/resend-verification', 'POST', { email: values.email });
                  setError('Если аккаунту требуется подтверждение, письмо будет отправлено.');
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              Отправить письмо повторно
            </button>
          )}
          {!['login', 'register'].includes(mode) && (
            <button
              className='text-button'
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              Вернуться ко входу
            </button>
          )}
          <p className='auth-foot'>Ваши записи доступны только вам.</p>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className='logo'>
      <span className='logo-mark'>
        <Icon.Sprout size={22} strokeWidth={2.4} />
      </span>
      <span>
        studia<span className='logo-dot'>.</span>
      </span>
    </div>
  );
}

function CourseBadge({ item, items, navigate, compact = false }) {
  const courses = by(items, 'course'),
    course = courseForRecord(item, courses);
  if (!course) return null;
  const sameTitle = compact && item.payload.title.trim() === course.payload.title.trim();
  const description = `Открыть предмет «${course.payload.title}»`;
  const tone = getCourseTone(
    course,
    courses.findIndex((value) => value.id === course.id),
  );
  return (
    <button
      className={`record-course-badge ${courseToneClass(tone)}`}
      onClick={() => navigate('course', course.id)}
      title={description}
      aria-label={sameTitle ? description : undefined}
    >
      <span className='course-color-dot' />
      {sameTitle ? 'К предмету' : course.payload.title}
      <Icon.ArrowRight size={12} />
    </button>
  );
}

function Metric({ icon: Glyph, label, value, hint }) {
  return (
    <div className='metric'>
      <span className='metric-icon'>
        <Glyph size={20} />
      </span>
      <span>{label}</span>
      <b>{value}</b>
      <small>{hint}</small>
    </div>
  );
}

function Empty({
  title = 'Здесь пока пусто',
  text = 'Добавьте первую запись, чтобы начать.',
  compact = false,
}) {
  return (
    <div className={`empty ${compact ? 'compact' : ''}`}>
      <span>
        <Icon.Sprout size={25} />
      </span>
      <b>{title}</b>
      <p>{text}</p>
    </div>
  );
}

function CardActions({ item, open, remove }) {
  return (
    <div className='card-actions'>
      <button
        className='icon-button'
        onClick={() => open({ kind: item.kind, item })}
        title='Редактировать'
        aria-label='Редактировать'
      >
        <Icon.Pencil size={16} />
      </button>
      <button
        className='icon-button danger'
        onClick={() => remove(item)}
        title='Удалить'
        aria-label='Удалить'
      >
        <Icon.Trash2 size={16} />
      </button>
    </div>
  );
}

export { Auth, Logo, CourseBadge, Metric, Empty, CardActions };
