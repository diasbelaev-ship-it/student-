import { useRef } from 'react';
import * as shared from './app-shared.jsx';
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
import { Auth, Logo } from './components/SharedComponents.jsx';
import { SearchDialog } from './components/GlobalSearch.jsx';
import { Editor } from './components/RecordEditor.jsx';
import { Page } from './sections/Page.jsx';
import AppShell from './AppShell.jsx';
import { useItems } from './hooks/useItems.js';
import { useSession } from './hooks/useSession.js';
import { useToast } from './hooks/useToast.js';
import { useReminders } from './hooks/useReminders.js';
import { LOCALES } from './i18n.js';
import {
  DEFAULT_PROFILE_PREFERENCES,
  readProfilePreferences,
  writeProfilePreferences,
} from './profilePreferences.js';

function App() {
  const { user, setUser, loading } = useSession();
  const sessionVersion = useRef(0);
  const [locale, setLocale] = useState(() => {
    try {
      const saved = window.localStorage.getItem('studia-locale:guest');
      return LOCALES.includes(saved) ? saved : 'ru';
    } catch {
      return 'ru';
    }
  });
  const [profilePreferences, setProfilePreferences] = useState({
    ...DEFAULT_PROFILE_PREFERENCES,
  });
  const { toast, setToast } = useToast();
  const [page, setPage] = useState('dashboard'),
    [selectedCourseId, setSelectedCourseId] = useState(null),
    [selectedGroupId, setSelectedGroupId] = useState(null),
    [editor, setEditor] = useState(null),
    [reminderAlert, setReminderAlert] = useState(null),
    [menu, setMenu] = useState(false),
    [more, setMore] = useState(false),
    [searchOpen, setSearchOpen] = useState(false);
  const { items, setItems, refresh } = useItems(setToast);
  useReminders(user, items, setReminderAlert);
  useEffect(() => {
    if (!user) {
      setProfilePreferences({ ...DEFAULT_PROFILE_PREFERENCES });
      return;
    }
    try {
      const savedLocale = window.localStorage.getItem(`studia-locale:${user.id}`);
      if (LOCALES.includes(savedLocale)) setLocale(savedLocale);
    } catch {}
    setProfilePreferences(readProfilePreferences(user.id));
  }, [user?.id]);
  function saveProfilePreferences(value) {
    const saved = writeProfilePreferences(user.id, value);
    setProfilePreferences(saved);
    return saved;
  }
  function changeLocale(value) {
    if (!LOCALES.includes(value)) return;
    setLocale(value);
    try {
      window.localStorage.setItem(user ? `studia-locale:${user.id}` : 'studia-locale:guest', value);
    } catch {}
  }
  useEffect(() => {
    if (user) refresh();
  }, [user?.id]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((value) => !value);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  async function save(kind, payload, id) {
    const version = sessionVersion.current;
    const result = id
      ? await send(`/api/items/${id}`, 'PUT', { kind, payload })
      : await send('/api/items', 'POST', { kind, payload });
    if (version !== sessionVersion.current) return;
    setItems((current) =>
      id ? current.map((x) => (x.id === id ? result : x)) : [result, ...current],
    );
    setEditor(null);
    setToast(id ? 'Изменения сохранены' : 'Запись добавлена');
  }
  async function remove(item) {
    const warning =
      item.kind === 'course'
        ? `Удалить предмет «${item.payload.title}»? Все связанные записи сохранятся без привязки.`
        : `Удалить «${item.payload.title}»?`;
    if (!window.confirm(warning)) return;
    const version = sessionVersion.current;
    try {
      await api(`/api/items/${item.id}`, { method: 'DELETE' });
      if (version !== sessionVersion.current) return;
      setItems((current) =>
        current
          .filter((record) => record.id !== item.id)
          .map((record) =>
            item.kind === 'course' && Number(record.payload.courseId) === Number(item.id)
              ? { ...record, payload: { ...record.payload, courseId: undefined } }
              : record,
          ),
      );
      setToast('Запись удалена');
    } catch (e) {
      if (version === sessionVersion.current) setToast(e.message);
    }
  }
  async function update(item, patch) {
    const version = sessionVersion.current;
    try {
      await save(item.kind, { ...item.payload, ...patch }, item.id);
    } catch (e) {
      if (version === sessionVersion.current) setToast(e.message);
    }
  }
  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      setToast(error.message);
      return;
    }
    sessionVersion.current++;
    setUser(null);
    setItems([]);
    setPage('dashboard');
    setSelectedCourseId(null);
    setSelectedGroupId(null);
    setEditor(null);
    setReminderAlert(null);
    setMenu(false);
    setMore(false);
    setSearchOpen(false);
    setToast('');
  }
  function navigate(id, recordId) {
    const pageId = id === 'assessment' ? 'journal' : id;
    if (pageId === 'course' && recordId) setSelectedCourseId(recordId);
    if (pageId === 'groups') setSelectedGroupId(recordId || null);
    setPage(pageId);
    setMenu(false);
    if (!sections.find((s) => s.id === pageId)?.extra) setMore(false);
    window.scrollTo(0, 0);
  }
  if (loading)
    return (
      <div className='loading'>
        <Logo />
        <span>Загружаем пространство…</span>
      </div>
    );
  if (!user) return <Auth onSuccess={setUser} locale={locale} setLocale={changeLocale} />;
  const version = sessionVersion.current;
  return (
    <AppShell
      {...{
        user,
        locale,
        profilePreferences,
        saveProfilePreferences,
        setLocale: changeLocale,
        setUser: (value) => {
          if (version === sessionVersion.current) setUser(value);
        },
        items,
        setItems,
        page,
        setPage,
        selectedCourseId,
        setSelectedCourseId,
        selectedGroupId,
        editor,
        setEditor,
        toast,
        setToast,
        reminderAlert,
        setReminderAlert,
        menu,
        setMenu,
        more,
        setMore,
        searchOpen,
        setSearchOpen,
        logout,
        navigate,
        save,
        remove,
        update,
        refresh: () => (version === sessionVersion.current ? refresh() : Promise.resolve(null)),
      }}
    />
  );
}

export default App;
