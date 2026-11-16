import React, { useMemo, useState } from 'react';
import { BookOpen, Layers3, Pencil, RotateCcw, Search, Sparkles, Trash2 } from 'lucide-react';
import { courseForRecord } from './course-links';

const deckName = (card) => card.payload.deck?.trim() || 'Без набора';

export default function FlashcardsView({ items, open, remove, navigate }) {
  const cards = items.filter((item) => item.kind === 'flashcard');
  const [deck, setDeck] = useState('all');
  const [query, setQuery] = useState('');
  const [flipped, setFlipped] = useState({});
  const decks = useMemo(() => {
    const groups = new Map();
    for (const card of cards) {
      const name = deckName(card);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(card);
    }
    return [...groups].sort(([a], [b]) => a.localeCompare(b, 'ru'));
  }, [cards]);
  const selectedDeck = deck === 'all' || decks.some(([name]) => name === deck) ? deck : 'all';
  const search = query.trim().toLocaleLowerCase();
  const visibleGroups = decks
    .filter(([name]) => selectedDeck === 'all' || name === selectedDeck)
    .map(([name, group]) => [
      name,
      group.filter(
        (card) =>
          !search ||
          [
            card.payload.title,
            card.payload.answer,
            card.payload.example,
            card.payload.exampleTranslation,
            card.payload.note,
          ].some((value) => value?.toLocaleLowerCase().includes(search)),
      ),
    ])
    .filter(([, group]) => group.length);
  const visibleCount = visibleGroups.reduce((sum, [, group]) => sum + group.length, 0);

  if (!cards.length)
    return (
      <div className='flash-empty'>
        <span>
          <Layers3 size={27} />
        </span>
        <h2>Начните с первого набора</h2>
        <p>
          Создайте карточки по теме вручную или попросите ИИ подготовить набор с примерами и
          подсказками.
        </p>
        <button className='button primary' onClick={() => open({ kind: 'flashcard' })}>
          Добавить карточку
        </button>
      </div>
    );

  return (
    <div className='flash-workspace'>
      <div className='flash-overview'>
        <div>
          <span className='kicker'>ВАША БАЗА ДЛЯ ПОВТОРЕНИЯ</span>
          <h2>
            {cards.length}{' '}
            {cards.length === 1 ? 'карточка' : cards.length < 5 ? 'карточки' : 'карточек'} в{' '}
            {decks.length} {decks.length === 1 ? 'наборе' : 'наборах'}
          </h2>
          <p>Сначала вспомните ответ, затем откройте перевод и пример в контексте.</p>
          <button className='flash-ai-link' onClick={() => navigate('assistant')}>
            <Sparkles size={15} />
            Дополнить карточки с ИИ
          </button>
        </div>
        <span className='flash-overview-icon'>
          <BookOpen size={28} />
        </span>
      </div>
      <div className='flash-controls'>
        <div className='flash-search'>
          <Search size={17} />
          <input
            type='search'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Найти слово, перевод или пример'
            aria-label='Поиск по карточкам'
          />
        </div>
        <div className='flash-deck-tabs' role='group' aria-label='Выбрать набор'>
          <button className={selectedDeck === 'all' ? 'active' : ''} onClick={() => setDeck('all')}>
            Все <span>{cards.length}</span>
          </button>
          {decks.map(([name, group]) => (
            <button
              key={name}
              className={selectedDeck === name ? 'active' : ''}
              onClick={() => setDeck(name)}
            >
              {name} <span>{group.length}</span>
            </button>
          ))}
        </div>
      </div>
      {visibleCount === 0 ? (
        <div className='flash-no-results'>
          Ничего не найдено. Попробуйте другой запрос или набор.
        </div>
      ) : (
        visibleGroups.map(([name, group]) => (
          <section className='flash-deck-section' key={name}>
            <div className='flash-deck-heading'>
              <div>
                <span className='flash-deck-icon'>
                  <Layers3 size={18} />
                </span>
                <div>
                  <h2>{name}</h2>
                  <p>
                    {group.length}{' '}
                    {group.length === 1 ? 'карточка' : group.length < 5 ? 'карточки' : 'карточек'}
                  </p>
                </div>
              </div>
            </div>
            <div className='flash-grid'>
              {group.map((card, index) => {
                const data = card.payload;
                const course = courseForRecord(
                  card,
                  items.filter((item) => item.kind === 'course'),
                );
                const isFlipped = !!flipped[card.id];
                return (
                  <article className={`flash-card ${isFlipped ? 'is-flipped' : ''}`} key={card.id}>
                    <div className='flash-card-top'>
                      <span>
                        {String(index + 1).padStart(2, '0')} /{' '}
                        {String(group.length).padStart(2, '0')}
                        {data.level ? ` · ${data.level}` : ''}
                      </span>
                      <div className='card-actions'>
                        <button
                          className='icon-button'
                          onClick={() => open({ kind: 'flashcard', item: card })}
                          aria-label={`Редактировать ${data.title}`}
                          title='Редактировать'
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className='icon-button'
                          onClick={() => remove(card)}
                          aria-label={`Удалить ${data.title}`}
                          title='Удалить'
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {course && (
                      <button
                        className='record-course-badge'
                        onClick={() => navigate('course', course.id)}
                      >
                        <BookOpen size={13} />
                        {course.payload.title}
                      </button>
                    )}
                    <button
                      className='flash-card-body'
                      onClick={() =>
                        setFlipped((current) => ({ ...current, [card.id]: !current[card.id] }))
                      }
                      aria-label={`${isFlipped ? 'Скрыть ответ' : 'Показать ответ'}: ${data.title}`}
                      aria-expanded={isFlipped}
                    >
                      {!isFlipped ? (
                        <div className='flash-front'>
                          <span className='flash-side-label'>ВСПОМНИТЕ ЗНАЧЕНИЕ</span>
                          <h3>{data.title}</h3>
                          <p>Произнесите ответ и пример, прежде чем перевернуть карточку.</p>
                        </div>
                      ) : (
                        <div className='flash-back'>
                          <span className='flash-side-label'>ОТВЕТ</span>
                          <h3>{data.answer}</h3>
                          {data.pronunciation && (
                            <p className='flash-pronunciation'>{data.pronunciation}</p>
                          )}
                          {data.example && (
                            <div className='flash-detail'>
                              <span>ПРИМЕР</span>
                              <strong>{data.example}</strong>
                              {data.exampleTranslation && <p>{data.exampleTranslation}</p>}
                            </div>
                          )}
                          {data.note && (
                            <div className='flash-detail flash-note'>
                              <span>ЗАПОМНИТЕ</span>
                              <p>{data.note}</p>
                            </div>
                          )}
                        </div>
                      )}
                      <span className='flash-card-flip'>
                        <RotateCcw size={15} />
                        {isFlipped ? 'Вернуться к вопросу' : 'Показать ответ'}
                      </span>
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
