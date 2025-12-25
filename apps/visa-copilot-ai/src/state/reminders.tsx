import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Reminder = {
  id: string;
  title: string;
  dateIso: string; // YYYY-MM-DD
  notificationId?: string;
  createdAt: number;
};

const STORAGE_KEY = "globalvisa.reminders.v1";

type Ctx = {
  reminders: Reminder[];
  loaded: boolean;
  addReminder: (r: { title: string; dateIso: string }) => Promise<void>;
  removeReminder: (id: string) => Promise<void>;
};

const RemindersContext = createContext<Ctx | null>(null);

function uid() {
  return `rem_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function parseDateIso(dateIso: string): Date | null {
  const s = dateIso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 9, 0, 0);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setReminders(JSON.parse(raw));
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: Reminder[]) => {
    setReminders(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addReminder = useCallback(
    async ({ title, dateIso }: { title: string; dateIso: string }) => {
      const dt = parseDateIso(dateIso);
      const id = uid();
      let notificationId: string | undefined;

      // Best-effort local notification (web may not support).
      if (dt && dt.getTime() > Date.now()) {
        try {
          await Notifications.requestPermissionsAsync();
          notificationId = await Notifications.scheduleNotificationAsync({
            content: { title: "GlobalVisa", body: title },
            trigger: dt,
          });
        } catch {
          // ignore
        }
      }

      const next: Reminder = { id, title, dateIso, notificationId, createdAt: Date.now() };
      await persist([next, ...reminders]);
    },
    [persist, reminders]
  );

  const removeReminder = useCallback(
    async (id: string) => {
      const target = reminders.find((r) => r.id === id);
      const next = reminders.filter((r) => r.id !== id);
      await persist(next);
      if (target?.notificationId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(target.notificationId);
        } catch {
          // ignore
        }
      }
    },
    [persist, reminders]
  );

  const value = useMemo(() => ({ reminders, loaded, addReminder, removeReminder }), [reminders, loaded, addReminder, removeReminder]);
  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}

export function useReminders() {
  const ctx = useContext(RemindersContext);
  if (!ctx) throw new Error("useReminders must be used within RemindersProvider");
  return ctx;
}

