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

function Collection({ page, items, open, remove, update, navigate }) {
  const list = by(items, page),
    total = page === 'expense' ? list.reduce((s, x) => s + Number(x.payload.amount), 0) : null,
    attendance =
      page === 'attendance'
        ? Math.round(
            (list.filter((x) => x.payload.status === 'present').length / (list.length || 1)) * 100,
          )
        : null,
    study = page === 'study' ? list.reduce((s, x) => s + Number(x.payload.minutes), 0) : null;
  return (
    <>
      {(total !== null || attendance !== null || study !== null) && (
        <div className='collection-summary'>
          <span>
            {page === 'expense'
              ? 'Всего расходов'
              : page === 'attendance'
                ? 'Посещаемость'
                : 'Время занятий'}
          </span>
          <b>
            {total !== null
              ? `${total.toLocaleString('ru-RU')} ₸`
              : attendance !== null
                ? `${attendance}%`
                : `${Math.floor(study / 60)} ч ${study % 60} мин`}
          </b>
        </div>
      )}
      {list.length ? (
        <div className='list-panel'>
          {list.map((x) => (
            <article className='list-item' key={x.id}>
              <span className='list-icon'>
                {page === 'material' ? (
                  <Icon.BookOpen size={20} />
                ) : page === 'goal' ? (
                  <Icon.Target size={20} />
                ) : page === 'habit' ? (
                  <Icon.Activity size={20} />
                ) : page === 'expense' ? (
                  <Icon.Wallet size={20} />
                ) : page === 'study' ? (
                  <Icon.Timer size={20} />
                ) : (
                  <Icon.UserCheck size={20} />
                )}
              </span>
              <div className='list-content'>
                <b>{x.payload.title}</b>
                <p>{description(page, x.payload)}</p>
                <CourseBadge item={x} items={items} navigate={navigate} />
                {page === 'goal' && (
                  <div className='progress'>
                    <i style={{ width: `${x.payload.progress}%` }} />
                  </div>
                )}
              </div>
              {page === 'habit' && (
                <button
                  className='button tertiary'
                  onClick={() => update(x, { completed: Number(x.payload.completed) + 1 })}
                >
                  +1
                </button>
              )}
              {page === 'material' && x.payload.url && (
                <a
                  className='button tertiary'
                  href={x.payload.url}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  Открыть <Icon.ExternalLink size={14} />
                </a>
              )}
              <CardActions item={x} open={open} remove={remove} />
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title='Первых записей пока нет'
          text='Нажмите «Добавить», чтобы начать вести этот раздел.'
        />
      )}
    </>
  );
}

export { Collection };
