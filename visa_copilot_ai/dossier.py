from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .diagnostic import run_visa_diagnostic
from .documents import Document, DocumentCheckResult, DocumentIssue, DocumentType, check_documents
from .models import DiagnosticResult, UserProfile


@dataclass(frozen=True)
class DossierVerificationResult:
    visa_type: str
    destination_region: str
    diagnostic: DiagnosticResult
    document_check: DocumentCheckResult
    coherence_score: float  # 0..100
    readiness_score: float  # 0..100 (final)
    readiness_level: str  # "not_ready" | "almost_ready" | "ready"
    key_risks: list[str]
    next_best_actions: list[str]
    disclaimers: list[str]


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _dedup(seq: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in seq:
        x2 = " ".join((x or "").strip().split())
        if not x2 or x2 in seen:
            continue
        seen.add(x2)
        out.append(x2)
    return out


def _issue_penalty(issue: DocumentIssue) -> float:
    if issue.severity == "risk":
        return 18.0
    if issue.severity == "warning":
        return 8.0
    return 2.0


def verify_dossier(
    profile: UserProfile,
    documents: list[Document],
    *,
    visa_type: str,
    destination_region: str,
) -> DossierVerificationResult:
    """
    Vérifie la cohérence globale dossier + profil.

    Le but est de pousser la prévention: détecter les incohérences et pièces
    faibles AVANT le dépôt, sans jamais automatiser une soumission.
    """

    diag = run_visa_diagnostic(profile)
    doc_check = check_documents(documents, visa_type=visa_type, destination_region=destination_region)

    # Coherence score starts high and gets penalties.
    coherence = 92.0
    for issue in doc_check.issues:
        coherence -= _issue_penalty(issue)
    coherence -= 6.0 * len(doc_check.missing_document_types)
    coherence = _clamp(coherence, 0.0, 100.0)

    # Combine with diagnostic readiness but don't double count too harshly.
    # Final readiness: 55% diagnostic readiness + 45% coherence
    readiness = 0.55 * float(diag.readiness_score) + 0.45 * coherence
    readiness = _clamp(readiness, 0.0, 100.0)

    if readiness >= 75 and diag.refusal_risk_score <= 0.55 and len(doc_check.missing_document_types) == 0:
        level = "ready"
    elif readiness >= 55:
        level = "almost_ready"
    else:
        level = "not_ready"

    # Summaries: risks + actions
    risks: list[str] = []
    actions: list[str] = []

    risks.extend(diag.key_risks)
    actions.extend(diag.next_best_actions)

    for t in doc_check.missing_document_types:
        risks.append(f"Document manquant (template): {t.value}")
        actions.append("Compléter la checklist officielle et ajouter la pièce correspondante.")

    # Convert the most important document issues into high-signal risks/actions.
    for issue in doc_check.issues:
        if issue.severity in {"risk", "warning"}:
            risks.append(issue.message)
            actions.extend(issue.suggested_fix or [])

    disclaimers = _dedup(
        [
            *diag.disclaimers,
            *doc_check.disclaimers,
            "Ce score de dossier est une aide à la décision pour prioriser les risques. Il ne garantit pas un résultat.",
        ]
    )

    return DossierVerificationResult(
        visa_type=visa_type,
        destination_region=destination_region,
        diagnostic=diag,
        document_check=doc_check,
        coherence_score=round(float(coherence), 1),
        readiness_score=round(float(readiness), 1),
        readiness_level=level,
        key_risks=_dedup(risks),
        next_best_actions=_dedup(actions),
        disclaimers=disclaimers,
    )


def dossier_to_dict(r: DossierVerificationResult) -> dict[str, Any]:
    def _doc_type_list(ts: list[DocumentType]) -> list[str]:
        return [t.value for t in ts]

    def _issue_to_dict(i: DocumentIssue) -> dict[str, Any]:
        return {
            "severity": i.severity,
            "code": i.code,
            "message": i.message,
            "why": list(i.why),
            "suggested_fix": list(i.suggested_fix),
            "evidence": [
                {
                    "doc_id": e.doc_id,
                    "doc_type": e.doc_type,
                    "extracted_key": e.extracted_key,
                    "value": e.value,
                    "present": bool(e.present),
                    "note": e.note,
                }
                for e in (i.evidence or [])
            ],
        }

    return {
        "visa_type": r.visa_type,
        "destination_region": r.destination_region,
        "diagnostic": {
            "difficulty_level": r.diagnostic.difficulty_level,
            "refusal_risk_score": float(r.diagnostic.refusal_risk_score),
            "readiness_score": float(r.diagnostic.readiness_score),
            "key_risks": list(r.diagnostic.key_risks),
            "next_best_actions": list(r.diagnostic.next_best_actions),
            "anti_scam_warnings": list(r.diagnostic.anti_scam_warnings),
            "assumptions": list(r.diagnostic.assumptions),
            "disclaimers": list(r.diagnostic.disclaimers),
        },
        "document_check": {
            "missing_document_types": _doc_type_list(r.document_check.missing_document_types),
            "issues": [_issue_to_dict(i) for i in r.document_check.issues],
            "assumptions": list(r.document_check.assumptions),
            "disclaimers": list(r.document_check.disclaimers),
        },
        "coherence_score": float(r.coherence_score),
        "readiness_score": float(r.readiness_score),
        "readiness_level": r.readiness_level,
        "key_risks": list(r.key_risks),
        "next_best_actions": list(r.next_best_actions),
        "disclaimers": list(r.disclaimers),
    }

