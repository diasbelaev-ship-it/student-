const { z } = require('zod');
const crypto = require('node:crypto');
const { db } = require('./db');
const { optional, required, date, schemas, itemSchema } = require('./schemas');
const { normalize, itemFor, present, ownsCourse } = require('./items');
const { account } = require('./auth');

const payloadHash = (payload) => crypto.createHash('sha256').update(String(payload)).digest('hex');
const profileHash = ({ name, sessionDate }) => payloadHash(JSON.stringify({ name, sessionDate }));

const proposalSchema = z.object({
  action: z.enum([
    'create',
    'update',
    'delete',
    'profile',
    'focus',
    'batch',
    'batchUpdate',
    'groupTask',
    'groupMessage',
  ]),
  targetId: z.coerce.number().int().positive().optional(),
  item: z.unknown().optional(),
  profile: z.unknown().optional(),
  focus: z.unknown().optional(),
  items: z.unknown().optional(),
  updates: z.unknown().optional(),
  groupId: z.coerce.number().int().positive().optional(),
  groupTask: z.unknown().optional(),
  groupMessage: z.unknown().optional(),
});
const aiAnswerSchema = z.object({
  message: required(4000),
  proposal: proposalSchema.nullable().optional(),
});
const profileChangeSchema = z
  .object({ name: required(60).optional(), sessionDate: date.nullable().optional() })
  .refine((v) => v.name !== undefined || v.sessionDate !== undefined, 'Нет изменений профиля');
const focusChangeSchema = z.object({
  minutes: z.coerce.number().int().min(1).max(180),
  label: optional(160),
});
const groupTaskAiSchema = z.object({ title: required(100), dueDate: date, course: optional(100) });
const groupMessageAiSchema = z.object({ body: required(2000) });
const memberOfGroup = (groupId, userId) =>
  db.prepare('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?').get(groupId, userId);
const aiFields = {
  course: 'title,teacher,room,color?:hex из палитры Studia',
  schedule: 'title,day:0-6,time:HH:MM,end:HH:MM,location,courseId?:id своего предмета',
  task: 'title,date?:YYYY-MM-DD,status:todo|doing|done,priority:low|normal|high,courseId?',
  grade: 'title,grade:0-4,credits,type:course|exam|credit,courseId? (ручной расчёт GPA)',
  gpaSetting:
    'title="Настройки GPA",scale:linear|bands,credits:{ключ предмета:кредиты} (настройки автоматического GPA)',
  assessment:
    'title,subject,score:0-1000,maxScore:1-1000,type:current|test|exam|credit,date?:YYYY-MM-DD,note,courseId? (оценка в журнале)',
  note: 'title,body,folder,courseId?',
  reminder: 'title,date:YYYY-MM-DD,time:HH:MM,alertMinutes:0-1440,courseId?',
  flashcard: 'title,answer,deck,level,pronunciation,example,exampleTranslation,note,courseId?',
  material: 'title,subject,url:https://... или пустая строка,notes,courseId?',
  attendance: 'title,date:YYYY-MM-DD,status:present|absent|excused,courseId?',
  goal: 'title,targetDate?:YYYY-MM-DD,progress:0-100,courseId?',
  habit: 'title,frequency:daily|weekly,completed:0-10000,courseId?',
  study: 'title,minutes:1-1440,date:YYYY-MM-DD,courseId?',
  expense: 'title,amount,date:YYYY-MM-DD,courseId?',
};
const scheduleKey = (item) =>
  item.kind === 'schedule'
    ? `${Number(item.payload.day)}|${item.payload.time}|${item.payload.end}|${item.payload.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase()}`
    : null;
const unnamedSchedule = (item) =>
  item?.kind === 'schedule' &&
  /^пара\s*\d+\s*[—–-]\s*предмет\s+не\s+указан$/i.test(String(item.payload?.title || '').trim());
const flashcardKey = (item) =>
  item.kind === 'flashcard'
    ? `${item.payload.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase()}|${item.payload.answer.trim().replace(/\s+/g, ' ').toLocaleLowerCase()}`
    : null;
const recordWord = (count) =>
  count % 10 === 1 && count % 100 !== 11
    ? 'запись'
    : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)
      ? 'записи'
      : 'записей';
function existingScheduleKeys(userId) {
  return new Set(
    db
      .prepare("SELECT payload FROM items WHERE user_id=? AND kind='schedule'")
      .all(userId)
      .map((row) => scheduleKey({ kind: 'schedule', payload: JSON.parse(row.payload) })),
  );
}
function existingFlashcardKeys(userId) {
  return new Set(
    db
      .prepare("SELECT payload FROM items WHERE user_id=? AND kind='flashcard'")
      .all(userId)
      .map((row) => flashcardKey({ kind: 'flashcard', payload: JSON.parse(row.payload) })),
  );
}
function normalizeAiItem(raw) {
  if (!raw || typeof raw !== 'object' || !raw.payload || typeof raw.payload !== 'object')
    return normalize(itemSchema.parse(raw));
  const payload = { ...raw.payload };
  if (
    payload.courseId === 0 ||
    payload.courseId === '0' ||
    payload.courseId === '' ||
    payload.courseId === null
  )
    delete payload.courseId;
  return normalize(itemSchema.parse({ ...raw, payload }));
}
function saveAiProposal(raw, userId) {
  const p = proposalSchema.parse(raw);
  let item = null;
  let skipped = 0;
  if (p.action === 'batch') {
    const requested = z.array(z.unknown()).min(1).max(30).parse(p.items).map(normalizeAiItem);
    const existing = existingScheduleKeys(userId),
      existingCards = existingFlashcardKeys(userId),
      seen = new Set();
    const newItems = [];
    for (const candidate of requested) {
      if (!ownsCourse(candidate, userId)) throw Error('Missing owned course');
      const schedule = scheduleKey(candidate),
        card = flashcardKey(candidate),
        key = `${candidate.kind}|${schedule || card || JSON.stringify(candidate.payload)}`;
      if (
        seen.has(key) ||
        (schedule && existing.has(schedule)) ||
        (card && existingCards.has(card))
      ) {
        skipped++;
        continue;
      }
      seen.add(key);
      newItems.push(candidate);
    }
    if (!newItems.length) return { proposal: null, skipped };
    item = newItems;
  }
  if (p.action === 'batchUpdate') {
    const requested = z
      .array(z.object({ targetId: z.coerce.number().int().positive(), item: z.unknown() }))
      .min(1)
      .max(30)
      .parse(p.updates);
    const seen = new Set(),
      updates = [];
    for (const change of requested) {
      if (seen.has(change.targetId)) throw Error('Duplicate update target');
      seen.add(change.targetId);
      const target = itemFor(change.targetId, userId);
      if (!target) throw Error('Missing owned target');
      const before = JSON.parse(target.payload);
      if (
        !change.item ||
        typeof change.item !== 'object' ||
        change.item.kind !== target.kind ||
        !change.item.payload ||
        typeof change.item.payload !== 'object'
      )
        throw Error('Invalid record update');
      const payload = {
        ...before,
        ...change.item.payload,
        ...(target.kind === 'flashcard' ? { title: before.title, answer: before.answer } : {}),
      };
      const updated = normalizeAiItem({ kind: target.kind, payload });
      if (!ownsCourse(updated, userId)) throw Error('Missing owned course');
      if (
        JSON.stringify(updated.payload) ===
        JSON.stringify(normalize({ kind: target.kind, payload: before }).payload)
      ) {
        skipped++;
        continue;
      }
      updates.push({
        targetId: change.targetId,
        item: updated,
        beforeHash: payloadHash(target.payload),
      });
    }
    if (!updates.length) return { proposal: null, skipped };
    item = updates;
  }
  if (p.action === 'create') {
    if (!p.item) throw Error('Missing item');
    item = normalizeAiItem(p.item);
    if (!ownsCourse(item, userId)) throw Error('Missing owned course');
  }
  if (p.action === 'update' || p.action === 'delete') {
    const target = p.targetId && itemFor(p.targetId, userId);
    if (!target) throw Error('Missing owned target');
    const beforeHash = payloadHash(target.payload);
    if (p.action === 'update') {
      if (
        !p.item ||
        p.item.kind !== target.kind ||
        !p.item.payload ||
        typeof p.item.payload !== 'object' ||
        Array.isArray(p.item.payload)
      )
        throw Error('Invalid record update');
      item = normalizeAiItem({
        kind: target.kind,
        payload: { ...JSON.parse(target.payload), ...p.item.payload },
      });
      if (!ownsCourse(item, userId)) throw Error('Missing owned course');
      item.beforeHash = beforeHash;
    } else {
      item = { beforeHash };
    }
  }
  if (p.action === 'profile') {
    const change = profileChangeSchema.parse(p.profile);
    const current = account(db.prepare('SELECT * FROM users WHERE id=?').get(userId));
    item = {
      kind: 'profile',
      beforeHash: profileHash(current),
      payload: {
        name: change.name ?? current.name,
        sessionDate: change.sessionDate === undefined ? current.sessionDate : change.sessionDate,
      },
    };
  }
  if (p.action === 'focus') item = { kind: 'focus', payload: focusChangeSchema.parse(p.focus) };
  if (p.action === 'groupTask' || p.action === 'groupMessage') {
    if (!p.groupId || !memberOfGroup(p.groupId, userId)) throw Error('Missing owned group');
    const group = db.prepare('SELECT name FROM study_groups WHERE id=?').get(p.groupId);
    item = {
      kind: p.action,
      groupId: p.groupId,
      groupName: group.name,
      payload:
        p.action === 'groupTask'
          ? groupTaskAiSchema.parse(p.groupTask)
          : groupMessageAiSchema.parse(p.groupMessage),
    };
  }
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO proposals(id,user_id,action,target_id,item,expires_at) VALUES(?,?,?,?,?,?)',
  ).run(
    id,
    userId,
    p.action,
    p.targetId || null,
    item ? JSON.stringify(item) : null,
    Date.now() + 600000,
  );
  return {
    proposal: {
      id,
      action: p.action,
      targetId: p.targetId,
      ...(p.action === 'batch'
        ? { items: item, skipped }
        : p.action === 'batchUpdate'
          ? {
              updates: item.map(({ targetId, item: updated }) => ({ targetId, item: updated })),
              skipped,
            }
          : { item }),
    },
    skipped,
  };
}

module.exports = {
  proposalSchema,
  aiAnswerSchema,
  profileChangeSchema,
  focusChangeSchema,
  groupTaskAiSchema,
  groupMessageAiSchema,
  memberOfGroup,
  aiFields,
  scheduleKey,
  unnamedSchedule,
  flashcardKey,
  recordWord,
  existingScheduleKeys,
  existingFlashcardKeys,
  normalizeAiItem,
  saveAiProposal,
  payloadHash,
  profileHash,
};
