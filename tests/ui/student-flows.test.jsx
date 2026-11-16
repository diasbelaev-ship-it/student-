import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../src/api.js', () => ({
  api: vi.fn(),
  send: vi.fn(),
}));

import { api, send } from '../../src/api.js';
import { Auth } from '../../src/components/SharedComponents.jsx';
import ScheduleImport from '../../src/ScheduleImport.jsx';
import JournalView from '../../src/JournalView.jsx';
import GpaView from '../../src/GpaView.jsx';
import AiProposalCard from '../../src/AiProposalCard.jsx';
import { Assistant } from '../../src/sections/Assistant.jsx';
import { SearchDialog } from '../../src/components/GlobalSearch.jsx';
import { Editor } from '../../src/components/RecordEditor.jsx';
import AppShell from '../../src/AppShell.jsx';
import GroupWorkspace from '../../src/GroupWorkspace.jsx';

const course = { id: 12, kind: 'course', payload: { title: 'Математика', color: '#ba654f' } };
const physics = { id: 13, kind: 'course', payload: { title: 'Физика, оптика', color: '#567DA6' } };
const schedule = {
  id: 20,
  kind: 'schedule',
  payload: { title: 'Математика', day: 0, time: '09:00', end: '10:30', courseId: 12 },
};
const assessment = {
  id: 30,
  kind: 'assessment',
  payload: {
    title: 'Контрольная',
    subject: 'Математика',
    score: 90,
    maxScore: 100,
    type: 'test',
    courseId: 12,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

describe('студенческие сценарии интерфейса', () => {
  it('вставляет скопированное изображение в ИИ-чат и отправляет его Gemini', async () => {
    send
      .mockRejectedValueOnce(new Error('Gemini временно недоступен.'))
      .mockResolvedValueOnce({ message: 'На изображении задание по математике.' });
    const toast = vi.fn();
    const image = new File([new Uint8Array([137, 80, 78, 71])], 'clipboard.png', {
      type: 'image/png',
    });
    render(
      <Assistant
        items={[]}
        refresh={vi.fn()}
        toast={toast}
        setUser={vi.fn()}
        user={{ id: 1, name: 'Диас' }}
      />,
    );

    const composer = screen.getByLabelText('Сообщение помощнику');
    fireEvent.paste(composer, {
      clipboardData: {
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
      },
    });

    expect(await screen.findByRole('button', { name: 'Удалить изображение' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить изображение' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Удалить изображение' })).toBeNull(),
    );

    fireEvent.paste(composer, {
      clipboardData: {
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
      },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        '/api/ai',
        'POST',
        expect.objectContaining({
          message: '',
          images: [
            expect.objectContaining({
              mimeType: 'image/png',
              data: expect.stringMatching(/^[A-Za-z0-9+/]+=*$/),
            }),
          ],
        }),
      ),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Gemini временно недоступен.');
    expect(screen.getByRole('button', { name: 'Удалить изображение' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(await screen.findByText('На изображении задание по математике.')).toBeInTheDocument();
    expect(send.mock.calls[1]).toEqual(send.mock.calls[0]);
    expect(toast).not.toHaveBeenCalled();
  });

  it('вход передаёт успешную сессию приложению', async () => {
    const onSuccess = vi.fn();
    send.mockResolvedValue({ user: { id: 1, name: 'Диас', email: 'dias@example.test' } });
    render(<Auth onSuccess={onSuccess} />);
    fireEvent.change(screen.getByPlaceholderText('student@example.com'), {
      target: { value: 'dias@example.test' },
    });
    fireEvent.change(screen.getByPlaceholderText('Не менее 8 символов'), {
      target: { value: 'Student-password-1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 1 })));
  });

  it('экран сброса читает одноразовый токен из hash и очищает адрес', async () => {
    window.history.replaceState(null, '', '/#reset=reset-token-0123456789');
    send.mockResolvedValue({ message: 'Пароль обновлён' });
    render(<Auth onSuccess={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Новый пароль' })).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    fireEvent.change(screen.getByPlaceholderText('Не менее 8 символов'), {
      target: { value: 'Student-password-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Обновить пароль' }));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith('/api/auth/reset', 'POST', {
        token: 'reset-token-0123456789',
        password: 'Student-password-2026!',
      }),
    );
  });

  it('принимает целую ссылку подтверждения и не падает на повреждённом URL', async () => {
    window.history.replaceState(null, '', '/#verify=%E0%A4%A');
    send.mockResolvedValueOnce({ message: 'Email подтверждён' });
    render(<Auth onSuccess={vi.fn()} />);
    expect(window.location.hash).toBe('');
    fireEvent.change(screen.getByLabelText('Код из письма'), {
      target: { value: 'http://localhost:5173/#verify=test-verification-token-12345' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить email' }));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith('/api/auth/verify', 'POST', {
        token: 'test-verification-token-12345',
      }),
    );
  });

  it('создание предмета сохраняет название и выбранный цвет', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<Editor editor={{ kind: 'course' }} courses={[]} close={vi.fn()} save={save} />);
    fireEvent.change(screen.getByLabelText('Название предмета'), {
      target: { value: 'Физика' },
    });
    fireEvent.click(screen.getByLabelText('Терракота'));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        'course',
        expect.objectContaining({
          title: 'Физика',
          color: '#B96B58',
        }),
        undefined,
      ),
    );
  });

  it('импорт расписания показывает предпросмотр, пропускает дубли и связывает предмет', async () => {
    const refresh = vi.fn();
    const close = vi.fn();
    send.mockResolvedValue({ id: 100 });
    render(
      <ScheduleImport
        courses={[course, physics]}
        existing={[schedule]}
        refresh={refresh}
        close={close}
        toast={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Таблица занятий'), {
      target: {
        value:
          'апта күні;басталуы;аяқталуы;пән\nДүйсенбі;09:00;10:30;Математика\nСейсенбі;11:00;12:30;"Физика, оптика"',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить таблицу' }));
    expect(await screen.findByText('Предпросмотр: 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить 1 занятий' }));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        '/api/items',
        'POST',
        expect.objectContaining({
          payload: expect.objectContaining({ title: 'Физика, оптика', courseId: 13 }),
        }),
      ),
    );
    expect(refresh).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('журнал объединяет предмет из расписания и считает GPA существующих оценок', () => {
    const items = [course, schedule, assessment];
    const open = vi.fn();
    const { rerender } = render(
      <JournalView items={items} open={open} remove={vi.fn()} navigate={vi.fn()} />,
    );
    expect(screen.getByText('Оценки по вашим предметам')).toBeInTheDocument();
    expect(screen.getByText('Математика', { selector: 'h3' })).toBeInTheDocument();
    expect(document.querySelector('.journal-hero-stats')).toHaveTextContent('1');
    rerender(
      <GpaView
        items={items}
        save={vi.fn()}
        open={open}
        remove={vi.fn()}
        navigate={vi.fn()}
        toast={vi.fn()}
      />,
    );
    expect(screen.getByText('Предварительный GPA')).toBeInTheDocument();
    expect(document.querySelector('.gpa-auto-hero strong')).toHaveTextContent('3.60');
    rerender(
      <GpaView
        items={[]}
        save={vi.fn()}
        open={open}
        remove={vi.fn()}
        navigate={vi.fn()}
        toast={vi.fn()}
      />,
    );
    expect(document.querySelector('.gpa-auto-hero strong')).toHaveTextContent('—');
  });

  it('предложение ИИ требует явного решения: подтверждение или отмена', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const proposal = {
      action: 'create',
      item: {
        kind: 'task',
        payload: {
          title: 'Подготовить доклад',
          status: 'todo',
          priority: 'normal',
        },
      },
    };
    const { rerender } = render(
      <AiProposalCard proposal={proposal} courses={[]} onConfirm={onConfirm} onCancel={onCancel} />,
    );
    expect(
      screen.getByText('ИИ ничего не изменит, пока вы не подтвердите действие.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onCancel).toHaveBeenCalledOnce();
    rerender(
      <AiProposalCard proposal={proposal} courses={[]} onConfirm={onConfirm} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('переносит общий дедлайн группы в личный план', async () => {
    const entry = {
      id: 4,
      title: 'Сдать проект',
      dueDate: '2026-11-10',
      course: 'Математика',
      author: 'Алия',
    };
    api.mockImplementation((path) =>
      Promise.resolve(
        path === '/api/groups'
          ? [{ id: 7, name: 'Группа А' }]
          : {
              group: { id: 7, name: 'Группа А', inviteCode: 'ABCDEFGH', creatorId: 1 },
              members: [{ id: 1, name: 'Диас' }],
              messages: [],
              tasks: [entry],
              files: [],
            },
      ),
    );
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <GroupWorkspace
        user={{ id: 1, name: 'Диас' }}
        items={[course]}
        save={save}
        toast={vi.fn()}
        selectedGroupId={7}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /В мой план/ }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        'task',
        expect.objectContaining({
          title: 'Сдать проект',
          date: '2026-11-10',
          courseId: 12,
        }),
      ),
    );
  });

  it('поиск находит сохранённую запись, а мобильная навигация открывает все разделы', () => {
    const choose = vi.fn();
    const { unmount } = render(
      <SearchDialog
        items={[{ id: 1, kind: 'task', payload: { title: 'Сдать проект' } }]}
        close={vi.fn()}
        choose={choose}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Найти предмет/), { target: { value: 'проект' } });
    fireEvent.click(screen.getByRole('button', { name: /Сдать проект/ }));
    expect(choose).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    unmount();
    const props = {
      user: { id: 1, name: 'Диас', email: 'dias@example.test' },
      items: [],
      page: 'profile',
      setPage: vi.fn(),
      setUser: vi.fn(),
      setItems: vi.fn(),
      selectedCourseId: null,
      setSelectedCourseId: vi.fn(),
      selectedGroupId: null,
      editor: null,
      setEditor: vi.fn(),
      toast: '',
      setToast: vi.fn(),
      reminderAlert: null,
      setReminderAlert: vi.fn(),
      menu: false,
      setMenu: vi.fn(),
      more: false,
      setMore: vi.fn(),
      searchOpen: false,
      setSearchOpen: vi.fn(),
      logout: vi.fn(),
      navigate: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
      update: vi.fn(),
      refresh: vi.fn(),
    };
    const view = render(<AppShell {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Все разделы' }));
    expect(screen.getByRole('navigation', { name: 'Разделы' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Разделы' })).getByText('Журнал оценок'),
    ).toBeInTheDocument();
    view.unmount();
  });
});
