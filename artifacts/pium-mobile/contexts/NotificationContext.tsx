import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const SETTINGS_KEY = 'pium_notification_settings';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface SchedulableTodo {
  id: number;
  title: string;
  dueDate: string;
}

export interface SchedulableClass {
  id: string;
  subject: string;
  dayOfWeek: number;
  startTime: string;
}

export interface SchedulableAcademic {
  id: string;
  title: string;
  date: string;
}

interface NotificationCtx {
  unreadCount: number;
  refreshUnread: () => void;
  scheduleTodoNotification: (todo: SchedulableTodo) => Promise<void>;
  cancelTodoNotification: (todoId: number) => Promise<void>;
  scheduleAcademicNotification: (item: SchedulableAcademic) => Promise<void>;
  cancelAcademicNotification: (itemId: string) => Promise<void>;
  scheduleClassNotifications: (classes: SchedulableClass[]) => Promise<void>;
}

const NotificationContext = createContext<NotificationCtx>({
  unreadCount: 0,
  refreshUnread: () => {},
  scheduleTodoNotification: async () => {},
  cancelTodoNotification: async () => {},
  scheduleAcademicNotification: async () => {},
  cancelAcademicNotification: async () => {},
  scheduleClassNotifications: async () => {},
});

async function getSettings(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const authHeader = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const refreshUnread = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: authHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
      }
    } catch {}
  }, [token, authHeader]);

  const registerPushToken = useCallback(async () => {
    if (Platform.OS === 'web' || !token) return;
    try {
      const expoPushToken = await Notifications.getExpoPushTokenAsync();
      await fetch(`${API_BASE}/notifications/push-token`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ token: expoPushToken.data, platform: Platform.OS }),
      });
    } catch {}
  }, [token, authHeader]);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }

    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') await registerPushToken();
      }
      await refreshUnread();
    })();

    notifListener.current = Notifications.addNotificationReceivedListener(() => {
      refreshUnread();
    });
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      refreshUnread();
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(refreshUnread, 60_000);
    return () => clearInterval(interval);
  }, [user, refreshUnread]);

  const scheduleTodoNotification = useCallback(async (todo: SchedulableTodo) => {
    if (Platform.OS === 'web' || !todo.dueDate) return;
    const settings = await getSettings();
    if (!settings.todo_deadline) return;
    try {
      const key = `todo_notif_${todo.id}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing) await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});

      const notifDate = new Date(todo.dueDate);
      notifDate.setDate(notifDate.getDate() - 1);
      notifDate.setHours(9, 0, 0, 0);
      if (notifDate <= new Date()) return;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📋 할 일 마감 알림',
          body: `내일 마감: ${todo.title}`,
          data: { type: 'todo', todoId: todo.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notifDate,
        },
      });
      await AsyncStorage.setItem(key, id);
    } catch {}
  }, []);

  const cancelTodoNotification = useCallback(async (todoId: number) => {
    if (Platform.OS === 'web') return;
    try {
      const key = `todo_notif_${todoId}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing) {
        await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
        await AsyncStorage.removeItem(key);
      }
    } catch {}
  }, []);

  const scheduleAcademicNotification = useCallback(async (item: SchedulableAcademic) => {
    if (Platform.OS === 'web' || !item.date) return;
    const settings = await getSettings();
    if (!settings.academic_favorite) return;
    try {
      const key = `academic_notif_${item.id}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing) await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});

      const notifDate = new Date(item.date);
      notifDate.setDate(notifDate.getDate() - 1);
      notifDate.setHours(9, 0, 0, 0);
      if (notifDate <= new Date()) return;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📅 학사일정 알림',
          body: `내일: ${item.title}`,
          data: { type: 'academic', itemId: item.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notifDate,
        },
      });
      await AsyncStorage.setItem(key, id);
    } catch {}
  }, []);

  const cancelAcademicNotification = useCallback(async (itemId: string) => {
    if (Platform.OS === 'web') return;
    try {
      const key = `academic_notif_${itemId}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing) {
        await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
        await AsyncStorage.removeItem(key);
      }
    } catch {}
  }, []);

  const scheduleClassNotifications = useCallback(async (classes: SchedulableClass[]) => {
    if (Platform.OS === 'web') return;
    const settings = await getSettings();

    const existingRaw = await AsyncStorage.getItem('class_notif_ids');
    if (existingRaw) {
      const ids: string[] = JSON.parse(existingRaw);
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      }
      await AsyncStorage.removeItem('class_notif_ids');
    }

    if (!settings.class_before) return;

    const newIds: string[] = [];
    for (const cls of classes) {
      try {
        const [hourStr, minuteStr] = cls.startTime.split(':');
        let hour = parseInt(hourStr);
        let minute = parseInt(minuteStr) - 15;
        if (minute < 0) { minute += 60; hour -= 1; }
        if (hour < 0) continue;

        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: '📚 수업 시작 알림',
            body: `15분 후 ${cls.subject} 수업이 시작됩니다`,
            data: { type: 'class', classId: cls.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: cls.dayOfWeek,
            hour,
            minute,
          },
        });
        newIds.push(id);
      } catch {}
    }
    if (newIds.length > 0) {
      await AsyncStorage.setItem('class_notif_ids', JSON.stringify(newIds));
    }
  }, []);

  return (
    <NotificationContext.Provider value={{
      unreadCount,
      refreshUnread,
      scheduleTodoNotification,
      cancelTodoNotification,
      scheduleAcademicNotification,
      cancelAcademicNotification,
      scheduleClassNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
