from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, Optional


@dataclass(frozen=True)
class CostItem:
    label: str
    amount: float
    currency: str = "USD"
    mandatory: bool = True
    why: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class AppointmentCostResult:
    destination_region: str
    visa_type: str
    currency: str
    items: list[CostItem]
    total_mandatory: float
    total_optional: float
    total: float
    warnings: list[str]
    next_steps: list[str]
    disclaimers: list[str]


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


def _money(x: Any) -> Decimal:
    try:
        return Decimal(str(x))
    except (InvalidOperation, ValueError):
        raise ValueError(f"Montant invalide: {x!r}")


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


def estimate_costs(
    *,
    destination_region: str,
    visa_type: str,
    currency: str = "USD",
    visa_fee: Optional[Any] = None,
    service_fee: Optional[Any] = None,
    biometrics_fee: Optional[Any] = None,
    translation_cost: Optional[Any] = None,
    insurance_cost: Optional[Any] = None,
    courier_cost: Optional[Any] = None,
) -> AppointmentCostResult:
    """
    Assistance coût (sans scraping):
    l'utilisateur fournit les montants (depuis la source officielle),
    on calcule le total et on signale les risques (frais non officiels, etc.).
    """

    dest = _norm(destination_region)
    vtype = _norm(visa_type)
    cur = _norm(currency) or "USD"

    items: list[CostItem] = []
    warnings: list[str] = []
    next_steps: list[str] = []

    def add(label: str, amount: Optional[Any], mandatory: bool, why: list[str]) -> None:
        if amount is None:
            return
        val = _money(amount)
        if val < 0:
            raise ValueError(f"Montant négatif non autorisé pour {label}.")
        items.append(CostItem(label=label, amount=float(val), currency=cur, mandatory=mandatory, why=why))

    add(
        "Frais de visa (officiel)",
        visa_fee,
        True,
        ["Payé uniquement via la procédure officielle du pays/portail."],
    )
    add(
        "Frais de service (centre agréé) — si applicable",
        service_fee,
        True,
        ["Certains pays externalisent la collecte via des prestataires officiels."],
    )
    add(
        "Biométrie — si applicable",
        biometrics_fee,
        True,
        ["Dépend du visa et du pays."],
    )
    add(
        "Traductions certifiées (estimation)",
        translation_cost,
        False,
        ["Peut être nécessaire selon la langue exigée par l'autorité."],
    )
    add(
        "Assurance voyage (estimation) — si requise",
        insurance_cost,
        False,
        ["Souvent requise pour certaines zones/visas (vérifier l'officiel)."],
    )
    add(
        "Courrier / retour passeport (estimation)",
        courier_cost,
        False,
        ["Optionnel selon le prestataire/consulat."],
    )

    if not items:
        warnings.append("Aucun coût fourni: impossible d'estimer le total.")
        next_steps.append("Récupérer les frais depuis la source officielle (ambassade/gouvernement/centre agréé).")

    # Anti-scam / overcharge signals (heuristiques)
    if service_fee is not None and visa_fee is not None:
        try:
            sf = _money(service_fee)
            vf = _money(visa_fee)
            if vf > 0 and (sf / vf) > Decimal("2.0"):
                warnings.append("Frais de service très élevés vs frais de visa: vérifier que le prestataire est officiel.")
        except Exception:
            pass

    total_mand = sum(Decimal(str(i.amount)) for i in items if i.mandatory)
    total_opt = sum(Decimal(str(i.amount)) for i in items if not i.mandatory)
    total = total_mand + total_opt

    next_steps.extend(
        [
            "Toujours payer via le portail officiel ou le centre agréé listé par l'ambassade/gouvernement.",
            "Conserver les reçus officiels (PDF / email) et les références de paiement.",
            "Éviter les paiements 'cash' ou via des liens envoyés par des tiers non vérifiés.",
        ]
    )

    disclaimers = [
        "Les frais changent fréquemment: la source de vérité est l'ambassade/gouvernement et, si applicable, le centre agréé officiel.",
        "Ce module calcule des totaux à partir de montants fournis; il ne récupère pas de tarifs automatiquement.",
    ]

    return AppointmentCostResult(
        destination_region=dest,
        visa_type=vtype,
        currency=cur,
        items=items,
        total_mandatory=float(total_mand),
        total_optional=float(total_opt),
        total=float(total),
        warnings=_dedup(warnings),
        next_steps=_dedup(next_steps),
        disclaimers=disclaimers,
    )


def appointment_cost_to_dict(r: AppointmentCostResult) -> dict[str, Any]:
    return {
        "destination_region": r.destination_region,
        "visa_type": r.visa_type,
        "currency": r.currency,
        "items": [
            {
                "label": i.label,
                "amount": float(i.amount),
                "currency": i.currency,
                "mandatory": bool(i.mandatory),
                "why": list(i.why),
            }
            for i in r.items
        ],
        "total_mandatory": float(r.total_mandatory),
        "total_optional": float(r.total_optional),
        "total": float(r.total),
        "warnings": list(r.warnings),
        "next_steps": list(r.next_steps),
        "disclaimers": list(r.disclaimers),
    }

