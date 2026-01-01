from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Any, Optional


class DocumentType(str, Enum):
    PASSPORT = "passport"
    PHOTO = "photo"
    BANK_STATEMENT = "bank_statement"
    PAYSLIPS = "payslips"
    EMPLOYMENT_LETTER = "employment_letter"
    BUSINESS_REGISTRATION = "business_registration"
    STUDENT_CERTIFICATE = "student_certificate"
    ENROLLMENT_LETTER = "enrollment_letter"
    INVITATION_LETTER = "invitation_letter"
    TRAVEL_INSURANCE = "travel_insurance"
    ACCOMMODATION_PLAN = "accommodation_plan"
    ITINERARY = "itinerary"
    CIVIL_STATUS = "civil_status"
    SPONSOR_LETTER = "sponsor_letter"
    OTHER = "other"


@dataclass(frozen=True)
class Document:
    """
    Représentation neutre d'un document.

    - Pas de stockage binaire ici.
    - On ne fait pas d'OCR réel dans ce dépôt; on accepte des "extracted fields"
      (provenant d'une étape OCR externe) pour pouvoir faire de la cohérence.
    """

    doc_id: str
    doc_type: DocumentType
    filename: str = ""
    issued_date: Optional[date] = None
    expires_date: Optional[date] = None
    extracted: dict[str, Any] = field(default_factory=dict)
    notes: str = ""


@dataclass(frozen=True)
class DocumentIssue:
    severity: str  # "info" | "warning" | "risk"
    code: str
    message: str
    why: list[str] = field(default_factory=list)
    suggested_fix: list[str] = field(default_factory=list)
    evidence: list["DocumentEvidence"] = field(default_factory=list)


@dataclass(frozen=True)
class DocumentEvidence:
    """
    Preuve structurée utilisée pour justifier une issue.

    - doc_id: identifiant du document concerné (vide si doc manquant).
    - doc_type: type du document (même si manquant, pour guider l’UI "Ajouter").
    - extracted_key: clé extraite (ex: expires_date, issued_date, ending_balance_usd).
    - value: valeur extraite (si disponible).
    - present: True si la valeur est présente / le doc existe, False sinon.
    - note: mini explication destinée à l’utilisateur.
    """

    doc_id: str
    doc_type: str
    extracted_key: str
    value: Any
    present: bool
    note: str = ""


@dataclass(frozen=True)
class DocumentCheckResult:
    missing_document_types: list[DocumentType]
    issues: list[DocumentIssue]
    assumptions: list[str]
    disclaimers: list[str]


def _today() -> date:
    return date.today()


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


def _parse_iso_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    s = _norm(value)
    if not s:
        return None
    try:
        return datetime.fromisoformat(s).date()
    except Exception:
        return None


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


def required_documents_template(visa_type: str, destination_region: str) -> list[DocumentType]:
    """
    Template minimal et générique.
    IMPORTANT: à compléter via sources officielles (par pays/visa).
    """

    v = _norm(visa_type).lower()
    d = _norm(destination_region).lower()

    base = [
        DocumentType.PASSPORT,
        DocumentType.PHOTO,
    ]

    if "schengen" in d or "europe" in d:
        base += [
            DocumentType.BANK_STATEMENT,
            DocumentType.TRAVEL_INSURANCE,
            DocumentType.ITINERARY,
            DocumentType.ACCOMMODATION_PLAN,
        ]
    if "uk" in d or "royaume" in d:
        base += [
            DocumentType.BANK_STATEMENT,
            DocumentType.ITINERARY,
            DocumentType.ACCOMMODATION_PLAN,
        ]
    if "us" in d or "usa" in d:
        base += [
            DocumentType.BANK_STATEMENT,
        ]
    if "study" in v or "étud" in v:
        base += [
            DocumentType.ENROLLMENT_LETTER,
            DocumentType.STUDENT_CERTIFICATE,
        ]
    if "business" in v or "affair" in v:
        base += [
            DocumentType.INVITATION_LETTER,
        ]
    if "family" in v or "famill" in v:
        base += [
            DocumentType.INVITATION_LETTER,
            DocumentType.CIVIL_STATUS,
        ]

    # De-dup while preserving order
    seen: set[DocumentType] = set()
    out: list[DocumentType] = []
    for t in base:
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def check_documents(
    documents: list[Document],
    *,
    visa_type: str,
    destination_region: str,
) -> DocumentCheckResult:
    """
    Contrôles de cohérence basiques + complétude (prévention).
    """

    assumptions: list[str] = []
    issues: list[DocumentIssue] = []

    # Index by type
    by_type: dict[DocumentType, list[Document]] = {}
    for doc in documents:
        by_type.setdefault(doc.doc_type, []).append(doc)

    required = required_documents_template(visa_type, destination_region)
    missing = [t for t in required if t not in by_type]

    if missing:
        issues.append(
            DocumentIssue(
                severity="risk",
                code="MISSING_REQUIRED_DOCS",
                message="Documents potentiellement requis manquants (template générique).",
                why=[
                    "Les refus proviennent souvent de pièces manquantes ou incomplètes.",
                    "Ce template est générique: la liste officielle dépend du pays/visa/nationalité.",
                ],
                suggested_fix=[
                    "Vérifier la checklist officielle (ambassade/gouvernement) et compléter le dossier avant dépôt.",
                ],
                evidence=[
                    DocumentEvidence(
                        doc_id="",
                        doc_type=t.value,
                        extracted_key="document",
                        value=None,
                        present=False,
                        note="Pièce absente (template).",
                    )
                    for t in missing
                ],
            )
        )

    # Passport checks
    passports = by_type.get(DocumentType.PASSPORT, [])
    if passports:
        # Choose most relevant: the one with latest expires_date
        p = sorted(passports, key=lambda x: (x.expires_date or date.min), reverse=True)[0]
        exp = p.expires_date or _parse_iso_date(p.extracted.get("expires_date"))
        if exp is None:
            assumptions.append("Date d'expiration du passeport inconnue.")
            issues.append(
                DocumentIssue(
                    severity="risk",
                    code="PASSPORT_EXPIRY_UNKNOWN",
                    message="Expiration du passeport non fournie: impossible de vérifier la validité.",
                    suggested_fix=["Ajouter la date d'expiration (ou re-scan OCR) et vérifier les règles officielles."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=p.doc_id,
                            doc_type=p.doc_type.value,
                            extracted_key="expires_date",
                            value=p.extracted.get("expires_date"),
                            present=False,
                            note="Champ requis pour vérifier la validité du passeport.",
                        )
                    ],
                )
            )
        else:
            if exp <= _today():
                issues.append(
                    DocumentIssue(
                        severity="risk",
                        code="PASSPORT_EXPIRED",
                        message="Passeport expiré.",
                        why=["Un passeport expiré rend la demande irrecevable dans la plupart des cas."],
                        suggested_fix=["Renouveler le passeport avant toute démarche visa."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=p.doc_id,
                                doc_type=p.doc_type.value,
                                extracted_key="expires_date",
                                value=exp.isoformat(),
                                present=True,
                                note="Date d'expiration extraite/utilisée pour le contrôle.",
                            )
                        ],
                    )
                )
            elif (exp - _today()).days < 180:
                issues.append(
                    DocumentIssue(
                        severity="warning",
                        code="PASSPORT_EXPIRY_SOON",
                        message="Passeport proche de l'expiration (< 6 mois).",
                        why=["De nombreux pays exigent 3 à 6 mois de validité après le retour."],
                        suggested_fix=["Vérifier l'exigence officielle; envisager un renouvellement préventif."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=p.doc_id,
                                doc_type=p.doc_type.value,
                                extracted_key="expires_date",
                                value=exp.isoformat(),
                                present=True,
                                note="Date d'expiration extraite/utilisée pour le contrôle.",
                            )
                        ],
                    )
                )

        # Name consistency (if extracted)
        name = _norm(p.extracted.get("full_name"))
        passport_no = _norm(p.extracted.get("passport_number"))
        if not name:
            assumptions.append("Nom complet non extrait du passeport.")
        if not passport_no:
            assumptions.append("Numéro de passeport non extrait.")
    else:
        issues.append(
            DocumentIssue(
                severity="risk",
                code="NO_PASSPORT",
                message="Passeport non fourni.",
                why=["Le passeport est la pièce centrale du dossier."],
                suggested_fix=["Ajouter un scan clair de la page d'identité du passeport."],
                evidence=[
                    DocumentEvidence(
                        doc_id="",
                        doc_type=DocumentType.PASSPORT.value,
                        extracted_key="document",
                        value=None,
                        present=False,
                        note="Passeport absent.",
                    )
                ],
            )
        )

    # Bank statement checks (freshness / basic signals)
    bank = by_type.get(DocumentType.BANK_STATEMENT, [])
    if bank:
        # Any with recent issued_date?
        freshest = sorted(bank, key=lambda x: (x.issued_date or date.min), reverse=True)[0]
        issued = freshest.issued_date or _parse_iso_date(freshest.extracted.get("issued_date"))
        if issued is None:
            assumptions.append("Date d'émission du relevé bancaire inconnue.")
        else:
            if (_today() - issued).days > 120:
                issues.append(
                    DocumentIssue(
                        severity="warning",
                        code="BANK_STATEMENT_OLD",
                        message="Relevé bancaire ancien (> 4 mois).",
                        why=["Les consulats demandent souvent des relevés récents (ex: 3 derniers mois)."],
                        suggested_fix=["Fournir des relevés plus récents selon la règle officielle."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=freshest.doc_id,
                                doc_type=freshest.doc_type.value,
                                extracted_key="issued_date",
                                value=issued.isoformat(),
                                present=True,
                                note="Date d'émission utilisée pour calculer l'ancienneté.",
                            )
                        ],
                    )
                )

        balance = freshest.extracted.get("ending_balance_usd")
        try:
            if balance is not None and float(balance) < 0:
                issues.append(
                    DocumentIssue(
                        severity="warning",
                        code="BANK_NEGATIVE_BALANCE",
                        message="Solde négatif détecté sur un relevé (signal de risque).",
                        suggested_fix=["Clarifier la situation financière; éviter incohérences budget/durée."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=freshest.doc_id,
                                doc_type=freshest.doc_type.value,
                                extracted_key="ending_balance_usd",
                                value=balance,
                                present=True,
                                note="Solde de fin détecté sur le relevé.",
                            )
                        ],
                    )
                )
        except Exception:
            assumptions.append("Solde non interprétable sur relevé bancaire (format OCR).")

    # Insurance checks
    ins = by_type.get(DocumentType.TRAVEL_INSURANCE, [])
    if ins:
        d0 = ins[0]
        exp = d0.expires_date or _parse_iso_date(d0.extracted.get("expires_date"))
        if exp is not None and exp <= _today():
            issues.append(
                DocumentIssue(
                    severity="warning",
                    code="INSURANCE_EXPIRED",
                    message="Assurance voyage expirée.",
                    why=["Une assurance doit couvrir les dates exactes du séjour (si requise)."],
                    suggested_fix=["Mettre à jour l'assurance aux dates du voyage (sans paiement irréversible avant visa)."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=d0.doc_id,
                            doc_type=d0.doc_type.value,
                            extracted_key="expires_date",
                            value=exp.isoformat(),
                            present=True,
                            note="Date d'expiration utilisée pour vérifier la couverture.",
                        )
                    ],
                )
            )

    disclaimers = [
        "Ces contrôles sont génériques: la liste officielle des documents dépend du pays, du visa, de la nationalité et du contexte.",
        "Aucune falsification: si un élément manque ou paraît faible, la solution est d'améliorer le dossier, pas de créer de faux documents.",
    ]

    return DocumentCheckResult(
        missing_document_types=missing,
        issues=issues,
        assumptions=_dedup(assumptions),
        disclaimers=disclaimers,
    )

