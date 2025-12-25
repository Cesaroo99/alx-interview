from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from visa_copilot_ai.appointments import appointment_cost_to_dict, estimate_costs
from visa_copilot_ai.diagnostic import diagnostic_to_dict, run_visa_diagnostic
from visa_copilot_ai.dossier import dossier_to_dict, verify_dossier
from visa_copilot_ai.documents import Document, DocumentType, required_documents_template
from visa_copilot_ai.form_guidance import field_guidance_to_dict, get_field_guidance
from visa_copilot_ai.models import EmploymentStatus, FinancialProfile, TravelPurpose, UserProfile
from visa_copilot_ai.refusal import explain_refusal, refusal_to_dict
from visa_copilot_ai.security import security_verdict_to_dict, verify_official_url
from visa_copilot_ai.travel_intelligence import travel_plan_to_dict, generate_travel_plan


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

