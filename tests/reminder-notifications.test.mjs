import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dueReminders,
  reminderDeliveryKey,
  reminderTiming,
} from '../src/reminder-notifications.mjs';

const item = (id, time, alertMinutes = 15) => ({
  id,
  kind: 'reminder',
  payload: { title: 'Пара', date: '2026-10-25', time, alertMinutes },
});

test('each lead time fires at the selected local minute', () => {
  for (const lead of [0, 5, 15, 30, 60]) {
    const reminder = item(lead, '12:00', lead);
    const { alertAt } = reminderTiming(reminder.payload);
    assert.deepEqual(
      dueReminders([reminder], alertAt - 1, () => false),
      [],
    );
    assert.deepEqual(
      dueReminders([reminder], alertAt, () => false),
      [reminder],
    );
  }
});

test('a sleeping tab catches up before the event and briefly after it', () => {
  const reminder = item(1, '12:00', 30);
  const { eventAt } = reminderTiming(reminder.payload);
  assert.deepEqual(
    dueReminders([reminder], eventAt - 1, () => false),
    [reminder],
  );
  assert.deepEqual(
    dueReminders([reminder], eventAt + 5 * 60_000, () => false),
    [reminder],
  );
  assert.deepEqual(
    dueReminders([reminder], eventAt + 5 * 60_000 + 1, () => false),
    [],
  );
});

test('delivery is scoped to user and reminder settings', () => {
  const reminder = item(1, '12:00');
  const first = reminderDeliveryKey(10, reminder);
  assert.notEqual(first, reminderDeliveryKey(11, reminder));
  assert.notEqual(first, reminderDeliveryKey(10, item(1, '12:05')));
  assert.notEqual(first, reminderDeliveryKey(10, item(1, '12:00', 5)));
});
