import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Reminder = {
  id: string;
  title: string;
  dateIso: string; // YYYY-MM-DD
  notificationIds?: string[];
  offsetsDays?: number[]; // ex: [7, 1, 0]
  createdAt: number;
};

const STORAGE_KEY = "globalvisa.reminders.v1";

type Ctx = {
  reminders: Reminder[];
  loaded: boolean;
  addReminder: (r: { title: string; dateIso: string; offsetsDays?: number[] }) => Promise<void>;
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

function addDays(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
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
    async ({ title, dateIso, offsetsDays }: { title: string; dateIso: string; offsetsDays?: number[] }) => {
      const dt = parseDateIso(dateIso);
      const id = uid();
      const offsets = (offsetsDays && offsetsDays.length ? offsetsDays : [7, 1, 0]).filter((x) => Number.isFinite(x));
      const notificationIds: string[] = [];

      // Best-effort local notification (web may not support).
      if (dt) {
        try {
          await Notifications.requestPermissionsAsync();
          for (const off of offsets) {
            const trig = addDays(dt, -off);
            if (trig.getTime() <= Date.now()) continue;
            const nid = await Notifications.scheduleNotificationAsync({
              content: { title: "GlobalVisa", body: off === 0 ? title : `${title} (J-${off})` },
              trigger: trig,
            });
            notificationIds.push(nid);
          }
        } catch {
          // ignore
        }
      }

      const next: Reminder = { id, title, dateIso, offsetsDays: offsets, notificationIds, createdAt: Date.now() };
      await persist([next, ...reminders]);
    },
    [persist, reminders]
  );

  const removeReminder = useCallback(
    async (id: string) => {
      const target = reminders.find((r) => r.id === id);
      const next = reminders.filter((r) => r.id !== id);
      await persist(next);
      for (const nid of target?.notificationIds || []) {
        try {
          await Notifications.cancelScheduledNotificationAsync(nid);
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

