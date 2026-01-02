from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, Optional


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


@dataclass(frozen=True)
class FeeInput:
    category: str  # visa_fee | biometrics | service | government | optional | other
    label: str
    amount: Optional[float] = None
    currency: str = "USD"
    official: bool = False
    optional: bool = False
    notes: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class SuspiciousFeeAlert:
    fee_label: str
    reason: str
    suggested_action: str
    risk_level: str  # Low | Medium | High


@dataclass(frozen=True)
class CostEngineResult:
    destination_region: str
    visa_type: str
    currency: str
    items: list[FeeInput]
    total_estimated: float
    total_official: float
    total_optional: float
    unknown_count: int
    suspicious_alerts: list[SuspiciousFeeAlert]
    guidance: list[str]


def _is_suspicious_label(label: str) -> bool:
    s = _norm(label).lower()
    red_flags = [
        "agent",
        "consultant",
        "garantie",
        "guarantee",
        "fast track",
        "fasttrack",
        "accéléré",
        "accelerated",
        "vip",
        "service premium",
        "priority service",
        "commission",
    ]
    return any(k in s for k in red_flags)


def _typical_max(category: str, visa_type: str) -> float:
    c = _norm(category).lower()
    v = _norm(visa_type).lower()
    if c == "visa_fee":
        if any(k in v for k in ["student", "étud", "work", "travail", "business", "affair"]):
            return 800.0
        return 350.0
    if c in {"biometrics", "service"}:
        return 250.0
    if c == "courier":
        return 80.0
    if c == "insurance":
        return 400.0
    if c == "translation":
        return 800.0
    if c in {"government", "other"}:
        return 2000.0
    return 2000.0


def _risk_from_over(max_ratio: float) -> str:
    if max_ratio >= 3.0:
        return "High"
    if max_ratio >= 1.8:
        return "Medium"
    return "Low"


def compute_cost_engine(
    *,
    destination_region: str,
    visa_type: str,
    currency: str,
    fees: list[FeeInput],
) -> CostEngineResult:
    dest = _norm(destination_region)
    vt = _norm(visa_type)
    cur = _norm(currency) or "USD"

    items: list[FeeInput] = []
    unknown = 0
    for f in fees:
        amt = f.amount
        if amt is None or (isinstance(amt, float) and not (amt >= 0)):
            unknown += 1
            items.append(FeeInput(**{**f.__dict__, "currency": cur}))
            continue
        val = _money(amt)
        if val < 0:
            raise ValueError(f"Montant négatif non autorisé pour {f.label}.")
        items.append(FeeInput(**{**f.__dict__, "amount": float(val), "currency": cur}))

    # totals
    total_off = Decimal("0")
    total_opt = Decimal("0")
    total = Decimal("0")
    for it in items:
        if it.amount is None:
            continue
        a = Decimal(str(it.amount))
        total += a
        if it.optional:
            total_opt += a
        if it.official and not it.optional:
            total_off += a

    alerts: list[SuspiciousFeeAlert] = []

    # duplicates
    seen: dict[tuple[str, str], int] = {}
    for it in items:
        key = (_norm(it.label).lower(), str(it.amount) if it.amount is not None else "none")
        seen[key] = seen.get(key, 0) + 1
    for (lbl, amt), count in seen.items():
        if count >= 2 and amt != "none":
            alerts.append(
                SuspiciousFeeAlert(
                    fee_label=lbl,
                    reason="Doublon détecté (même libellé et montant saisis plusieurs fois).",
                    suggested_action="Supprimer le doublon ou confirmer qu'il s'agit de frais distincts (preuves officielles).",
                    risk_level="Medium",
                )
            )

    # suspicious label & over-range
    for it in items:
        if it.amount is None:
            continue
        if _is_suspicious_label(it.label) and not it.optional:
            alerts.append(
                SuspiciousFeeAlert(
                    fee_label=it.label,
                    reason="Libellé pouvant indiquer un frais non officiel (agent/premium/commission).",
                    suggested_action="Vérifier sur le site officiel; éviter tout paiement via tiers non agréé.",
                    risk_level="High",
                )
            )

        cat = _norm(it.category).lower()
        maxv = _typical_max(cat, vt)
        if float(it.amount) > maxv:
            ratio = float(it.amount) / maxv if maxv > 0 else 9.0
            alerts.append(
                SuspiciousFeeAlert(
                    fee_label=it.label,
                    reason=f"Montant élevé vs plage typique (>{int(maxv)} {cur}) pour la catégorie {cat}.",
                    suggested_action="Re-vérifier le tarif officiel et la devise; demander le barème officiel/receipt.",
                    risk_level=_risk_from_over(ratio),
                )
            )

    # service fee too high vs visa fee
    visa_fee = next((x for x in items if _norm(x.category).lower() == "visa_fee" and x.amount is not None), None)
    service_fee = next((x for x in items if _norm(x.category).lower() == "service" and x.amount is not None), None)
    if visa_fee and service_fee and visa_fee.amount and visa_fee.amount > 0:
        if float(service_fee.amount) / float(visa_fee.amount) > 2.0:
            alerts.append(
                SuspiciousFeeAlert(
                    fee_label=service_fee.label,
                    reason="Frais de service très élevés vs frais de visa.",
                    suggested_action="Confirmer que le prestataire est bien listé comme centre agréé officiel.",
                    risk_level="High",
                )
            )

    guidance = _dedup(
        [
            "Cette estimation est basée sur des frais officiels fournis + des coûts optionnels saisis.",
            "Vérifiez tout frais signalé avant paiement (site ambassade/gouvernement/centre agréé).",
            "Vous pouvez modifier/retirer/ajouter des lignes: le total se mettra à jour.",
            "Conservez les reçus officiels (PDF/email) et évitez les paiements via tiers non vérifiés.",
        ]
    )

    return CostEngineResult(
        destination_region=dest,
        visa_type=vt,
        currency=cur,
        items=items,
        total_estimated=float(total),
        total_official=float(total_off),
        total_optional=float(total_opt),
        unknown_count=int(unknown),
        suspicious_alerts=alerts,
        guidance=guidance,
    )


def cost_engine_to_dict(r: CostEngineResult) -> dict[str, Any]:
    return {
        "destination_region": r.destination_region,
        "visa_type": r.visa_type,
        "currency": r.currency,
        "items": [
            {
                "category": i.category,
                "label": i.label,
                "amount": i.amount,
                "currency": i.currency,
                "official": bool(i.official),
                "optional": bool(i.optional),
                "notes": list(i.notes),
            }
            for i in r.items
        ],
        "totals": {
            "total_estimated": float(r.total_estimated),
            "total_official": float(r.total_official),
            "total_optional": float(r.total_optional),
            "unknown_count": int(r.unknown_count),
        },
        "suspicious_fees_alerts": [
            {
                "fee_flagged": a.fee_label,
                "reason_for_suspicion": a.reason,
                "suggested_action": a.suggested_action,
                "risk_level": a.risk_level,
            }
            for a in r.suspicious_alerts
        ],
        "guidance": list(r.guidance),
    }

