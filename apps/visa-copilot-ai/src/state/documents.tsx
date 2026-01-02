import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type DocumentType =
  | "passport"
  | "photo"
  | "bank_statement"
  | "payslips"
  | "employment_letter"
  | "business_registration"
  | "student_certificate"
  | "enrollment_letter"
  | "invitation_letter"
  | "travel_insurance"
  | "accommodation_plan"
  | "itinerary"
  | "civil_status"
  | "sponsor_letter"
  | "refusal_letter"
  | "other";

export type StoredDocument = {
  id: string;
  doc_type: DocumentType;
  filename: string;
  uri: string;
  mimeType?: string;
  size?: number;
  addedAt: number;
  extracted?: Record<string, unknown>;
};

const STORAGE_KEY = "globalvisa.documents.v1";

type Ctx = {
  docs: StoredDocument[];
  loaded: boolean;
  addDoc: (d: Omit<StoredDocument, "id" | "addedAt">) => Promise<StoredDocument>;
  removeDoc: (id: string) => Promise<void>;
  updateDoc: (id: string, patch: Partial<StoredDocument>) => Promise<void>;
  clearAll: () => Promise<void>;
};

const DocumentsContext = createContext<Ctx | null>(null);

function uid() {
  return `doc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function safeDeleteFile(uri: string) {
  try {
    if (!uri) return;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setDocs(JSON.parse(raw));
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: StoredDocument[]) => {
    setDocs(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addDoc = useCallback(
    async (d: Omit<StoredDocument, "id" | "addedAt">) => {
      const id = uid();
      const next: StoredDocument = { ...d, id, addedAt: Date.now() };
      await persist([next, ...docs]);
      return next;
    },
    [docs, persist]
  );

  const removeDoc = useCallback(
    async (id: string) => {
      const target = docs.find((x) => x.id === id);
      const next = docs.filter((x) => x.id !== id);
      await persist(next);
      if (target?.uri) await safeDeleteFile(target.uri);
    },
    [docs, persist]
  );

  const updateDoc = useCallback(
    async (id: string, patch: Partial<StoredDocument>) => {
      const next = docs.map((d) => (d.id === id ? { ...d, ...patch } : d));
      await persist(next);
    },
    [docs, persist]
  );

  const clearAll = useCallback(async () => {
    for (const d of docs) {
      if (d.uri) await safeDeleteFile(d.uri);
    }
    await persist([]);
  }, [docs, persist]);

  const value = useMemo(() => ({ docs, loaded, addDoc, removeDoc, updateDoc, clearAll }), [docs, loaded, addDoc, removeDoc, updateDoc, clearAll]);
  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments() {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error("useDocuments must be used within DocumentsProvider");
  return ctx;
}

