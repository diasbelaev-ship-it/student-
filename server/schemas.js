const { z } = require('zod');
const courseColors = require('../src/course-colors.json').map((color) => color.hex);
const fail = (res, code, message) => res.status(code).json({ error: message });

function parse(schema, value, res) {
  const result = schema.safeParse(value);
  if (!result.success) {
    fail(res, 400, result.error.issues[0]?.message || 'Некорректные данные');
    return null;
  }
  return result.data;
}

const required = (max = 160) => z.string().trim().min(1, 'Заполните обязательное поле').max(max);

const optional = (max = 160) => z.string().trim().max(max).default('');

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата: ГГГГ-ММ-ДД')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, 'Некорректная дата');

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время: ЧЧ:ММ');

const courseId = z.coerce.number().int().positive().optional();

const schemas = {
  course: z.object({
    title: required(),
    teacher: optional(120),
    room: optional(80),
    color: z.enum(courseColors).optional(),
  }),
  grade: z.object({
    title: required(),
    grade: z.coerce.number().min(0).max(4),
    credits: z.coerce.number().positive().max(60),
    type: z.enum(['course', 'exam', 'credit']).default('course'),
    courseId,
  }),
  gpaSetting: z.object({
    title: z.literal('Настройки GPA'),
    scale: z.enum(['linear', 'bands']).default('linear'),
    credits: z
      .record(z.string().min(1).max(160), z.coerce.number().positive().max(60))
      .refine((value) => Object.keys(value).length <= 100, 'Слишком много предметов'),
  }),
  assessment: z
    .object({
      title: required(),
      subject: required(),
      score: z.coerce.number().min(0).max(1000),
      maxScore: z.coerce.number().positive().max(1000),
      type: z.enum(['current', 'test', 'exam', 'credit']).default('current'),
      date: date.optional(),
      note: optional(500),
      courseId,
    })
    .refine((value) => value.score <= value.maxScore, {
      message: 'Балл не может превышать максимум',
      path: ['score'],
    }),
  schedule: z
    .object({
      title: required(),
      day: z.coerce.number().int().min(0).max(6),
      time,
      end: time,
      location: optional(80),
      courseId,
    })
    .refine((v) => v.end > v.time, 'Окончание должно быть позже начала'),
  note: z.object({ title: required(), body: optional(20000), folder: optional(80), courseId }),
  reminder: z.object({
    title: required(),
    date,
    time,
    alertMinutes: z.coerce.number().int().min(0).max(1440).default(15),
    courseId,
  }),
  task: z.object({
    title: required(),
    date: date.optional(),
    status: z.enum(['todo', 'doing', 'done']).default('todo'),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
    courseId,
  }),
  material: z.object({
    title: required(),
    subject: optional(80),
    url: z.union([z.literal(''), z.string().url().startsWith('https://')]).default(''),
    notes: optional(3000),
    courseId,
  }),
  attendance: z.object({
    title: required(),
    date,
    status: z.enum(['present', 'absent', 'excused']),
    courseId,
  }),
  goal: z.object({
    title: required(),
    targetDate: date.optional(),
    progress: z.coerce.number().int().min(0).max(100).default(0),
    courseId,
  }),
  expense: z.object({
    title: required(),
    amount: z.coerce.number().nonnegative().max(100000000),
    date,
    courseId,
  }),
  habit: z.object({
    title: required(),
    frequency: z.enum(['daily', 'weekly']).default('daily'),
    completed: z.coerce.number().int().nonnegative().max(10000).default(0),
    courseId,
  }),
  flashcard: z.object({
    title: required(500),
    answer: required(3000),
    deck: optional(80),
    level: optional(20),
    pronunciation: optional(120),
    example: optional(600),
    exampleTranslation: optional(600),
    note: optional(1200),
    courseId,
  }),
  study: z.object({
    title: required(),
    minutes: z.coerce.number().int().min(1).max(1440),
    date,
    courseId,
  }),
};

const itemSchema = z
  .object({ kind: z.enum(Object.keys(schemas)), payload: z.unknown() })
  .superRefine((value, ctx) => {
    const result = schemas[value.kind].safeParse(value.payload);
    if (!result.success)
      result.error.issues.forEach((issue) =>
        ctx.addIssue({ code: 'custom', message: issue.message, path: ['payload', ...issue.path] }),
      );
  });

module.exports = { parse, required, optional, date, time, courseId, schemas, itemSchema, fail };
