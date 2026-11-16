import * as ui from './SharedComponents.jsx';
import * as shared from '../app-shared.jsx';
const { Auth, Logo, CourseBadge, Metric, Empty, CardActions } = ui;
const {
  useState,
  Icon,
  initialValues,
  COURSE_COLORS,
  getCourseTone,
  courseToneClass,
  forms,
  courseLinkedKinds,
  courseForRecord,
  courseDefaults,
} = shared;

function Editor({ editor, close, save, courses }) {
  const optionalDateField = { assessment: 'date', task: 'date', goal: 'targetDate' }[editor.kind];
  const { kind, item, defaults } = editor,
    [values, setValues] = useState(() => {
      const initial = { ...initialValues(kind), ...defaults, ...item?.payload };
      if (item && optionalDateField)
        initial[optionalDateField] = item.payload[optionalDateField] || '';
      const linked = courses.find((x) => x.id === Number(initial.courseId));
      if (kind === 'assessment' && linked) initial.subject = linked.payload.title;
      if (
        kind === 'course' &&
        !COURSE_COLORS.some(
          (color) => color.hex.toLowerCase() === String(initial.color || '').toLowerCase(),
        )
      )
        initial.color = getCourseTone(item, courses.length).hex;
      return initial;
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [courseTouched, setCourseTouched] = useState(false);
  const config = forms[kind];
  const optionalFields = new Set([
    'location',
    'folder',
    'body',
    'subject',
    'url',
    'notes',
    'deck',
    'level',
    'pronunciation',
    'example',
    'exampleTranslation',
    'note',
    optionalDateField,
    'teacher',
    'room',
  ]);
  function chooseCourse(value) {
    setCourseTouched(true);
    setValues((current) => {
      if (!value) return { ...current, courseId: '' };
      const course = courses.find((x) => x.id === Number(value));
      if (!course) return current;
      const next = { ...current, courseId: value };
      const defaults = courseDefaults(kind, course);
      for (const field of ['subject', 'folder', 'title'])
        if (defaults[field] && (!next[field] || (kind === 'assessment' && field === 'subject')))
          next[field] = defaults[field];
      return next;
    });
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const payload = { ...values };
      if (optionalDateField && !payload[optionalDateField]) delete payload[optionalDateField];
      if (courseLinkedKinds.has(kind)) {
        if (payload.courseId) payload.courseId = Number(payload.courseId);
        else if (!courseTouched) {
          const matched = courseForRecord({ kind, payload }, courses);
          if (matched) payload.courseId = matched.id;
          else delete payload.courseId;
        } else delete payload.courseId;
        if (kind === 'assessment' && payload.courseId) {
          const selected = courses.find((x) => x.id === payload.courseId);
          if (selected) payload.subject = selected.payload.title;
        }
      }
      await save(kind, payload, item?.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <div
      className='modal-backdrop'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className='modal'
        role='dialog'
        aria-modal='true'
        aria-label={item ? `Редактировать ${config.label}` : `Добавить ${config.label}`}
      >
        <div className='modal-head'>
          <div>
            <span className='kicker'>{item ? 'РЕДАКТИРОВАНИЕ' : 'НОВАЯ ЗАПИСЬ'}</span>
            <h2>{config.label}</h2>
          </div>
          <button className='icon-button' onClick={close} aria-label='Закрыть'>
            <Icon.X size={21} />
          </button>
        </div>
        <form onSubmit={submit}>
          {kind === 'flashcard' && (
            <p className='editor-intro'>
              Соберите карточку как мини-урок: ответ, пример в контексте и короткая подсказка.
              Пустые дополнительные поля можно заполнить позже.
            </p>
          )}
          {kind === 'course' && (
            <fieldset className='course-color-picker'>
              <legend>Цвет предмета</legend>
              <div>
                {COURSE_COLORS.map((color) => (
                  <label
                    className={`course-color-option ${courseToneClass(color)}${values.color === color.hex ? ' selected' : ''}`}
                    key={color.key}
                    title={color.label}
                  >
                    <input
                      type='radio'
                      name='course-color'
                      value={color.hex}
                      checked={values.color === color.hex}
                      onChange={() => setValues((current) => ({ ...current, color: color.hex }))}
                    />
                    <span className='course-color-swatch' />
                    <span>{color.label}</span>
                  </label>
                ))}
              </div>
              <small>Метка поможет быстрее находить предмет в расписании, задачах и журнале.</small>
            </fieldset>
          )}
          {courseLinkedKinds.has(kind) && courses.length > 0 && (
            <label>
              Связать с предметом
              <select value={values.courseId ?? ''} onChange={(e) => chooseCourse(e.target.value)}>
                <option value=''>Без предмета</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.payload.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === 'assessment' && values.courseId && (
            <p className='help-text'>
              Название предмета в журнале берётся из выбранной карточки предмета.
            </p>
          )}
          {config.fields.map((f) => (
            <label key={f.name}>
              {f.label}
              {f.type === 'textarea' ? (
                <textarea
                  required={!optionalFields.has(f.name)}
                  value={values[f.name] ?? ''}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  rows={kind === 'note' ? 8 : kind === 'flashcard' ? 3 : 4}
                />
              ) : f.type === 'select' ? (
                <select
                  value={values[f.name]}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                >
                  {f.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  required={!optionalFields.has(f.name)}
                  readOnly={kind === 'assessment' && f.name === 'subject' && !!values.courseId}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={values[f.name] ?? ''}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                />
              )}
            </label>
          ))}
          {error && (
            <p className='form-error' role='alert'>
              {error}
            </p>
          )}
          <div className='modal-actions'>
            <button type='button' className='button secondary' onClick={close}>
              Отмена
            </button>
            <button className='button primary' disabled={busy}>
              {busy ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { Editor };
