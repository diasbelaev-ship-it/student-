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

function Tasks({ items, open, remove, update, navigate }) {
  const columns = [
    ['todo', 'К выполнению'],
    ['doing', 'В работе'],
    ['done', 'Готово'],
  ];
  const emptyText = {
    todo: 'Новые задачи начнутся здесь.',
    doing: 'Сюда переместятся задачи, над которыми вы работаете.',
    done: 'Здесь будут завершённые дела.',
  };
  return (
    <div className='kanban'>
      {columns.map(([status, label]) => {
        const list = by(items, 'task').filter((x) => x.payload.status === status);
        return (
          <section className='kanban-column surface-status' key={status}>
            <div className='kanban-heading'>
              <span className={`kanban-mark ${status}`} />
              <h3>{label}</h3>
              <small>{list.length}</small>
            </div>
            {list.map((x) => (
              <article className='task-card surface-card' key={x.id}>
                <div className='task-card-top'>
                  <span className={`priority-tag ${x.payload.priority}`}>
                    {x.payload.priority === 'high'
                      ? 'Высокий'
                      : x.payload.priority === 'low'
                        ? 'Низкий'
                        : 'Обычный'}
                  </span>
                  <CardActions item={x} open={open} remove={remove} />
                </div>
                <b>{x.payload.title}</b>
                <CourseBadge item={x} items={items} navigate={navigate} />
                <div className='task-bottom'>
                  <span>
                    <Icon.CalendarDays size={14} />
                    {x.payload.date ? prettyDate(x.payload.date) : 'Без даты'}
                  </span>
                  {status !== 'done' && (
                    <button
                      onClick={() => update(x, { status: status === 'todo' ? 'doing' : 'done' })}
                      title='Переместить вправо'
                    >
                      <Icon.ArrowRight size={16} />
                    </button>
                  )}
                </div>
                <div className='task-linked-actions'>
                  {x.payload.date && (
                    <button
                      onClick={() =>
                        open({
                          kind: 'reminder',
                          defaults: {
                            title: x.payload.title,
                            date: x.payload.date,
                            time: '09:00',
                            ...(x.payload.courseId ? { courseId: x.payload.courseId } : {}),
                          },
                        })
                      }
                    >
                      <Icon.BellRing size={13} />
                      Напомнить
                    </button>
                  )}
                  <button
                    onClick={() =>
                      open({
                        kind: 'note',
                        defaults: {
                          title: x.payload.title,
                          ...(x.payload.courseId ? { courseId: x.payload.courseId } : {}),
                        },
                      })
                    }
                  >
                    <Icon.NotebookPen size={13} />
                    Конспект
                  </button>
                </div>
              </article>
            ))}
            {!list.length && <p className='kanban-empty'>{emptyText[status]}</p>}
            <button
              className='add-in-column'
              onClick={() => open({ kind: 'task', defaults: { status } })}
            >
              <Icon.Plus size={17} /> Добавить задачу
            </button>
          </section>
        );
      })}
    </div>
  );
}

export { Tasks };
