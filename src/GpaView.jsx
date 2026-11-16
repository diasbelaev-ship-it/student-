import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, GraduationCap, Info, Plus, Trash2, Pencil } from 'lucide-react';
import { buildGpaEstimate, GPA_BANDS } from './gpa';

const number = (value) => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

export default function GpaView({ items, save, open, remove, navigate, toast }) {
  const settingRecord = items.find((item) => item.kind === 'gpaSetting');
  const setting = settingRecord?.payload || {
    title: 'Настройки GPA',
    scale: 'linear',
    credits: {},
  };
  const estimate = useMemo(() => buildGpaEstimate(items, setting), [items, settingRecord]);
  const manual = items.filter((item) => item.kind === 'grade');
  const manualCredits = manual.reduce((sum, item) => sum + Number(item.payload.credits), 0);
  const manualValue = manualCredits
    ? manual.reduce(
        (sum, item) => sum + Number(item.payload.grade) * Number(item.payload.credits),
        0,
      ) / manualCredits
    : null;
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);

  async function persist(next) {
    setBusy(true);
    try {
      await save('gpaSetting', next, settingRecord?.id);
      setDrafts({});
    } catch (error) {
      toast(error.message);
    } finally {
      setBusy(false);
    }
  }

  function commitCredit(row) {
    if (!Object.hasOwn(drafts, row.key)) return;
    const text = drafts[row.key].trim();
    const credits = { ...setting.credits };
    if (!text) {
      delete credits[row.key];
      delete credits[row.creditKey];
    } else {
      const value = Number(text.replace(',', '.'));
      if (!Number.isFinite(value) || value < 0.5 || value > 60)
        return toast('Укажите от 0,5 до 60 кредитов или оставьте поле пустым');
      credits[row.key] = value;
      if (row.creditKey !== row.key) delete credits[row.creditKey];
    }
    persist({ ...setting, credits });
  }

  return (
    <div className='gpa-page gpa-connected-page'>
      <section className='gpa-auto-hero surface-primary'>
        <div>
          <span className='kicker light'>ПО ДАННЫМ ЖУРНАЛА</span>
          <strong>{estimate.value === null ? '—' : estimate.value.toFixed(2)}</strong>
          <small>
            из 4.00 · {estimate.rows.length} {estimate.rows.length === 1 ? 'предмет' : 'предметов'}{' '}
            с оценками
          </small>
        </div>
        <div>
          <GraduationCap size={29} />
          <h2>Предварительный GPA</h2>
          <p>
            Новые оценки из журнала сразу участвуют в расчёте. Укажите кредиты и выберите шкалу,
            чтобы получить более полезную оценку.
          </p>
          <button onClick={() => navigate('journal')}>
            Открыть журнал <ArrowRight size={15} />
          </button>
        </div>
      </section>

      <div className='gpa-method-bar'>
        <label>
          Перевод процентов в GPA{' '}
          <select
            value={setting.scale}
            disabled={busy}
            onChange={(event) => persist({ ...setting, scale: event.target.value })}
          >
            <option value='linear'>Линейно: процент × 4 / 100</option>
            <option value='bands'>Ступенчатая примерная шкала</option>
          </select>
        </label>
        <span>
          <Info size={17} />
          Это ориентир, а не официальный GPA вуза: веса работ и правила перевода могут отличаться.
        </span>
      </div>
      {setting.scale === 'bands' && (
        <details className='gpa-scale-details'>
          <summary>Посмотреть пороги примерной шкалы</summary>
          <div>
            {GPA_BANDS.slice(0, -1).map(([minimum, point], index) => (
              <span key={minimum}>
                {minimum}–{index === 0 ? 100 : GPA_BANDS[index - 1][0] - 1}% → {point.toFixed(2)}
              </span>
            ))}
            <span>ниже 50% → 0.00</span>
          </div>
        </details>
      )}

      <section className='gpa-auto-panel surface-card'>
        <div className='gpa-panel-heading'>
          <div>
            <span className='home-eyebrow'>АВТОМАТИЧЕСКИЙ РАСЧЁТ</span>
            <h3>Предметы из журнала</h3>
          </div>
          <small>
            {estimate.allCreditsSet
              ? 'Кредиты указаны для всех предметов'
              : 'Без указанных кредитов предмет получает вес 1'}
          </small>
        </div>
        {estimate.rows.length ? (
          <div className='gpa-auto-table'>
            <div className='gpa-auto-head'>
              <span>Предмет</span>
              <span>Баллы</span>
              <span>Кредиты</span>
              <span>GPA</span>
            </div>
            {estimate.rows.map((row) => (
              <div className='gpa-auto-row' key={row.key}>
                <div>
                  <span className='gpa-row-icon'>
                    <BookOpen size={17} />
                  </span>
                  <span>
                    <strong>{row.title}</strong>
                    <small>
                      {row.assessments} {row.assessments === 1 ? 'оценка' : 'оценок'} в журнале
                    </small>
                  </span>
                </div>
                <span className='gpa-percent'>{number(row.percent)}%</span>
                <label>
                  <span className='sr-only'>Кредиты: {row.title}</span>
                  <input
                    type='number'
                    min='0.5'
                    max='60'
                    step='0.5'
                    inputMode='decimal'
                    placeholder='1'
                    disabled={busy}
                    value={
                      Object.hasOwn(drafts, row.key)
                        ? drafts[row.key]
                        : row.explicitlyWeighted
                          ? String(row.credits)
                          : ''
                    }
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [row.key]: event.target.value }))
                    }
                    onBlur={() => commitCredit(row)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                  />
                  <small>{row.explicitlyWeighted ? 'сохранено' : 'вес 1'}</small>
                </label>
                <strong className='gpa-point'>{row.point.toFixed(2)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className='gpa-auto-empty'>
            <BookOpen size={24} />
            <strong>Пока нет оценок для расчёта</strong>
            <p>Добавьте оценку по любому предмету в журнале — она автоматически появится здесь.</p>
            <button onClick={() => navigate('journal')}>
              Перейти в журнал <ArrowRight size={15} />
            </button>
          </div>
        )}
        {estimate.rows.length > 0 && (
          <div className='gpa-formula'>
            Σ (балл предмета × кредиты) / Σ кредитов = <strong>{estimate.value.toFixed(2)}</strong>
            <span>Если кредиты не указаны, используется равный вес 1.</span>
          </div>
        )}
      </section>

      <section className='gpa-manual-panel surface-card'>
        <div className='gpa-panel-heading'>
          <div>
            <span className='home-eyebrow'>ОТДЕЛЬНЫЙ РАСЧЁТ</span>
            <h3>Ручные итоговые баллы</h3>
            <p>
              Старые записи сохранены. Они не смешиваются с оценками из журнала, чтобы предмет не
              считался дважды.
            </p>
          </div>
          <button className='button secondary' onClick={() => open({ kind: 'grade' })}>
            <Plus size={16} />
            Добавить балл
          </button>
        </div>
        {manual.length ? (
          <>
            <div className='gpa-manual-summary'>
              По ручным записям: <strong>{manualValue.toFixed(2)}</strong> из 4.00 ·{' '}
              {number(manualCredits)} кредитов
            </div>
            <div className='gpa-manual-list'>
              {manual.map((item) => (
                <div key={item.id}>
                  <strong>{item.payload.title}</strong>
                  <span>{number(item.payload.credits)} кр.</span>
                  <b>{Number(item.payload.grade).toFixed(2)}</b>
                  <button
                    onClick={() => open({ kind: 'grade', item })}
                    aria-label={`Изменить ${item.payload.title}`}
                  >
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(item)} aria-label={`Удалить ${item.payload.title}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className='gpa-manual-empty'>
            Ручных записей пока нет. Для автоматического расчёта они не нужны.
          </p>
        )}
      </section>
    </div>
  );
}
