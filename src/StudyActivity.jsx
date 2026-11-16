import { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

const localDay = (date) => date.toLocaleDateString('sv-SE');
const fullDate = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

export default function StudyActivity({ items, navigate }) {
  const [selected, setSelected] = useState(null);
  const today = localDay(new Date());
  const { days, activeDays } = useMemo(() => {
    const counts = new Map();
    for (const item of items) {
      if (item.kind === 'task' && item.payload.status !== 'done') continue;
      if (item.kind === 'gpaSetting') continue;
      const date = String(item.updated_at || item.created_at || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      counts.set(date, (counts.get(date) || 0) + 1);
    }
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 84);
    const cells = Array.from({ length: 91 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = localDay(date);
      return { date: key, count: counts.get(key) || 0, future: key > today };
    });
    return { days: cells, activeDays: cells.filter((day) => !day.future && day.count > 0).length };
  }, [items, today]);
  const chosen = days.find((day) => day.date === selected);

  return (
    <details className='study-activity-disclosure'>
      <summary>
        <span className='study-activity-summary-label'>УЧЕБНЫЙ РИТМ</span>
        <strong>Карта активности за 13 недель</strong>
        <span className='study-activity-summary-total'>{activeDays} активных дней</span>
      </summary>
      <section className='study-activity' aria-labelledby='study-activity-title'>
        <div className='study-activity-heading'>
          <div>
            <span className='study-activity-kicker'>УЧЕБНЫЙ РИТМ</span>
            <h2 id='study-activity-title'>Каждый шаг виден</h2>
            <p>Реальные записи и выполненные задачи за последние 13 недель.</p>
          </div>
          <div className='study-activity-total'>
            <strong>{activeDays}</strong>
            <span>{activeDays === 1 ? 'активный день' : 'активных дней'}</span>
          </div>
        </div>
        <div className='study-activity-map' role='group' aria-label='Активность по дням недели'>
          <div className='study-activity-weekdays' aria-hidden='true'>
            <span>Пн</span>
            <span>Ср</span>
            <span>Пт</span>
          </div>
          <div className='study-activity-cells'>
            {days.map((day) => (
              <button
                type='button'
                key={day.date}
                disabled={day.future}
                className={`study-activity-cell level-${Math.min(day.count, 4)}${selected === day.date ? ' selected' : ''}${day.date === today ? ' today' : ''}`}
                onClick={() => setSelected(day.date)}
                title={`${fullDate(day.date)} — ${day.count} записей`}
                aria-label={`${fullDate(day.date)}: ${day.count} записей`}
                aria-pressed={selected === day.date}
              />
            ))}
          </div>
        </div>
        <div className='study-activity-foot'>
          <p>
            {chosen
              ? `${fullDate(chosen.date)} · ${chosen.count ? `${chosen.count} записей` : 'пока без записей'}`
              : 'Выберите день, чтобы посмотреть активность'}
          </p>
          <button type='button' onClick={() => navigate('task')}>
            К задачам <ArrowUpRight size={16} />
          </button>
        </div>
      </section>
    </details>
  );
}
