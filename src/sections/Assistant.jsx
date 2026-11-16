import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ImagePlus, Send, Sparkles, X } from 'lucide-react';
import { send } from '../api.js';
import AiProposalCard from '../AiProposalCard.jsx';
import { translate } from '../i18n.js';

function Assistant({ items, refresh, toast, setUser, user, locale = 'ru' }) {
  const t = (key) => translate(locale, `assistant.${key}`);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Привет! Помогу разобраться с учёбой и предложу изменения в расписании, задачах, конспектах и других разделах. Перед любым изменением покажу его вам.',
    },
  ]);
  const [input, setInput] = useState(''),
    [busy, setBusy] = useState(false),
    [proposal, setProposal] = useState(null),
    [attachments, setAttachments] = useState([]),
    [readingImages, setReadingImages] = useState(false),
    [requestError, setRequestError] = useState('');
  const readingImagesRef = useRef(false);
  const chatLog = useRef(null);
  useEffect(() => {
    if (chatLog.current) chatLog.current.scrollTop = chatLog.current.scrollHeight;
  }, [messages, busy, requestError]);
  const starters = [
    'Найди ближайшие дедлайны и помоги расставить приоритеты',
    'Сгенерируй 20 карточек английского уровня B1 с примерами',
    'Проверь расписание и найди пары без названия предмета',
  ];
  async function ask(e) {
    e.preventDefault();
    const message = input.trim();
    if ((!message && !attachments.length) || busy || readingImagesRef.current) return;
    const recent = messages.slice(-6);
    const previousImageIndex = recent.reduce(
      (found, entry, index) => (entry.role === 'user' && entry.images?.length ? index : found),
      -1,
    );
    const history = recent.map((entry, index) => ({
      role: entry.role,
      text: entry.text.slice(0, 1000),
      ...(index === previousImageIndex
        ? {
            images: entry.images.map((image) => ({
              mimeType: image.mimeType,
              data: image.data.slice(image.data.indexOf(',') + 1),
            })),
          }
        : {}),
    }));
    const submitted = { role: 'user', text: message, images: attachments };
    setInput('');
    setAttachments([]);
    setMessages((x) => [...x, submitted]);
    setRequestError('');
    setBusy(true);
    try {
      const r = await send('/api/ai', 'POST', {
        message,
        history,
        images: submitted.images.map((image) => ({
          mimeType: image.mimeType,
          data: image.data.slice(image.data.indexOf(',') + 1),
        })),
      });
      setMessages((x) => [...x, { role: 'assistant', text: r.message }]);
      setProposal(r.proposal || null);
    } catch (err) {
      setMessages((x) => x.filter((entry) => entry !== submitted));
      setInput(input);
      setAttachments(submitted.images);
      setRequestError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function addImages(files) {
    if (!files.length || busy || readingImagesRef.current) return;
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (files.some((file) => !allowed.has(file.type))) {
      toast(t('imageFormatError'));
      return;
    }
    if (files.some((file) => file.size > 2 * 1024 * 1024)) {
      toast(t('imageSizeError'));
      return;
    }
    const total =
      attachments.reduce((sum, image) => sum + image.size, 0) +
      files.reduce((sum, file) => sum + file.size, 0);
    if (attachments.length + files.length > 2 || total > 4 * 1024 * 1024) {
      toast(t('imageTotalError'));
      return;
    }
    readingImagesRef.current = true;
    setReadingImages(true);
    try {
      const loaded = await Promise.all(
        files.map(
          (file) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                typeof reader.result === 'string'
                  ? resolve({
                      name: file.name,
                      size: file.size,
                      mimeType: file.type,
                      data: reader.result,
                    })
                  : reject(new Error('Invalid image data'));
              reader.onerror = () => reject(new Error('Image read failed'));
              reader.readAsDataURL(file);
            }),
        ),
      );
      setAttachments((current) => [...current, ...loaded]);
    } catch {
      toast(t('imageReadError'));
    } finally {
      readingImagesRef.current = false;
      setReadingImages(false);
    }
  }
  async function confirm() {
    if (!proposal) return;
    setBusy(true);
    try {
      const response = await send('/api/ai/confirm', 'POST', { proposalId: proposal.id });
      if (response.result?.user) setUser(response.result.user);
      if (response.result?.focus)
        localStorage.setItem(
          `studia-focus-settings-${user.id}`,
          JSON.stringify(response.result.focus),
        );
      await refresh();
      const created = response.result?.created?.length;
      const resultText =
        proposal.action === 'batch'
          ? `Добавлено записей: ${created}. ${response.result.skipped ? `Пропущено дублей: ${response.result.skipped}.` : ''}`
          : proposal.action === 'batchUpdate'
            ? `Обновлено записей: ${response.result?.changed?.length || 0}.`
            : proposal.action === 'groupTask'
              ? 'Общий дедлайн добавлен в группу. Участники смогут перенести его в личный план.'
              : proposal.action === 'groupMessage'
                ? 'Сообщение отправлено участникам группы.'
                : proposal.action === 'focus'
                  ? 'Таймер настроен. Откройте раздел «Фокус» и нажмите «Начать».'
                  : 'Готово. Изменение сохранено.';
      setMessages((current) => [...current, { role: 'assistant', text: resultText }]);
      setProposal(null);
      toast(
        proposal.action === 'batch'
          ? 'Записи добавлены'
          : proposal.action === 'batchUpdate'
            ? 'Записи обновлены'
            : 'Изменение подтверждено',
      );
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  }
  const target = items.find((x) => x.id === proposal?.targetId);
  return (
    <div className='assistant-panel'>
      <div className='assistant-head'>
        <span className='assistant-symbol'>
          <Sparkles size={20} />
        </span>
        <div>
          <b>Studia AI</b>
          <small>Учебный помощник · Gemini</small>
        </div>
      </div>
      <div className='chat-log' ref={chatLog}>
        {messages.map((m, i) => (
          <div className={`chat-bubble ${m.role}`} key={i}>
            {m.text && <span>{m.text}</span>}
            {m.images?.length > 0 && (
              <div className='chat-message-images'>
                {m.images.map((image, imageIndex) => (
                  <img key={`${i}-${imageIndex}`} src={image.data} alt={t('attachmentAlt')} />
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className='chat-bubble assistant'>Думаю над ответом…</div>}
        {requestError && (
          <div className='chat-bubble assistant' role='alert'>
            {requestError}
          </div>
        )}
      </div>
      {proposal && (
        <AiProposalCard
          proposal={proposal}
          target={target}
          courses={items.filter((item) => item.kind === 'course')}
          records={items}
          busy={busy}
          onConfirm={confirm}
          onCancel={() => setProposal(null)}
        />
      )}
      {messages.length === 1 && !proposal && (
        <div className='assistant-starters' aria-label='Примеры запросов'>
          <span>С чего начнём?</span>
          {starters.map((prompt) => (
            <button key={prompt} type='button' onClick={() => setInput(prompt)} disabled={busy}>
              {prompt}
              <ArrowUpRight size={14} />
            </button>
          ))}
          {items.some((item) => item.kind === 'flashcard') && (
            <button
              type='button'
              onClick={() =>
                setInput(
                  'Дополни мои существующие карточки английского: добавь уровень, произношение (если уверен), пример с переводом и подсказку по употреблению. Слова и ответы оставь прежними.',
                )
              }
              disabled={busy}
            >
              Дополнить мои карточки английского
              <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      )}
      <form className='chat-form' onSubmit={ask}>
        <div className='chat-composer'>
          {attachments.length > 0 && (
            <div className='chat-attachments' aria-label={t('attachmentAlt')}>
              {attachments.map((image, index) => (
                <div className='chat-attachment' key={`${image.name}-${index}`}>
                  <img src={image.data} alt='' />
                  <button
                    type='button'
                    className='chat-attachment-remove'
                    aria-label={t('removeImage')}
                    disabled={busy || readingImages}
                    onClick={() =>
                      setAttachments((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            aria-label='Сообщение помощнику'
            value={input}
            readOnly={busy}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(event) => {
              const items = Array.from(event.clipboardData?.items || [])
                .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
                .map((item) => item.getAsFile())
                .filter(Boolean);
              const images = items.length
                ? items
                : Array.from(event.clipboardData?.files || []).filter((file) =>
                    file.type.startsWith('image/'),
                  );
              if (images.length) {
                event.preventDefault();
                void addImages(images);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder='Спросите о занятиях или поручите подготовить изменения…'
            maxLength={2500}
            rows={1}
          />
          <div className='chat-composer-tools'>
            <label className='chat-attach' title={t('attachImage')}>
              <ImagePlus size={17} />
              <span>{t('attachImage')}</span>
              <input
                type='file'
                accept='image/jpeg,image/png,image/webp'
                multiple
                disabled={busy || readingImages}
                onChange={(event) => {
                  addImages(Array.from(event.currentTarget.files || []));
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <small>{t('pasteHint')} · Enter — отправить · Shift+Enter — новая строка</small>
          </div>
        </div>
        <button
          className='button primary chat-send'
          disabled={busy || readingImages || (!input.trim() && !attachments.length)}
          aria-label='Отправить'
        >
          <Send size={18} />
        </button>
      </form>
      <p className='assistant-disclaimer'>
        Помощник получает ваш профиль, личные записи и названия групп, в которых вы состоите.
        Переписка и файлы групп ему не передаются. Любое изменение требует подтверждения;
        предложение действует 10 минут. {t('imagePrivacy')}
      </p>
    </div>
  );
}

export { Assistant };
