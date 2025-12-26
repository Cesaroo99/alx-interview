from __future__ import annotations

from typing import Any, Optional

import os

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from visa_copilot_ai.appointments import appointment_cost_to_dict, estimate_costs
from visa_copilot_ai.diagnostic import diagnostic_to_dict, run_visa_diagnostic
from visa_copilot_ai.dossier import dossier_to_dict, verify_dossier
from visa_copilot_ai.documents import Document, DocumentType, required_documents_template
from visa_copilot_ai.eligibility import (
    EligibilityUserProfile,
    LanguageEvidence,
    eligibility_to_dict,
    evaluate_visa_eligibility,
)
from visa_copilot_ai.form_guidance import field_guidance_to_dict, get_field_guidance
from visa_copilot_ai.models import EmploymentStatus, FinancialProfile, TravelPurpose, UserProfile
from visa_copilot_ai.refusal import explain_refusal, refusal_to_dict
from visa_copilot_ai.security import security_verdict_to_dict, verify_official_url
from visa_copilot_ai.travel_intelligence import travel_plan_to_dict, generate_travel_plan

from .rules_admin import delete_override_rules, load_rules, save_override_rules, validate_rules


app = FastAPI(title="Visa Copilot AI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _parse_profile(data: dict[str, Any]) -> UserProfile:
    fp_data = data.get("financial_profile")
    fp = None
    if isinstance(fp_data, dict):
        fp = FinancialProfile(
            monthly_income_usd=fp_data.get("monthly_income_usd"),
            savings_usd=fp_data.get("savings_usd"),
            sponsor_available=fp_data.get("sponsor_available"),
        )

    employment_status = data.get("employment_status", EmploymentStatus.OTHER.value)
    travel_purpose = data.get("travel_purpose", TravelPurpose.OTHER.value)

    return UserProfile(
        nationality=str(data.get("nationality", "") or ""),
        age=int(data.get("age", 0) or 0),
        profession=str(data.get("profession", "") or ""),
        employment_status=EmploymentStatus(str(employment_status)),
        travel_purpose=TravelPurpose(str(travel_purpose)),
        travel_history_trips_last_5y=int(data.get("travel_history_trips_last_5y", 0) or 0),
        prior_visa_refusals=int(data.get("prior_visa_refusals", 0) or 0),
        destination_region_hint=data.get("destination_region_hint"),
        financial_profile=fp,
        notes=str(data.get("notes", "") or ""),
    )


def _parse_documents(data: Any) -> list[Document]:
    if data is None:
        return []
    if not isinstance(data, list):
        raise ValueError("documents doit être une liste.")
    docs: list[Document] = []
    for i, raw in enumerate(data):
        if not isinstance(raw, dict):
            raise ValueError(f"documents[{i}] doit être un objet.")
        dtype = raw.get("doc_type", DocumentType.OTHER.value)
        docs.append(
            Document(
                doc_id=str(raw.get("doc_id", f"doc_{i}")),
                doc_type=DocumentType(str(dtype)),
                filename=str(raw.get("filename", "") or ""),
                issued_date=None,
                expires_date=None,
                extracted=dict(raw.get("extracted", {}) or {}),
                notes=str(raw.get("notes", "") or ""),
            )
        )
    return docs


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/diagnose")
def diagnose(payload: dict[str, Any]) -> dict[str, Any]:
    profile = _parse_profile(payload.get("profile") or payload)
    result = run_visa_diagnostic(profile)
    return diagnostic_to_dict(result)


@app.post("/verify-url")
def verify_url(payload: dict[str, Any]) -> dict[str, Any]:
    url = str(payload.get("url", "") or "")
    country = payload.get("country")
    verdict = verify_official_url(url, expected_country=str(country) if country else None)
    return security_verdict_to_dict(verdict)


@app.post("/verify-dossier")
def verify_dossier_endpoint(payload: dict[str, Any]) -> dict[str, Any]:
    profile_raw = payload.get("profile")
    if not isinstance(profile_raw, dict):
        raise ValueError("profile doit être un objet.")
    docs = _parse_documents(payload.get("documents"))
    visa_type = str(payload.get("visa_type", "") or "")
    destination_region = str(payload.get("destination_region", "") or "")
    profile = _parse_profile(profile_raw)
    result = verify_dossier(profile, docs, visa_type=visa_type, destination_region=destination_region)
    return dossier_to_dict(result)


@app.post("/plan-trip")
def plan_trip(payload: dict[str, Any]) -> dict[str, Any]:
    profile_raw = payload.get("profile")
    if not isinstance(profile_raw, dict):
        raise ValueError("profile doit être un objet.")
    profile = _parse_profile(profile_raw)
    result = generate_travel_plan(
        profile,
        destination=str(payload.get("destination", "") or ""),
        start_date=payload.get("start_date"),
        end_date=payload.get("end_date"),
        estimated_budget_usd=float(payload.get("estimated_budget_usd", 0) or 0),
        mode=str(payload.get("mode", "simulation") or "simulation"),
        anchor_city=payload.get("anchor_city"),
    )
    return travel_plan_to_dict(result)


@app.post("/explain-refusal")
def explain_refusal_endpoint(payload: dict[str, Any]) -> dict[str, Any]:
    rr = payload.get("refusal_reasons") or []
    if not isinstance(rr, list):
        raise ValueError("refusal_reasons doit être une liste.")
    result = explain_refusal(
        refusal_reasons=[str(x) for x in rr],
        refusal_letter_text=str(payload.get("refusal_letter_text") or "") or None,
    )
    return refusal_to_dict(result)


@app.post("/estimate-costs")
def estimate_costs_endpoint(payload: dict[str, Any]) -> dict[str, Any]:
    result = estimate_costs(
        destination_region=str(payload.get("destination_region", "") or ""),
        visa_type=str(payload.get("visa_type", "") or ""),
        currency=str(payload.get("currency", "USD") or "USD"),
        visa_fee=payload.get("visa_fee"),
        service_fee=payload.get("service_fee"),
        biometrics_fee=payload.get("biometrics_fee"),
        translation_cost=payload.get("translation_cost"),
        insurance_cost=payload.get("insurance_cost"),
        courier_cost=payload.get("courier_cost"),
    )
    return appointment_cost_to_dict(result)


@app.post("/guide-field")
def guide_field(payload: dict[str, Any]) -> dict[str, Any]:
    profile_raw = payload.get("profile")
    if not isinstance(profile_raw, dict):
        raise ValueError("profile doit être un objet.")
    profile = _parse_profile(profile_raw)
    context = payload.get("context") if isinstance(payload.get("context"), dict) else None
    g = get_field_guidance(
        form_type=str(payload.get("form_type", "") or ""),
        field_name=str(payload.get("field_name", "") or ""),
        profile=profile,
        context=context,
    )
    return field_guidance_to_dict(g)


@app.post("/copilot/chat")
def copilot_chat(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Copilot (MVP, sans LLM):
    - Réponses guidées et contextuelles basées sur nos modules heuristiques.
    - Fournit aussi des actions rapides pour l’UI.
    """

    profile_raw = payload.get("profile")
    if isinstance(profile_raw, dict):
        profile = _parse_profile(profile_raw)
    else:
        profile = _parse_profile(payload.get("profile") or {})

    user_message = str(payload.get("message", "") or "").strip()
    msg_l = user_message.lower()

    quick_actions: list[dict[str, Any]] = []

    # 1) Anti-scam / URL
    if any(k in msg_l for k in ["url", "lien", "site", "portail", "officiel", "phishing", "arnaque", "scam"]):
        answer = (
            "Pour éviter les scams, vérifiez toujours le domaine avant d’entrer des données. "
            "Si vous collez l’URL, je peux estimer le risque (https, raccourcisseurs, punycode, etc.)."
        )
        quick_actions = [
            {"type": "open", "target": "security", "label": "Vérifier une URL"},
            {"type": "tip", "label": "Ne jamais payer hors portail officiel"},
        ]
        return {"answer": answer, "quick_actions": quick_actions}

    # 2) Documents
    if any(k in msg_l for k in ["document", "pièce", "passeport", "relev", "attestation", "assurance", "dossier"]):
        dest = profile.destination_region_hint or "destination"
        # On réutilise le type de visa recommandé le plus plausible: sinon "visitor"
        visa_type = "visitor"
        req = required_documents_template(visa_type=visa_type, destination_region=dest)
        docs = ", ".join([d.value for d in req[:8]]) + ("…" if len(req) > 8 else "")
        answer = (
            f"Checklist de base (à confirmer sur la source officielle) pour {dest}: {docs}\n\n"
            "Je peux aussi vous dire quelles pièces sont les plus risquées (expiration, relevés trop anciens, incohérences)."
        )
        quick_actions = [
            {"type": "open", "target": "documents", "label": "Ouvrir Documents"},
            {"type": "open", "target": "dossier", "label": "Vérifier le dossier"},
        ]
        return {"answer": answer, "quick_actions": quick_actions}

    # 3) Risque / refus
    if any(k in msg_l for k in ["refus", "risque", "chance", "probabilité", "score"]):
        diag = run_visa_diagnostic(profile)
        answer = (
            f"Votre readiness est {diag.readiness_score}/100 et le risque (heuristique) est {int(diag.refusal_risk_score * 100)}%.\n\n"
            "Top actions visa-first:\n- "
            + "\n- ".join(diag.next_best_actions[:3])
        )
        quick_actions = [
            {"type": "open", "target": "diagnostic", "label": "Voir le diagnostic"},
            {"type": "open", "target": "parcours", "label": "Voir le parcours"},
        ]
        return {"answer": answer, "quick_actions": quick_actions}

    # 4) Default: guidance
    answer = (
        "Dites-moi: (1) destination, (2) motif, (3) votre situation (emploi/études), et (4) budget approximatif. "
        "Je vous guiderai étape par étape et je vous dirai surtout *pourquoi* chaque élément compte."
    )
    quick_actions = [
        {"type": "open", "target": "parcours", "label": "Démarrer le parcours"},
        {"type": "open", "target": "diagnostic", "label": "Faire un diagnostic"},
    ]
    return {"answer": answer, "quick_actions": quick_actions}


@app.post("/eligibility/proposals")
def eligibility_proposals(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Module "Voir les propositions de visa auxquelles je suis éligible".

    Entrée attendue:
    {
      "country": "canada",
      "userProfile": {...}
    }
    """

    country = str(payload.get("country", "") or "").strip() or str(payload.get("destination_country", "") or "").strip()
    up = payload.get("userProfile") or payload.get("profile") or {}
    if not isinstance(up, dict):
        raise ValueError("userProfile doit être un objet.")

    language_raw = up.get("language") if isinstance(up.get("language"), dict) else {}
    lang = LanguageEvidence(
        band=language_raw.get("band") if language_raw else up.get("language_band"),
        exam=str(language_raw.get("exam") if language_raw else (up.get("language_exam") or "self")),
    )

    user = EligibilityUserProfile(
        age=int(up.get("age", 0) or 0),
        nationality=str(up.get("nationality", "") or ""),
        destination_country=country or str(up.get("destination_country", "") or ""),
        education_level=str(up.get("education_level", "") or ""),
        field_of_study=str(up.get("field_of_study", "") or ""),
        years_experience=float(up.get("years_experience", 0) or 0),
        marital_status=str(up.get("marital_status", "") or ""),
        language=lang,
        financial_capacity_usd=(float(up["financial_capacity_usd"]) if "financial_capacity_usd" in up and up["financial_capacity_usd"] is not None else None),
        sponsor_available=(bool(up["sponsor_available"]) if "sponsor_available" in up and up["sponsor_available"] is not None else None),
        travel_history_trips_last_5y=(int(up["travel_history_trips_last_5y"]) if "travel_history_trips_last_5y" in up and up["travel_history_trips_last_5y"] is not None else None),
        prior_visa_refusals=(int(up["prior_visa_refusals"]) if "prior_visa_refusals" in up and up["prior_visa_refusals"] is not None else None),
    )

    # IA "rules reasoner" : le scoring est piloté par des règles configurables,
    # et enrichi d’un raisonnement explicable (forces/faiblesses) basé sur ces règles.
    rules_pack = load_rules()
    results = evaluate_visa_eligibility(user, country=country or "default", rules=rules_pack.rules)
    return {
        "country": country or "default",
        "engine": {
            "type": "ai_rules_reasoner",
            "rules_source": rules_pack.source,
            "rules_path": rules_pack.path,
        },
        "disclaimer": "Scores heuristiques (IA explicable): ils n’impliquent pas une décision. Vérifiez toujours les règles officielles.",
        "results": [eligibility_to_dict(r) for r in results],
    }


def _require_admin_key(x_admin_key: str | None) -> None:
    expected = os.getenv("GLOBALVISA_ADMIN_KEY", "").strip()
    if not expected:
        raise HTTPException(status_code=403, detail="Admin non configuré (GLOBALVISA_ADMIN_KEY manquant).")
    if not x_admin_key or x_admin_key.strip() != expected:
        raise HTTPException(status_code=403, detail="Clé admin invalide.")


@app.get("/admin/eligibility/rules")
def admin_get_rules(x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    r = load_rules()
    return {"source": r.source, "path": r.path, "rules": r.rules}


@app.post("/admin/eligibility/rules/validate")
def admin_validate_rules(payload: dict[str, Any], x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    rules = payload.get("rules")
    if not isinstance(rules, dict):
        raise ValueError("rules doit être un objet JSON.")
    return validate_rules(rules)


@app.put("/admin/eligibility/rules")
def admin_put_rules(payload: dict[str, Any], x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    rules = payload.get("rules")
    if not isinstance(rules, dict):
        raise ValueError("rules doit être un objet JSON.")
    v = validate_rules(rules)
    if not v.get("ok"):
        raise HTTPException(status_code=400, detail={"message": "Règles invalides", "validation": v})
    path = save_override_rules(rules)
    return {"ok": True, "saved_to": path, "validation": v}


@app.delete("/admin/eligibility/rules")
def admin_delete_rules(x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    deleted = delete_override_rules()
    return {"ok": True, "deleted": deleted}

