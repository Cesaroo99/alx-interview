from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Optional

from .models import TravelPurpose, UserProfile


@dataclass(frozen=True)
class Alert:
    alert_type: str
    description: str
    risk_level: str  # "Low" | "Medium" | "High"
    suggested_action: str


@dataclass(frozen=True)
class DayPlan:
    day: int
    date: str  # ISO
    country_or_city: str
    activity_type: str  # transit/tourism/study/work/business/other
    activities: list[str]
    accommodation_note: str
    notes: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class TravelPlanResult:
    mode: str  # "simulation" | "post_visa_booking"
    destination: str
    visa_type: str
    purpose: str
    start_date: str
    end_date: str
    duration_days: int
    estimated_budget_usd: float
    budget_level: str  # "low" | "medium" | "high"
    coherence_warnings: list[str]  # backward-compat
    alerts: list[Alert]
    visa_compliance_status: str  # "✔" | "⚠" | "✖"
    next_recommended_steps: list[str]
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


def _parse_destination_list(destination: str) -> list[str]:
    # Accept comma-separated destinations/cities/countries.
    raw = [x.strip() for x in str(destination or "").split(",")]
    return [x for x in raw if x]


def _risk_level_from_warning(msg: str) -> str:
    m = _norm(msg).lower()
    if any(k in m for k in ["impossible", "invalide", "dépasse", "depasse", "exceed", "overstay"]):
        return "High"
    if any(k in m for k in ["attention", "risque", "vigilance", "long", "faible"]):
        return "Medium"
    return "Low"


def _compliance_status(alerts: list[Alert]) -> str:
    if any(a.risk_level == "High" for a in alerts):
        return "✖"
    if any(a.risk_level == "Medium" for a in alerts):
        return "⚠"
    return "✔"


def _tourist_duration_limit_days(destination: str) -> int:
    d = _norm(destination).lower()
    if "schengen" in d or "europe" in d:
        return 90
    return 30


def generate_travel_plan(
    profile: UserProfile,
    *,
    destination: str,
    start_date: Any,
    end_date: Any,
    estimated_budget_usd: float,
    mode: str = "simulation",
    anchor_city: Optional[str] = None,
    visa_type: Optional[str] = None,
    maximize_compliance: bool = False,
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
    alerts: list[Alert] = []
    why: list[str] = []

    # Coherence checks (heuristiques)
    if duration > 30 and profile.travel_purpose in {TravelPurpose.TOURISM, TravelPurpose.BUSINESS}:
        msg = "Durée > 30 jours: attention à la justification (congés, budget, attaches)."
        warnings.append(msg)
        alerts.append(
            Alert(
                alert_type="duration_long",
                description=msg,
                risk_level="Medium",
                suggested_action="Réduire la durée ou documenter congés/attaches/budget de façon cohérente.",
            )
        )
        why.append("Les séjours longs nécessitent souvent une justification forte et cohérente.")

    if level == "low" and profile.travel_purpose == TravelPurpose.TOURISM:
        msg = "Budget/jour faible pour un séjour touristique: risque d'incohérence (hébergement, transport, vie quotidienne)."
        warnings.append(msg)
        alerts.append(
            Alert(
                alert_type="budget_unrealistic",
                description=msg,
                risk_level="Medium",
                suggested_action="Ajuster le budget ou raccourcir le séjour; éviter un budget irréaliste dans le dossier.",
            )
        )
        why.append("Un budget irréaliste peut être interprété comme une intention non crédible.")

    if profile.travel_purpose == TravelPurpose.BUSINESS and duration > 14:
        msg = "Voyage d'affaires long (> 14 jours): prévoir un agenda pro détaillé et preuves d'activité."
        warnings.append(msg)
        alerts.append(
            Alert(
                alert_type="business_duration_long",
                description=msg,
                risk_level="Medium",
                suggested_action="Préparer un agenda business détaillé + preuves (invitation, réunions, salon).",
            )
        )
        why.append("Un agenda pro crédible renforce la cohérence du motif 'business'.")

    # Visa-limit heuristic for tourist/business
    if profile.travel_purpose in {TravelPurpose.TOURISM, TravelPurpose.BUSINESS}:
        limit_days = _tourist_duration_limit_days(dest)
        if duration > limit_days:
            if maximize_compliance:
                # Auto-adjust end_date (no assumption beyond user-provided start_date).
                new_ed = sd + timedelta(days=limit_days - 1)
                ed = new_ed
                duration = (ed - sd).days + 1
                msg = f"Durée ajustée automatiquement à {limit_days} jours (max compliance) pour rester sous une limite touristique typique."
                warnings.append(msg)
                alerts.append(
                    Alert(
                        alert_type="visa_duration_limit_adjusted",
                        description=msg,
                        risk_level="Low",
                        suggested_action="Vérifier la limite officielle exacte; ajuster si nécessaire.",
                    )
                )
                why.append("En mode Max compliance, la durée a été plafonnée pour réduire le risque de non‑conformité.")
            else:
                msg = f"Durée estimée ({duration} jours) potentiellement au-delà d'une limite touristique typique ({limit_days} jours) pour cette zone."
                warnings.append(msg)
                alerts.append(
                    Alert(
                        alert_type="visa_duration_limit",
                        description=msg,
                        risk_level="High",
                        suggested_action="Réduire la durée ou vérifier la limite officielle exacte avant de finaliser l'itinéraire.",
                    )
                )

    # Multi-destination / transit heuristic
    dest_parts = _parse_destination_list(dest)
    if len(dest_parts) >= 2:
        if maximize_compliance:
            # Simplify to single anchor to reduce transit/sequence risk.
            dest_parts = dest_parts[:1]
            dest = dest_parts[0]
            alerts.append(
                Alert(
                    alert_type="simplified_multi_destination",
                    description="Mode Max compliance: itinéraire simplifié à une destination principale pour réduire le risque de transit/visa d'escale.",
                    risk_level="Low",
                    suggested_action="Si vous maintenez plusieurs pays, vérifier les visas de transit et la séquence entrée/sortie.",
                )
            )
            why.append("Un itinéraire simple et cohérent réduit le risque de questions (transits, visas d'escale, dates serrées).")
        else:
            alerts.append(
                Alert(
                    alert_type="transit_visa_possible",
                    description="Trajet multi-destinations: certains transits peuvent nécessiter un visa selon nationalité et aéroport (règles variables).",
                    risk_level="Medium",
                    suggested_action="Vérifier les exigences de transit (airside/landside) pour chaque pays d'escale avant de déposer le dossier.",
                )
            )

    # Itinerary generation: simple, consistent, low-risk.
    base_city = _norm(anchor_city) or (dest_parts[0] if dest_parts else dest)
    cities = [base_city]
    if duration >= 7:
        cities.append(f"Excursion proche de {base_city}")
    if duration >= 12:
        cities.append(f"Deuxième ville (proche) depuis {base_city}")

    itinerary: list[DayPlan] = []
    # Step 1: Departure (placeholder)
    itinerary.append(
        DayPlan(
            day=1,
            date=sd.isoformat(),
            country_or_city="Départ (pays de résidence) → Transit/Aéroport",
            activity_type="transit",
            activities=["Check‑in (simulation)", "Contrôle documents (passeport, visa, assurance si requise)", "Transit / correspondance (si applicable)"],
            accommodation_note="Aucun hébergement (jour de voyage).",
            notes=["Aucune réservation/payement irréversible requis par ce module."],
        )
    )

    # Middle days (2..duration-1) + Return day
    for i in range(1, duration - 1):
        current_date = sd + timedelta(days=i)
        if duration <= 5:
            city = base_city
        elif duration <= 10:
            city = cities[0] if i < duration - 3 else cities[1]
        else:
            if i < duration - 6:
                city = cities[0]
            elif i < duration - 3 and len(cities) > 2:
                city = cities[2]
            else:
                city = cities[1]

        if profile.travel_purpose == TravelPurpose.TOURISM:
            activity_type = "tourism"
            acts = ["Visite culturelle (musée / centre historique)", "Activité légère (parc / promenade)", "Temps libre (restauration, marchés)"]
        elif profile.travel_purpose == TravelPurpose.BUSINESS:
            activity_type = "business"
            acts = ["Réunion / salon / visite d'entreprise (selon invitation)", "Temps de préparation (documents, emails)", "Tourisme modéré en fin de journée"]
        elif profile.travel_purpose == TravelPurpose.STUDY:
            activity_type = "study"
            acts = ["Démarches d'installation (orientation / inscription si applicable)", "Préparation logistique (logement, transport)", "Temps d'étude / repérage"]
        else:
            activity_type = "other"
            acts = ["Activité principale liée au motif déclaré", "Temps libre raisonnable"]

        accommodation = "Hébergement en mode simulation (options flexibles/annulables si possible)."
        notes = []
        # Add non-blocking notes based on alerts
        if any(a.alert_type == "budget_unrealistic" for a in alerts):
            notes.append("Note: ajuster budget/jour pour rester crédible.")
        if any(a.alert_type == "duration_long" for a in alerts):
            notes.append("Note: séjour long → justificatifs (congés/attaches) recommandés.")

        itinerary.append(
            DayPlan(
                day=i + 1,
                date=current_date.isoformat(),
                country_or_city=city,
                activity_type=activity_type,
                activities=acts,
                accommodation_note=accommodation,
                notes=_dedup(notes),
            )
        )

    # Return / onward travel (last day)
    if duration >= 2:
        itinerary.append(
            DayPlan(
                day=duration,
                date=ed.isoformat(),
                country_or_city="Départ destination → Transit/Aéroport → Retour",
                activity_type="transit",
                activities=["Check‑out (simulation)", "Transit / correspondance (si applicable)", "Retour (ou onward travel)"],
                accommodation_note="Aucun hébergement (jour de voyage).",
                notes=["Respecter la séquence entrée/sortie et éviter les chevauchements avec d'autres obligations."],
            )
        )

    booking_policy = [
        "Par défaut: SIMULATION (aucun paiement irréversible).",
        "Réservations réelles uniquement après approbation du visa (ou options annulables si la règle officielle l'autorise).",
        "Ne jamais acheter de billets non remboursables uniquement pour 'prouver' une intention.",
    ]

    next_steps = _dedup(
        [
            "Vérifier les exigences officielles (durée autorisée, transit, assurance) pour les pays concernés.",
            "Aligner budget ↔ durée ↔ motif et préparer des preuves cohérentes.",
            "Préparer un dossier 'propre': dates, noms, documents cohérents (aucune falsification).",
        ]
    )

    disclaimers = [
        "Ce module sert la crédibilité visa, pas l'optimisation de voyage.",
        "Les exigences de preuve d'hébergement/itinéraire dépendent du pays et du type de visa: suivre la source officielle.",
        "Aucune réservation n'est effectuée. Aucune approbation n'est garantie.",
    ]

    # Mode sanity
    mode_norm = _norm(mode).lower() or "simulation"
    if mode_norm not in {"simulation", "post_visa_booking"}:
        mode_norm = "simulation"

    visa_label = _norm(visa_type) or "unknown"
    purpose = profile.travel_purpose.value if isinstance(profile.travel_purpose, TravelPurpose) else str(profile.travel_purpose or "")
    compliance = _compliance_status(alerts)

    return TravelPlanResult(
        mode=mode_norm,
        destination=dest,
        visa_type=visa_label,
        purpose=purpose,
        start_date=sd.isoformat(),
        end_date=ed.isoformat(),
        duration_days=int(duration),
        estimated_budget_usd=round(float(budget), 2),
        budget_level=level,
        coherence_warnings=_dedup(warnings),
        alerts=alerts,
        visa_compliance_status=compliance,
        next_recommended_steps=next_steps,
        why=_dedup(why),
        itinerary=itinerary,
        booking_policy=booking_policy,
        disclaimers=disclaimers,
    )


def travel_plan_to_dict(r: TravelPlanResult) -> dict[str, Any]:
    return {
        "mode": r.mode,
        "destination": r.destination,
        "visa_type": r.visa_type,
        "purpose": r.purpose,
        "start_date": r.start_date,
        "end_date": r.end_date,
        "duration_days": r.duration_days,
        "estimated_budget_usd": float(r.estimated_budget_usd),
        "budget_level": r.budget_level,
        "coherence_warnings": list(r.coherence_warnings),
        "alerts": [
            {
                "alert_type": a.alert_type,
                "description": a.description,
                "risk_level": a.risk_level,
                "suggested_action": a.suggested_action,
            }
            for a in r.alerts
        ],
        "timeline_overview": {
            "total_trip_duration_days": r.duration_days,
            "visa_compliance_status": r.visa_compliance_status,
            "next_recommended_steps": list(r.next_recommended_steps),
        },
        "why": list(r.why),
        "itinerary": [
            {
                "day": d.day,
                "date": d.date,
                "country_or_city": d.country_or_city,
                "activity_type": d.activity_type,
                "activities": list(d.activities),
                "accommodation_note": d.accommodation_note,
                "notes": list(d.notes),
            }
            for d in r.itinerary
        ],
        "booking_policy": list(r.booking_policy),
        "disclaimers": list(r.disclaimers),
    }

