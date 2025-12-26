from __future__ import annotations

import json
from dataclasses import dataclass, field
import os
from typing import Any, Optional

import importlib.resources as pkg_resources


@dataclass(frozen=True)
class LanguageEvidence:
    """
    Représentation simplifiée.
    - band: échelle 0..9 (approx). Ex: IELTS 6 ~ band 6.
    - exam: "IELTS" | "TEF" | "TOEFL" | "self"
    """

    band: Optional[float] = None
    exam: str = "self"


@dataclass(frozen=True)
class EligibilityUserProfile:
    # Identity
    age: int
    nationality: str
    destination_country: str

    # Education
    education_level: str = ""  # ex: "high_school" | "bachelor" | "master" | "phd"
    field_of_study: str = ""

    # Professional
    years_experience: float = 0.0

    # Personal
    marital_status: str = ""  # ex: "single" | "married" | "divorced" | "widowed"

    # Language
    language: LanguageEvidence = field(default_factory=LanguageEvidence)

    # Financial
    financial_capacity_usd: Optional[float] = None
    sponsor_available: Optional[bool] = None

    # History
    travel_history_trips_last_5y: Optional[int] = None
    prior_visa_refusals: Optional[int] = None


@dataclass(frozen=True)
class VisaEligibilityResult:
    visaType: str
    score: int  # 0..100
    color: str  # "green" | "orange" | "red"
    message: str
    missingRequirements: list[str]
    improvementsToNextLevel: list[str]
    why: list[str]


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


def _load_rules() -> dict[str, Any]:
    """
    Source de règles:
    - Par défaut: ressources versionnées dans le repo.
    - Override possible via env var GLOBALVISA_RULES_PATH (modifiable sans changer le code).
    """

    override = os.getenv("GLOBALVISA_RULES_PATH", "").strip()
    if override:
        try:
            with open(override, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            # fallback to embedded rules
            pass

    with pkg_resources.files("visa_copilot_ai").joinpath("resources/visa_rules.json").open("r", encoding="utf-8") as f:
        return json.load(f)


def _merge_dict(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge_dict(out[k], v)
        else:
            out[k] = v
    return out


def _select_country_rules(all_rules: dict[str, Any], country: str) -> dict[str, Any]:
    countries = all_rules.get("countries", {})
    default = countries.get("default", {})
    c_key = _norm(country).lower()
    if not c_key:
        return default
    current = countries.get(c_key)
    if not isinstance(current, dict):
        return default
    inherits = current.get("inherits")
    if inherits and isinstance(countries.get(inherits), dict):
        return _merge_dict(countries[inherits], current)
    return _merge_dict(default, current)


def _score_age(age: int) -> float:
    # Score "générique": pics en âge actif, sans être une règle.
    if age <= 0:
        return 0.2
    if age < 18:
        return 0.4
    if 18 <= age <= 35:
        return 1.0
    if 36 <= age <= 45:
        return 0.85
    if 46 <= age <= 55:
        return 0.65
    return 0.45


EDU_POINTS = {
    "none": 0.1,
    "high_school": 0.35,
    "associate": 0.55,
    "bachelor": 0.75,
    "master": 0.9,
    "phd": 1.0,
}


def _score_education(level: str) -> float:
    k = _norm(level).lower()
    return EDU_POINTS.get(k, 0.45 if k else 0.35)


def _score_field(field: str) -> float:
    # Heuristique neutre: on valorise la clarté plus que la "valeur" d'un domaine.
    f = _norm(field)
    if not f:
        return 0.35
    if len(f) >= 6:
        return 0.75
    return 0.55


def _score_experience(years: float, min_years: float | None, rec_years: float | None) -> float:
    y = max(0.0, float(years or 0.0))
    if min_years is not None and y < float(min_years):
        return 0.2
    if rec_years is not None and float(rec_years) > 0:
        return _clamp(y / float(rec_years), 0.2, 1.0)
    # fallback: 0..10 ans
    return _clamp(y / 6.0, 0.2, 1.0)


def _score_travel_history(trips: Optional[int], refusals: Optional[int]) -> float:
    t = max(0, int(trips or 0))
    r = max(0, int(refusals or 0))
    base = 0.35
    if t == 0:
        base = 0.35
    elif t <= 2:
        base = 0.55
    elif t <= 5:
        base = 0.75
    else:
        base = 0.9
    if r >= 1:
        base -= 0.18 + 0.06 * min(r, 3)
    return _clamp(base, 0.05, 1.0)


def _score_language(lang: LanguageEvidence, min_band: Optional[float]) -> float:
    b = lang.band
    if b is None:
        return 0.35
    b = float(b)
    if min_band is not None and b < float(min_band):
        return 0.25
    # normalize in 0..9
    return _clamp(b / 9.0, 0.2, 1.0)


def _score_finances(capacity_usd: Optional[float], min_usd: Optional[float], rec_usd: Optional[float]) -> float:
    if capacity_usd is None:
        return 0.35
    c = max(0.0, float(capacity_usd))
    if min_usd is not None and c < float(min_usd):
        return 0.2
    if rec_usd is not None and float(rec_usd) > 0:
        return _clamp(c / float(rec_usd), 0.2, 1.0)
    return _clamp(c / 5000.0, 0.2, 1.0)


def _score_sponsor(sponsor_available: Optional[bool], requires: bool) -> float:
    if requires:
        return 1.0 if sponsor_available else 0.1
    if sponsor_available is None:
        return 0.45
    return 0.75 if sponsor_available else 0.55


def _score_marital(status: str) -> float:
    # Neutre: on évite des heuristiques agressives. On valorise la cohérence (présence d'info).
    s = _norm(status).lower()
    if not s:
        return 0.4
    return 0.65


def _score_destination_fit(destination_country: str, target_country: str) -> float:
    # Bonus "fit" si le user regarde le bon pays.
    return 1.0 if _norm(destination_country).lower() == _norm(target_country).lower() and target_country else 0.75


def _color_from_score(score: int, green: int, orange: int) -> str:
    if score >= green:
        return "green"
    if score >= orange:
        return "orange"
    return "red"


def _message_from_color(color: str) -> str:
    if color == "green":
        return "Profil solide pour ce visa (selon règles heuristiques)."
    if color == "orange":
        return "Profil acceptable mais améliorable."
    return "Profil insuffisant actuellement (ou informations manquantes)."


def evaluate_visa_eligibility(
    user: EligibilityUserProfile,
    country: str,
    *,
    rules: Optional[dict[str, Any]] = None,
) -> list[VisaEligibilityResult]:
    """
    Service demandé:
    evaluateVisaEligibility(userProfile, country)

    - Règles chargées depuis config (modifiables sans toucher au code)
    - Sortie explicable (why + missing + improvements)
    """

    rules_obj = rules if isinstance(rules, dict) else _load_rules()
    country_rules = _select_country_rules(rules_obj, country)
    visa_types = (country_rules.get("visa_types") or {})
    out: list[VisaEligibilityResult] = []

    for visa_key, visa_cfg in visa_types.items():
        if not isinstance(visa_cfg, dict):
            continue

        label = str(visa_cfg.get("label") or visa_key)
        thresholds = visa_cfg.get("thresholds") or {}
        green = int(thresholds.get("green", 70))
        orange = int(thresholds.get("orange", 40))

        weights = visa_cfg.get("weights") or {}
        req = visa_cfg.get("requirements") or {}
        hints = visa_cfg.get("improvement_hints") or {}

        # Requirement values
        min_exp = req.get("min_experience_years")
        rec_exp = req.get("recommended_experience_years")
        min_lang = req.get("min_language_band")
        min_fin = req.get("min_financial_capacity_usd")
        rec_fin = req.get("recommended_financial_capacity_usd")
        requires_sponsor = bool(req.get("requires_sponsor", False))

        # Subscores 0..1
        subs: dict[str, float] = {
            "age": _score_age(user.age),
            "education": _score_education(user.education_level),
            "field_of_study": _score_field(user.field_of_study),
            "experience": _score_experience(user.years_experience, min_exp, rec_exp),
            "marital_status": _score_marital(user.marital_status),
            "language": _score_language(user.language, min_lang),
            "financial_capacity": _score_finances(user.financial_capacity_usd, min_fin, rec_fin),
            "travel_history": _score_travel_history(user.travel_history_trips_last_5y, user.prior_visa_refusals),
            "sponsor": _score_sponsor(user.sponsor_available, requires_sponsor),
            "destination_fit": _score_destination_fit(user.destination_country, country),
        }

        # Weighted score
        total_w = 0.0
        acc = 0.0
        why: list[str] = []

        for k, w in weights.items():
            try:
                wf = float(w)
            except Exception:
                continue
            if wf <= 0:
                continue
            total_w += wf
            s = subs.get(k, 0.4)
            acc += wf * s

        if total_w <= 0:
            score = 0
        else:
            score = int(round(_clamp(acc / total_w, 0.0, 1.0) * 100))

        color = _color_from_score(score, green, orange)
        message = _message_from_color(color)

        # Missing requirements (business logic, not only missing fields)
        missing: list[str] = []
        if requires_sponsor and not user.sponsor_available:
            missing.append("Sponsor / offre / invitation requis(e) selon ce visa (à vérifier sur la source officielle).")
        if min_exp is not None and user.years_experience < float(min_exp):
            missing.append(f"Expérience minimale: {min_exp} an(s) (estimé).")
        if min_lang is not None and (user.language.band is None or float(user.language.band) < float(min_lang)):
            missing.append(f"Niveau de langue minimal: band {min_lang} (estimé).")
        if min_fin is not None and (user.financial_capacity_usd is None or float(user.financial_capacity_usd) < float(min_fin)):
            missing.append(f"Capacité financière minimale estimée: {min_fin} USD.")
        if not _norm(user.education_level) and "education" in weights:
            missing.append("Niveau d’études non renseigné.")
        if not _norm(user.field_of_study) and "field_of_study" in weights:
            missing.append("Domaine de formation non renseigné.")

        # Improvements to next level
        improvements: list[str] = []
        next_target = green if color != "green" else None
        if next_target is not None:
            # pick weakest weighted criteria
            items: list[tuple[float, str]] = []
            for k, w in weights.items():
                try:
                    wf = float(w)
                except Exception:
                    continue
                items.append((wf * (1.0 - subs.get(k, 0.4)), k))
            items.sort(reverse=True)
            for _, k in items[:4]:
                hint = hints.get(k)
                if hint:
                    improvements.append(str(hint))
                else:
                    # generic
                    if k == "language":
                        improvements.append("Améliorer le niveau de langue ou fournir une preuve standardisée.")
                    elif k == "financial_capacity":
                        improvements.append("Renforcer les preuves financières (épargne/revenus/sponsor) selon l’officiel.")
                    elif k == "experience":
                        improvements.append("Augmenter et documenter l’expérience professionnelle pertinente.")
                    elif k == "education":
                        improvements.append("Clarifier/renforcer le niveau d’études et fournir les justificatifs.")
                    elif k == "sponsor":
                        improvements.append("Ajouter un sponsor conforme si requis/utile.")

        # Explainability (compact)
        why.append(f"Score calculé via pondération de critères (config pays: '{_norm(country).lower() or 'default'}').")
        if missing:
            why.append("Certaines exigences semblent manquantes: le score reflète aussi les infos absentes.")

        out.append(
            VisaEligibilityResult(
                visaType=label,
                score=score,
                color=color,
                message=message,
                missingRequirements=missing,
                improvementsToNextLevel=list(dict.fromkeys([_norm(x) for x in improvements if _norm(x)])),
                why=why,
            )
        )

    # tri: meilleur score d'abord
    out.sort(key=lambda x: x.score, reverse=True)
    return out


def eligibility_to_dict(r: VisaEligibilityResult) -> dict[str, Any]:
    return {
        "visaType": r.visaType,
        "score": int(r.score),
        "color": r.color,
        "message": r.message,
        "missingRequirements": list(r.missingRequirements),
        "improvementsToNextLevel": list(r.improvementsToNextLevel),
        "why": list(r.why),
    }

