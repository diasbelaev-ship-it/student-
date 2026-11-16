import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api.js', () => ({ api: vi.fn() }));

import { api } from '../../src/api.js';
import { useItems } from '../../src/hooks/useItems.js';

describe('загрузка записей', () => {
  beforeEach(() => vi.clearAllMocks());

  it('принимает старый формат API со списком без пагинации', async () => {
    const records = [{ id: 1, kind: 'course', payload: { title: 'Математика' } }];
    const onError = vi.fn();
    api.mockResolvedValue(records);
    const { result } = renderHook(() => useItems(onError));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.items).toEqual(records);
    expect(onError).not.toHaveBeenCalled();
  });

  it('загружает все страницы нового API по курсору', async () => {
    const first = { id: 1, kind: 'course', payload: { title: 'Математика' } };
    const second = { id: 2, kind: 'schedule', payload: { title: 'Физика' } };
    api
      .mockResolvedValueOnce({ items: [first], nextCursor: 'cursor-2' })
      .mockResolvedValueOnce({ items: [second], nextCursor: null });
    const { result } = renderHook(() => useItems(vi.fn()));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.items).toEqual([first, second]);
    expect(api).toHaveBeenCalledTimes(2);
  });

  it('после сохранения во время загрузки получает все страницы без устаревших данных', async () => {
    const olderPage = Promise.withResolvers();
    const first = { id: 1, kind: 'course', payload: { title: 'Математика' } };
    const saved = { id: 2, kind: 'note', payload: { title: 'Новая запись' } };
    const old = { id: 3, kind: 'schedule', payload: { title: 'Старая пара' } };
    api
      .mockResolvedValueOnce({ items: [first], nextCursor: 'before-write' })
      .mockReturnValueOnce(olderPage.promise)
      .mockResolvedValueOnce({ items: [saved, first], nextCursor: 'after-write' })
      .mockResolvedValueOnce({ items: [old], nextCursor: null });
    const onError = vi.fn();
    const { result } = renderHook(() => useItems(onError));
    await act(async () => {
      void result.current.refresh();
    });
    await act(async () => result.current.setItems((current) => [saved, ...current]));
    await act(async () => olderPage.reject(new Error('Старый запрос больше не нужен')));

    expect(result.current.items).toEqual([saved, first, old]);
    expect(onError).not.toHaveBeenCalled();
  });
});
