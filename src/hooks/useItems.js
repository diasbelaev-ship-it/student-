import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

function normalizePage(response) {
  if (Array.isArray(response)) return { items: response, nextCursor: null };
  if (response && Array.isArray(response.items)) return response;
  throw new Error('Сервер вернул некорректный список записей. Обновите страницу.');
}

export function useItems(onError) {
  const [items, setRecords] = useState([]);
  const activeRequest = useRef(null);
  useEffect(() => () => activeRequest.current?.abort(), []);

  const setItems = (value) => {
    setRecords(value);
    if (!activeRequest.current) return;
    if (typeof value === 'function') {
      // The write may reorder cursor pages. Reload from the first page after it commits.
      void refresh();
    } else {
      activeRequest.current.abort();
      activeRequest.current = null;
    }
  };

  async function refresh() {
    activeRequest.current?.abort();
    const request = new AbortController();
    activeRequest.current = request;
    try {
      const records = new Map();
      const seenCursors = new Set();
      let cursor;
      do {
        const query = new URLSearchParams({ limit: '200' });
        if (cursor) query.set('cursor', cursor);
        const response = await api(`/api/items?${query.toString()}`, { signal: request.signal });
        if (request.signal.aborted) return null;
        const page = normalizePage(response);
        for (const record of page.items) records.set(record.id, record);
        cursor = page.nextCursor;
        if (cursor && seenCursors.has(cursor)) throw new Error('Сервер повторил страницу записей.');
        seenCursors.add(cursor);
      } while (cursor);
      const next = [...records.values()];
      setRecords(next);
      return next;
    } catch (error) {
      if (!request.signal.aborted) onError(error.message);
      return null;
    } finally {
      if (activeRequest.current === request) activeRequest.current = null;
    }
  }

  return { items, setItems, refresh };
}
