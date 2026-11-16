import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  GraduationCap,
  Library,
  NotebookPen,
  Plus,
  Sparkles,
  Target,
  Timer,
  Users,
} from 'lucide-react';
import { buildJournal } from './journal';
import { buildGpaEstimate } from './gpa';
import { days } from './config';
import { api } from './api';
import StudyActivity from './StudyActivity';

const formatDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const formatShortDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

function WidgetTitle({ eyebrow, title, action, onAction }) {
  return (
    <div className='home-widget-title'>
      <div>
        <span className='home-eyebrow'>{eyebrow}</span>
        <h3>{title}</h3>
      </div>
      {action && (
        <button onClick={onAction}>
          {action}
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}

export default function DashboardHome({ user, items, open, update, navigate }) {
  const [groupOverview, setGroupOverview] = useState(null);
  useEffect(() => {
    let active = true;
    api('/api/groups/overview')
      .then((data) => {
        if (active) setGroupOverview(data);
      })
      .catch(() => {
        if (active) setGroupOverview({ groupCount: 0, tasks: [], unavailable: true });
      });
    return () => {
      active = false;
    };
  }, [user.id]);
  const today = new Date().toLocaleDateString('sv-SE');
  const weekday = (new Date().getDay() + 6) % 7;
  const classes = useMemo(
    () =>
      items
        .filter((item) => item.kind === 'schedule' && Number(item.payload.day) === weekday)
        .sort((a, b) => a.payload.time.localeCompare(b.payload.time)),
    [items, weekday],
  );
  const weekClasses = useMemo(
    () =>
      days.map((name, index) => ({
        name,
        index,
        lessons: items
          .filter((item) => item.kind === 'schedule' && Number(item.payload.day) === index)
          .sort((a, b) => a.payload.time.localeCompare(b.payload.time)),
      })),
    [items],
  );
  const journal = useMemo(() => buildJournal(items), [items]);
  const tasks = useMemo(
    () =>
      items
        .filter((item) => item.kind === 'task' && item.payload.status !== 'done')
        .sort((a, b) => (a.payload.date || '9999').localeCompare(b.payload.date || '9999')),
    [items],
  );
  const grades = items.filter((item) => item.kind === 'grade');
  const credits = grades.reduce((sum, item) => sum + Number(item.payload.credits), 0);
  const estimate = useMemo(
    () => buildGpaEstimate(items, items.find((item) => item.kind === 'gpaSetting')?.payload),
    [items],
  );
  const manualGpa = credits
    ? (
        grades.reduce(
          (sum, item) => sum + Number(item.payload.grade) * Number(item.payload.credits),
          0,
        ) / credits
      ).toFixed(2)
    : '—';
  const gpa = estimate.value === null ? manualGpa : estimate.value.toFixed(2);
  const notes = items.filter((item) => item.kind === 'note');
  const recentNote = [...notes].sort((a, b) =>
    (b.updated_at || '').localeCompare(a.updated_at || ''),
  )[0];
  const courseCount = journal.length;
  const allTasks = items.filter((item) => item.kind === 'task');
  const completedTasks = allTasks.filter((item) => item.payload.status === 'done').length;
  const taskProgress = allTasks.length ? Math.round((completedTasks / allTasks.length) * 100) : 0;
  const gradedSubjects = journal.filter((group) => group.assessments.length > 0).length;
  const reminders = items
    .filter((item) => item.kind === 'reminder' && item.payload.date >= today)
    .sort((a, b) =>
      `${a.payload.date}${a.payload.time}`.localeCompare(`${b.payload.date}${b.payload.time}`),
    );
  const sessionDays = user.sessionDate
    ? Math.max(
        0,
        Math.ceil((new Date(`${user.sessionDate}T00:00:00`).getTime() - Date.now()) / 86400000),
      )
    : null;
  const nextClass = classes.find(
    (item) => item.payload.end > new Date().toTimeString().slice(0, 5),
  );
  const firstName = user.name.trim().split(' ')[0];
  const todayLabel = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const urgentTask = tasks.find((item) => item.payload.date && item.payload.date <= today);
  const nextGroupTask = groupOverview?.tasks?.[0];
  const priority = urgentTask
    ? {
        title: urgentTask.payload.title,
        detail:
          urgentTask.payload.date < today
            ? `Срок прошёл ${formatDate(urgentTask.payload.date)}. Отметьте выполненным или обновите план.`
            : 'Задача запланирована на сегодня.',
        action: 'К задаче',
        go: () => navigate('task'),
      }
    : nextClass
      ? {
          title: nextClass.payload.title,
          detail: `${nextClass.payload.time}–${nextClass.payload.end}${nextClass.payload.location ? ` · ${nextClass.payload.location}` : ''}`,
          action: 'Расписание',
          go: () => navigate('schedule'),
        }
      : nextGroupTask
        ? {
            title: nextGroupTask.title,
            detail: `${nextGroupTask.groupName} · до ${formatDate(nextGroupTask.dueDate)}`,
            action: 'Открыть группу',
            go: () => navigate('groups', nextGroupTask.groupId),
          }
        : tasks[0]
          ? {
              title: tasks[0].payload.title,
              detail: tasks[0].payload.date
                ? `До ${formatDate(tasks[0].payload.date)}`
                : 'Срок не указан',
              action: 'К задаче',
              go: () => navigate('task'),
            }
          : {
              title: 'Выберите главное на сегодня',
              detail: 'Добавьте ближайший учебный шаг, чтобы быстро возвращаться к нему.',
              action: 'Добавить задачу',
              go: () => open({ kind: 'task' }),
            };
  const hasDashboardContent =
    items.some((item) => item.kind !== 'gpaSetting') || Boolean(groupOverview?.groupCount);

  if (!hasDashboardContent)
    return (
      <div className='home-dashboard home-dashboard-empty'>
        <section className='home-onboarding surface-card' aria-labelledby='home-onboarding-title'>
          <span className='home-eyebrow'>ПЕРВЫЕ ШАГИ</span>
          <h2 id='home-onboarding-title'>С чего начать</h2>
          <p>Три коротких шага соберут основу вашего учебного пространства.</p>
          <div className='home-onboarding-steps'>
            <button type='button' onClick={() => open({ kind: 'schedule' })}>
              <span>01</span>
              <CalendarDays size={20} />
              <strong>Добавить расписание</strong>
              <small>Пары появятся в плане на день</small>
              <ArrowRight size={16} />
            </button>
            <button type='button' onClick={() => open({ kind: 'task' })}>
              <span>02</span>
              <Check size={20} />
              <strong>Добавить задачу</strong>
              <small>Запишите ближайший учебный шаг</small>
              <ArrowRight size={16} />
            </button>
            <button type='button' onClick={() => open({ kind: 'course' })}>
              <span>03</span>
              <BookOpen size={20} />
              <strong>Создать предмет</strong>
              <small>Свяжите с ним пары, оценки и заметки</small>
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>
    );

  return (
    <div className='home-dashboard'>
      {priority && (
        <section className='home-priority surface-status' aria-label='Следующий шаг'>
          <span className='home-priority-icon'>
            <Target size={20} />
          </span>
          <div>
            <span className='home-eyebrow'>СЛЕДУЮЩИЙ ШАГ</span>
            <h2>{priority.title}</h2>
            <p>{priority.detail}</p>
          </div>
          <button type='button' onClick={priority.go}>
            {priority.action}
            <ArrowRight size={16} />
          </button>
        </section>
      )}
      <div className='home-top-grid'>
        <section className='home-hero surface-primary' aria-label='Обзор учебного дня'>
          <div className='home-hero-copy'>
            <span className='home-hero-label'>
              <span className='home-hero-label-mark' /> ПЛАН НА СЕГОДНЯ
            </span>
            <h2>
              {tasks.length || classes.length
                ? `Ваш день в порядке, ${firstName}.`
                : `Начнём с малого, ${firstName}.`}
            </h2>
            <p>
              {tasks.length || classes.length
                ? 'Сначала важное. Остальное всегда можно найти в своём учебном пространстве.'
                : 'Добавьте первую пару или задачу — и здесь появится ваш личный план.'}
            </p>
            <div className='home-hero-actions'>
              <button className='home-hero-primary' onClick={() => open({ kind: 'task' })}>
                <Plus size={17} /> Новая задача
              </button>
              <button className='home-hero-secondary' onClick={() => open({ kind: 'schedule' })}>
                Добавить пару <ArrowRight size={16} />
              </button>
            </div>
            <div className='home-hero-metrics' aria-label='Краткая сводка'>
              <span>
                <strong>{classes.length}</strong> пар сегодня
              </span>
              <span>
                <strong>{tasks.length}</strong> задач в работе
              </span>
            </div>
          </div>
          <div className='home-day-sheet' aria-label='План дня'>
            <div className='home-day-sheet-top'>
              <span>{todayLabel}</span>
              <CalendarDays size={18} />
            </div>
            <div className='home-day-sheet-title'>На повестке</div>
            {classes.length || tasks.length ? (
              <div className='home-day-sheet-lines'>
                {classes.slice(0, 2).map((item) => (
                  <div key={`lesson-${item.id}`}>
                    <time>{item.payload.time}</time>
                    <span>{item.payload.title}</span>
                  </div>
                ))}
                {tasks.slice(0, Math.max(1, 3 - Math.min(classes.length, 2))).map((item) => (
                  <div key={`task-${item.id}`}>
                    <time>
                      {item.payload.date ? `до ${formatShortDate(item.payload.date)}` : 'без срока'}
                    </time>
                    <span>{item.payload.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className='home-day-sheet-empty'>
                <BookOpen size={26} />
                <span>Ваш первый шаг появится здесь</span>
              </div>
            )}
            <div className='home-day-sheet-foot'>
              <span>STUDIA / {new Date().getFullYear()}</span>
              <span>{String(weekday + 1).padStart(2, '0')} / 07</span>
            </div>
          </div>
          <picture className='home-hero-art' aria-hidden='true'>
            <source
              type='image/avif'
              srcSet='/illustrations/study-desk-480.avif 480w, /illustrations/study-desk-960.avif 960w, /illustrations/study-desk-1600.avif 1600w'
              sizes='(max-width: 500px) 68vw, (max-width: 1100px) 56vw, 590px'
            />
            <source
              type='image/webp'
              srcSet='/illustrations/study-desk-480.webp 480w, /illustrations/study-desk-960.webp 960w, /illustrations/study-desk-1600.webp 1600w'
              sizes='(max-width: 500px) 68vw, (max-width: 1100px) 56vw, 590px'
            />
            <img
              src='/illustrations/study-desk-960.jpg'
              width='1536'
              height='1024'
              loading='eager'
              fetchPriority='high'
              decoding='async'
              alt=''
            />
          </picture>
        </section>
      </div>

      <div className='home-main-grid'>
        <section className='home-widget surface-card home-schedule-widget'>
          <WidgetTitle
            eyebrow='СЕГОДНЯ'
            title='Занятия сегодня'
            action='Расписание'
            onAction={() => navigate('schedule')}
          />
          {classes.length ? (
            <div className='home-class-list'>
              {classes.map((item) => (
                <div
                  className={`home-class-row ${item.id === nextClass?.id ? 'upcoming' : ''}`}
                  key={item.id}
                >
                  <div className='home-class-time'>
                    <strong>{item.payload.time}</strong>
                    <span>{item.payload.end}</span>
                  </div>
                  <div className='home-class-detail'>
                    <strong>{item.payload.title}</strong>
                    <span>{item.payload.location || 'Аудитория не указана'}</span>
                  </div>
                  {item.id === nextClass?.id && <span className='home-now-chip'>Следующая</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className='home-widget-empty'>
              <span className='home-empty-icon'>
                <CalendarDays size={23} />
              </span>
              <strong>Сегодня свободно</strong>
              <p>Добавьте занятие вручную или перенесите расписание из таблицы.</p>
              <button onClick={() => navigate('schedule')}>
                Открыть расписание <ArrowRight size={14} />
              </button>
            </div>
          )}
        </section>
        <section className='home-widget surface-card home-task-widget'>
          <WidgetTitle
            eyebrow='ПРИОРИТЕТ'
            title='Ближайшие дедлайны'
            action='Все задачи'
            onAction={() => navigate('task')}
          />
          {tasks.length ? (
            <div className='home-task-list'>
              {tasks.slice(0, 4).map((item) => (
                <div className='home-task-row' key={item.id}>
                  <button
                    className='home-task-check'
                    onClick={() => update(item, { status: 'done' })}
                    aria-label={`Отметить выполненной: ${item.payload.title}`}
                  >
                    <Check size={14} />
                  </button>
                  <div>
                    <strong>{item.payload.title}</strong>
                    <span
                      className={item.payload.date && item.payload.date < today ? 'overdue' : ''}
                    >
                      {item.payload.date
                        ? item.payload.date < today
                          ? `Просрочено · ${formatDate(item.payload.date)}`
                          : item.payload.date === today
                            ? 'Сегодня'
                            : formatDate(item.payload.date)
                        : 'Без срока'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='home-widget-empty'>
              <span className='home-empty-icon'>
                <Target size={23} />
              </span>
              <strong>Нет открытых задач</strong>
              <p>Запишите даже небольшой шаг — он появится здесь.</p>
              <button onClick={() => open({ kind: 'task' })}>
                Добавить задачу <ArrowRight size={14} />
              </button>
            </div>
          )}
        </section>
      </div>

      <section className='home-week-section surface-card' aria-label='Ваша неделя'>
        <WidgetTitle
          eyebrow='РАСПИСАНИЕ'
          title='Ваша неделя'
          action='Всё расписание'
          onAction={() => navigate('schedule')}
        />
        <div className='home-week-grid'>
          {weekClasses.map((day) => (
            <button
              type='button'
              className={`home-week-day${day.index === weekday ? ' is-today' : ''}`}
              key={day.index}
              onClick={() => navigate('schedule')}
            >
              <span>
                {day.name.slice(0, 3)}
                {day.index === weekday ? ' · сегодня' : ''}
              </span>
              <strong>{day.lessons.length}</strong>
              <small>
                {day.lessons.length === 1
                  ? 'занятие'
                  : day.lessons.length > 1 && day.lessons.length < 5
                    ? 'занятия'
                    : 'занятий'}
              </small>
              {day.lessons.length > 0 && (
                <em>
                  {day.lessons
                    .slice(0, 2)
                    .map((lesson) => lesson.payload.title)
                    .join(' · ')}
                  {day.lessons.length > 2 ? ` +${day.lessons.length - 2}` : ''}
                </em>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className='home-progress-gpa surface-card' aria-label='Учебный прогресс и GPA'>
        <div className='home-progress-copy'>
          <span className='home-eyebrow'>УЧЕБНЫЙ ПРОГРЕСС</span>
          <h3>{allTasks.length ? 'Шаг за шагом к результату' : 'Начните с одной задачи'}</h3>
          <p>
            {allTasks.length
              ? `${completedTasks} из ${allTasks.length} задач выполнено`
              : 'Добавьте дело по учёбе, чтобы видеть свой прогресс.'}
          </p>
        </div>
        <div
          className='home-progress-ring'
          style={{ '--progress': `${taskProgress}%` }}
          aria-label={`${taskProgress}% задач выполнено`}
        >
          <strong>{taskProgress}%</strong>
        </div>
        <div className='home-gpa-summary'>
          <span className='home-eyebrow'>РАСЧЁТНЫЙ GPA</span>
          <strong>{gpa}</strong>
          <small>
            {estimate.rows.length
              ? `${estimate.rows.length} предметов из журнала · предварительно`
              : grades.length
                ? `${grades.length} ручных записей`
                : 'Добавьте оценки в журнал'}
          </small>
          <button type='button' onClick={() => navigate('grade')}>
            Открыть калькулятор <ArrowRight size={14} />
          </button>
        </div>
        {sessionDays !== null && (
          <button
            className='home-session-countdown'
            type='button'
            onClick={() => navigate('profile')}
          >
            <Clock3 size={15} />
            <span>До сессии</span>
            <strong>{sessionDays} дн.</strong>
          </button>
        )}
      </section>

      <section className='home-shortcut-section' aria-label='Быстрые переходы'>
        <div className='home-shortcut-grid'>
          <button className='home-shortcut-card' onClick={() => navigate('journal')}>
            <span className='home-shortcut-icon'>
              <ClipboardList size={17} />
            </span>
            <span>
              <strong>Предметы и оценки</strong>
              <small>
                {courseCount
                  ? `${courseCount} предметов · ${gradedSubjects} с оценками`
                  : 'Откройте журнал оценок'}
              </small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button
            className='home-shortcut-card'
            onClick={() => (reminders.length ? navigate('reminder') : open({ kind: 'reminder' }))}
          >
            <span className='home-shortcut-icon'>
              <BellRing size={17} />
            </span>
            <span>
              <strong>Напоминания</strong>
              <small>
                {reminders.length
                  ? `${reminders[0].payload.title} · ${formatDate(reminders[0].payload.date)}`
                  : 'Создать напоминание'}
              </small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button className='home-shortcut-card' onClick={() => navigate('groups')}>
            <span className='home-shortcut-icon'>
              <Users size={17} />
            </span>
            <span>
              <strong>Учебные группы</strong>
              <small>
                {groupOverview?.unavailable
                  ? 'Не удалось загрузить группы'
                  : groupOverview?.groupCount
                    ? `${groupOverview.groupCount} групп · ${nextGroupTask ? `дедлайн ${formatDate(nextGroupTask.dueDate)}` : 'чат и файлы'}`
                    : 'Обсуждения и общие файлы'}
              </small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button
            className='home-shortcut-card'
            onClick={() =>
              recentNote ? open({ kind: 'note', item: recentNote }) : open({ kind: 'note' })
            }
          >
            <span className='home-shortcut-icon'>
              <NotebookPen size={17} />
            </span>
            <span>
              <strong>{recentNote ? 'Последний конспект' : 'Конспекты'}</strong>
              <small>{recentNote ? recentNote.payload.title : 'Создать первую заметку'}</small>
            </span>
            <ArrowRight size={15} />
          </button>
        </div>
        <div className='home-quick-tools' aria-label='Другие инструменты'>
          <button type='button' onClick={() => navigate('assistant')}>
            <Sparkles size={15} /> Gemini
          </button>
          <button type='button' onClick={() => navigate('focus')}>
            <Timer size={15} /> Фокус
          </button>
          <button type='button' onClick={() => navigate('material')}>
            <Library size={15} /> Материалы
          </button>
        </div>
      </section>

      <StudyActivity items={items} navigate={navigate} />
    </div>
  );
}
