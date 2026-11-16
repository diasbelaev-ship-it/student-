// Import only a user-supplied timetable table. No Platonus credentials or session data are handled here.
export function parseScheduleCsv(source) {
  if (typeof source !== 'string' || source.length > 100_000)
    throw Error('Таблица слишком большая (до 100 КБ)');
  const text = source.replace(/^\uFEFF/, '').trim();
  if (!text) throw Error('Вставьте таблицу расписания или выберите CSV-файл');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = ['\t', ';', ','].sort(
    (a, b) => firstLine.split(b).length - firstLine.split(a).length,
  )[0];
  const rows = [];
  let row = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw Error('Не закрыты кавычки в таблице');
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw Error('Нужны строка заголовков и хотя бы одно занятие');
  if (rows.length > 101) throw Error('За один раз можно перенести не более 100 занятий');
  const aliases = {
    day: ['day', 'день', 'день недели', 'апта күні'],
    time: ['time', 'начало', 'время', 'время начала', 'басталуы'],
    end: ['end', 'конец', 'окончание', 'время окончания', 'аяқталуы'],
    title: ['subject', 'title', 'предмет', 'название', 'дисциплина', 'пән'],
    location: ['location', 'аудитория', 'кабинет', 'место', 'аудиториясы'],
  };
  const header = rows.shift().map((v) => v.toLowerCase().replace(/\s+/g, ' ').trim());
  const index = Object.fromEntries(
    Object.entries(aliases).map(([key, names]) => [
      key,
      header.findIndex((v) => names.includes(v)),
    ]),
  );
  if (['day', 'time', 'title'].some((k) => index[k] < 0))
    throw Error('Нужны колонки: день, начало/время, предмет; также конец или диапазон времени');
  const dayNames = [
    'понедельник',
    'вторник',
    'среда',
    'четверг',
    'пятница',
    'суббота',
    'воскресенье',
  ];
  const kazakhDays = ['дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі', 'жексенбі'];
  const normalizeTime = (value) => {
    const match = String(value || '')
      .trim()
      .match(/^(\d{1,2})[:.](\d{2})$/);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return '';
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  };
  return rows.map((r, n) => {
    const rawDay = (r[index.day] || '').toLowerCase().trim();
    const day = /^\d$/.test(rawDay)
      ? Number(rawDay)
      : dayNames.indexOf(rawDay) >= 0
        ? dayNames.indexOf(rawDay)
        : kazakhDays.indexOf(rawDay);
    if (day < 0 || day > 6) throw Error(`Строка ${n + 2}: неверный день недели`);
    const title = (r[index.title] || '').trim();
    const rawTime = r[index.time] || '';
    const range = rawTime.match(/^\s*(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})\s*$/);
    const time = normalizeTime(range ? range[1] : rawTime);
    const end = normalizeTime(range ? range[2] : index.end >= 0 ? r[index.end] : '');
    const location = index.location < 0 ? '' : (r[index.location] || '').trim();
    if (!title || title.length > 160 || !time || !end || end <= time || location.length > 80)
      throw Error(`Строка ${n + 2}: проверьте предмет, время и аудиторию`);
    return { kind: 'schedule', payload: { title, day, time, end, location } };
  });
}
