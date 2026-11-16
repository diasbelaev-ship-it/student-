import { useEffect } from 'react';
import {
  dueReminders,
  reminderDeliveryKey,
  playReminderSound,
  showReminderNotification,
  unlockReminderSound,
} from '../reminder-notifications.mjs';

const deliveredAlerts = new Set();

function soundEnabled() {
  try {
    return localStorage.getItem('studia-sound') !== 'off';
  } catch {
    return true;
  }
}

export function useReminders(user, items, setReminderAlert) {
  useEffect(() => {
    if (!user) return undefined;
    const unlock = () => {
      if (soundEnabled()) void unlockReminderSound();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return undefined;
    let checking = false;
    let stopped = false;
    async function check() {
      if (stopped || checking) return;
      checking = true;
      try {
        for (const item of dueReminders(items, Date.now(), (record) => {
          const key = reminderDeliveryKey(user.id, record);
          try {
            return deliveredAlerts.has(key) || localStorage.getItem(key) === '1';
          } catch {
            return deliveredAlerts.has(key);
          }
        })) {
          if (stopped) break;
          const key = reminderDeliveryKey(user.id, item);
          deliveredAlerts.add(key);
          try {
            localStorage.setItem(key, '1');
          } catch {}
          setReminderAlert({ title: item.payload.title, time: item.payload.time });
          if (soundEnabled()) playReminderSound();
          await showReminderNotification(item.payload.title, `Событие в ${item.payload.time}`, key);
        }
      } finally {
        checking = false;
      }
    }
    const wake = () => {
      if (!document.hidden) void check();
    };
    void check();
    const timer = setInterval(() => void check(), 10000);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
    };
  }, [items, user?.id, setReminderAlert]);
}
