from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .dossier import verify_dossier
from .documents import Document, DocumentType
from .models import UserProfile


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


def _risk_from_severity(sev: str) -> str:
    s = _norm(sev).lower()
    if s == "risk":
        return "High"
    if s == "warning":
        return "Medium"
    return "Low"


def _priority_from_risk(risk: str) -> str:
    r = _norm(risk).lower()
    if r == "high":
        return "High"
    if r == "medium":
        return "Medium"
    return "Low"


@dataclass(frozen=True)
class Finding:
    id: str
    issue: str
    description: str
    risk_level: str  # Low | Medium | High
    priority: str  # Low | Medium | High
    suggested_action: str
    status: str  # Pending | Completed | Not Applicable
    action: Optional[dict[str, Any]] = None  # UI hint (route/params)


@dataclass(frozen=True)
class FinalCheckResult:
    total_checks: int
    counts: dict[str, int]  # High/Medium/Low
    readiness_status: str  # Ready | Needs Attention | Blocked
    findings: list[Finding]
    next_steps_ready: list[str]
    next_steps_blocked: list[str]
    final_user_prompt: str


def run_final_verification(
    *,
    profile: UserProfile,
    destination_region: str,
    visa_type: str,
    documents: list[Document],
    travel_signals: Optional[dict[str, Any]] = None,
    cost_signals: Optional[dict[str, Any]] = None,
    timeline_signals: Optional[dict[str, Any]] = None,
    completed_finding_ids: Optional[list[str]] = None,
) -> FinalCheckResult:
    dest = _norm(destination_region)
    vt = _norm(visa_type)
    completed = {(_norm(x).lower()) for x in (completed_finding_ids or []) if _norm(x)}

    dossier = verify_dossier(profile, documents, visa_type=vt, destination_region=dest)
    findings: list[Finding] = []

    def mk_status(fid: str) -> str:
        return "Completed" if fid.lower() in completed else "Pending"

    # --- A) Documents completeness + consistency (reuse dossier issues/evidence)
    for t in dossier.document_check.missing_document_types:
        fid = f"missing_{t.value}"
        risk = "High" if t in {DocumentType.PASSPORT, DocumentType.BANK_STATEMENT} else "Medium"
        findings.append(
            Finding(
                id=fid,
                issue=f"Document manquant: {t.value}",
                description="Pièce attendue dans la checklist (template) non trouvée dans le coffre.",
                risk_level=risk,
                priority=_priority_from_risk(risk),
                suggested_action="Ajouter ce document dans Documents (scan lisible, version récente si applicable).",
                status=mk_status(fid),
                action={"action_key": "open_documents", "params": {"doc_type": t.value}},
            )
        )

    for i in dossier.document_check.issues:
        rid = f"doc_issue_{_norm(i.code).lower()}"
        risk = _risk_from_severity(i.severity)
        ev = (i.evidence or [])[:1]
        action: Optional[dict[str, Any]] = {"action_key": "open_dossier"}
        if ev:
            e = ev[0]
            # If the evidence references a document, we can point to edit with focus
            if _norm(e.doc_id):
                action = {"action_key": "open_document_edit", "params": {"id": e.doc_id, "focus": e.extracted_key}}
            else:
                action = {"action_key": "open_document_add", "params": {"doc_type": e.doc_type}}

        findings.append(
            Finding(
                id=rid,
                issue=i.message,
                description="; ".join([_norm(x) for x in (i.why or [])[:2] if _norm(x)]) or "Incohérence détectée via analyse de dossier.",
                risk_level=risk,
                priority=_priority_from_risk(risk),
                suggested_action=(_norm((i.suggested_fix or [""])[0]) or "Corriger la pièce/valeur puis relancer la vérification."),
                status=mk_status(rid),
                action=action,
            )
        )

    # --- B) Itinerary alignment
    ts = travel_signals or {}
    travel_ready = bool(ts.get("travel_plan_ready", False))
    travel_high_alerts = int(ts.get("travel_high_risks", 0) or 0)
    if not travel_ready:
        fid = "travel_missing"
        findings.append(
            Finding(
                id=fid,
                issue="Itinéraire non finalisé",
                description="Aucun itinéraire/export détecté. Sans plan cohérent, le dossier peut être jugé faible.",
                risk_level="Medium",
                priority="High",
                suggested_action="Générer un itinéraire visa‑compliant et exporter les dates clés dans la timeline.",
                status=mk_status(fid),
                action={"action_key": "open_travel"},
            )
        )
    elif travel_high_alerts > 0:
        fid = "travel_high_alerts"
        findings.append(
            Finding(
                id=fid,
                issue="Alertes itinéraire à risque élevé",
                description="L’itinéraire contient des alertes High (durée, budget, conformité) à corriger avant dépôt.",
                risk_level="High",
                priority="High",
                suggested_action="Ouvrir Travel Intelligence, résoudre les alertes High, puis ré-exporter la timeline.",
                status=mk_status(fid),
                action={"action_key": "open_travel"},
            )
        )

    # --- C) Costs & payments
    cs = cost_signals or {}
    costs_ready = bool(cs.get("costs_ready", False))
    suspicious = int(cs.get("suspicious_fees_high", 0) or 0)
    unknown = int(cs.get("unknown_count", 0) or 0)
    if not costs_ready:
        fid = "costs_missing"
        findings.append(
            Finding(
                id=fid,
                issue="Estimation des coûts manquante",
                description="Aucune estimation de frais/paiement détectée. Risque de surprises ou frais non officiels.",
                risk_level="Medium",
                priority="Medium",
                suggested_action="Renseigner les frais officiels et vérifier les alertes de frais suspects.",
                status=mk_status(fid),
                action={"action_key": "open_costs"},
            )
        )
    if suspicious > 0:
        fid = "costs_suspicious"
        findings.append(
            Finding(
                id=fid,
                issue="Frais suspects détectés",
                description="Des frais semblent élevés/non officiels/doublonnés.",
                risk_level="High",
                priority="High",
                suggested_action="Vérifier le barème officiel et supprimer/justifier les frais non officiels avant paiement.",
                status=mk_status(fid),
                action={"action_key": "open_costs"},
            )
        )
    if unknown > 0:
        fid = "costs_unknown"
        findings.append(
            Finding(
                id=fid,
                issue="Montants de frais inconnus",
                description="Certains montants sont vides: le total est provisoire.",
                risk_level="Low",
                priority="Low",
                suggested_action="Compléter les montants manquants si possible (frais officiels, biométrie, service).",
                status=mk_status(fid),
                action={"action_key": "open_costs"},
            )
        )

    # --- D) Appointments & deadlines
    tl = timeline_signals or {}
    appointment_ready = bool(tl.get("appointment_ready", False))
    overlap = int(tl.get("overlap_conflicts", 0) or 0)
    if not appointment_ready:
        fid = "appointment_missing"
        findings.append(
            Finding(
                id=fid,
                issue="Rendez‑vous/biométrie non planifié",
                description="Aucun événement RDV/biométrie détecté dans la timeline.",
                risk_level="Medium",
                priority="Medium",
                suggested_action="Ouvrir Portail/centre agréé, réserver le RDV, puis enregistrer la date dans la timeline.",
                status=mk_status(fid),
                action={"action_key": "open_appointments"},
            )
        )
    if overlap > 0:
        fid = "timeline_overlap"
        findings.append(
            Finding(
                id=fid,
                issue="Conflits de dates détectés",
                description="Chevauchement entre dates de voyage/obligations/rdv possible.",
                risk_level="Medium",
                priority="High",
                suggested_action="Vérifier la timeline et ajuster dates/événements avant dépôt.",
                status=mk_status(fid),
                action={"action_key": "open_appointments"},
            )
        )

    # --- E) Prior refusals / plan B
    if int(getattr(profile, "prior_visa_refusals", 0) or 0) >= 1:
        fid = "prior_refusals_review"
        findings.append(
            Finding(
                id=fid,
                issue="Refus antérieur: réponse documentée recommandée",
                description="Un refus antérieur augmente le niveau de contrôle. Une réponse claire aux motifs du refus aide la cohérence.",
                risk_level="Medium",
                priority="High",
                suggested_action="Analyser le refus (module discret) et préparer une lettre explicative factuelle + preuves corrigées.",
                status=mk_status(fid),
                action={"action_key": "open_refusal_discreet"},
            )
        )

    # Counts and readiness
    counts = {"High": 0, "Medium": 0, "Low": 0}
    for f in findings:
        counts[f.risk_level] = int(counts.get(f.risk_level, 0) or 0) + (1 if f.status == "Pending" else 0)

    if counts["High"] > 0:
        readiness = "Blocked"
    elif counts["Medium"] > 0:
        readiness = "Needs Attention"
    else:
        readiness = "Ready"

    total_checks = len(findings)

    ready_now: list[str] = []
    blocked_now: list[str] = []
    for f in findings:
        if f.status != "Pending":
            continue
        if f.risk_level in {"High", "Medium"}:
            ready_now.append(f"{f.issue} → {f.suggested_action}")
        else:
            blocked_now.append(f"{f.issue} (peut attendre)")

    final_prompt = (
        "Votre vérification finale est terminée. Souhaitez-vous :\n"
        "1) Corriger les points High en priorité maintenant ?\n"
        "2) Revoir les contrôles Medium/Low ?\n"
        "3) Générer un rapport de readiness pour la soumission ?"
    )

    return FinalCheckResult(
        total_checks=total_checks,
        counts=counts,
        readiness_status=readiness,
        findings=findings,
        next_steps_ready=ready_now[:8],
        next_steps_blocked=blocked_now[:8],
        final_user_prompt=final_prompt,
    )


def final_check_to_dict(r: FinalCheckResult) -> dict[str, Any]:
    return {
        "A_dossier_summary": {
            "total_checks": int(r.total_checks),
            "high_risks": int(r.counts.get("High", 0)),
            "medium_risks": int(r.counts.get("Medium", 0)),
            "low_risks": int(r.counts.get("Low", 0)),
            "readiness_status": r.readiness_status,
        },
        "B_detailed_findings": [
            {
                "id": f.id,
                "issue": f.issue,
                "description": f.description,
                "risk_level": f.risk_level,
                "priority": f.priority,
                "suggested_action": f.suggested_action,
                "status": f.status,
                "action": f.action,
            }
            for f in r.findings
        ],
        "C_next_steps_summary": {
            "what_to_do_now": list(r.next_steps_ready),
            "what_is_blocked": list(r.next_steps_blocked),
        },
        "final_user_prompt": r.final_user_prompt,
    }

