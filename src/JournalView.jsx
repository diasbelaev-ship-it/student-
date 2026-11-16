import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { buildJournal, isUnnamedLesson } from './journal';
import { days } from './config';
import CourseColorMark from './CourseColorMark';
import { courseToneClass, getCourseTone } from './course-colors';

const typeNames = {
  current: 'Текущая работа',
  test: 'Контрольная / тест',
  exam: 'Экзамен',
  credit: 'Зачёт',
};
const number = (value) => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const dateLabel = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : '';

export default function JournalView({ items, open, remove, navigate }) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => buildJournal(items), [items]);
  const unnamedLessons = items.filter(
    (item) =>
      item.kind === 'schedule' && !item.payload.courseId && isUnnamedLesson(item.payload.title),
  );
  const unnamedCount = unnamedLessons.length;
  const assessmentCount = groups.reduce((sum, group) => sum + group.assessments.length, 0);
  const filtered = groups.filter((group) =>
    group.title.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')),
  );
  const add = (subject, courseId) =>
    open({
      kind: 'assessment',
      defaults: subject ? { subject, ...(courseId ? { courseId } : {}) } : undefined,
    });

  return (
    <div className='journal-page'>
      <section className='journal-hero surface-primary'>
        <div>
          <span className='kicker light'>ЛИЧНЫЙ ЖУРНАЛ</span>
          <h2>Оценки по вашим предметам</h2>
          <p>
            Добавляйте пары в расписание — предметы появятся здесь автоматически. Оценки вносите
            только вы.
          </p>
          <div className='journal-hero-actions'>
            <button onClick={() => add()}>
              <Plus size={16} />
              Добавить оценку
            </button>
            <button onClick={() => navigate('schedule')}>
              Открыть расписание <ArrowRight size={15} />
            </button>
          </div>
        </div>
        <div className='journal-hero-stats'>
          <div>
            <strong>{groups.length}</strong>
            <span>предметов</span>
          </div>
          <div>
            <strong>{assessmentCount}</strong>
            <span>оценок</span>
          </div>
        </div>
      </section>
      <div className='journal-toolbar'>
        <div className='journal-search'>
          <Search size={17} />
          <input
            type='search'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Найти предмет'
            aria-label='Поиск предмета в журнале'
          />
        </div>
        <button className='button secondary' onClick={() => navigate('grade')}>
          <GraduationCap size={17} />
          Калькулятор GPA <ArrowRight size={15} />
        </button>
      </div>
      {unnamedCount > 0 && (
        <div className='journal-unnamed-notice'>
          <CalendarDays size={19} />
          <span>
            <strong>
              {unnamedCount}{' '}
              {unnamedCount % 10 === 1 && unnamedCount % 100 !== 11
                ? 'пара'
                : [2, 3, 4].includes(unnamedCount % 10) &&
                    ![12, 13, 14].includes(unnamedCount % 100)
                  ? 'пары'
                  : 'пар'}{' '}
              без названия предмета
            </strong>
            <small>
              Они остаются в расписании, но не считаются отдельными предметами. Укажите названия,
              чтобы они появились в журнале.
            </small>
            <span className='journal-unnamed-list'>
              {unnamedLessons.map((item) => (
                <button key={item.id} onClick={() => open({ kind: 'schedule', item })}>
                  {days[Number(item.payload.day)] || 'День'} · {item.payload.time}{' '}
                  <Pencil size={12} />
                </button>
              ))}
            </span>
          </span>
          <button onClick={() => navigate('schedule')}>
            Всё расписание <ArrowRight size={15} />
          </button>
        </div>
      )}
      {groups.length === 0 ? (
        <div className='journal-empty'>
          <span>
            <CalendarDays size={26} />
          </span>
          <h3>Начните с расписания</h3>
          <p>
            Создайте первую пару — её предмет сразу появится в журнале. Можно также внести оценку
            вручную.
          </p>
          <div>
            <button className='button primary' onClick={() => navigate('schedule')}>
              Добавить пару
            </button>
            <button className='button secondary' onClick={() => add()}>
              Добавить оценку
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className='journal-empty'>
          <p>Предмет не найден. Попробуйте другое название.</p>
        </div>
      ) : (
        <div className='journal-subject-grid'>
          {filtered.map((group, index) => {
            const course = items.find(
                (item) => item.kind === 'course' && item.id === group.courseId,
              ),
              tone = getCourseTone(course, index, group.title);
            return (
              <section
                className={`journal-subject surface-card ${courseToneClass(tone)}`}
                key={group.key}
              >
                <div className='journal-subject-head'>
                  <CourseColorMark
                    course={course}
                    title={group.title}
                    index={index}
                    className='journal-subject-icon'
                  />
                  <div>
                    <span className='journal-source'>
                      {group.fromSchedule
                        ? `${group.classCount} ${group.classCount === 1 ? 'пара' : group.classCount < 5 ? 'пары' : 'пар'} в расписании`
                        : 'Личный предмет'}
                    </span>
                    <h3>{group.title}</h3>
                    {group.courseId && (
                      <button
                        className='journal-course-link'
                        onClick={() => navigate('course', group.courseId)}
                      >
                        Все записи предмета <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                  <span className='journal-percent'>
                    {group.percent === null ? '—' : `${group.percent}%`}
                  </span>
                </div>
                <div className='journal-subject-body'>
                  {group.assessments.length ? (
                    group.assessments.map((item) => (
                      <div className='journal-mark' key={item.id}>
                        <span className='journal-mark-symbol'>
                          <ClipboardList size={16} />
                        </span>
                        <div>
                          <strong>{item.payload.title}</strong>
                          <small>
                            {typeNames[item.payload.type] || 'Оценка'}
                            {item.payload.date ? ` · ${dateLabel(item.payload.date)}` : ''}
                            {item.payload.note ? ` · ${item.payload.note}` : ''}
                          </small>
                        </div>
                        <b>
                          {number(item.payload.score)}{' '}
                          <span>/ {number(item.payload.maxScore)}</span>
                        </b>
                        <div className='journal-mark-actions'>
                          <button
                            onClick={() => open({ kind: 'assessment', item })}
                            aria-label={`Изменить оценку: ${item.payload.title}`}
                            title='Изменить'
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => remove(item)}
                            aria-label={`Удалить оценку: ${item.payload.title}`}
                            title='Удалить'
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className='journal-no-marks'>
                      Оценок пока нет. Добавьте первую работу по этому предмету.
                    </p>
                  )}
                </div>
                <button className='journal-add' onClick={() => add(group.title, group.courseId)}>
                  <Plus size={16} />
                  Добавить оценку
                </button>
              </section>
            );
          })}
        </div>
      )}
      {assessmentCount > 0 && (
        <p className='journal-footnote'>
          Процент по предмету — сумма полученных баллов, делённая на сумму максимумов внесённых
          работ. Это не официальный итог и не GPA.
        </p>
      )}
    </div>
  );
}
