import type { StoredDocument } from "@/src/state/documents";
import type { UserProfile } from "@/src/state/profile";

function pick(obj: any, keys: string[]) {
  const out: any = {};
  for (const k of keys) {
    if (obj && obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

export function sanitizeProfile(profile: UserProfile | null) {
  if (!profile) return null;
  // Évite d’envoyer des champs texte libres potentiellement sensibles (notes).
  const base = pick(profile, [
    "nationality",
    "age",
    "profession",
    "employment_status",
    "travel_purpose",
    "travel_history_trips_last_5y",
    "prior_visa_refusals",
    "destination_region_hint",
    "education_level",
    "field_of_study",
    "years_experience",
    "marital_status",
    "financial_capacity_usd",
    "sponsor_available",
  ]);
  if (profile.financial_profile) {
    base.financial_profile = pick(profile.financial_profile, ["monthly_income_usd", "savings_usd", "sponsor_available"]);
  }
  if (profile.language) {
    base.language = pick(profile.language, ["exam", "band"]);
  }
  return base;
}

export function sanitizeDocuments(docs: StoredDocument[]) {
  // Ne pas envoyer filename/uri (PII possible). On garde type + quelques métadonnées utiles.
  return (docs || []).slice(0, 30).map((d) => ({
    id: d.id,
    doc_type: d.doc_type,
    size: d.size,
    // whitelist extraction keys (si présents) – sans contenu brut.
    extracted: d.extracted ? pick(d.extracted, ["issued_date", "expires_date", "country", "doc_number_present"]) : {},
  }));
}

export function buildJourneyContext(profile: UserProfile | null, docs: StoredDocument[]) {
  return {
    profile: sanitizeProfile(profile),
    documents: sanitizeDocuments(docs),
  };
}

