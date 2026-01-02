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
  visa_type?: string;
  purpose?: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  estimated_budget_usd: number;
  budget_level: "low" | "medium" | "high" | string;
  coherence_warnings: string[];
  alerts?: Array<{ alert_type: string; description: string; risk_level: "Low" | "Medium" | "High" | string; suggested_action: string }>;
  timeline_overview?: { total_trip_duration_days: number; visa_compliance_status: "✔" | "⚠" | "✖" | string; next_recommended_steps: string[] };
  why: string[];
  itinerary: Array<{
    day: number;
    date: string;
    country_or_city: string;
    activity_type?: string;
    activities: string[];
    accommodation_note: string;
    notes?: string[];
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

export type CostEngineFee = {
  category: string;
  label: string;
  amount: number | null;
  currency: string;
  official: boolean;
  optional: boolean;
  notes: string[];
};

export type CostEngineResponse = {
  destination_region: string;
  visa_type: string;
  currency: string;
  items: CostEngineFee[];
  totals: {
    total_estimated: number;
    total_official: number;
    total_optional: number;
    unknown_count: number;
  };
  suspicious_fees_alerts: Array<{
    fee_flagged: string;
    reason_for_suspicion: string;
    suggested_action: string;
    risk_level: "Low" | "Medium" | "High" | string;
  }>;
  guidance: string[];
  disclaimer?: string;
  final_user_prompt?: string;
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

export type VisaEligibilityEngineResponse = {
  ok: boolean;
  error?: string;
  missing_required?: string[];
  assumptions?: string[];
  disclaimer?: string;
  engine?: any;
  input_summary?: any;
  top_visa_options?: Array<{
    country: string;
    visa_type: string;
    estimated_approval_likelihood: "High" | "Medium" | "Low" | string;
    key_reasons_supporting_eligibility: string[];
    main_risk_factors: string[];
    required_documents_summary: string[];
    typical_processing_time_range: string;
    estimated_minimum_budget_usd: number | null;
  }>;
  alternative_strategic_pathways?: string[];
  profile_strength_score?: { total: number; breakdown: Record<string, number> };
  improvement_recommendations?: string[];
  next_question?: string;
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
    return post<any>("/verify-dossier", payload);
  },
  planTrip(payload: {
    profile: UserProfile;
    destination: string;
    start_date: string;
    end_date: string;
    estimated_budget_usd: number;
    mode?: "simulation" | "post_visa_booking";
    anchor_city?: string;
    visa_type?: string;
    maximize_compliance?: boolean;
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
  estimateCostsEngine(payload: {
    destination_region: string;
    visa_type: string;
    currency: string;
    fees: Array<{
      category: string;
      label: string;
      amount: number | null;
      official?: boolean;
      optional?: boolean;
      notes?: string[];
    }>;
  }) {
    return post<CostEngineResponse>("/estimate-costs/engine", payload);
  },
  explainRefusal(payload: { refusal_reasons: string[]; refusal_letter_text?: string | null }) {
    return post<RefusalResponse>("/explain-refusal", payload);
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
  visaEligibilityEngine(payload: any) {
    return post<VisaEligibilityEngineResponse>("/eligibility/engine", payload);
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

