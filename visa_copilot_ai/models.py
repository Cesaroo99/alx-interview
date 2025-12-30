from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class TravelPurpose(str, Enum):
    TOURISM = "tourism"
    BUSINESS = "business"
    STUDY = "study"
    FAMILY = "family"
    TRANSIT = "transit"
    MEDICAL = "medical"
    OTHER = "other"


class EmploymentStatus(str, Enum):
    EMPLOYED = "employed"
    SELF_EMPLOYED = "self_employed"
    STUDENT = "student"
    UNEMPLOYED = "unemployed"
    RETIRED = "retired"
    OTHER = "other"


@dataclass(frozen=True)
class FinancialProfile:
    """
    Profil financier minimal (facultatif).

    La logique de diagnostic ne doit jamais pousser l'utilisateur à falsifier
    des documents : on utilise ces données uniquement pour détecter des risques
    (cohérence budget/durée/objectifs).
    """

    monthly_income_usd: Optional[float] = None
    savings_usd: Optional[float] = None
    sponsor_available: Optional[bool] = None


@dataclass(frozen=True)
class UserProfile:
    """
    Profil utilisateur minimal pour un diagnostic initial.
    """

    nationality: str
    age: int
    profession: str
    employment_status: EmploymentStatus = EmploymentStatus.OTHER
    travel_purpose: TravelPurpose = TravelPurpose.OTHER
    travel_history_trips_last_5y: int = 0
    prior_visa_refusals: int = 0
    destination_region_hint: Optional[str] = None  # ex: "Schengen", "UK", "US", "Canada"
    financial_profile: Optional[FinancialProfile] = None

    # Notes non sensibles fournies par l'utilisateur (optionnel).
    notes: str = ""


@dataclass(frozen=True)
class Recommendation:
    label: str
    confidence: float  # 0..1
    why: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class DiagnosticResult:
    """
    Résultat structuré, conçu pour être affiché avec explications ("pourquoi").
    """

    eligible_countries_or_regions: list[Recommendation]
    recommended_visa_types: list[Recommendation]
    difficulty_level: str  # "low" | "medium" | "high"
    refusal_risk_score: float  # 0..1 (heuristique, non une "probabilité" officielle)
    readiness_score: float  # 0..100 (visa-readiness)
    key_risks: list[str]
    next_best_actions: list[str]
    anti_scam_warnings: list[str]
    assumptions: list[str]
    disclaimers: list[str]

