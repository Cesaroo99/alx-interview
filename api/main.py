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
from .content_admin import (
    delete_news_override,
    delete_offices_override,
    load_news_data,
    load_offices_data,
    save_news_override,
    save_offices_override,
    validate_news_data,
    validate_offices_data,
)

from visa_copilot_ai.offices import list_offices
from visa_copilot_ai.news import list_news
from visa_copilot_ai.news_ingest import ingest_news, load_sources_list

from .news_ingest_admin import (
    delete_sources_override,
    load_ingested_cache,
    load_sources,
    save_ingested_cache,
    save_sources_override,
    validate_sources,
)

from .openai_responses import call_openai_responses
from .forms_catalog import get_form, list_forms, select_form_id
from .procedure_store import (
    add_audit,
    create_procedure,
    init_db,
    list_audit,
    list_procedures,
    list_steps,
    load_draft,
    mark_completed_and_advance,
    save_draft,
)
from .ai_forms import next_steps as ai_next_steps
from .ai_forms import suggest_for_field as ai_suggest_for_field
from .ai_forms import validate_step as ai_validate_step


app = FastAPI(title="Visa Copilot AI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


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

    # Mode LLM (OpenAI) si configuré.
    # Note: aucune clé n'est stockée dans le code; tout passe par OPENAI_API_KEY.
    if (os.getenv("OPENAI_API_KEY") or "").strip() and user_message:
        if any(k in msg_l for k in ["url", "lien", "site", "portail", "officiel", "phishing", "arnaque", "scam"]):
            quick_actions = [
                {"type": "open", "target": "security", "label": "Vérifier une URL"},
                {"type": "tip", "label": "Ne jamais payer hors portail officiel"},
            ]
        elif any(k in msg_l for k in ["document", "pièce", "passeport", "relev", "attestation", "assurance", "dossier"]):
            quick_actions = [
                {"type": "open", "target": "documents", "label": "Ouvrir Documents"},
                {"type": "open", "target": "dossier", "label": "Vérifier le dossier"},
            ]
        elif any(k in msg_l for k in ["refus", "risque", "chance", "probabilité", "score"]):
            quick_actions = [
                {"type": "open", "target": "diagnostic", "label": "Voir le diagnostic"},
                {"type": "open", "target": "parcours", "label": "Voir le parcours"},
            ]
        else:
            quick_actions = [
                {"type": "open", "target": "parcours", "label": "Démarrer le parcours"},
                {"type": "open", "target": "diagnostic", "label": "Faire un diagnostic"},
            ]

        profile_hint = (
            f"nationalité={profile.nationality}, âge={profile.age}, profession={profile.profession}, "
            f"emploi={profile.employment_status.value}, motif={profile.travel_purpose.value}, "
            f"destination_hint={profile.destination_region_hint or ''}, refus_précédents={profile.prior_visa_refusals}"
        )
        prompt = (
            "Tu es GlobalVisa Copilot, un assistant de visa.\n"
            "- Réponds en français.\n"
            "- Sois clair, structuré, concis, et actionnable.\n"
            "- Ne prétends jamais être une autorité; recommande de vérifier la source officielle.\n"
            "- N'invente pas de lois ni de liens.\n\n"
            f"Contexte profil: {profile_hint}\n\n"
            f"Question utilisateur: {user_message}\n"
        )

        try:
            _raw, text = call_openai_responses(input_text=prompt, store=False)
            answer = text.strip() or "Je n’ai pas pu générer une réponse utile. Pouvez-vous préciser la destination et le motif ?"
            return {"answer": answer, "quick_actions": quick_actions}
        except Exception:
            # Fallback silencieux vers le mode heuristique ci-dessous.
            quick_actions = []

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


@app.post("/ai/respond")
def ai_respond(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Proxy minimal vers OpenAI Responses.

    Body:
    {
      "model": "gpt-5-nano",
      "input": "write a haiku about ai",
      "store": false
    }
    """
    if not (os.getenv("OPENAI_API_KEY") or "").strip():
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY non configurée sur le serveur.")

    model = payload.get("model")
    input_text = str(payload.get("input", "") or "").strip()
    store = bool(payload.get("store", False))

    if not input_text:
        raise HTTPException(status_code=400, detail="Champ 'input' requis.")

    raw, text = call_openai_responses(input_text=input_text, model=str(model) if model else None, store=store)
    return {"model": (model or os.getenv("OPENAI_MODEL") or "gpt-5-nano"), "text": text, "response": raw}


@app.get("/forms")
def forms(type: Optional[str] = None, country: Optional[str] = None, intent: Optional[str] = None) -> dict[str, Any]:
    """
    Catalogue de formulaires (guides) disponibles.
    """
    items = list_forms(form_type=type, country=country, intent=intent)
    return {"items": items}


@app.get("/forms/{form_id}")
def form_get(form_id: str) -> dict[str, Any]:
    f = get_form(form_id)
    if not f:
        raise HTTPException(status_code=404, detail="form introuvable")
    return f


@app.post("/procedures")
def procedures_create(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Crée une procédure (visa/admission/admin) et ses étapes à partir d'un formulaire catalogue.
    """
    proc_type = str(payload.get("type", "") or "").strip() or "visa"
    intent = str(payload.get("intent", "") or "").strip() or "tourism"
    country = str(payload.get("country", "") or "").strip() or "generic"
    region = payload.get("region")
    target = payload.get("target")
    locale = str(payload.get("locale", "fr") or "fr").strip().lower()
    if locale not in {"fr", "en"}:
        locale = "fr"

    form_id = select_form_id(form_type=proc_type, country=country, intent=intent)
    if not form_id:
        raise HTTPException(status_code=404, detail="Aucun formulaire trouvé pour ce type/pays/intention.")
    f = get_form(form_id)
    steps = list(f.get("steps") or []) if isinstance(f.get("steps"), list) else []
    created = create_procedure(
        proc_type=proc_type,
        intent=intent,
        country=country,
        region=str(region) if region else None,
        target=str(target) if target else None,
        locale=locale,
        form_id=form_id,
        steps=steps,
    )
    add_audit(procedure_id=created["id"], actor="user", action="procedure.start", payload={"type": proc_type, "intent": intent, "country": country})
    return {"procedure": created, "form": {"id": form_id, "meta": (f.get("meta") or {})}}


@app.get("/procedures")
def procedures_list(limit: int = 50) -> dict[str, Any]:
    return {"items": list_procedures(limit=limit)}


@app.get("/procedures/{procedure_id}/steps")
def procedures_steps(procedure_id: str) -> dict[str, Any]:
    return {"items": list_steps(procedure_id)}


@app.get("/procedures/{procedure_id}/draft/{step_id}")
def procedures_draft_get(procedure_id: str, step_id: str) -> dict[str, Any]:
    d = load_draft(procedure_id, step_id) or {"procedure_id": procedure_id, "step_id": step_id, "updated_at": None, "data": {}}
    return d


@app.put("/procedures/{procedure_id}/draft/{step_id}")
def procedures_draft_put(procedure_id: str, step_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="data doit être un objet JSON.")
    save_draft(procedure_id, step_id, data)
    return {"ok": True}


@app.post("/procedures/{procedure_id}/steps/{step_id}/complete")
def procedures_step_complete(procedure_id: str, step_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    mark_completed_and_advance(procedure_id, step_id)
    locale = "fr"
    if isinstance(payload, dict) and isinstance(payload.get("locale"), str):
        locale = payload["locale"].lower()
    # IA = décisionnaire des recommandations/next actions (retournées au client)
    ai = ai_next_steps(procedure_id=procedure_id, completed_step_id=step_id, locale=locale)
    return {"ok": True, "ai": ai, "steps": list_steps(procedure_id)}


@app.post("/ai/forms/suggest")
def ai_forms_suggest(payload: dict[str, Any]) -> dict[str, Any]:
    procedure_id = str(payload.get("procedure_id", "") or "")
    step_id = str(payload.get("step_id", "") or "")
    field_id = str(payload.get("field_id", "") or "")
    locale = str(payload.get("locale", "fr") or "fr").lower()
    user_input = payload.get("user_input")
    return ai_suggest_for_field(procedure_id=procedure_id, step_id=step_id, field_id=field_id, locale=locale, user_input=str(user_input) if user_input is not None else None)


@app.post("/ai/forms/validate")
def ai_forms_validate(payload: dict[str, Any]) -> dict[str, Any]:
    procedure_id = str(payload.get("procedure_id", "") or "")
    step_id = str(payload.get("step_id", "") or "")
    locale = str(payload.get("locale", "fr") or "fr").lower()
    return ai_validate_step(procedure_id=procedure_id, step_id=step_id, locale=locale)


@app.get("/audit")
def audit(procedure_id: Optional[str] = None, limit: int = 200) -> dict[str, Any]:
    return {"items": list_audit(procedure_id=procedure_id, limit=limit)}

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


@app.get("/offices")
def offices(
    country: Optional[str] = None,
    city: Optional[str] = None,
    type: Optional[str] = None,  # noqa: A002 - API param name
    service: Optional[str] = None,
    q: Optional[str] = None,
    verify_urls: bool = False,
) -> dict[str, Any]:
    """
    Ambassades/consulats/centres (TLS/VFS):
    - Filtrage par pays/ville/type/service + recherche texte
    - Optionnel: ajout d'un verdict anti-scam sur l'URL officielle
    """

    pack = load_offices_data()
    items = list_offices(country=country, city=city, office_type=type, service=service, q=q, data=pack.data)

    if verify_urls:
        for it in items:
            url = str(it.get("official_url") or "")
            if url:
                it["official_url_verdict"] = security_verdict_to_dict(verify_official_url(url, expected_country=it.get("country")))
            else:
                it["official_url_verdict"] = None

    return {
        "source": {"type": "content_pack", "source": pack.source, "path": pack.path},
        "disclaimer": "Données informatives. Confirmer toujours via la source officielle avant déplacement/paiement.",
        "items": items,
    }


@app.get("/news")
def news(
    country: Optional[str] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 30,
) -> dict[str, Any]:
    """
    Actualités Visa & Lois:
    - feed par pays + catégories (visa_news/law_change) + tags
    """

    pack = load_news_data()
    cache = load_ingested_cache()
    merged_items = []
    if isinstance(pack.data.get("items"), list):
        merged_items.extend(pack.data["items"])
    if isinstance(cache.data.get("items"), list):
        merged_items.extend(cache.data["items"])
    items = list_news(
        country=country,
        category=category,
        tag=tag,
        q=q,
        limit=limit,
        data={"items": merged_items},
    )
    return {
        "source": {"type": "content_pack", "source": pack.source, "path": pack.path},
        "ingested_cache": {"path": cache.path, "updated_at": cache.data.get("updated_at")},
        "items": items,
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


@app.get("/admin/offices")
def admin_get_offices(x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    r = load_offices_data()
    return {"source": r.source, "path": r.path, "data": r.data}


@app.post("/admin/offices/validate")
def admin_validate_offices(payload: dict[str, Any], x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("data doit être un objet JSON.")
    return validate_offices_data(data)


@app.put("/admin/offices")
def admin_put_offices(payload: dict[str, Any], x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("data doit être un objet JSON.")
    v = validate_offices_data(data)
    if not v.get("ok"):
        raise HTTPException(status_code=400, detail={"message": "Données invalides", "validation": v})
    path = save_offices_override(data)
    return {"ok": True, "saved_to": path, "validation": v}


@app.delete("/admin/offices")
def admin_delete_offices(x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    deleted = delete_offices_override()
    return {"ok": True, "deleted": deleted}


@app.get("/admin/news")
def admin_get_news(x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    r = load_news_data()
    return {"source": r.source, "path": r.path, "data": r.data}


@app.post("/admin/news/validate")
def admin_validate_news(payload: dict[str, Any], x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("data doit être un objet JSON.")
    return validate_news_data(data)


@app.put("/admin/news")
def admin_put_news(payload: dict[str, Any], x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("data doit être un objet JSON.")
    v = validate_news_data(data)
    if not v.get("ok"):
        raise HTTPException(status_code=400, detail={"message": "Données invalides", "validation": v})
    path = save_news_override(data)
    return {"ok": True, "saved_to": path, "validation": v}


@app.delete("/admin/news")
def admin_delete_news(x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    deleted = delete_news_override()
    return {"ok": True, "deleted": deleted}


@app.get("/admin/news/sources")
def admin_get_news_sources(x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    r = load_sources()
    return {"source": r.source, "path": r.path, "data": r.data}


@app.post("/admin/news/sources/validate")
def admin_validate_news_sources(payload: dict[str, Any], x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("data doit être un objet JSON.")
    return validate_sources(data)


@app.put("/admin/news/sources")
def admin_put_news_sources(payload: dict[str, Any], x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("data doit être un objet JSON.")
    v = validate_sources(data)
    if not v.get("ok"):
        raise HTTPException(status_code=400, detail={"message": "Sources invalides", "validation": v})
    path = save_sources_override(data)
    return {"ok": True, "saved_to": path, "validation": v}


@app.delete("/admin/news/sources")
def admin_delete_news_sources(x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    deleted = delete_sources_override()
    return {"ok": True, "deleted": deleted}


@app.get("/admin/news/ingest/status")
def admin_news_ingest_status(x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    cache = load_ingested_cache()
    return {
        "cache_path": cache.path,
        "updated_at": cache.data.get("updated_at"),
        "last_ingest": cache.data.get("last_ingest"),
        "items_count": len(cache.data.get("items") or []) if isinstance(cache.data.get("items"), list) else 0,
    }


@app.post("/admin/news/ingest/run")
def admin_news_ingest_run(payload: dict[str, Any] | None = None, x_admin_key: str | None = Header(default=None)) -> dict[str, Any]:
    _require_admin_key(x_admin_key)
    body = payload or {}
    max_per_source = int(body.get("max_per_source", 20) or 20)
    max_total = int(body.get("max_total", 400) or 400)

    src_pack = load_sources()
    srcs = load_sources_list(src_pack.data)

    cache = load_ingested_cache()
    existing = cache.data.get("items") if isinstance(cache.data, dict) else []

    items, meta = ingest_news(sources=srcs, existing_items=existing, max_per_source=max_per_source, max_total=max_total)
    saved_payload = {
        "updated_at": meta.updated_at,
        "items": items,
        "last_ingest": {
            "ok": meta.ok,
            "fetched_sources": meta.fetched_sources,
            "new_items": meta.new_items,
            "total_items": meta.total_items,
            "errors": meta.errors,
            "updated_at": meta.updated_at,
        },
    }
    saved_to = save_ingested_cache(saved_payload)
    return {"ok": meta.ok, "saved_to": saved_to, "last_ingest": saved_payload["last_ingest"], "sources": {"source": src_pack.source, "path": src_pack.path}}

