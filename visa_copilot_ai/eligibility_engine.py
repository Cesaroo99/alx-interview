from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from .eligibility import EligibilityUserProfile, LanguageEvidence, evaluate_visa_eligibility


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _dedup(seq: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in seq:
        x2 = _norm(x)
        if not x2 or x2 in seen:
            continue
        seen.add(x2)
        out.append(x2)
    return out


def _age_from_range(age_range: str) -> int:
    """
    Convertit une tranche d'âge en âge approximatif (pour moteur heuristique).
    """
    a = _norm(age_range)
    if a in {"18-25", "18–25"}:
        return 22
    if a in {"26-35", "26–35"}:
        return 30
    if a in {"36-45", "36–45"}:
        return 40
    if a in {"46+", "46 +", "46 plus"}:
        return 50
    # fallback: si on reçoit déjà un âge
    try:
        return int(float(a))
    except Exception:
        return 0


def _age_range_from_age(age: int) -> str:
    if age <= 0:
        return ""
    if 18 <= age <= 25:
        return "18–25"
    if 26 <= age <= 35:
        return "26–35"
    if 36 <= age <= 45:
        return "36–45"
    return "46+"


def _purpose_to_preferred_keys(purpose: str) -> list[str]:
    p = _norm(purpose).lower()
    if "study" in p or "étud" in p:
        return ["student"]
    if "work" in p or "travail" in p:
        return ["skilled_worker", "temporary_work"]
    if "tour" in p or "visit" in p:
        return ["tourist"]
    if "business" in p or "affair" in p:
        return ["business_investor", "tourist"]
    if "transit" in p:
        return ["tourist"]
    if "family" in p or "regroup" in p or "famill" in p:
        return ["family_reunification"]
    if "permanent" in p or "pr" in p or "résidence" in p:
        return ["skilled_worker"]
    return []


def _likelihood_from_score(score: int, missing_count: int) -> str:
    # Strict: missing requirements penalize the likelihood band.
    if score >= 78 and missing_count == 0:
        return "High"
    if score >= 60 and missing_count <= 1:
        return "Medium"
    return "Low"


def _processing_time_for(visa_key_or_label: str) -> str:
    s = _norm(visa_key_or_label).lower()
    if "tour" in s or "visitor" in s:
        return "1–6 semaines"
    if "étudiant" in s or "student" in s:
        return "4–12 semaines"
    if "temporaire" in s or "temporary" in s:
        return "4–16 semaines"
    if "qualifi" in s or "skilled" in s:
        return "3–12 mois"
    if "business" in s or "invest" in s:
        return "1–4 mois"
    if "famil" in s:
        return "3–12 mois"
    return "Variable (à vérifier sur la source officielle)"


def _documents_summary_for(visa_key_or_label: str) -> list[str]:
    s = _norm(visa_key_or_label).lower()
    base = [
        "Passeport valide",
        "Formulaire(s) + photo(s) conformes",
        "Preuves financières (relevés, revenus, épargne)",
        "Preuves d'attaches et cohérence du projet",
    ]
    if "tour" in s or "visitor" in s:
        return base + ["Itinéraire/hébergement (réservations non irréversibles recommandées)", "Assurance si exigée"]
    if "étudiant" in s or "student" in s:
        return base + ["Lettre d'admission/inscription", "Preuve de langue (si exigée)", "Plan d'études (SOP)"]
    if "qualifi" in s or "skilled" in s:
        return base + ["CV + preuves d'expérience", "Diplômes/évaluations", "Test de langue (souvent requis)"]
    if "temporaire" in s:
        return base + ["Offre/contrat (sponsor) si requis", "Preuves d'expérience sur le poste"]
    if "business" in s or "invest" in s:
        return base + ["Business plan", "Source des fonds", "Preuves d'activité/entreprise"]
    if "famil" in s:
        return base + ["Preuves de lien familial/état civil", "Statut du membre hôte", "Lettre d'invitation/sponsor"]
    return base


def _budget_min_from_requirements(req: dict[str, Any]) -> Optional[float]:
    for k in ["min_financial_capacity_usd", "recommended_financial_capacity_usd"]:
        if k in req and req[k] is not None:
            try:
                return float(req[k])
            except Exception:
                continue
    return None


def _destination_risk_level(country: str) -> str:
    # Heuristique simple (pas une règle officielle).
    c = _norm(country).lower()
    if c in {"usa", "united states", "uk", "united kingdom", "canada", "australia", "new zealand"}:
        return "Élevé"
    if c in {"france", "germany", "spain", "italy", "portugal", "schengen"}:
        return "Moyen"
    return "Moyen"


@dataclass(frozen=True)
class EngineInput:
    # Required
    nationality: str
    country_of_residence: str
    age_range: str
    purpose: str
    destinations: list[str]  # may be ["no_preference"]

    # Optional extras (subset used by our engine)
    education_level: str = ""
    field_of_study: str = ""
    year_last_diploma: Optional[int] = None
    is_student: Optional[bool] = None

    employment_status: str = ""
    job_title: str = ""
    years_experience: float = 0.0
    income_range: str = ""
    employer_exists: Optional[bool] = None

    funds_range: str = ""
    sponsor_available: Optional[bool] = None
    sponsor_relationship: str = ""
    sponsor_country: str = ""

    has_travel_history: Optional[bool] = None
    countries_visited: list[str] = None  # type: ignore[assignment]
    prior_visa_refusals: Optional[bool] = None
    refusals_explanation: str = ""

    languages: list[str] = None  # type: ignore[assignment]
    language_proof: str = "none"
    language_band: Optional[float] = None

    budget_sensitivity: str = ""
    processing_speed: str = ""
    willing_pathway: Optional[bool] = None

    visa_types_interest: list[str] = None  # type: ignore[assignment]


def parse_engine_input(payload: dict[str, Any]) -> tuple[Optional[EngineInput], list[str], list[str]]:
    """
    Returns: (EngineInput|None, missing_required_fields, assumptions)
    """
    assumptions: list[str] = []

    # Accept both a nested schema and a flat schema.
    identity = payload.get("identity") if isinstance(payload.get("identity"), dict) else {}
    objective = payload.get("objective") if isinstance(payload.get("objective"), dict) else {}

    nationality = _norm(identity.get("nationality") or payload.get("nationality"))
    residence = _norm(identity.get("country_of_residence") or payload.get("country_of_residence") or payload.get("residence_country"))
    age_range = _norm(identity.get("age_range") or payload.get("age_range"))

    purpose = _norm(objective.get("purpose") or payload.get("purpose") or payload.get("travel_purpose"))

    dest_raw = objective.get("destinations") if isinstance(objective.get("destinations"), list) else payload.get("destinations")
    if not isinstance(dest_raw, list):
        dest_raw = [objective.get("destination")] if objective.get("destination") else ([payload.get("destination")] if payload.get("destination") else [])
    destinations = [_norm(x) for x in dest_raw if _norm(x)]
    if not destinations:
        destinations = ["no_preference"]
        assumptions.append("Destination non précisée: le moteur proposera des pays 'best-fit' (heuristique).")

    missing: list[str] = []
    if not nationality:
        missing.append("nationality")
    if not residence:
        missing.append("country_of_residence")
    if not age_range and not isinstance(payload.get("age"), (int, float)):
        missing.append("age_range")
    if not purpose:
        missing.append("purpose")

    if missing:
        return None, missing, assumptions

    # Derive age range from numeric age if needed.
    if not age_range:
        age_range = _age_range_from_age(int(payload.get("age", 0) or 0)) or ""
        if not age_range:
            age_range = "26–35"
            assumptions.append("Âge non précisé: tranche d'âge supposée 26–35.")

    # Optional blocks
    edu = payload.get("education") if isinstance(payload.get("education"), dict) else {}
    prof = payload.get("professional") if isinstance(payload.get("professional"), dict) else {}
    fin = payload.get("financial") if isinstance(payload.get("financial"), dict) else {}
    hist = payload.get("travel_history") if isinstance(payload.get("travel_history"), dict) else {}
    lang = payload.get("language") if isinstance(payload.get("language"), dict) else {}
    prefs = payload.get("preferences") if isinstance(payload.get("preferences"), dict) else {}

    visa_interest = payload.get("visa_types_interest")
    if not isinstance(visa_interest, list):
        visa_interest = objective.get("visa_types_interest") if isinstance(objective.get("visa_types_interest"), list) else []
    visa_interest = [_norm(x) for x in (visa_interest or []) if _norm(x)]

    return (
        EngineInput(
            nationality=nationality,
            country_of_residence=residence,
            age_range=age_range,
            purpose=purpose,
            destinations=destinations,
            education_level=_norm(edu.get("education_level") or payload.get("education_level")),
            field_of_study=_norm(edu.get("field_of_study") or payload.get("field_of_study")),
            year_last_diploma=(int(edu["year_last_diploma"]) if isinstance(edu.get("year_last_diploma"), (int, float)) else None),
            is_student=(bool(edu["is_student"]) if "is_student" in edu else None),
            employment_status=_norm(prof.get("employment_status") or payload.get("employment_status")),
            job_title=_norm(prof.get("job_title") or payload.get("job_title") or payload.get("profession")),
            years_experience=float(prof.get("years_experience", payload.get("years_experience", 0)) or 0),
            income_range=_norm(prof.get("income_range") or payload.get("income_range")),
            employer_exists=(bool(prof["employer_exists"]) if "employer_exists" in prof else None),
            funds_range=_norm(fin.get("funds_range") or payload.get("funds_range")),
            sponsor_available=(bool(fin["sponsor_available"]) if "sponsor_available" in fin else payload.get("sponsor_available")),
            sponsor_relationship=_norm(fin.get("sponsor_relationship") or payload.get("sponsor_relationship")),
            sponsor_country=_norm(fin.get("sponsor_country") or payload.get("sponsor_country")),
            has_travel_history=(bool(hist["has_travel_history"]) if "has_travel_history" in hist else None),
            countries_visited=[_norm(x) for x in (hist.get("countries_visited") or []) if _norm(x)] if isinstance(hist.get("countries_visited"), list) else [],
            prior_visa_refusals=(bool(hist["prior_visa_refusals"]) if "prior_visa_refusals" in hist else payload.get("prior_visa_refusals")),
            refusals_explanation=_norm(hist.get("refusals_explanation") or payload.get("refusals_explanation")),
            languages=[_norm(x) for x in (lang.get("languages") or []) if _norm(x)] if isinstance(lang.get("languages"), list) else [],
            language_proof=_norm(lang.get("proof") or payload.get("language_proof") or "none") or "none",
            language_band=(float(lang["band"]) if isinstance(lang.get("band"), (int, float)) else (float(payload["language_band"]) if isinstance(payload.get("language_band"), (int, float)) else None)),
            budget_sensitivity=_norm(prefs.get("budget_sensitivity") or payload.get("budget_sensitivity")),
            processing_speed=_norm(prefs.get("processing_speed") or payload.get("processing_speed")),
            willing_pathway=(bool(prefs["willing_pathway"]) if "willing_pathway" in prefs else None),
            visa_types_interest=visa_interest,
        ),
        [],
        assumptions,
    )


def run_visa_eligibility_engine(
    payload: dict[str, Any],
    *,
    rules: dict[str, Any],
) -> dict[str, Any]:
    """
    Decision-support engine (heuristique, explicable).
    Returns a structured output A/B/C/D.
    """
    inp, missing, assumptions = parse_engine_input(payload)
    if inp is None:
        return {
            "ok": False,
            "error": "Champs requis manquants.",
            "missing_required": missing,
            "assumptions": assumptions,
        }

    # Destinations: if no preference, propose a short list from our rules pack.
    countries_rules = rules.get("countries") if isinstance(rules.get("countries"), dict) else {}
    supported = [k for k in countries_rules.keys() if k and k != "default"]
    if not supported:
        supported = ["default"]
    destinations = inp.destinations
    if len(destinations) == 1 and destinations[0].lower() == "no_preference":
        # Best-fit heuristic shortlist (limited to supported rule keys).
        shortlist = []
        for c in ["canada", "france", "germany", "portugal", "spain", "uk", "usa", "uae", "australia"]:
            if c in countries_rules or c in supported:
                shortlist.append(c)
        if not shortlist:
            shortlist = ["default"]
        destinations = shortlist[:5]
        assumptions.append("Aucune préférence: shortlist de destinations proposée à partir des pays supportés par le moteur.")

    # Build an EligibilityUserProfile (our existing scoring core).
    age = _age_from_range(inp.age_range)
    lang_exam = "self"
    if inp.language_proof and inp.language_proof.lower() != "none":
        lang_exam = inp.language_proof

    user = EligibilityUserProfile(
        age=age,
        nationality=inp.nationality,
        destination_country=(destinations[0] if destinations else "default"),
        education_level=inp.education_level,
        field_of_study=inp.field_of_study,
        years_experience=float(inp.years_experience or 0.0),
        marital_status="",  # not collected in required set; keep optional
        language=LanguageEvidence(band=inp.language_band, exam=lang_exam),
        financial_capacity_usd=None,  # we will optionally map ranges in next iteration
        sponsor_available=(bool(inp.sponsor_available) if inp.sponsor_available is not None else None),
        travel_history_trips_last_5y=None,
        prior_visa_refusals=(1 if inp.prior_visa_refusals else 0) if inp.prior_visa_refusals is not None else None,
    )

    preferred_keys = _purpose_to_preferred_keys(inp.purpose)

    # Compute options per destination.
    options: list[dict[str, Any]] = []
    for dest in destinations:
        dest_key = _norm(dest).lower()
        user2 = user.__class__(**{**user.__dict__, "destination_country": dest_key})  # type: ignore[attr-defined]
        results = evaluate_visa_eligibility(user2, country=dest_key or "default", rules=rules)

        for r in results:
            label = r.visaType
            # Filter by purpose preference if available (based on label keywords).
            if preferred_keys:
                # quick mapping by label keywords
                lk = _norm(label).lower()
                wanted = False
                if "tour" in lk:
                    wanted = "tourist" in preferred_keys
                elif "étudiant" in lk or "student" in lk:
                    wanted = "student" in preferred_keys
                elif "temporaire" in lk:
                    wanted = "temporary_work" in preferred_keys or "skilled_worker" in preferred_keys
                elif "qualifi" in lk:
                    wanted = "skilled_worker" in preferred_keys
                elif "business" in lk or "invest" in lk:
                    wanted = "business_investor" in preferred_keys
                elif "famil" in lk:
                    wanted = "family_reunification" in preferred_keys
                if not wanted:
                    continue

            # Filter by user-selected visa types interest (string match).
            if inp.visa_types_interest:
                low_label = _norm(label).lower()
                if not any(_norm(x).lower() in low_label for x in inp.visa_types_interest):
                    continue

            # Get visa requirements (min budget) from rules config if possible.
            cfg = (
                (countries_rules.get(dest_key) or {}).get("visa_types", {}).get(_norm(label).lower())
                if isinstance(countries_rules.get(dest_key), dict)
                else None
            )
            # Above is usually None because label is not the key. We'll find by scanning.
            req: dict[str, Any] = {}
            vtypes = (countries_rules.get(dest_key) or {}).get("visa_types") if isinstance(countries_rules.get(dest_key), dict) else {}
            if isinstance(vtypes, dict):
                for vk, vc in vtypes.items():
                    if isinstance(vc, dict) and str(vc.get("label") or "").strip() == label:
                        req = vc.get("requirements") or {}
                        break

            min_budget = _budget_min_from_requirements(req) if isinstance(req, dict) else None

            options.append(
                {
                    "country": dest_key or "default",
                    "visa_type": label,
                    "estimated_approval_likelihood": _likelihood_from_score(int(r.score), len(r.missingRequirements or [])),
                    "key_reasons": _dedup(
                        [
                            *[f"Point fort: {x.get('label')}" for x in (r.ai.get("strengths") or []) if isinstance(x, dict)],
                            *list(r.why or []),
                        ]
                    )[:6],
                    "main_risk_factors": _dedup(
                        [
                            *list(r.missingRequirements or []),
                            *[f"Faiblesse: {x.get('label')}" for x in (r.ai.get("weaknesses") or []) if isinstance(x, dict)],
                            f"Risque de surstay (heuristique): {_destination_risk_level(dest_key)}",
                        ]
                    )[:6],
                    "required_documents_summary": _documents_summary_for(label),
                    "typical_processing_time_range": _processing_time_for(label),
                    "estimated_minimum_budget_usd": (round(float(min_budget), 0) if min_budget is not None else None),
                    "why": list(r.why or []),
                    "improvements": list(r.improvementsToNextLevel or []),
                    "score": int(r.score),
                }
            )

    options.sort(key=lambda x: (0 if x["estimated_approval_likelihood"] == "High" else 1 if x["estimated_approval_likelihood"] == "Medium" else 2, -int(x["score"])), reverse=False)
    top = options[:5]

    # Profile strength score breakdown (0-100) — simple & transparent.
    fin = 55 if inp.funds_range else 40
    travel = 55 if (inp.has_travel_history or (inp.countries_visited and len(inp.countries_visited) > 0)) else 40
    if inp.prior_visa_refusals:
        travel = max(10, travel - 20)
    coherence = 60 if (inp.purpose and (inp.education_level or inp.job_title)) else 45
    home_ties = 55 if inp.employment_status else 40
    dest_risk = 50
    if top:
        dest_risk = 60 if _destination_risk_level(top[0]["country"]) == "Élevé" else 50

    strength_score = int(round((fin + travel + coherence + home_ties + (100 - dest_risk)) / 5))

    pathways: list[str] = []
    p = _norm(inp.purpose).lower()
    if "study" in p or "étud" in p:
        pathways += ["Études → Travail (post‑diplôme) → Résidence longue durée (si éligible)"]
    if "tour" in p or "visit" in p:
        pathways += ["Visa court séjour → historique de voyage crédible → options plus longues (si projet solide)"]
    if "work" in p or "travail" in p:
        pathways += ["Travail temporaire (offre/sponsor) → Travail qualifié → voie long terme"]
    if "family" in p or "famill" in p:
        pathways += ["Regroupement familial → stabilisation du statut → options de résidence selon règles"]
    pathways = _dedup(pathways)[:4] or ["Études → Travail → Long terme", "Court séjour → Long séjour (si cohérent)"]

    improvements = _dedup(
        [
            "Aligner clairement objectif ↔ profil (lettre d'intention, cohérence des pièces).",
            "Renforcer la preuve financière (relevés récents, revenus stables, sponsor documenté si besoin).",
            "Améliorer la preuve de langue (IELTS/TOEFL/TEF/TCF) si la voie le demande.",
            "Construire un historique de voyage cohérent (voyages courts, retours à temps).",
            "Éviter les incohérences (noms, dates, budgets) entre documents.",
            *[x for o in top for x in (o.get("improvements") or [])],
        ]
    )[:10]

    return {
        "ok": True,
        "input_summary": {
            "nationality": inp.nationality,
            "country_of_residence": inp.country_of_residence,
            "age_range": inp.age_range,
            "purpose": inp.purpose,
            "destinations_considered": destinations,
            "visa_types_interest": inp.visa_types_interest or [],
        },
        "assumptions": assumptions,
        "disclaimer": "Ce moteur fournit une aide à la décision (heuristique). Il ne garantit pas une approbation. Vérifiez toujours les exigences officielles.",
        # A
        "top_visa_options": [
            {
                "country": o["country"],
                "visa_type": o["visa_type"],
                "estimated_approval_likelihood": o["estimated_approval_likelihood"],
                "key_reasons_supporting_eligibility": o["key_reasons"],
                "main_risk_factors": o["main_risk_factors"],
                "required_documents_summary": o["required_documents_summary"],
                "typical_processing_time_range": o["typical_processing_time_range"],
                "estimated_minimum_budget_usd": o["estimated_minimum_budget_usd"],
            }
            for o in top
        ],
        # B
        "alternative_strategic_pathways": pathways,
        # C
        "profile_strength_score": {
            "total": int(_clamp(strength_score, 0, 100)),
            "breakdown": {
                "financial_strength": int(_clamp(fin, 0, 100)),
                "travel_history": int(_clamp(travel, 0, 100)),
                "academic_professional_coherence": int(_clamp(coherence, 0, 100)),
                "home_ties": int(_clamp(home_ties, 0, 100)),
                "destination_risk_level": int(_clamp(dest_risk, 0, 100)),
            },
        },
        # D
        "improvement_recommendations": improvements,
        "next_question": "Souhaitez-vous une feuille de route pas-à-pas de candidature pour l’une de ces options de visa ?",
    }

