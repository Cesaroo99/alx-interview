from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Optional

from .models import TravelPurpose, UserProfile


@dataclass(frozen=True)
class DayPlan:
    day: int
    date: str  # ISO
    city: str
    activities: list[str]
    accommodation_note: str


@dataclass(frozen=True)
class TravelPlanResult:
    mode: str  # "simulation" | "post_visa_booking"
    destination: str
    start_date: str
    end_date: str
    duration_days: int
    estimated_budget_usd: float
    budget_level: str  # "low" | "medium" | "high"
    coherence_warnings: list[str]
    why: list[str]
    itinerary: list[DayPlan]
    booking_policy: list[str]
    disclaimers: list[str]


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _parse_date(d: Any) -> date:
    if isinstance(d, date) and not isinstance(d, datetime):
        return d
    s = _norm(d)
    if not s:
        raise ValueError("Date manquante.")
    return datetime.fromisoformat(s).date()


def _budget_level(budget_per_day: float) -> str:
    if budget_per_day < 60:
        return "low"
    if budget_per_day < 140:
        return "medium"
    return "high"


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


def generate_travel_plan(
    profile: UserProfile,
    *,
    destination: str,
    start_date: Any,
    end_date: Any,
    estimated_budget_usd: float,
    mode: str = "simulation",
    anchor_city: Optional[str] = None,
) -> TravelPlanResult:
    """
    Travel Intelligence (pas une app de voyage):
    - objectif: crédibilité visa (cohérence motif/durée/budget/profil)
    - mode simulation par défaut (aucun paiement, aucune réservation)
    """

    dest = _norm(destination)
    if not dest:
        raise ValueError("Destination manquante.")
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)
    if ed < sd:
        raise ValueError("end_date doit être >= start_date.")

    duration = (ed - sd).days + 1
    if duration <= 0:
        raise ValueError("Durée invalide.")

    budget = float(estimated_budget_usd)
    if budget <= 0:
        raise ValueError("Budget estimatif invalide.")

    budget_per_day = budget / float(duration)
    level = _budget_level(budget_per_day)

    warnings: list[str] = []
    why: list[str] = []

    # Coherence checks (heuristiques)
    if duration > 30 and profile.travel_purpose in {TravelPurpose.TOURISM, TravelPurpose.BUSINESS}:
        warnings.append("Durée > 30 jours: attention à la justification (congés, budget, attaches).")
        why.append("Les séjours longs nécessitent souvent une justification forte et cohérente.")

    if level == "low" and profile.travel_purpose == TravelPurpose.TOURISM:
        warnings.append("Budget/jour faible pour un séjour touristique: risque d'incohérence (hébergement, transport, vie quotidienne).")
        why.append("Un budget irréaliste peut être interprété comme une intention non crédible.")

    if profile.travel_purpose == TravelPurpose.BUSINESS and duration > 14:
        warnings.append("Voyage d'affaires long (> 14 jours): prévoir un agenda pro détaillé et preuves d'activité.")
        why.append("Un agenda pro crédible renforce la cohérence du motif 'business'.")

    # Itinerary generation: simple, consistent, low-risk.
    base_city = _norm(anchor_city) or (dest.split(",")[0] if "," in dest else dest)
    cities = [base_city]
    if duration >= 7:
        # Add 1-2 nearby cities as "day trips" without changing accommodation too often.
        cities.append(f"Excursion proche de {base_city}")
    if duration >= 12:
        cities.append(f"Deuxième ville (proche) depuis {base_city}")

    itinerary: list[DayPlan] = []
    for i in range(duration):
        current_date = sd + timedelta(days=i)
        if duration <= 5:
            city = base_city
        elif duration <= 10:
            city = cities[0] if i < duration - 2 else cities[1]
        else:
            if i < duration - 5:
                city = cities[0]
            elif i < duration - 2 and len(cities) > 2:
                city = cities[2]
            else:
                city = cities[1]

        if profile.travel_purpose == TravelPurpose.TOURISM:
            acts = [
                "Visite culturelle (musée / centre historique)",
                "Activité légère (parc / promenade)",
                "Temps libre (restauration, marchés)",
            ]
        elif profile.travel_purpose == TravelPurpose.BUSINESS:
            acts = [
                "Réunion / salon / visite d'entreprise (selon invitation)",
                "Temps de préparation (documents, emails)",
                "Activité légère en fin de journée (tourisme modéré)",
            ]
        elif profile.travel_purpose == TravelPurpose.STUDY:
            acts = [
                "Visite du campus / administration (si applicable)",
                "Préparation logistique (logement, transport, inscription)",
                "Temps d'étude / orientation",
            ]
        else:
            acts = [
                "Activité principale liée au motif déclaré",
                "Temps libre raisonnable",
            ]

        accommodation = "Plan d'hébergement cohérent (simulation: options annulables/restituables si possible)."
        itinerary.append(
            DayPlan(
                day=i + 1,
                date=current_date.isoformat(),
                city=city,
                activities=acts,
                accommodation_note=accommodation,
            )
        )

    booking_policy = [
        "Par défaut: SIMULATION (aucun paiement irréversible).",
        "Réservations réelles uniquement après approbation du visa (ou options annulables si la règle officielle l'autorise).",
        "Ne jamais acheter de billets non remboursables uniquement pour 'prouver' une intention.",
    ]

    disclaimers = [
        "Ce module sert la crédibilité visa, pas l'optimisation de voyage.",
        "Les exigences de preuve d'hébergement/itinéraire dépendent du pays et du type de visa: suivre la source officielle.",
    ]

    # Mode sanity
    mode_norm = _norm(mode).lower() or "simulation"
    if mode_norm not in {"simulation", "post_visa_booking"}:
        mode_norm = "simulation"

    return TravelPlanResult(
        mode=mode_norm,
        destination=dest,
        start_date=sd.isoformat(),
        end_date=ed.isoformat(),
        duration_days=int(duration),
        estimated_budget_usd=round(float(budget), 2),
        budget_level=level,
        coherence_warnings=_dedup(warnings),
        why=_dedup(why),
        itinerary=itinerary,
        booking_policy=booking_policy,
        disclaimers=disclaimers,
    )


def travel_plan_to_dict(r: TravelPlanResult) -> dict[str, Any]:
    return {
        "mode": r.mode,
        "destination": r.destination,
        "start_date": r.start_date,
        "end_date": r.end_date,
        "duration_days": r.duration_days,
        "estimated_budget_usd": float(r.estimated_budget_usd),
        "budget_level": r.budget_level,
        "coherence_warnings": list(r.coherence_warnings),
        "why": list(r.why),
        "itinerary": [
            {
                "day": d.day,
                "date": d.date,
                "city": d.city,
                "activities": list(d.activities),
                "accommodation_note": d.accommodation_note,
            }
            for d in r.itinerary
        ],
        "booking_policy": list(r.booking_policy),
        "disclaimers": list(r.disclaimers),
    }

