import React, { useMemo, useState } from 'react';
import { ExternalLink, Upload, X } from 'lucide-react';
import { send } from './api';
import { days } from './config';
import { parseScheduleCsv } from './csv';

const signature = (payload) =>
  [
    payload.day,
    payload.time,
    payload.end,
    payload.title.trim().toLowerCase(),
    (payload.location || '').trim().toLowerCase(),
  ].join('|');

export default function ScheduleImport({ existing, courses = [], close, refresh, toast }) {
  const [source, setSource] = useState('');
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fresh = useMemo(() => {
    if (!records) return [];
    const seen = new Set(existing.map((item) => signature(item.payload)));
    return records.filter((record) => {
      const key = signature(record.payload);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [records, existing]);

  function preview() {
    try {
      setRecords(parseScheduleCsv(source));
      setError('');
    } catch (err) {
      setRecords(null);
      setError(err.message);
    }
  }
  async function chooseFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 100_000) {
      setError('Файл слишком большой (до 100 КБ)');
      return;
    }
    setSource(await file.text());
    setRecords(null);
    setError('');
    event.target.value = '';
  }
  async function importRecords() {
    if (!fresh.length || busy) return;
    setBusy(true);
    let saved = 0;
    try {
      for (const record of fresh) {
        const course = courses.find(
          (x) => x.payload.title.trim().toLowerCase() === record.payload.title.trim().toLowerCase(),
        );
        await send(
          '/api/items',
          'POST',
          course ? { ...record, payload: { ...record.payload, courseId: course.id } } : record,
        );
        saved++;
      }
      await refresh();
      toast(`Перенесено занятий: ${saved}`);
      close();
    } catch (err) {
      await refresh();
      setError(
        `${err.message}. Сохранено ${saved} из ${fresh.length}; повторный просмотр исключит дубли.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className='modal-backdrop'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) close();
      }}
    >
      <div
        className='modal schedule-import'
        role='dialog'
        aria-modal='true'
        aria-labelledby='schedule-import-title'
      >
        <div className='modal-head'>
          <div>
            <span className='kicker'>ПЕРЕНОС РАСПИСАНИЯ</span>
            <h2 id='schedule-import-title'>Из Platonus в Studia</h2>
          </div>
          <button className='icon-button' onClick={close} disabled={busy} aria-label='Закрыть'>
            <X size={19} />
          </button>
        </div>
        <p className='import-intro'>
          Откройте Platonus ALT, войдите там самостоятельно и перейдите в «Расписание». Если таблицу
          можно выделить, скопируйте её и вставьте ниже. Подойдёт и CSV-файл. Перед сохранением мы
          покажем все распознанные занятия.
        </p>
        <a
          className='button secondary import-link'
          href='https://platonus.alt.edu.kz/'
          target='_blank'
          rel='noopener noreferrer'
        >
          Открыть Platonus ALT <ExternalLink size={15} />
        </a>
        <label className='import-label' htmlFor='schedule-source'>
          Таблица занятий
        </label>
        <textarea
          id='schedule-source'
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setRecords(null);
            setError('');
          }}
          rows='6'
          placeholder={
            'день\tначало\tконец\tпредмет\tаудитория\nПонедельник\t09:00\t10:30\tМатематика\t204'
          }
          disabled={busy}
        />
        <div className='import-file-row'>
          <label className='button secondary upload'>
            <Upload size={16} />
            Выбрать CSV
            <input
              type='file'
              accept='.csv,.tsv,text/csv,text/tab-separated-values'
              onChange={chooseFile}
              disabled={busy}
            />
          </label>
          <span>Пароль и код входа сюда не вставляйте.</span>
        </div>
        {error && (
          <p className='form-error' role='alert'>
            {error}
          </p>
        )}
        {records && (
          <div className='import-preview'>
            <div className='import-preview-head'>
              <b>Предпросмотр: {records.length}</b>
              <span>
                {records.length - fresh.length} совпадают с уже сохранёнными или повторяются
              </span>
            </div>
            <div className='import-preview-list'>
              {records.map((record, index) => (
                <div className='import-preview-row' key={index}>
                  <span>{days[record.payload.day]}</span>
                  <strong>
                    {record.payload.time}–{record.payload.end}
                  </strong>
                  <b>{record.payload.title}</b>
                  <small>{record.payload.location || 'Без аудитории'}</small>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className='help-text'>
          Распознаются таблицы с колонками «день, начало, конец, предмет, аудитория» или «день,
          время, предмет» (время диапазоном 09:00–10:30). Формат скопированной страницы Platonus
          может отличаться; прямой доступ к аккаунту и автоматическая синхронизация здесь не
          используются.
        </p>
        <div className='modal-actions'>
          <button className='button secondary' onClick={close} disabled={busy}>
            Отмена
          </button>
          {records ? (
            <button
              className='button primary'
              onClick={importRecords}
              disabled={busy || !fresh.length}
            >
              {busy ? 'Сохраняем…' : `Сохранить ${fresh.length} занятий`}
            </button>
          ) : (
            <button className='button primary' onClick={preview} disabled={busy}>
              Проверить таблицу
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
