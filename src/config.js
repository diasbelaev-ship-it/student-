export const today = () => new Date().toLocaleDateString('sv-SE');
export const days = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
];
export const sections = [
  { id: 'dashboard', label: 'Сегодня', icon: 'LayoutDashboard' },
  { id: 'schedule', label: 'Расписание', icon: 'CalendarDays' },
  { id: 'course', label: 'Предметы', icon: 'BookOpen' },
  { id: 'task', label: 'Дедлайны', icon: 'Columns3' },
  { id: 'note', label: 'Конспекты', icon: 'NotebookPen' },
  { id: 'groups', label: 'Учебные группы', icon: 'Users' },
  { id: 'chat', label: 'Чат', icon: 'MessageCircle' },
  { id: 'assistant', label: 'ИИ-помощник', icon: 'Sparkles' },
  { id: 'journal', label: 'Журнал оценок', icon: 'ClipboardList' },
  { id: 'grade', label: 'Калькулятор GPA', icon: 'GraduationCap' },
  { id: 'material', label: 'Библиотека', icon: 'Library' },
  { id: 'reminder', label: 'Напоминания', icon: 'BellRing', extra: true },
  { id: 'focus', label: 'Фокус', icon: 'Timer', extra: true },
  { id: 'flashcard', label: 'Карточки', icon: 'Layers3', extra: true },
  { id: 'attendance', label: 'Посещаемость', icon: 'UserCheck', extra: true },
  { id: 'goal', label: 'Цели', icon: 'Target', extra: true },
  { id: 'habit', label: 'Привычки', icon: 'Activity', extra: true },
  { id: 'study', label: 'Учебное время', icon: 'ChartNoAxesCombined', extra: true },
  { id: 'expense', label: 'Финансы', icon: 'Wallet', extra: true },
  { id: 'profile', label: 'Профиль', icon: 'UserRound', extra: true },
];
const field = (name, label, type = 'text', extra = {}) => ({ name, label, type, ...extra });
export const forms = {
  course: {
    label: 'Предмет',
    fields: [
      field('title', 'Название предмета'),
      field('teacher', 'Преподаватель'),
      field('room', 'Основная аудитория'),
    ],
  },
  schedule: {
    label: 'Занятие',
    fields: [
      field('title', 'Предмет'),
      field('day', 'День недели', 'select', {
        options: days.map((label, value) => ({ label, value })),
      }),
      field('time', 'Начало', 'time'),
      field('end', 'Конец', 'time'),
      field('location', 'Аудитория / ссылка'),
    ],
  },
  task: {
    label: 'Задача',
    fields: [
      field('title', 'Что нужно сделать'),
      field('date', 'Дедлайн', 'date'),
      field('status', 'Статус', 'select', {
        options: [
          { label: 'К выполнению', value: 'todo' },
          { label: 'В работе', value: 'doing' },
          { label: 'Готово', value: 'done' },
        ],
      }),
      field('priority', 'Приоритет', 'select', {
        options: [
          { label: 'Обычный', value: 'normal' },
          { label: 'Высокий', value: 'high' },
          { label: 'Низкий', value: 'low' },
        ],
      }),
    ],
  },
  grade: {
    label: 'Дисциплина для GPA',
    fields: [
      field('title', 'Дисциплина'),
      field('grade', 'Балл GPA (0–4)', 'number', { min: 0, max: 4, step: 0.01 }),
      field('credits', 'Кредиты', 'number', { min: 0.5, max: 60, step: 0.5 }),
      field('type', 'Тип', 'select', {
        options: [
          { label: 'Курс', value: 'course' },
          { label: 'Экзамен', value: 'exam' },
          { label: 'Зачёт', value: 'credit' },
        ],
      }),
    ],
  },
  assessment: {
    label: 'Оценка в журнале',
    fields: [
      field('subject', 'Предмет'),
      field('title', 'За что оценка'),
      field('score', 'Получено баллов', 'number', { min: 0, max: 1000, step: 0.01 }),
      field('maxScore', 'Из скольких баллов', 'number', { min: 0.01, max: 1000, step: 0.01 }),
      field('type', 'Вид работы', 'select', {
        options: [
          { label: 'Текущая работа', value: 'current' },
          { label: 'Контрольная / тест', value: 'test' },
          { label: 'Экзамен', value: 'exam' },
          { label: 'Зачёт', value: 'credit' },
        ],
      }),
      field('date', 'Дата', 'date'),
      field('note', 'Комментарий', 'textarea'),
    ],
  },
  note: {
    label: 'Конспект',
    fields: [
      field('title', 'Название'),
      field('folder', 'Папка / предмет'),
      field('body', 'Текст конспекта', 'textarea'),
    ],
  },
  reminder: {
    label: 'Напоминание',
    fields: [
      field('title', 'Событие'),
      field('date', 'Дата', 'date'),
      field('time', 'Время', 'time'),
      field('alertMinutes', 'За сколько минут', 'number', { min: 0, max: 1440, step: 1 }),
    ],
  },
  flashcard: {
    label: 'Карточка',
    fields: [
      field('deck', 'Набор / тема'),
      field('level', 'Уровень'),
      field('title', 'Слово или вопрос'),
      field('answer', 'Перевод или ответ', 'textarea'),
      field('pronunciation', 'Произношение'),
      field('example', 'Пример в контексте', 'textarea'),
      field('exampleTranslation', 'Перевод примера', 'textarea'),
      field('note', 'Подсказка по употреблению', 'textarea'),
    ],
  },
  material: {
    label: 'Материал',
    fields: [
      field('title', 'Название'),
      field('subject', 'Предмет'),
      field('url', 'Ссылка HTTPS', 'url'),
      field('notes', 'Заметка', 'textarea'),
    ],
  },
  attendance: {
    label: 'Посещаемость',
    fields: [
      field('title', 'Предмет'),
      field('date', 'Дата', 'date'),
      field('status', 'Статус', 'select', {
        options: [
          { label: 'Присутствовал', value: 'present' },
          { label: 'Пропустил', value: 'absent' },
          { label: 'Уважительная причина', value: 'excused' },
        ],
      }),
    ],
  },
  goal: {
    label: 'Цель',
    fields: [
      field('title', 'Чего хотите достичь'),
      field('targetDate', 'К какой дате', 'date'),
      field('progress', 'Прогресс, %', 'number', { min: 0, max: 100, step: 1 }),
    ],
  },
  habit: {
    label: 'Привычка',
    fields: [
      field('title', 'Название'),
      field('frequency', 'Частота', 'select', {
        options: [
          { label: 'Ежедневно', value: 'daily' },
          { label: 'Еженедельно', value: 'weekly' },
        ],
      }),
      field('completed', 'Выполнено раз', 'number', { min: 0, max: 10000, step: 1 }),
    ],
  },
  study: {
    label: 'Учебная сессия',
    fields: [
      field('title', 'Над чем работали'),
      field('minutes', 'Минут', 'number', { min: 1, max: 1440, step: 1 }),
      field('date', 'Дата', 'date'),
    ],
  },
  expense: {
    label: 'Расход',
    fields: [
      field('title', 'На что потратили'),
      field('amount', 'Сумма, ₸', 'number', { min: 0, max: 100000000, step: 0.01 }),
      field('date', 'Дата', 'date'),
    ],
  },
};
export function initialValues(kind) {
  const defaults = {
    day: 0,
    time: '09:00',
    end: '10:30',
    date: today(),
    targetDate: today(),
    alertMinutes: 15,
    credits: 3,
    grade: 4,
    score: 0,
    maxScore: 100,
    status: kind === 'attendance' ? 'present' : 'todo',
    priority: 'normal',
    type: kind === 'assessment' ? 'current' : 'course',
    progress: 0,
    completed: 0,
    frequency: 'daily',
    minutes: 25,
    amount: 0,
  };
  return Object.fromEntries(forms[kind].fields.map((f) => [f.name, defaults[f.name] ?? '']));
}
