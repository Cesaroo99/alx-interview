import type { UserProfile } from "@/src/state/profile";

const DEFAULT_LOCAL_API = "http://localhost:8000";
const DEFAULT_RENDER_API = "https://visa-copilot-ai-api.onrender.com";

function computeBaseUrl(): string {
  const raw = (process.env.EXPO_PUBLIC_API_BASE_URL || "").trim();
  const isProd = process.env.NODE_ENV === "production";

  // Évite une config Render "par défaut" (localhost) qui casse le web en prod.
  if (!raw) return isProd ? DEFAULT_RENDER_API : DEFAULT_LOCAL_API;
  if (isProd && (raw.includes("localhost") || raw.includes("127.0.0.1"))) return DEFAULT_RENDER_API;

  return raw;
}

const BASE_URL = computeBaseUrl();

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

async function get<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { ...(headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

async function request<T>(path: string, options: { method: string; body?: unknown; headers?: Record<string, string> }) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export type DiagnosticResponse = {
  difficulty_level: string;
  refusal_risk_score: number;
  readiness_score: number;
  key_risks: string[];
  next_best_actions: string[];
  anti_scam_warnings: string[];
};

export type VerifyUrlResponse = {
  hostname: string;
  scheme: string;
  likely_official: boolean;
  risk_score: number;
  risk_level: string;
  reasons: string[];
  next_safe_steps: string[];
};

export type CopilotChatResponse = {
  answer: string;
  quick_actions: Array<{ type: string; target?: string; label: string }>;
};

export type AiRespondResponse = {
  model: string;
  text: string;
  response: any;
};

export type TravelPlanResponse = {
  mode: "simulation" | "post_visa_booking" | string;
  destination: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  estimated_budget_usd: number;
  budget_level: "low" | "medium" | "high" | string;
  coherence_warnings: string[];
  why: string[];
  itinerary: Array<{
    day: number;
    date: string;
    city: string;
    activities: string[];
    accommodation_note: string;
  }>;
  booking_policy: string[];
  disclaimers: string[];
};

export type EstimateCostsResponse = {
  destination_region: string;
  visa_type: string;
  currency: string;
  items: Array<{ label: string; amount: number; currency: string; mandatory: boolean; why: string[] }>;
  total_mandatory: number;
  total_optional: number;
  total: number;
  warnings: string[];
  next_steps: string[];
  disclaimers: string[];
};

export type DossierEvidence = {
  doc_id: string | null;
  doc_type: string;
  present: boolean;
  extracted_key: string | null;
  value: any;
  note?: string | null;
};

export type DossierDocumentIssue = {
  severity: "info" | "warning" | "risk" | string;
  code: string;
  message: string;
  why: string[];
  suggested_fix: string[];
  evidence: DossierEvidence[];
};

export type VerifyDossierResponse = {
  visa_type: string;
  destination_region: string;
  coherence_score: number;
  readiness_score: number;
  readiness_level: string;
  key_risks: string[];
  next_best_actions: string[];
  disclaimers: string[];
  diagnostic: DiagnosticResponse & { assumptions?: string[]; disclaimers?: string[] };
  document_check: {
    missing_document_types: string[];
    issues: DossierDocumentIssue[];
    assumptions: string[];
    disclaimers: string[];
  };
};

export type RefusalResponse = {
  refusal_reasons: string[];
  plain_explanation: string[];
  likely_root_causes: string[];
  corrective_actions: string[];
  plan_b_options: string[];
  anti_scam_warnings: string[];
  disclaimers: string[];
};

export type FormCatalogItem = { id: string; meta: any };
export type FormDefinition = { id: string; meta: any; steps: any[] };

export type Procedure = {
  id: string;
  created_at: string;
  updated_at: string;
  type: string;
  intent: string;
  country: string;
  region?: string | null;
  target?: string | null;
  locale: "fr" | "en" | string;
  form_id: string;
  status: string;
};

export type ProcedureStep = {
  id: string;
  procedure_id: string;
  step_key: string;
  title: { fr?: string; en?: string; [k: string]: string | undefined };
  ordering: number;
  status: "not_started" | "in_progress" | "done" | string;
  official_url?: string | null;
};

export type Journey = {
  id: string;
  created_at: string;
  updated_at: string;
  locale: "fr" | "en" | string;
  status: string;
  goal: any;
  plan: any;
};

export type JourneyStep = {
  id: string;
  journey_id: string;
  step_key: string;
  ordering: number;
  status: "not_started" | "in_progress" | "done" | "blocked" | string;
  title: { fr?: string; en?: string; [k: string]: any };
  description: { fr?: string; en?: string; [k: string]: any };
  payload: any;
};

export type OfficeItem = {
  id: string;
  type: "embassy" | "consulate" | "tls" | "vfs" | string;
  name: string;
  country: string;
  city: string;
  address: string;
  geo: null | { lat: number; lng: number };
  hours: Array<{ day: string; open: string | null; close: string | null; note: string }>;
  critical_hours_days: string[];
  contacts: { email: string; phone: string };
  official_url: string;
  services: string[];
  disclaimer: string;
  official_url_verdict?: any;
};

export type NewsItem = {
  id: string;
  category: "visa_news" | "law_change" | string;
  country: string;
  tags: string[];
  title: string;
  summary: string;
  source_name: string;
  source_url: string;
  published_at: string;
  reliability_score: number;
  disclaimer: string;
};

export const Api = {
  diagnose(profile: UserProfile) {
    return post<DiagnosticResponse>("/diagnose", { profile });
  },
  verifyUrl(url: string, country?: string) {
    return post<VerifyUrlResponse>("/verify-url", { url, country });
  },
  copilotChat(profile: UserProfile | null, message: string) {
    return post<CopilotChatResponse>("/copilot/chat", { profile, message });
  },
  aiRespond(input: string, opts?: { model?: string; store?: boolean }) {
    return post<AiRespondResponse>("/ai/respond", { input, model: opts?.model, store: opts?.store });
  },
  verifyDossier(payload: {
    profile: UserProfile;
    visa_type: string;
    destination_region: string;
    documents: Array<{ doc_id: string; doc_type: string; filename?: string; extracted?: Record<string, unknown> }>;
  }) {
    return post<VerifyDossierResponse>("/verify-dossier", payload);
  },
  planTrip(payload: {
    profile: UserProfile;
    destination: string;
    start_date: string;
    end_date: string;
    estimated_budget_usd: number;
    mode?: "simulation" | "post_visa_booking";
    anchor_city?: string;
  }) {
    return post<TravelPlanResponse>("/plan-trip", payload);
  },
  estimateCosts(payload: {
    destination_region: string;
    visa_type: string;
    currency: string;
    visa_fee?: number | null;
    service_fee?: number | null;
    biometrics_fee?: number | null;
    translation_cost?: number | null;
    insurance_cost?: number | null;
    courier_cost?: number | null;
  }) {
    return post<EstimateCostsResponse>("/estimate-costs", payload);
  },
  explainRefusal(payload: { refusal_reasons: string[]; refusal_letter_text?: string | null }) {
    return post<RefusalResponse>("/explain-refusal", payload);
  },
  listForms(params?: { type?: string; country?: string; intent?: string }) {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.country) qs.set("country", params.country);
    if (params?.intent) qs.set("intent", params.intent);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return get<{ items: FormCatalogItem[] }>(`/forms${suffix}`);
  },
  getForm(formId: string) {
    return get<FormDefinition>(`/forms/${encodeURIComponent(formId)}`);
  },
  createProcedure(payload: { type: string; intent: string; country: string; region?: string; target?: string; locale: "fr" | "en" }) {
    return post<{ procedure: Procedure; form: { id: string; meta: any } }>("/procedures", payload);
  },
  listProcedures() {
    return get<{ items: Procedure[] }>("/procedures");
  },
  listProcedureSteps(procedureId: string) {
    return get<{ items: ProcedureStep[] }>(`/procedures/${encodeURIComponent(procedureId)}/steps`);
  },
  getDraft(procedureId: string, stepId: string) {
    return get<{ procedure_id: string; step_id: string; updated_at: string | null; data: Record<string, any> }>(
      `/procedures/${encodeURIComponent(procedureId)}/draft/${encodeURIComponent(stepId)}`
    );
  },
  saveDraft(procedureId: string, stepId: string, data: Record<string, any>) {
    return request<{ ok: boolean }>(`/procedures/${encodeURIComponent(procedureId)}/draft/${encodeURIComponent(stepId)}`, {
      method: "PUT",
      body: { data },
    });
  },
  completeStep(procedureId: string, stepId: string, locale: "fr" | "en") {
    return post<{ ok: boolean; ai: any; steps: ProcedureStep[] }>(`/procedures/${encodeURIComponent(procedureId)}/steps/${encodeURIComponent(stepId)}/complete`, {
      locale,
    });
  },
  aiSuggest(payload: { procedure_id: string; step_id: string; field_id: string; locale: "fr" | "en"; user_input?: string | null }) {
    return post<{ engine: string; result: any }>("/ai/forms/suggest", payload);
  },
  aiValidate(payload: { procedure_id: string; step_id: string; locale: "fr" | "en" }) {
    return post<{ engine: string; result: any }>("/ai/forms/validate", payload);
  },
  audit(params?: { procedure_id?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.procedure_id) qs.set("procedure_id", params.procedure_id);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return get<{ items: any[] }>(`/audit${suffix}`);
  },
  createJourney(payload: { goal: any; locale: "fr" | "en"; context: any }) {
    return post<{ journey: Journey; steps: JourneyStep[]; ai: any }>("/journeys", payload);
  },
  listJourneys() {
    return get<{ items: Journey[] }>("/journeys");
  },
  getJourney(journeyId: string) {
    return get<{ journey: Journey }>(`/journeys/${encodeURIComponent(journeyId)}`);
  },
  listJourneySteps(journeyId: string) {
    return get<{ items: JourneyStep[] }>(`/journeys/${encodeURIComponent(journeyId)}/steps`);
  },
  listJourneyEvents(journeyId: string) {
    return get<{ items: any[] }>(`/journeys/${encodeURIComponent(journeyId)}/events`);
  },
  journeyAct(payload: { journey_id: string; locale: "fr" | "en"; context: any; action: any }) {
    return post<{ journey: Journey; steps: JourneyStep[]; ai: any }>(`/journeys/${encodeURIComponent(payload.journey_id)}/act`, payload);
  },
  journeyCompleteStep(payload: { journey_id: string; step_id: string; locale: "fr" | "en"; context: any }) {
    return post<{ journey: Journey; steps: JourneyStep[]; ai: any }>(
      `/journeys/${encodeURIComponent(payload.journey_id)}/steps/${encodeURIComponent(payload.step_id)}/complete`,
      { locale: payload.locale, context: payload.context }
    );
  },
  visaProposals(country: string, userProfile: UserProfile) {
    return post<{
      country: string;
      disclaimer: string;
      results: Array<{
        visaType: string;
        score: number;
        color: "green" | "orange" | "red";
        message: string;
        missingRequirements: string[];
        improvementsToNextLevel: string[];
        why: string[];
      }>;
    }>("/eligibility/proposals", { country, userProfile });
  },
  adminGetEligibilityRules(adminKey: string) {
    return request<{ source: string; path: string; rules: any }>("/admin/eligibility/rules", {
      method: "GET",
      headers: { "x-admin-key": adminKey },
    });
  },
  adminValidateEligibilityRules(adminKey: string, rules: any) {
    return request<{ ok: boolean; errors: string[]; warnings: string[] }>("/admin/eligibility/rules/validate", {
      method: "POST",
      headers: { "x-admin-key": adminKey },
      body: { rules },
    });
  },
  adminPutEligibilityRules(adminKey: string, rules: any) {
    return request<any>("/admin/eligibility/rules", {
      method: "PUT",
      headers: { "x-admin-key": adminKey },
      body: { rules },
    });
  },
  adminDeleteEligibilityRules(adminKey: string) {
    return request<any>("/admin/eligibility/rules", {
      method: "DELETE",
      headers: { "x-admin-key": adminKey },
    });
  },
  offices(params?: { country?: string; city?: string; type?: string; service?: string; q?: string; verify_urls?: boolean }) {
    const qs = new URLSearchParams();
    if (params?.country) qs.set("country", params.country);
    if (params?.city) qs.set("city", params.city);
    if (params?.type) qs.set("type", params.type);
    if (params?.service) qs.set("service", params.service);
    if (params?.q) qs.set("q", params.q);
    if (params?.verify_urls) qs.set("verify_urls", "true");
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return get<{ source: any; disclaimer: string; items: OfficeItem[] }>(`/offices${suffix}`);
  },
  news(params?: { country?: string; category?: string; tag?: string; q?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.country) qs.set("country", params.country);
    if (params?.category) qs.set("category", params.category);
    if (params?.tag) qs.set("tag", params.tag);
    if (params?.q) qs.set("q", params.q);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return get<{ source: any; items: NewsItem[] }>(`/news${suffix}`);
  },
};

