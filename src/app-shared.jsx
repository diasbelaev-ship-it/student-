import React, { useEffect, useMemo, useState } from 'react';

import {
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
  ImagePlus,
  Info,
  Layers3,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  MessageCircle,
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
} from 'lucide-react';

import { api, send } from './api';

import { days, forms, initialValues, sections, today } from './config';

import ScheduleImport from './ScheduleImport';

import DashboardHome from './DashboardHome';

import AiProposalCard from './AiProposalCard';

import FlashcardsView from './FlashcardsView';

import JournalView from './JournalView';

import GpaView from './GpaView';

import CourseWorkspace from './CourseWorkspace';

import FocusWorkspace from './FocusWorkspace';

import GroupWorkspace from './GroupWorkspace';

import MaterialLibrary from './MaterialLibrary';

import { courseForRecord, courseDefaults } from './course-links';

import CourseColorMark from './CourseColorMark';

import { COURSE_COLORS, courseToneClass, getCourseTone } from './course-colors';

import {
  dueReminders,
  reminderDeliveryKey,
  playReminderSound,
  showReminderNotification,
  unlockReminderSound,
} from './reminder-notifications.mjs';

const Icon = {
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
  ImagePlus,
  Info,
  Layers3,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  MessageCircle,
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
};

const prettyDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Без даты';

const plural = (n, forms) =>
  forms[
    n % 10 === 1 && n % 100 !== 11
      ? 0
      : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
        ? 1
        : 2
  ];

const deliveredAlerts = new Set();

const subtitle = {
  course: 'Пары, задачи, оценки и материалы собраны по предметам.',
  schedule: 'Неделя, собранная по вашим правилам.',
  task: 'От идеи до выполненного дела.',
  journal: 'Предметы из расписания и ваши оценки по каждой работе.',
  grade: 'Отдельный расчёт среднего балла с учётом кредитов.',
  note: 'Ваши мысли, лекции и открытия.',
  groups: 'Общайтесь, делитесь файлами и согласовывайте сроки вместе.',
  chat: 'Личные беседы с однокурсниками — в одном месте.',
  reminder: 'Важное не потеряется среди повседневных дел.',
  focus: 'Время сосредоточиться на одном.',
  flashcard: 'Повторяйте активно, запоминайте надолго.',
  material: 'Полезные ссылки и материалы в одном месте.',
  attendance: 'Отмечайте занятия и отслеживайте участие.',
  goal: 'Большие цели начинаются с маленьких шагов.',
  habit: 'Пусть полезное станет привычным.',
  study: 'Посмотрите, куда уходит учебное время.',
  expense: 'Держите студенческие расходы в поле зрения.',
  assistant: 'Планируйте и разбирайте темы вместе с Gemini.',
  profile: 'Настройте личное учебное пространство.',
};

const by = (items, kind) => items.filter((x) => x.kind === kind);

const courseLinkedKinds = new Set([
  'schedule',
  'task',
  'assessment',
  'grade',
  'note',
  'reminder',
  'flashcard',
  'material',
  'attendance',
  'goal',
  'habit',
  'study',
  'expense',
]);

function reminderSoundEnabled() {
  try {
    return localStorage.getItem('studia-sound') !== 'off';
  } catch {
    return true;
  }
}

function description(kind, p) {
  switch (kind) {
    case 'material':
      return [p.subject, p.notes].filter(Boolean).join(' · ') || 'Материал';
    case 'attendance':
      return `${prettyDate(p.date)} · ${
        { present: 'Присутствовал', absent: 'Пропуск', excused: 'Уважительная причина' }[p.status]
      }`;
    case 'goal':
      return `${p.progress}% · ${p.targetDate ? `до ${prettyDate(p.targetDate)}` : 'без срока'}`;
    case 'habit':
      return `${p.frequency === 'daily' ? 'Ежедневно' : 'Еженедельно'} · выполнено ${p.completed} раз`;
    case 'expense':
      return `${prettyDate(p.date)} · ${Number(p.amount).toLocaleString('ru-RU')} ₸`;
    case 'study':
      return `${prettyDate(p.date)} · ${p.minutes} мин`;
    default:
      return '';
  }
}

export {
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
};
