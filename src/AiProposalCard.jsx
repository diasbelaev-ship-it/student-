import { CalendarDays, Check, ClipboardCheck, Trash2, X } from 'lucide-react';
import { proposalPreview } from './ai-proposal';
const recordWord = (count) =>
  count % 10 === 1 && count % 100 !== 11
    ? 'запись'
    : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)
      ? 'записи'
      : 'записей';

function BatchReview({ proposal, courses, records, busy, onConfirm, onCancel }) {
  const updating = proposal.action === 'batchUpdate';
  const items = updating ? proposal.updates || [] : proposal.items || [];
  const enrichingCards = updating && items.every((entry) => entry.item?.kind === 'flashcard');
  const actionWord = updating ? (enrichingCards ? 'Дополнить' : 'Обновить') : 'Добавить';
  return (
    <section className='ai-review' aria-label='Несколько предложений ИИ для подтверждения'>
      <div className='ai-review-heading'>
        <span className='ai-review-icon'>
          <ClipboardCheck size={21} />
        </span>
        <div>
          <span>ПРОВЕРЬТЕ ВЕСЬ СПИСОК</span>
          <h3>
            {actionWord} {items.length} {recordWord(items.length)}
          </h3>
        </div>
        <span className='ai-review-pending'>Не сохранено</span>
      </div>
      <div className='ai-batch-list'>
        {items.map((entry, index) => {
          const item = updating ? entry.item : entry;
          const target = updating ? records.find((record) => record.id === entry.targetId) : null;
          const preview = proposalPreview(
            { action: updating ? 'update' : 'create', item },
            target,
            courses,
          );
          return (
            <article className='ai-batch-item' key={`${index}-${entry.targetId || item.kind}`}>
              <span className='ai-batch-number'>{index + 1}</span>
              <div>
                <span className='ai-review-section'>{preview.section}</span>
                <strong>{preview.title}</strong>
                <div className='ai-batch-facts'>
                  {preview.fields.map((field) => (
                    <span key={field.label}>
                      <small>{field.label}</small>
                      {field.value}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className='ai-review-footer'>
        <p>
          {proposal.skipped ? `${proposal.skipped} записей без изменений пропущено. ` : ''}
          {updating
            ? enrichingCards
              ? 'Слова и ответы останутся прежними. Дополнения сохранятся только после подтверждения.'
              : 'Изменения сохранятся только после вашего подтверждения.'
            : 'Все новые записи сохранятся только после вашего подтверждения.'}
        </p>
        <div className='ai-review-actions'>
          <button className='button secondary' onClick={onCancel} disabled={busy}>
            <X size={16} />
            Отмена
          </button>
          <button className='button primary' onClick={onConfirm} disabled={busy || !items.length}>
            <Check size={17} />
            {busy ? 'Сохраняем…' : `${actionWord} ${items.length}`}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function AiProposalCard({
  proposal,
  target,
  courses,
  records = [],
  busy,
  onConfirm,
  onCancel,
}) {
  if (proposal.action === 'batch' || proposal.action === 'batchUpdate')
    return (
      <BatchReview
        proposal={proposal}
        courses={courses}
        records={records}
        busy={busy}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  const preview = proposalPreview(proposal, target, courses);
  const deleting = proposal.action === 'delete';
  const Glyph = deleting ? Trash2 : preview.kind === 'schedule' ? CalendarDays : ClipboardCheck;

  return (
    <section
      className={`ai-review ${deleting ? 'ai-review-danger' : ''}`}
      aria-label='Предложение ИИ для подтверждения'
    >
      <div className='ai-review-heading'>
        <span className='ai-review-icon'>
          <Glyph size={21} />
        </span>
        <div>
          <span>ПРОВЕРЬТЕ ПЕРЕД СОХРАНЕНИЕМ</span>
          <h3>{preview.actionTitle}</h3>
        </div>
        <span className='ai-review-pending'>Не сохранено</span>
      </div>
      <div className='ai-review-content'>
        <span className='ai-review-section'>{preview.section}</span>
        <strong className='ai-review-title'>{preview.title}</strong>
        {deleting ? (
          <p className='ai-review-warning'>
            После подтверждения эта запись будет удалена. Отменить удаление нельзя.
          </p>
        ) : preview.fields.length ? (
          <dl className='ai-review-fields'>
            {preview.fields.map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>
                  {field.previous && (
                    <span className='ai-review-previous'>
                      {field.previous}
                      <span aria-hidden='true'>→</span>
                    </span>
                  )}
                  <span>{field.value}</span>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className='ai-review-warning'>
            ИИ не предложил изменения данных. Лучше отменить это предложение и уточнить запрос.
          </p>
        )}
      </div>
      <div className='ai-review-footer'>
        <p>
          {proposal.action === 'groupMessage'
            ? 'После подтверждения сообщение увидят участники группы.'
            : proposal.action === 'groupTask'
              ? 'После подтверждения дедлайн появится у всех участников группы.'
              : 'ИИ ничего не изменит, пока вы не подтвердите действие.'}
        </p>
        <div className='ai-review-actions'>
          <button className='button secondary' onClick={onCancel} disabled={busy}>
            <X size={16} />
            Отмена
          </button>
          <button
            className={`button ${deleting ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            disabled={busy || (!deleting && proposal.action === 'update' && !preview.fields.length)}
          >
            <Check size={17} />
            {busy ? 'Сохраняем…' : preview.confirmLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
