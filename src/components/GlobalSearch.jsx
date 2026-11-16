import * as ui from './SharedComponents.jsx';
import * as shared from '../app-shared.jsx';
const { useState, React, Icon, sections } = shared;

function SearchDialog({ items, close, choose }) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const results = normalized
    ? items
        .filter(
          (item) =>
            item.kind !== 'gpaSetting' &&
            Object.values(item.payload).some(
              (value) => typeof value === 'string' && value.toLowerCase().includes(normalized),
            ),
        )
        .slice(0, 30)
    : [];
  return (
    <div
      className='modal-backdrop'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className='modal search-dialog'
        role='dialog'
        aria-modal='true'
        aria-label='Поиск по записям'
      >
        <div className='search-dialog-field'>
          <Icon.Search size={19} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Найти предмет, оценку, задачу или конспект…'
          />
          <button className='icon-button' onClick={close} aria-label='Закрыть'>
            <Icon.X size={18} />
          </button>
        </div>
        <div className='search-results'>
          {!normalized ? (
            <p>Начните вводить название или текст записи.</p>
          ) : results.length ? (
            results.map((item) => {
              const section = sections.find(
                (s) => s.id === (item.kind === 'assessment' ? 'journal' : item.kind),
              );
              return (
                <button key={item.id} onClick={() => choose(item)}>
                  <span className='soft-icon'>
                    {React.createElement(Icon[section?.icon] || Icon.Circle, { size: 17 })}
                  </span>
                  <span>
                    <b>{item.payload.title}</b>
                    <small>{section?.label || 'Запись'}</small>
                  </span>
                  <Icon.ArrowRight size={16} />
                </button>
              );
            })
          ) : (
            <p>Ничего не найдено. Попробуйте другое слово.</p>
          )}
        </div>
        <div className='search-dialog-foot'>
          Поиск работает только по вашим сохранённым записям.
        </div>
      </div>
    </div>
  );
}

export { SearchDialog };
