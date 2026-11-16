import { days, forms, sections } from './config.js';

const customLabels = {
  courseId: 'Предмет',
  sessionDate: 'Начало сессии',
  minutes: 'Длительность',
  label: 'Тема',
  name: 'Имя',
  scale: 'Шкала GPA',
  credits: 'Кредиты предметов',
  dueDate: 'Срок сдачи',
  course: 'Предмет',
  body: 'Текст сообщения',
};

const actionLabels = {
  create: ['Новая запись', 'Добавить'],
  update: ['Изменение записи', 'Сохранить изменения'],
  delete: ['Удаление записи', 'Удалить запись'],
  profile: ['Изменение профиля', 'Сохранить в профиле'],
  focus: ['Настройка фокуса', 'Применить настройки'],
  groupTask: ['Общий дедлайн', 'Добавить в группу'],
  groupMessage: ['Сообщение группе', 'Отправить группе'],
};

function fieldLabel(kind, key) {
  return customLabels[key] || forms[kind]?.fields.find((field) => field.name === key)?.label || key;
}

function fieldValue(kind, key, value, courses) {
  if (value === undefined || value === null || value === '') return 'Не указано';
  if (key === 'day') return days[Number(value)] || String(value);
  if (key === 'date' || key === 'targetDate' || key === 'sessionDate' || key === 'dueDate') {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (key === 'courseId')
    return (
      courses.find((course) => course.id === Number(value))?.payload.title || `Предмет №${value}`
    );
  if (key === 'alertMinutes') return `${value} мин. до события`;
  if (key === 'minutes') return `${value} мин`;
  if (key === 'credits' && kind === 'gpaSetting') {
    const entries = Object.entries(value);
    return entries.length
      ? entries.map(([subject, credits]) => `${subject}: ${credits} кр.`).join(' · ')
      : 'Равный вес для всех предметов';
  }
  if (key === 'credits') return `${value} кредитов`;
  if (key === 'scale') return value === 'bands' ? 'Примерная ступенчатая' : 'Линейная';
  if (key === 'grade') return `${Number(value).toFixed(2)} из 4`;
  if (key === 'progress') return `${value}%`;
  if (key === 'amount') return `${Number(value).toLocaleString('ru-RU')} ₸`;
  if (key === 'completed') return `${value} раз`;
  const option = forms[kind]?.fields
    .find((field) => field.name === key)
    ?.options?.find((item) => String(item.value) === String(value));
  return option?.label || String(value);
}

const equal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function proposalPreview(proposal, target, courses = []) {
  if (proposal.action === 'groupTask' || proposal.action === 'groupMessage') {
    const [actionTitle, confirmLabel] = actionLabels[proposal.action];
    const item = proposal.item || {};
    const payload = item.payload || {};
    return {
      kind: proposal.action,
      section: 'Учебные группы',
      actionTitle,
      confirmLabel,
      title:
        proposal.action === 'groupTask' ? payload.title || 'Общий дедлайн' : 'Сообщение участникам',
      fields: [
        { label: 'Группа', value: item.groupName || `Группа №${item.groupId}` },
        ...(proposal.action === 'groupTask'
          ? [
              {
                label: 'Срок сдачи',
                value: fieldValue('groupTask', 'dueDate', payload.dueDate, courses),
              },
              ...(payload.course ? [{ label: 'Предмет', value: payload.course }] : []),
            ]
          : [{ label: 'Текст сообщения', value: payload.body || 'Не указано' }]),
      ],
    };
  }
  const kind =
    proposal.item?.kind || target?.kind || (proposal.action === 'profile' ? 'profile' : 'focus');
  const payload = proposal.item?.payload || target?.payload || {};
  const before = target?.payload || {};
  const section =
    sections.find((item) => item.id === kind)?.label ||
    (kind === 'assessment'
      ? 'Журнал оценок'
      : kind === 'gpaSetting'
        ? 'Калькулятор GPA'
        : kind === 'focus'
          ? 'Фокус'
          : 'Профиль');
  const [actionTitle, confirmLabel] = actionLabels[proposal.action] || actionLabels.create;
  const title =
    kind === 'profile'
      ? 'Профиль'
      : kind === 'focus'
        ? 'Таймер Pomodoro'
        : payload.title || 'Запись';
  const fields = [];
  const updating = proposal.action === 'update';

  if (proposal.action !== 'delete') {
    const keys =
      kind === 'profile'
        ? ['name', 'sessionDate']
        : kind === 'focus'
          ? ['minutes', 'label']
          : kind === 'gpaSetting'
            ? ['scale', 'credits']
            : [
                ...(forms[kind]?.fields.map((field) => field.name) || []),
                ...(Object.hasOwn(payload, 'courseId') || Object.hasOwn(before, 'courseId')
                  ? ['courseId']
                  : []),
              ];
    for (const key of keys) {
      if (key === 'time' && kind === 'schedule') {
        if (!updating || !equal(payload.time, before.time) || !equal(payload.end, before.end)) {
          const time = (item) => [item.time, item.end].filter(Boolean).join('–') || 'Не указано';
          fields.push({
            label: 'Время',
            value: time(payload),
            previous: updating ? time(before) : null,
          });
        }
        continue;
      }
      if (key === 'end' || key === 'title') continue;
      const value = payload[key];
      if (
        !updating &&
        (value === undefined || value === null || value === '') &&
        !(kind === 'schedule' && key === 'location')
      )
        continue;
      if (updating && equal(value, before[key])) continue;
      fields.push({
        label: fieldLabel(kind, key),
        value: fieldValue(kind, key, value, courses),
        previous: updating ? fieldValue(kind, key, before[key], courses) : null,
      });
    }
    if (updating && !equal(payload.title, before.title))
      fields.unshift({
        label: 'Название',
        value: payload.title,
        previous: before.title || 'Не указано',
      });
  }

  return { kind, section, actionTitle, confirmLabel, title, fields };
}
