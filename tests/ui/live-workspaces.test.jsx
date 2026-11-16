import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api, send } from '../../src/api.js';
import { DirectChat } from '../../src/DirectChat.jsx';
import GroupWorkspace from '../../src/GroupWorkspace.jsx';
import FocusWorkspace from '../../src/FocusWorkspace.jsx';
import { Editor } from '../../src/components/RecordEditor.jsx';
import { useReminders } from '../../src/hooks/useReminders.js';
import { showReminderNotification } from '../../src/reminder-notifications.mjs';

vi.mock('../../src/api.js', () => ({ api: vi.fn(), send: vi.fn() }));
vi.mock('../../src/reminder-notifications.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  showReminderNotification: vi.fn(),
}));

const user = { id: 1, name: 'Студент' };
const chats = [
  { id: 1, peer: { id: 2, name: 'Алия' } },
  { id: 2, peer: { id: 3, name: 'Нурлан' } },
];
const message = (id, body) => ({ id, userId: 2, userName: 'Алия', body });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

it('добавляет новые сообщения по курсору, сохраняя порядок и избегая повторной полной загрузки', async () => {
  vi.useFakeTimers();
  api.mockImplementation(async (path) => {
    if (path === '/api/chats') return chats;
    if (path === '/api/chats/1/messages') return [message(10, 'Первое сообщение')];
    if (path === '/api/chats/1/messages?after=10')
      return [message(11, 'Ответ однокурсника'), message(12, 'Мой ответ')];
    return [];
  });
  send.mockResolvedValue(message(12, 'Мой ответ'));
  await act(async () => render(<DirectChat user={user} />));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Алия/ })));
  const draft = screen.getByRole('textbox', { name: 'Напишите сообщение…' });
  fireEvent.change(draft, { target: { value: 'Мой ответ' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Отправить' })));
  await act(async () => vi.advanceTimersByTimeAsync(5000));

  const thread = within(screen.getByRole('region', { name: 'Алия' }));
  expect(
    thread.getAllByRole('article').map((entry) => entry.querySelector('p').textContent),
  ).toEqual(['Первое сообщение', 'Ответ однокурсника', 'Мой ответ']);
  expect(api.mock.calls.filter(([path]) => path === '/api/chats/1/messages')).toHaveLength(1);
});

it('личный чат не показывает запоздавшие сообщения и сохраняет черновик отдельно для каждой беседы', async () => {
  const slow = Promise.withResolvers();
  api.mockImplementation((path) => {
    if (path === '/api/chats') return Promise.resolve(chats);
    if (path === '/api/chats/1/messages') return slow.promise;
    return Promise.resolve([message(20, 'Второй чат')]);
  });
  render(<DirectChat user={user} />);
  fireEvent.click(await screen.findByRole('button', { name: /Алия/ }));
  const draft = () => screen.getByRole('textbox', { name: 'Напишите сообщение…' });
  fireEvent.change(draft(), { target: { value: 'Черновик для Алии' } });
  fireEvent.click(screen.getByRole('button', { name: /Нурлан/ }));
  expect(draft()).toHaveValue('');
  expect(await screen.findByText('Второй чат')).toBeVisible();
  await act(async () => slow.resolve([message(10, 'Только для Алии')]));
  expect(screen.queryByText('Только для Алии')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Алия/ }));
  expect(draft()).toHaveValue('Черновик для Алии');
  await screen.findByText('Только для Алии');
});

it('группы игнорируют старый ответ и показывают удаление только автору дедлайна или создателю группы', async () => {
  const slow = Promise.withResolvers();
  const groups = [
    { id: 1, name: 'Группа А', creatorId: 2, inviteCode: 'AAAAAAAA', memberCount: 2 },
    { id: 2, name: 'Группа Б', creatorId: 2, inviteCode: 'BBBBBBBB', memberCount: 2 },
  ];
  const task = { dueDate: '2026-11-25', course: '', author: 'Студент' };
  const detail = (group, tasks = []) => ({ group, members: [], messages: [], files: [], tasks });
  api.mockImplementation((path) => {
    if (path === '/api/groups') return Promise.resolve(groups);
    if (path === '/api/groups/1') return slow.promise;
    return Promise.resolve(
      detail(groups[1], [
        { ...task, id: 5, userId: 1, title: 'Мой дедлайн' },
        { ...task, id: 6, userId: 2, title: 'Чужой дедлайн' },
      ]),
    );
  });
  render(<GroupWorkspace user={user} items={[]} save={vi.fn()} toast={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: /Группа А/ }));
  fireEvent.click(screen.getByRole('button', { name: /Группа Б/ }));
  expect(await screen.findByRole('heading', { name: 'Группа Б' })).toBeVisible();
  await act(async () => slow.resolve(detail(groups[0])));
  expect(screen.queryByRole('heading', { name: 'Группа А' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Удалить Мой дедлайн' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Удалить Чужой дедлайн' })).not.toBeInTheDocument();
});

it('фокус завершает работу, перерыв и следующую работу и сообщает о сохранении после ответа сервера', async () => {
  vi.useFakeTimers();
  localStorage.setItem(
    'studia-focus-settings-1',
    JSON.stringify({ minutes: 1, label: 'Повторение' }),
  );
  const firstSave = Promise.withResolvers();
  const save = vi.fn().mockReturnValueOnce(firstSave.promise).mockResolvedValue(undefined);
  const toast = vi.fn();
  render(<FocusWorkspace items={[]} user={user} save={save} toast={toast} />);
  const finish = async (minutes) => {
    fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
    await act(async () => vi.advanceTimersByTimeAsync(minutes * 60_000));
  };
  await finish(1);
  expect(save).toHaveBeenCalledTimes(1);
  expect(toast).not.toHaveBeenCalled();
  expect(screen.getByText('05:00')).toBeVisible();
  await act(async () => firstSave.resolve());
  expect(toast).toHaveBeenCalledWith(expect.stringContaining('Работа сохранена'));
  await finish(5);
  expect(screen.getByText('01:00')).toBeVisible();
  await finish(1);
  expect(save).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenLastCalledWith(
    'study',
    expect.objectContaining({ title: 'Повторение', minutes: 1 }),
  );
});

it('редактирует оценку без даты и позволяет убрать необязательную дату', async () => {
  const item = {
    id: 1,
    kind: 'assessment',
    payload: { title: 'Контрольная', subject: 'Химия', score: 10, maxScore: 10 },
  };
  const save = vi.fn().mockResolvedValue(undefined);
  render(<Editor editor={{ kind: 'assessment', item }} courses={[]} save={save} close={vi.fn()} />);
  const date = screen.getByLabelText('Дата');
  expect(date).toHaveValue('');
  fireEvent.change(date, { target: { value: '2026-11-11' } });
  fireEvent.change(date, { target: { value: '' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Сохранить' })));
  expect(save).toHaveBeenCalledWith(
    'assessment',
    expect.not.objectContaining({ date: expect.anything() }),
    1,
  );
});

it('после смены аккаунта прекращает выдавать ожидающие напоминания предыдущего пользователя', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T12:00:00'));
  const firstNotification = Promise.withResolvers();
  showReminderNotification.mockReturnValueOnce(firstNotification.promise);
  const item = (id, title) => ({
    id,
    kind: 'reminder',
    payload: { title, date: '2026-11-11', time: '12:00', alertMinutes: 0 },
  });
  const alert = vi.fn();
  const { rerender } = renderHook(({ owner, items }) => useReminders(owner, items, alert), {
    initialProps: {
      owner: user,
      items: [item(1, 'Первое напоминание'), item(2, 'Личное напоминание')],
    },
  });
  expect(alert).toHaveBeenCalledTimes(1);
  rerender({ owner: { id: 2, name: 'Другой студент' }, items: [] });
  await act(async () => firstNotification.resolve(true));
  expect(alert).toHaveBeenCalledTimes(1);
});
