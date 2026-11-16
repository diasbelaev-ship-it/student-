import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  FileText,
  MessageCircle,
  Paperclip,
  Plus,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { api, send } from './api';
import { UserAvatar } from './components/UserAvatar.jsx';

const shortDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : '';
const shortTime = (value) =>
  value
    ? new Date(`${value.replace(' ', 'T')}Z`).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
const fileTypes = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.xlsx,.pptx';
const emptyTask = { title: '', dueDate: '', course: '' };
const memberCount = (n) =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'участник' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'участника' : 'участников'}`;

export default function GroupWorkspace({
  user,
  profilePreferences,
  items,
  save,
  toast,
  selectedGroupId,
}) {
  const [groups, setGroups] = useState([]);
  const [selectedId, setSelectedId] = useState(selectedGroupId || null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(Boolean(selectedGroupId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [task, setTask] = useState(emptyTask);
  const [taskOpen, setTaskOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat');
  const fileInput = useRef(null);
  const log = useRef(null);
  const activeGroup = useRef(selectedGroupId || null);
  const detailRequest = useRef(0);
  const listRequest = useRef(0);

  const selectGroup = useCallback((id) => {
    if (activeGroup.current === id) return;
    activeGroup.current = id;
    detailRequest.current++;
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(Boolean(id));
    setMessage('');
    setTask(emptyTask);
    setTaskOpen(false);
    setMobileTab('chat');
    setError('');
  }, []);

  async function loadGroups(quiet = false) {
    const request = ++listRequest.current;
    try {
      const next = await api('/api/groups');
      if (request !== listRequest.current) return;
      setGroups(next);
      if (!quiet) setError('');
    } catch (err) {
      if (!quiet && request === listRequest.current) setError(err.message);
    } finally {
      if (request === listRequest.current) setLoading(false);
    }
  }
  async function loadDetail(id, quiet = false, signal) {
    if (activeGroup.current !== id) return;
    const request = ++detailRequest.current;
    const isCurrent = () => !signal?.aborted && request === detailRequest.current;
    if (!quiet) setDetailLoading(true);
    try {
      const next = await api(`/api/groups/${id}`, { signal });
      if (!isCurrent()) return;
      setDetail(next);
      if (!quiet) setError('');
    } catch (err) {
      if (!quiet && isCurrent()) setError(err.message);
    } finally {
      if (isCurrent()) setDetailLoading(false);
    }
  }

  function updateDetail(id, update) {
    if (activeGroup.current !== id) return;
    detailRequest.current++;
    setDetail((current) => (current?.group.id === id ? update(current) : current));
  }

  useEffect(() => {
    loadGroups();
  }, []);
  useEffect(() => {
    selectGroup(selectedGroupId || null);
  }, [selectedGroupId, selectGroup]);
  useEffect(() => {
    if (!selectedId) return undefined;
    const controller = new AbortController();
    let fetching = false;
    async function poll(quiet = true) {
      if (fetching || (quiet && document.hidden)) return;
      fetching = true;
      try {
        await loadDetail(selectedId, quiet, controller.signal);
      } finally {
        fetching = false;
      }
    }
    void poll(false);
    const wake = () => void poll();
    const timer = setInterval(wake, 7000);
    document.addEventListener('visibilitychange', wake);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [selectedId]);
  useEffect(() => {
    if (log.current && mobileTab === 'chat') log.current.scrollTop = log.current.scrollHeight;
  }, [detail?.messages?.length, mobileTab]);

  async function createOrJoin(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const group =
        action === 'create'
          ? await send('/api/groups', 'POST', { name, description: '' })
          : await send('/api/groups/join', 'POST', { code });
      await loadGroups();
      selectGroup(group.id);
      setAction('');
      setName('');
      setCode('');
      toast(action === 'create' ? 'Группа создана' : 'Вы присоединились к группе');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function sendMessage(event) {
    event.preventDefault();
    const body = message.trim();
    if (!body || busy) return;
    setBusy(true);
    setError('');
    try {
      const entry = await send(`/api/groups/${selectedId}/messages`, 'POST', { body });
      updateDetail(selectedId, (current) => ({
        ...current,
        messages: current.messages.some((message) => message.id === entry.id)
          ? current.messages
          : [...current.messages, entry],
      }));
      if (activeGroup.current === selectedId)
        setMessage((current) => (current.trim() === body ? '' : current));
      void loadGroups(true);
    } catch (err) {
      if (activeGroup.current === selectedId) setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function addTask(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const entry = await send(`/api/groups/${selectedId}/tasks`, 'POST', task);
      updateDetail(selectedId, (current) => ({
        ...current,
        tasks: current.tasks.some((task) => task.id === entry.id)
          ? current.tasks
          : [...current.tasks, entry].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      }));
      if (activeGroup.current === selectedId) {
        setTask(emptyTask);
        setTaskOpen(false);
      }
      toast('Общий дедлайн добавлен');
    } catch (err) {
      if (activeGroup.current === selectedId) setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function copyTask(entry) {
    try {
      const matched = items.find(
        (item) =>
          item.kind === 'course' &&
          item.payload.title.toLocaleLowerCase() === entry.course.toLocaleLowerCase(),
      );
      await save('task', {
        title: entry.title,
        date: entry.dueDate,
        status: 'todo',
        priority: 'normal',
        ...(matched ? { courseId: matched.id } : {}),
      });
      toast('Дедлайн добавлен в личный план');
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeTask(entry) {
    if (!window.confirm(`Удалить общий дедлайн «${entry.title}»?`)) return;
    try {
      await api(`/api/groups/${selectedId}/tasks/${entry.id}`, { method: 'DELETE' });
      updateDetail(selectedId, (current) => ({
        ...current,
        tasks: current.tasks.filter((item) => item.id !== entry.id),
      }));
    } catch (err) {
      if (activeGroup.current === selectedId) setError(err.message);
    }
  }
  async function uploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Файл слишком большой: максимум 5 МБ');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/groups/${selectedId}/files`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name),
          'X-File-Type': file.type,
        },
        body: file,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить файл');
      await loadDetail(selectedId, true);
      toast('Файл доступен участникам группы');
    } catch (err) {
      if (activeGroup.current === selectedId) setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function removeFile(file) {
    if (!window.confirm(`Удалить файл «${file.name}» для всех участников?`)) return;
    try {
      await api(`/api/groups/${selectedId}/files/${file.id}`, { method: 'DELETE' });
      updateDetail(selectedId, (current) => ({
        ...current,
        files: current.files.filter((entry) => entry.id !== file.id),
      }));
      toast('Файл удалён из группы');
    } catch (err) {
      if (activeGroup.current === selectedId) setError(err.message);
    }
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(detail.group.inviteCode);
      toast('Код приглашения скопирован');
    } catch {
      toast(`Код приглашения: ${detail.group.inviteCode}`);
    }
  }

  const selected = groups.find((group) => group.id === selectedId);
  const isInPlan = (entry) =>
    items.some(
      (item) =>
        item.kind === 'task' &&
        item.payload.title === entry.title &&
        item.payload.date === entry.dueDate,
    );
  return (
    <div className='groups-workspace'>
      <div className='groups-intro'>
        <div>
          <h2>Учитесь вместе</h2>
          <p>
            Обсуждения, файлы и общие сроки вашей группы. Личный план остаётся под вашим контролем.
          </p>
        </div>
        <div className='groups-intro-actions'>
          <button
            type='button'
            className='button secondary'
            onClick={() => {
              setAction(action === 'join' ? '' : 'join');
              setError('');
            }}
          >
            Войти по коду
          </button>
          <button
            type='button'
            className='button primary'
            onClick={() => {
              setAction(action === 'create' ? '' : 'create');
              setError('');
            }}
          >
            <Plus size={16} />
            Создать группу
          </button>
        </div>
      </div>
      {action && (
        <form className='groups-action-form' onSubmit={createOrJoin}>
          <label>
            {action === 'create' ? 'Название группы' : 'Код приглашения'}
            <input
              autoFocus
              required
              maxLength={action === 'create' ? 100 : 40}
              minLength={action === 'create' ? 2 : 8}
              value={action === 'create' ? name : code}
              onChange={(event) =>
                action === 'create' ? setName(event.target.value) : setCode(event.target.value)
              }
              placeholder={
                action === 'create'
                  ? 'Например, Математика · группа 21'
                  : 'Вставьте код от одногруппника'
              }
            />
          </label>
          <button className='button primary' disabled={busy}>
            {action === 'create' ? 'Создать' : 'Присоединиться'}
          </button>
          <button type='button' className='button secondary' onClick={() => setAction('')}>
            Отмена
          </button>
        </form>
      )}
      {error && (
        <div className='groups-error' role='alert'>
          {error}{' '}
          <button
            type='button'
            onClick={() => {
              setError('');
              loadGroups();
              if (selectedId) loadDetail(selectedId);
            }}
          >
            Повторить
          </button>
        </div>
      )}
      <div className={`groups-layout ${selectedId ? 'has-selection' : ''}`}>
        <aside className='groups-list' aria-label='Ваши учебные группы'>
          <div className='groups-list-head'>
            <strong>Мои группы</strong>
            <span>{groups.length}</span>
          </div>
          {loading ? (
            <p className='groups-quiet'>Загружаем группы…</p>
          ) : groups.length ? (
            groups.map((group) => (
              <button
                type='button'
                key={group.id}
                className={`groups-list-row ${selectedId === group.id ? 'selected' : ''}`}
                onClick={() => selectGroup(group.id)}
              >
                <span className='groups-list-avatar'>{group.name.slice(0, 1).toUpperCase()}</span>
                <span className='groups-list-text'>
                  <b>{group.name}</b>
                  <small>
                    {group.latestMessage ||
                      `${memberCount(group.memberCount)} · начните обсуждение`}
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))
          ) : (
            <div className='groups-list-empty'>
              <Users size={24} />
              <strong>Пока нет групп</strong>
              <p>Создайте пространство для одногруппников или войдите по коду.</p>
            </div>
          )}
        </aside>
        <section
          className='groups-detail'
          aria-label={selected ? `Группа ${selected.name}` : 'Группа'}
        >
          {!selectedId ? (
            <div className='groups-placeholder'>
              <MessageCircle size={29} />
              <h3>Выберите группу</h3>
              <p>Здесь появятся разговоры, материалы и общие дедлайны.</p>
            </div>
          ) : detail?.group.id !== selectedId ? (
            <p className='groups-quiet' role='status'>
              {detailLoading ? 'Загружаем пространство группы…' : 'Не удалось открыть группу.'}
            </p>
          ) : (
            <>
              <div className='groups-detail-header'>
                <button
                  type='button'
                  className='groups-back'
                  onClick={() => selectGroup(null)}
                  aria-label='К списку групп'
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h3>{detail.group.name}</h3>
                  <p>{detail.members.map((member) => member.name).join(', ')}</p>
                </div>
                <span className='groups-member-count'>
                  <Users size={15} />
                  {detail.group.memberCount}
                </span>
              </div>
              <div className='groups-mobile-tabs' role='tablist' aria-label='Содержимое группы'>
                {[
                  ['chat', 'Чат'],
                  ['tasks', 'Дедлайны'],
                  ['files', 'Файлы'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type='button'
                    role='tab'
                    aria-selected={mobileTab === id}
                    onClick={() => setMobileTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className='groups-content'>
                <div
                  className={`groups-chat ${mobileTab !== 'chat' ? 'groups-mobile-hidden' : ''}`}
                >
                  <div className='groups-column-title'>
                    <strong>Обсуждение</strong>
                    <span>
                      {detail.messages.length
                        ? `Последние сообщения · ${detail.messages.length}`
                        : 'Напишите первое сообщение'}
                    </span>
                  </div>
                  <div className='groups-message-log' ref={log} aria-live='polite'>
                    {detail.messages.length ? (
                      detail.messages.map((entry) => (
                        <div
                          key={entry.id}
                          className={`groups-message ${entry.userId === user.id ? 'own' : ''}`}
                        >
                          <UserAvatar
                            name={entry.userName}
                            preferences={entry.userId === user.id ? profilePreferences : undefined}
                            className='groups-message-avatar'
                          />
                          <div>
                            <div className='groups-message-meta'>
                              <b>{entry.userId === user.id ? 'Вы' : entry.userName}</b>
                              <time>{shortTime(entry.createdAt)}</time>
                            </div>
                            <p>{entry.body}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className='groups-chat-empty'>
                        Обсудите ближайшую пару, задайте вопрос или поделитесь полезным материалом.
                      </div>
                    )}
                  </div>
                  <form className='groups-composer' onSubmit={sendMessage}>
                    <label htmlFor='groups-message-input' className='sr-only'>
                      Сообщение группе
                    </label>
                    <input
                      id='groups-message-input'
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      maxLength={2000}
                      placeholder='Написать группе…'
                    />
                    <button
                      type='submit'
                      disabled={busy || !message.trim()}
                      aria-label='Отправить сообщение'
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
                <div className='groups-side'>
                  <section
                    className={`groups-side-block ${mobileTab !== 'tasks' ? 'groups-mobile-hidden' : ''}`}
                  >
                    <div className='groups-column-title'>
                      <strong>Общие дедлайны</strong>
                      <button
                        type='button'
                        onClick={() => setTaskOpen((value) => !value)}
                        aria-label='Добавить общий дедлайн'
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    {taskOpen && (
                      <form className='groups-task-form' onSubmit={addTask}>
                        <input
                          required
                          aria-label='Что нужно сдать'
                          maxLength={100}
                          placeholder='Что нужно сдать'
                          value={task.title}
                          onChange={(event) => setTask({ ...task, title: event.target.value })}
                        />
                        <input
                          required
                          aria-label='Дата сдачи'
                          type='date'
                          value={task.dueDate}
                          onChange={(event) => setTask({ ...task, dueDate: event.target.value })}
                        />
                        <input
                          aria-label='Предмет'
                          maxLength={100}
                          placeholder='Предмет (необязательно)'
                          value={task.course}
                          onChange={(event) => setTask({ ...task, course: event.target.value })}
                        />
                        <button className='button primary' disabled={busy}>
                          Добавить
                        </button>
                      </form>
                    )}
                    {detail.tasks.length ? (
                      detail.tasks.map((entry) => (
                        <div className='groups-task-row' key={entry.id}>
                          <time>{shortDate(entry.dueDate)}</time>
                          <div>
                            <b>{entry.title}</b>
                            <small>
                              {entry.course || 'Без предмета'} · {entry.author}
                            </small>
                            <button
                              type='button'
                              disabled={isInPlan(entry)}
                              onClick={() => copyTask(entry)}
                            >
                              {isInPlan(entry) ? (
                                'Уже в плане'
                              ) : (
                                <>
                                  В мой план <ArrowRight size={13} />
                                </>
                              )}
                            </button>
                          </div>
                          {(entry.userId === user.id || detail.group.creatorId === user.id) && (
                            <button
                              type='button'
                              className='groups-delete'
                              aria-label={`Удалить ${entry.title}`}
                              title='Удалить общий дедлайн'
                              onClick={() => removeTask(entry)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className='groups-side-empty'>
                        Добавьте общий срок сдачи — каждый участник сможет перенести его в свой
                        план.
                      </p>
                    )}
                  </section>
                  <section
                    className={`groups-side-block ${mobileTab !== 'files' ? 'groups-mobile-hidden' : ''}`}
                  >
                    <div className='groups-column-title'>
                      <strong>Материалы</strong>
                      <button
                        type='button'
                        onClick={() => fileInput.current?.click()}
                        disabled={busy}
                        aria-label='Загрузить файл'
                      >
                        <Paperclip size={18} />
                      </button>
                    </div>
                    <input
                      ref={fileInput}
                      type='file'
                      accept={fileTypes}
                      onChange={uploadFile}
                      className='sr-only'
                      aria-label='Выбрать файл для группы'
                    />
                    {detail.files.length ? (
                      detail.files.map((file) => (
                        <div className='groups-file-wrap' key={file.id}>
                          <a
                            className='groups-file-row'
                            href={`/api/groups/${selectedId}/files/${file.id}`}
                            download
                          >
                            <FileText size={18} />
                            <span>
                              <b>{file.name}</b>
                              <small>
                                {file.author} · {(file.size / 1024).toFixed(0)} КБ
                              </small>
                            </span>
                            <Download size={16} />
                          </a>
                          {(file.userId === user.id || detail.group.creatorId === user.id) && (
                            <button
                              type='button'
                              className='groups-file-delete'
                              onClick={() => removeFile(file)}
                              aria-label={`Удалить файл ${file.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className='groups-side-empty'>
                        Загрузите конспект или файл задания. Доступ есть только участникам.
                      </p>
                    )}
                    <p className='groups-file-note'>PDF, изображения, TXT и Office · до 5 МБ</p>
                  </section>
                </div>
              </div>
              <div className='groups-invite'>
                <span>Код для одногруппников</span>
                <code>{detail.group.inviteCode}</code>
                <button type='button' onClick={copyInvite}>
                  <Copy size={15} />
                  Скопировать
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
