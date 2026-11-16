import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  LoaderCircle,
  MessageCircle,
  Mic,
  MicOff,
  Plus,
  Search,
  Send,
} from 'lucide-react';
import { api, send } from './api';
import { localeTags, translate } from './i18n';

const speechLanguages = [
  { value: 'ru', tag: 'ru-RU', label: { ru: 'Русский', kk: 'Орысша', en: 'Russian' } },
  { value: 'kk', tag: 'kk-KZ', label: { ru: 'Қазақша', kk: 'Қазақша', en: 'Kazakh' } },
  { value: 'en', tag: 'en-US', label: { ru: 'English', kk: 'English', en: 'English' } },
];

function dateLabel(value, locale) {
  if (!value) return '';
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return translate(locale, 'chat.today');
  if (date.toDateString() === yesterday.toDateString()) return translate(locale, 'chat.yesterday');
  return date.toLocaleDateString(localeTags[locale] || localeTags.ru, {
    day: 'numeric',
    month: 'short',
  });
}

function timeLabel(value, locale) {
  if (!value) return '';
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString(localeTags[locale] || localeTags.ru, {
        hour: '2-digit',
        minute: '2-digit',
      });
}

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function DirectChat({ user, locale = 'ru' }) {
  const t = (key) => translate(locale, `chat.${key}`);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [email, setEmail] = useState('');
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [messageLoadError, setMessageLoadError] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [speechLocale, setSpeechLocale] = useState(locale);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef(null);
  const logRef = useRef(null);
  const activeChat = useRef(null);
  const selected = conversations.find((chat) => chat.id === selectedId);
  const draft = drafts[selectedId] || '';

  function setDraft(value) {
    setDrafts((current) => ({
      ...current,
      [selectedId]: typeof value === 'function' ? value(current[selectedId] || '') : value,
    }));
  }

  function stopDictation() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
  }

  function selectConversation(id) {
    if (activeChat.current === id) return;
    activeChat.current = id;
    stopDictation();
    setSelectedId(id);
    setMessages([]);
    setLoadingMessages(Boolean(id));
    setMessageLoadError('');
    setInterim('');
    setListening(false);
    setError('');
  }

  const loadConversations = useCallback(
    async (quiet = false) => {
      try {
        const data = await api('/api/chats');
        if (!Array.isArray(data)) throw new Error(t('networkError'));
        setConversations(data);
        if (!quiet) setError('');
      } catch (err) {
        if (!quiet) setError(err.message || t('networkError'));
      } finally {
        setLoading(false);
      }
    },
    [locale],
  );

  useEffect(() => {
    loadConversations();
    const timer = window.setInterval(() => {
      if (!document.hidden) loadConversations(true);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const controller = new AbortController();
    let cursor = null;
    let fetching = false;
    async function loadMessages() {
      if (fetching || document.hidden) return;
      fetching = true;
      try {
        const query = cursor === null ? '' : `?after=${cursor}`;
        const data = await api(`/api/chats/${selectedId}/messages${query}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted || activeChat.current !== selectedId) return;
        if (!Array.isArray(data)) throw new Error(t('networkError'));
        cursor = data.at(-1)?.id || cursor || 0;
        if (data.length) setMessages((current) => mergeMessages(current, data));
        setMessageLoadError('');
      } catch (err) {
        if (!controller.signal.aborted && activeChat.current === selectedId)
          setMessageLoadError(err.message || t('networkError'));
      } finally {
        fetching = false;
        if (!controller.signal.aborted && activeChat.current === selectedId)
          setLoadingMessages(false);
      }
    }
    void loadMessages();
    const timer = window.setInterval(loadMessages, 5000);
    document.addEventListener('visibilitychange', loadMessages);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', loadMessages);
    };
  }, [selectedId, locale]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages.length, interim]);

  useEffect(() => {
    setSpeechLocale(locale);
  }, [locale]);

  useEffect(() => stopDictation, []);

  async function startConversation(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await send('/api/chats', 'POST', { email: email.trim() });
      await loadConversations(true);
      selectConversation(result.id);
      setEmail('');
    } catch (err) {
      setError(err.message || t('lookupError'));
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!selectedId || !body || busy) return;
    stopDictation();
    setListening(false);
    setInterim('');
    setBusy(true);
    setError('');
    try {
      const sent = await send(`/api/chats/${selectedId}/messages`, 'POST', { body });
      setDraft((current) => (current.trim() === body ? '' : current));
      if (activeChat.current === selectedId) {
        setMessages((current) => mergeMessages(current, [sent]));
      }
      loadConversations(true);
    } catch (err) {
      if (activeChat.current === selectedId) setError(err.message || t('networkError'));
    } finally {
      setBusy(false);
    }
  }

  function dictate() {
    if (recognitionRef.current) {
      if (listening) recognitionRef.current.stop();
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError(t('unsupported'));
      return;
    }
    const recognition = new Recognition();
    recognition.lang =
      speechLanguages.find((entry) => entry.value === speechLocale)?.tag || 'ru-RU';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;
    setInterim('');
    setError('');
    recognition.onstart = () => {
      if (recognitionRef.current === recognition) setListening(true);
    };
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      let finalText = '';
      let currentInterim = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
        else currentInterim += result[0].transcript;
      }
      if (finalText.trim()) {
        setDraft((current) =>
          `${current}${current && !current.endsWith(' ') ? ' ' : ''}${finalText.trim()}`.slice(
            0,
            3000,
          ),
        );
      }
      setInterim(currentInterim);
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed')
        setError(t('voicePermission'));
      else if (event.error !== 'no-speech' && event.error !== 'aborted') setError(t('voiceError'));
      setListening(false);
      setInterim('');
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      setListening(false);
      setInterim('');
      recognitionRef.current = null;
    };
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError(t('voiceError'));
    }
  }

  return (
    <section className='direct-chat-workspace' aria-label={t('heading')}>
      <div className='direct-chat-intro'>
        <span className='direct-chat-intro-icon'>
          <MessageCircle size={21} />
        </span>
        <div>
          <h2>{t('heading')}</h2>
          <p>{t('intro')}</p>
        </div>
      </div>

      {(error || messageLoadError) && (
        <div className='direct-chat-error' role='alert'>
          {error || messageLoadError}
        </div>
      )}

      <div className='direct-chat-layout' data-mobile-view={selectedId ? 'thread' : 'list'}>
        <aside className='direct-chat-list' aria-label={t('conversations')}>
          <div className='direct-chat-list-header'>
            <strong>{t('conversations')}</strong>
            <span>{conversations.length}</span>
          </div>
          <form className='direct-chat-new' onSubmit={startConversation}>
            <label htmlFor='direct-chat-email'>{t('emailLabel')}</label>
            <div className='direct-chat-email-row'>
              <input
                id='direct-chat-email'
                type='email'
                autoComplete='email'
                required
                maxLength={120}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('emailPlaceholder')}
              />
              <button
                type='submit'
                className='button primary'
                disabled={busy}
                aria-label={t('find')}
              >
                {busy ? (
                  <LoaderCircle size={17} className='direct-chat-spin' />
                ) : (
                  <Plus size={17} />
                )}
              </button>
            </div>
            <small>{t('noEmailExposure')}</small>
          </form>
          <div className='direct-chat-conversations' role='list'>
            {loading ? (
              <div className='direct-chat-list-state' role='status'>
                {t('loading')}
              </div>
            ) : conversations.length === 0 ? (
              <div className='direct-chat-list-state'>
                <Search size={20} />
                <b>{t('emptyListTitle')}</b>
                <span>{t('emptyList')}</span>
              </div>
            ) : (
              conversations.map((chat) => (
                <div role='listitem' key={chat.id}>
                  <button
                    type='button'
                    className={`direct-chat-conversation ${selectedId === chat.id ? 'selected' : ''}`}
                    onClick={() => selectConversation(chat.id)}
                    aria-current={selectedId === chat.id ? 'true' : undefined}
                  >
                    <span className='direct-chat-avatar'>
                      {chat.peer.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className='direct-chat-conversation-copy'>
                      <b>{chat.peer.name}</b>
                      <small>{chat.latestMessage?.body || t('emptyMessages')}</small>
                    </span>
                    {chat.lastMessageAt && <time>{timeLabel(chat.lastMessageAt, locale)}</time>}
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <section
          className='direct-chat-thread'
          aria-label={selected?.peer.name || t('noSelectionTitle')}
        >
          {selected ? (
            <>
              <header className='direct-chat-thread-header'>
                <button
                  type='button'
                  className='direct-chat-back'
                  onClick={() => selectConversation(null)}
                  aria-label={t('back')}
                >
                  <ArrowLeft size={19} />
                </button>
                <span className='direct-chat-avatar'>
                  {selected.peer.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3>{selected.peer.name}</h3>
                  <p>{t('intro').split('.')[0]}</p>
                </div>
              </header>
              <div
                className='direct-chat-message-log'
                ref={logRef}
                aria-live='polite'
                aria-busy={loadingMessages}
              >
                {loadingMessages && messages.length === 0 ? (
                  <p className='direct-chat-empty' role='status'>
                    {t('loading')}
                  </p>
                ) : messages.length === 0 ? (
                  <p className='direct-chat-empty'>{t('emptyMessages')}</p>
                ) : (
                  messages.map((message) => (
                    <article
                      className={`direct-chat-message ${message.userId === user.id ? 'own' : ''}`}
                      key={message.id}
                    >
                      <div className='direct-chat-message-meta'>
                        <b>{message.userId === user.id ? t('you') : message.userName}</b>
                        <time dateTime={message.createdAt}>
                          {dateLabel(message.createdAt, locale)} ·{' '}
                          {timeLabel(message.createdAt, locale)}
                        </time>
                      </div>
                      <p>{message.body}</p>
                    </article>
                  ))
                )}
                {interim && (
                  <p className='direct-chat-interim' aria-live='assertive'>
                    {interim}
                  </p>
                )}
              </div>
              <form className='direct-chat-composer' onSubmit={sendMessage}>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  maxLength={3000}
                  rows={2}
                  placeholder={t('composePlaceholder')}
                  aria-label={t('composePlaceholder')}
                  disabled={busy}
                />
                <div className='direct-chat-composer-tools'>
                  <label className='direct-chat-speech-select'>
                    <span>{t('speechLang')}</span>
                    <select
                      value={speechLocale}
                      onChange={(event) => setSpeechLocale(event.target.value)}
                      aria-label={t('speechLang')}
                    >
                      {speechLanguages.map((entry) => (
                        <option key={entry.value} value={entry.value}>
                          {entry.label[locale]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <small className='direct-chat-voice-note'>{t('voiceNotice')}</small>
                  <button
                    type='button'
                    className={`direct-chat-mic ${listening ? 'is-listening' : ''}`}
                    onClick={dictate}
                    disabled={busy}
                    aria-label={listening ? t('stopVoice') : t('voice')}
                    title={listening ? t('stopVoice') : t('voice')}
                  >
                    {listening ? <MicOff size={19} /> : <Mic size={19} />}
                  </button>
                  <button
                    type='submit'
                    className='direct-chat-send'
                    disabled={!draft.trim() || busy}
                    aria-label={t('send')}
                  >
                    {busy ? (
                      <LoaderCircle size={19} className='direct-chat-spin' />
                    ) : (
                      <Send size={19} />
                    )}
                  </button>
                </div>
                <small className='direct-chat-enter-hint'>
                  Enter — {t('send').toLowerCase()} · Shift+Enter —{' '}
                  {locale === 'en' ? 'new line' : locale === 'kk' ? 'жаңа жол' : 'новая строка'}
                </small>
              </form>
            </>
          ) : (
            <div className='direct-chat-placeholder'>
              <span>
                <MessageCircle size={25} />
              </span>
              <h3>{t('noSelectionTitle')}</h3>
              <p>{t('noSelection')}</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

export { DirectChat };
