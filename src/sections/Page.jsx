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
import { Courses } from './Courses.jsx';
import { Schedule } from './Schedule.jsx';
import { Tasks } from './Tasks.jsx';
import { Notes } from './Notes.jsx';
import { Reminders } from './Reminders.jsx';
import { Focus } from './Focus.jsx';
import { Collection } from './Collection.jsx';
import { Profile } from './Profile.jsx';
import { Assistant } from './Assistant.jsx';
import { DirectChat } from '../DirectChat.jsx';

function Page(props) {
  let view;
  switch (props.page) {
    case 'dashboard':
      view = <DashboardHome {...props} />;
      break;
    case 'course':
      view = <CourseWorkspace {...props} />;
      break;
    case 'schedule':
      view = <Schedule {...props} />;
      break;
    case 'task':
      view = <Tasks {...props} />;
      break;
    case 'journal':
      view = <JournalView {...props} />;
      break;
    case 'grade':
      view = <GpaView {...props} />;
      break;
    case 'note':
      view = <Notes {...props} />;
      break;
    case 'reminder':
      view = <Reminders {...props} />;
      break;
    case 'focus':
      view = <FocusWorkspace {...props} />;
      break;
    case 'flashcard':
      view = <FlashcardsView {...props} />;
      break;
    case 'assistant':
      view = <Assistant {...props} />;
      break;
    case 'groups':
      view = <GroupWorkspace {...props} />;
      break;
    case 'chat':
      view = <DirectChat {...props} />;
      break;
    case 'material':
      view = <MaterialLibrary {...props} />;
      break;
    case 'profile':
      view = <Profile {...props} />;
      break;
    default:
      view = <Collection {...props} />;
  }
  return (
    <>
      <div key={props.page} className={`section-stage section-${props.page}`}>
        {view}
      </div>
    </>
  );
}

export { Page };
