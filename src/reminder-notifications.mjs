const MINUTE = 60_000;
const LATE_GRACE = 5 * MINUTE;

export function reminderTiming(payload) {
  const eventAt = new Date(`${payload.date}T${payload.time}:00`).getTime();
  const lead = Number(payload.alertMinutes);
  if (!Number.isFinite(eventAt) || !Number.isFinite(lead) || lead < 0) return null;
  return { eventAt, alertAt: eventAt - lead * MINUTE };
}

export function reminderDeliveryKey(userId, item) {
  const { date, time, alertMinutes } = item.payload;
  return `studia-reminder:${userId}:${item.id}:${date}:${time}:${alertMinutes}`;
}

export function dueReminders(items, now, wasDelivered) {
  return items.filter((item) => {
    if (item.kind !== 'reminder') return false;
    const timing = reminderTiming(item.payload);
    return (
      timing && now >= timing.alertAt && now <= timing.eventAt + LATE_GRACE && !wasDelivered(item)
    );
  });
}

let audioContext;

export async function unlockReminderSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return false;
  try {
    audioContext ||= new AudioContextClass();
    if (audioContext.state !== 'running') await audioContext.resume();
    return audioContext.state === 'running';
  } catch {
    return false;
  }
}

export function playReminderSound() {
  if (!audioContext || audioContext.state !== 'running') return false;
  try {
    const start = audioContext.currentTime;
    for (const [delay, frequency] of [
      [0, 660],
      [0.2, 880],
    ]) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + delay);
      gain.gain.exponentialRampToValueAtTime(0.16, start + delay + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.18);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start + delay);
      oscillator.stop(start + delay + 0.19);
    }
    return true;
  } catch {
    return false;
  }
}

export async function showReminderNotification(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const options = { body, tag };
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/notification-sw.js');
      await registration.showNotification(title, options);
      return true;
    } catch {
      /* Fall back to the window notification API. */
    }
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
