export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error(
      'Нет связи с локальным сервером Studia. Запустите start-studia.cmd в папке проекта и обновите страницу.',
    );
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие');
  return data;
}
export const send = (path, method, body) => api(path, { method, body: JSON.stringify(body) });
