import type { UserProfile } from "@/src/state/profile";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000";

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
  verifyDossier(payload: {
    profile: UserProfile;
    visa_type: string;
    destination_region: string;
    documents: Array<{ doc_id: string; doc_type: string; filename?: string; extracted?: Record<string, unknown> }>;
  }) {
    return post<any>("/verify-dossier", payload);
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
};

