import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type VisaStage = "research" | "application" | "appointment" | "biometrics" | "submission" | "waiting" | "decision" | "completed" | "other";

export type VisaCase = {
  id: string;
  country: string;
  visaType: string;
  objective?: string;
  stage?: VisaStage;
  createdAt: number;
  updatedAt: number;
};

export type VisaEventType =
  | "appointment"
  | "biometrics"
  | "submission"
  | "deadline"
  | "payment"
  | "passport_collection"
  | "visa_validity"
  | "entry_deadline"
  | "other";

export type EventStatus = "upcoming" | "completed" | "overdue";

export type ChangeRecord = {
  ts: number;
  by: "system" | "user";
  action: "created" | "edited_date" | "marked_completed" | "deleted" | "confirmed" | "ignored";
  from?: any;
  to?: any;
};

export type VisaEvent = {
  id: string;
  visaId: string;
  type: VisaEventType;
  title: string;
  notes?: string;
  meta?: any;
  dateIso?: string; // YYYY-MM-DD (single date)
  startDateIso?: string; // for ranges
  endDateIso?: string;
  tentative: boolean;
  source: "detected" | "manual";
  sourceUrl?: string;
  userEdited: boolean;
  status: EventStatus;
  createdAt: number;
  updatedAt: number;
  history: ChangeRecord[];
  reminders: Array<{ offsetDays: number; notificationId?: string; fireDateIso: string; priority: "low" | "medium" | "high" }>;
};

export type PendingDetection = {
  id: string;
  visaId: string;
  type: VisaEventType;
  title: string;
  dateIso?: string;
  startDateIso?: string;
  endDateIso?: string;
  snippet?: string;
  sourceUrl?: string;
  detectedAt: number;
};

export type TimelineState = {
  visas: VisaCase[];
  events: VisaEvent[];
  pending: PendingDetection[];
  procedure?: Record<string, { completedStepIds: string[]; updatedAt: number }>;
  settings?: {
    silentMode: boolean; // true = notifications UI minimal; validations in dashboard
  };
};

const STORAGE_KEY = "globalvisa.timeline.v1";

type Ctx = {
  state: TimelineState;
  loaded: boolean;

  upsertVisa: (v: { country: string; visaType: string; objective?: string; stage?: VisaStage }) => Promise<string>;

  addManualEvent: (args: {
    visaId: string;
    title: string;
    type: VisaEventType;
    dateIso?: string;
    startDateIso?: string;
    endDateIso?: string;
    priority?: "low" | "medium" | "high";
    notes?: string;
    meta?: any;
  }) => Promise<void>;

  addPendingDetection: (d: Omit<PendingDetection, "id" | "detectedAt">) => Promise<string>;
  resolvePendingDetection: (id: string, action: "save" | "edit" | "ignore", edited?: { dateIso?: string; startDateIso?: string; endDateIso?: string }) => Promise<void>;

  editEventDate: (eventId: string, edited: { dateIso?: string; startDateIso?: string; endDateIso?: string }) => Promise<void>;
  markEventCompleted: (eventId: string) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;

  toggleProcedureStep: (visaId: string, stepId: string) => Promise<void>;

  setSilentMode: (enabled: boolean) => Promise<void>;
};

const TimelineContext = createContext<Ctx | null>(null);

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function compareIso(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function computeStatus(dateIso?: string): EventStatus {
  if (!dateIso) return "upcoming";
  const t = todayIso();
  if (compareIso(dateIso, t) < 0) return "overdue";
  return "upcoming";
}

function offsetsDefault() {
  return [14, 7, 3, 1, 0];
}

function priorityForOffset(off: number): "low" | "medium" | "high" {
  if (off >= 14) return "low";
  if (off >= 7) return "medium";
  return "high";
}

async function scheduleReminders(title: string, dateIso: string, offsets: number[]) {
  const dt = parseDateIso(dateIso);
  const out: Array<{ offsetDays: number; notificationId?: string; fireDateIso: string; priority: "low" | "medium" | "high" }> = [];
  if (!dt) return out;
  try {
    await Notifications.requestPermissionsAsync();
  } catch {
    // ignore
  }
  for (const off of offsets) {
    const trig = addDays(dt, -off);
    const fireIso = `${trig.getFullYear()}-${String(trig.getMonth() + 1).padStart(2, "0")}-${String(trig.getDate()).padStart(2, "0")}`;
    if (trig.getTime() <= Date.now()) {
      out.push({ offsetDays: off, fireDateIso: fireIso, priority: priorityForOffset(off) });
      continue;
    }
    let nid: string | undefined;
    try {
      nid = await Notifications.scheduleNotificationAsync({
        content: {
          title: "GlobalVisa",
          body: off === 0 ? title : `${title} (J-${off})`,
        },
        trigger: trig,
      });
    } catch {
      nid = undefined;
    }
    out.push({ offsetDays: off, notificationId: nid, fireDateIso: fireIso, priority: priorityForOffset(off) });
  }
  return out;
}

async function cancelEventReminders(reminders: VisaEvent["reminders"]) {
  for (const r of reminders || []) {
    if (!r.notificationId) continue;
    try {
      await Notifications.cancelScheduledNotificationAsync(r.notificationId);
    } catch {
      // ignore
    }
  }
}

export function VisaTimelineProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TimelineState>({ visas: [], events: [], pending: [], procedure: {}, settings: { silentMode: true } });
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
        if (raw) {
          const parsed = JSON.parse(raw);
          setState({
            visas: Array.isArray(parsed?.visas) ? parsed.visas : [],
            events: Array.isArray(parsed?.events) ? parsed.events : [],
            pending: Array.isArray(parsed?.pending) ? parsed.pending : [],
            procedure: typeof parsed?.procedure === "object" && parsed?.procedure ? parsed.procedure : {},
            settings: { silentMode: parsed?.settings?.silentMode !== false },
          });
        } else {
          setState({ visas: [], events: [], pending: [], procedure: {}, settings: { silentMode: true } });
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: TimelineState) => {
    setState(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const upsertVisa = useCallback(
    async ({ country, visaType, objective, stage }: { country: string; visaType: string; objective?: string; stage?: VisaStage }) => {
      const c = country.trim().toLowerCase();
      const v = visaType.trim();
      const key = `${c}__${v}`.toLowerCase();
      const existing = state.visas.find((x) => `${x.country}__${x.visaType}`.toLowerCase() === key);
      const now = Date.now();
      if (existing) {
        const updated: VisaCase = { ...existing, objective: objective ?? existing.objective, stage: stage ?? existing.stage, updatedAt: now };
        const next = { ...state, visas: state.visas.map((x) => (x.id === existing.id ? updated : x)) };
        await persist(next);
        return existing.id;
      }
      const id = uid("visa");
      const nextVisa: VisaCase = { id, country: c || "unknown", visaType: v || "unknown", objective, stage, createdAt: now, updatedAt: now };
      await persist({ ...state, visas: [nextVisa, ...state.visas] });
      return id;
    },
    [persist, state]
  );

  const addEventInternal = useCallback(
    async (args: {
      visaId: string;
      type: VisaEventType;
      title: string;
      notes?: string;
      meta?: any;
      dateIso?: string;
      startDateIso?: string;
      endDateIso?: string;
      tentative: boolean;
      source: "detected" | "manual";
      sourceUrl?: string;
      markConfirmed?: boolean;
      by: "system" | "user";
    }) => {
      const now = Date.now();
      const id = uid("evt");

      const chosenDate = args.dateIso || args.startDateIso; // range: reminders attach to start for MVP
      const reminders = !args.tentative && chosenDate ? await scheduleReminders(args.title, chosenDate, offsetsDefault()) : [];

      const ev: VisaEvent = {
        id,
        visaId: args.visaId,
        type: args.type,
        title: args.title,
        notes: args.notes,
        meta: args.meta,
        dateIso: args.dateIso,
        startDateIso: args.startDateIso,
        endDateIso: args.endDateIso,
        tentative: args.tentative,
        source: args.source,
        sourceUrl: args.sourceUrl,
        userEdited: false,
        status: computeStatus(args.dateIso || args.startDateIso),
        createdAt: now,
        updatedAt: now,
        history: [
          { ts: now, by: args.by, action: "created", to: { dateIso: args.dateIso, startDateIso: args.startDateIso, endDateIso: args.endDateIso } },
          ...(args.markConfirmed ? [{ ts: now, by: args.by, action: "confirmed" as const }] : []),
        ],
        reminders,
      };

      await persist({ ...state, events: [ev, ...state.events] });
    },
    [persist, state]
  );

  const addManualEvent = useCallback(
    async (args: {
      visaId: string;
      title: string;
      type: VisaEventType;
      dateIso?: string;
      startDateIso?: string;
      endDateIso?: string;
      priority?: "low" | "medium" | "high";
      notes?: string;
      meta?: any;
    }) => {
      await addEventInternal({
        visaId: args.visaId,
        type: args.type,
        title: args.title,
        notes: args.notes,
        meta: args.meta,
        dateIso: args.dateIso,
        startDateIso: args.startDateIso,
        endDateIso: args.endDateIso,
        tentative: false,
        source: "manual",
        by: "user",
        markConfirmed: true,
      });
    },
    [addEventInternal]
  );

  const addPendingDetection = useCallback(
    async (d: Omit<PendingDetection, "id" | "detectedAt">) => {
      const id = uid("det");
      const det: PendingDetection = { ...d, id, detectedAt: Date.now() };
      await persist({ ...state, pending: [det, ...state.pending] });
      return id;
    },
    [persist, state]
  );

  const resolvePendingDetection = useCallback(
    async (id: string, action: "save" | "edit" | "ignore", edited?: { dateIso?: string; startDateIso?: string; endDateIso?: string }) => {
      const target = state.pending.find((p) => p.id === id);
      if (!target) return;
      const nextPending = state.pending.filter((p) => p.id !== id);

      if (action === "ignore") {
        await persist({ ...state, pending: nextPending });
        return;
      }

      const finalDates = action === "edit" ? edited || {} : { dateIso: target.dateIso, startDateIso: target.startDateIso, endDateIso: target.endDateIso };
      const now = Date.now();

      await persist({ ...state, pending: nextPending });
      await addEventInternal({
        visaId: target.visaId,
        type: target.type,
        title: target.title,
        dateIso: finalDates.dateIso,
        startDateIso: finalDates.startDateIso,
        endDateIso: finalDates.endDateIso,
        tentative: false,
        source: "detected",
        sourceUrl: target.sourceUrl,
        by: "system",
        markConfirmed: true,
      });

      // add an audit record to the new event is done; for ignore we avoid storing noise
      void now;
    },
    [addEventInternal, persist, state]
  );

  const editEventDate = useCallback(
    async (eventId: string, edited: { dateIso?: string; startDateIso?: string; endDateIso?: string }) => {
      const ev = state.events.find((e) => e.id === eventId);
      if (!ev) return;
      const now = Date.now();
      await cancelEventReminders(ev.reminders);

      const chosenDate = edited.dateIso || edited.startDateIso;
      const reminders = chosenDate ? await scheduleReminders(ev.title, chosenDate, offsetsDefault()) : [];

      const updated: VisaEvent = {
        ...ev,
        ...edited,
        tentative: false,
        userEdited: true,
        updatedAt: now,
        status: computeStatus(edited.dateIso || edited.startDateIso),
        reminders,
        history: [
          ...ev.history,
          { ts: now, by: "user", action: "edited_date", from: { dateIso: ev.dateIso, startDateIso: ev.startDateIso, endDateIso: ev.endDateIso }, to: edited },
        ],
      };

      await persist({ ...state, events: state.events.map((x) => (x.id === eventId ? updated : x)) });
    },
    [persist, state]
  );

  const markEventCompleted = useCallback(
    async (eventId: string) => {
      const ev = state.events.find((e) => e.id === eventId);
      if (!ev) return;
      const now = Date.now();
      const updated: VisaEvent = {
        ...ev,
        status: "completed",
        updatedAt: now,
        history: [...ev.history, { ts: now, by: "user", action: "marked_completed" }],
      };
      await persist({ ...state, events: state.events.map((x) => (x.id === eventId ? updated : x)) });
    },
    [persist, state]
  );

  const deleteEvent = useCallback(
    async (eventId: string) => {
      const ev = state.events.find((e) => e.id === eventId);
      if (!ev) return;
      await cancelEventReminders(ev.reminders);
      await persist({ ...state, events: state.events.filter((e) => e.id !== eventId) });
    },
    [persist, state]
  );

  const setSilentMode = useCallback(
    async (enabled: boolean) => {
      const next: TimelineState = {
        ...state,
        settings: { ...(state.settings || { silentMode: true }), silentMode: !!enabled },
      };
      await persist(next);
    },
    [persist, state]
  );

  const toggleProcedureStep = useCallback(
    async (visaId: string, stepId: string) => {
      const vid = String(visaId || "").trim();
      const sid = String(stepId || "").trim();
      if (!vid || !sid) return;
      const current = (state.procedure || {})[vid] || { completedStepIds: [], updatedAt: Date.now() };
      const set = new Set((current.completedStepIds || []).map((x) => String(x)));
      if (set.has(sid)) set.delete(sid);
      else set.add(sid);
      const next: TimelineState = {
        ...state,
        procedure: {
          ...(state.procedure || {}),
          [vid]: { completedStepIds: Array.from(set), updatedAt: Date.now() },
        },
      };
      await persist(next);
    },
    [persist, state]
  );

  const value = useMemo(
    () => ({
      state,
      loaded,
      upsertVisa,
      addManualEvent,
      addPendingDetection,
      resolvePendingDetection,
      editEventDate,
      markEventCompleted,
      deleteEvent,
      toggleProcedureStep,
      setSilentMode,
    }),
    [state, loaded, upsertVisa, addManualEvent, addPendingDetection, resolvePendingDetection, editEventDate, markEventCompleted, deleteEvent, toggleProcedureStep, setSilentMode]
  );

  return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

export function useVisaTimeline() {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error("useVisaTimeline must be used within VisaTimelineProvider");
  return ctx;
}

