import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { today } from './config';

export default function FocusWorkspace({ items, save, toast, user }) {
  const [settings] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(`studia-focus-settings-${user.id}`) || '{}');
      return {
        minutes:
          Number.isInteger(value.minutes) && value.minutes >= 1 && value.minutes <= 180
            ? value.minutes
            : 25,
        label: typeof value.label === 'string' ? value.label.slice(0, 160) : 'Учёба',
      };
    } catch {
      return { minutes: 25, label: 'Учёба' };
    }
  });
  const [mode, setMode] = useState('work');
  const [seconds, setSeconds] = useState(settings.minutes * 60);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState(settings.label);
  const [courseId, setCourseId] = useState('');
  const [taskId, setTaskId] = useState('');
  const endAt = useRef(null);
  const completed = useRef(false);
  const courses = items.filter((item) => item.kind === 'course');
  const tasks = items.filter((item) => item.kind === 'task' && item.payload.status !== 'done');

  useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + seconds * 1000;
    const timer = setInterval(
      () => setSeconds(Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000))),
      500,
    );
    return () => {
      clearInterval(timer);
      endAt.current = null;
    };
  }, [running]);
  useEffect(() => {
    if (seconds !== 0 || completed.current) return;
    completed.current = true;
    setRunning(false);
    if (mode === 'work') {
      void save('study', {
        title: label.trim() || 'Фокус-сессия',
        minutes: settings.minutes,
        date: today(),
        ...(courseId ? { courseId: Number(courseId) } : {}),
      })
        .then(() =>
          toast(`${settings.minutes} минут выполнено. Работа сохранена в «Учебном времени».`),
        )
        .catch((error) => toast(`Не удалось сохранить фокус-сессию. ${error.message}`));
      setMode('break');
      setSeconds(5 * 60);
    } else {
      setMode('work');
      setSeconds(settings.minutes * 60);
      toast('Отдых окончен. Готовы к следующему циклу?');
    }
  }, [seconds]);
  function change(next) {
    completed.current = false;
    setRunning(false);
    setMode(next);
    setSeconds(next === 'work' ? settings.minutes * 60 : 5 * 60);
  }
  function toggleTimer() {
    if (running) {
      if (endAt.current !== null)
        setSeconds(Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000)));
      setRunning(false);
    } else if (seconds > 0) {
      completed.current = false;
      setRunning(true);
    }
  }
  function chooseTask(value) {
    setTaskId(value);
    const task = tasks.find((item) => item.id === Number(value));
    if (task) {
      setLabel(task.payload.title);
      setCourseId(task.payload.courseId ? String(task.payload.courseId) : '');
    }
  }
  return (
    <div className='focus-panel'>
      <span className='kicker'>ПОМОГАЕМ ДЕРЖАТЬ ФОКУС</span>
      <h2>Одна задача. Один момент.</h2>
      <div className='focus-tabs'>
        <button className={mode === 'work' ? 'active' : ''} onClick={() => change('work')}>
          Работа · {settings.minutes} мин
        </button>
        <button className={mode === 'break' ? 'active' : ''} onClick={() => change('break')}>
          Перерыв · 5 мин
        </button>
      </div>
      <div className='timer-ring'>
        <span>
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:
          {String(seconds % 60).padStart(2, '0')}
        </span>
      </div>
      <div className='focus-context'>
        {tasks.length > 0 && (
          <label>
            Задача
            <select
              value={taskId}
              disabled={running}
              onChange={(event) => chooseTask(event.target.value)}
            >
              <option value=''>Своя тема</option>
              {tasks.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.payload.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {courses.length > 0 && (
          <label>
            Предмет
            <select
              value={courseId}
              disabled={running}
              onChange={(event) => setCourseId(event.target.value)}
            >
              <option value=''>Без предмета</option>
              {courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.payload.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <input
        className='focus-label'
        value={label}
        maxLength={160}
        disabled={running}
        onChange={(event) => setLabel(event.target.value)}
        aria-label='Над чем работаете'
      />
      <div className='focus-actions'>
        <button className='button primary' onClick={toggleTimer}>
          {running ? (
            <>
              <Pause size={18} />
              Пауза
            </>
          ) : (
            <>
              <Play size={18} />
              Начать
            </>
          )}
        </button>
        <button
          className='button secondary'
          onClick={() => {
            completed.current = false;
            setRunning(false);
            setSeconds(mode === 'work' ? settings.minutes * 60 : 5 * 60);
          }}
        >
          <RotateCcw size={17} />
          Сбросить
        </button>
      </div>
      <p>Завершённая работа автоматически сохраняется в «Учебном времени» и выбранном предмете.</p>
    </div>
  );
}
