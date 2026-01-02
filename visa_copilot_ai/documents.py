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
    # Document sensible: refus consulaire (activations discrètes côté UI)
    REFUSAL_LETTER = "refusal_letter"
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


def _norm_key(s: Any) -> str:
    """
    Normalisation agressive pour comparaison de noms/champs:
    - minuscules
    - suppression des espaces/punct simples
    """
    out = []
    for ch in _norm(s).lower():
        if ch.isalnum():
            out.append(ch)
    return "".join(out)


def _name_like(a: Any, b: Any) -> bool:
    """
    Comparaison "souple" de noms:
    - égalité normalisée, ou inclusion (ex: "john doe" vs "john m doe")
    """
    na = _norm_key(a)
    nb = _norm_key(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    # Inclusions pour tolérer 2e prénom/variantes.
    return na in nb or nb in na


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


def _parse_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            return float(value)
        except Exception:
            return None
    s = _norm(value).replace(",", "")
    if not s:
        return None
    try:
        return float(s)
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


def _region_min_passport_validity_after_trip_days(destination_region: str) -> int:
    d = _norm(destination_region).lower()
    # Heuristique conservatrice: Schengen ~ 3 mois après le départ,
    # beaucoup d’autres destinations ~ 6 mois.
    if "schengen" in d or "europe" in d:
        return 90
    return 180


def _region_daily_budget_usd(destination_region: str) -> float:
    d = _norm(destination_region).lower()
    # Heuristiques (ordre de grandeur) — à confirmer sur sources officielles.
    if "schengen" in d or "europe" in d:
        return 110.0
    if "uk" in d or "royaume" in d:
        return 140.0
    if "us" in d or "usa" in d:
        return 160.0
    return 90.0


def _extract_trip_window(
    docs: list[Document],
) -> tuple[Optional[date], Optional[date], list[DocumentEvidence]]:
    """
    Extrait une fenêtre de voyage (start/end) depuis itinerary/accommodation.
    Retourne: start, end, evidence.
    """
    start: Optional[date] = None
    end: Optional[date] = None
    evidence: list[DocumentEvidence] = []

    key_pairs = [
        ("start_date", "end_date"),
        ("trip_start_date", "trip_end_date"),
        ("travel_start_date", "travel_end_date"),
    ]

    candidates = [d for d in docs if d.doc_type in {DocumentType.ITINERARY, DocumentType.ACCOMMODATION_PLAN}]

    for doc in candidates:
        for k_start, k_end in key_pairs:
            raw_s = doc.extracted.get(k_start)
            raw_e = doc.extracted.get(k_end)
            parsed_s = _parse_iso_date(raw_s)
            parsed_e = _parse_iso_date(raw_e)

            if raw_s is not None or raw_e is not None:
                evidence.append(
                    DocumentEvidence(
                        doc_id=doc.doc_id,
                        doc_type=doc.doc_type.value,
                        extracted_key=k_start,
                        value=raw_s,
                        present=parsed_s is not None,
                        note="Date de début voyage (itinéraire/hébergement).",
                    )
                )
                evidence.append(
                    DocumentEvidence(
                        doc_id=doc.doc_id,
                        doc_type=doc.doc_type.value,
                        extracted_key=k_end,
                        value=raw_e,
                        present=parsed_e is not None,
                        note="Date de fin voyage (itinéraire/hébergement).",
                    )
                )

            if parsed_s is not None:
                start = parsed_s if start is None else min(start, parsed_s)
            if parsed_e is not None:
                end = parsed_e if end is None else max(end, parsed_e)

    return start, end, evidence


def _is_schengen(destination_region: str) -> bool:
    d = _norm(destination_region).lower()
    return ("schengen" in d) or ("europe" in d)


def _relationship_implies_family(rel: str) -> bool:
    r = _norm(rel).lower()
    if not r:
        return False
    return any(k in r for k in ["spouse", "wife", "husband", "époux", "epoux", "épouse", "epouse", "mari", "femme", "parent", "famill", "sister", "brother", "mother", "father"])


def _extract_address_like(doc: Document) -> str:
    return _norm(
        doc.extracted.get("address")
        or doc.extracted.get("host_address")
        or doc.extracted.get("accommodation_address")
        or doc.extracted.get("hotel_address")
        or doc.extracted.get("stay_address")
    )


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
    passport_doc: Optional[Document] = None
    if passports:
        # Choose most relevant: the one with latest expires_date
        passport_doc = sorted(passports, key=lambda x: (x.expires_date or date.min), reverse=True)[0]
        exp = passport_doc.expires_date or _parse_iso_date(passport_doc.extracted.get("expires_date"))
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
                            doc_id=passport_doc.doc_id,
                            doc_type=passport_doc.doc_type.value,
                            extracted_key="expires_date",
                            value=passport_doc.extracted.get("expires_date"),
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
                                doc_id=passport_doc.doc_id,
                                doc_type=passport_doc.doc_type.value,
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
                                doc_id=passport_doc.doc_id,
                                doc_type=passport_doc.doc_type.value,
                                extracted_key="expires_date",
                                value=exp.isoformat(),
                                present=True,
                                note="Date d'expiration extraite/utilisée pour le contrôle.",
                            )
                        ],
                    )
                )

        # Name consistency (if extracted)
        name = _norm(passport_doc.extracted.get("full_name"))
        passport_no = _norm(passport_doc.extracted.get("passport_number"))
        if not name:
            assumptions.append("Nom complet non extrait du passeport.")
            issues.append(
                DocumentIssue(
                    severity="warning",
                    code="PASSPORT_NAME_MISSING",
                    message="Nom complet non extrait du passeport.",
                    why=["Le nom sert à vérifier les cohérences (réservations, invitations, relevés, formulaires)."],
                    suggested_fix=["Compléter `full_name` (ou re-scan OCR) à partir de la page d'identité."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=passport_doc.doc_id,
                            doc_type=passport_doc.doc_type.value,
                            extracted_key="full_name",
                            value=passport_doc.extracted.get("full_name"),
                            present=False,
                            note="Champ utile pour vérifier les incohérences entre pièces.",
                        )
                    ],
                )
            )
        if not passport_no:
            assumptions.append("Numéro de passeport non extrait.")
            issues.append(
                DocumentIssue(
                    severity="warning",
                    code="PASSPORT_NUMBER_MISSING",
                    message="Numéro de passeport non extrait.",
                    why=["Souvent requis sur formulaires, assurances, lettres d'invitation, etc."],
                    suggested_fix=["Compléter `passport_number` (ou re-scan OCR) à partir de la page d'identité."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=passport_doc.doc_id,
                            doc_type=passport_doc.doc_type.value,
                            extracted_key="passport_number",
                            value=passport_doc.extracted.get("passport_number"),
                            present=False,
                            note="Champ souvent demandé dans d'autres pièces et formulaires.",
                        )
                    ],
                )
            )
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
            issues.append(
                DocumentIssue(
                    severity="warning",
                    code="BANK_STATEMENT_ISSUED_UNKNOWN",
                    message="Date d'émission du relevé bancaire manquante: impossible d'évaluer la fraîcheur.",
                    why=["Les consulats demandent souvent des relevés récents (ex: 3 derniers mois)."],
                    suggested_fix=["Compléter `issued_date` (ou re-scan OCR) et fournir des relevés récents."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=freshest.doc_id,
                            doc_type=freshest.doc_type.value,
                            extracted_key="issued_date",
                            value=freshest.extracted.get("issued_date"),
                            present=False,
                            note="Champ requis pour vérifier l'ancienneté du relevé.",
                        )
                    ],
                )
            )
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
            issues.append(
                DocumentIssue(
                    severity="warning",
                    code="BANK_BALANCE_UNPARSABLE",
                    message="Solde de fin non interprétable sur le relevé (format/ocr).",
                    why=["Un champ illisible peut empêcher une évaluation correcte des capacités financières."],
                    suggested_fix=["Corriger `ending_balance_usd` (nombre) ou fournir un relevé plus lisible."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=freshest.doc_id,
                            doc_type=freshest.doc_type.value,
                            extracted_key="ending_balance_usd",
                            value=balance,
                            present=balance is not None,
                            note="La valeur doit être un nombre (ex: 2500).",
                        )
                    ],
                )
            )

        # Coherence cross-doc: account holder name vs passport full_name (if both present)
        if passport_doc is not None:
            passport_name = _norm(passport_doc.extracted.get("full_name"))
            acct_name = _norm(freshest.extracted.get("account_holder_name"))
            if passport_name and acct_name and not _name_like(passport_name, acct_name):
                issues.append(
                    DocumentIssue(
                        severity="warning",
                        code="NAME_MISMATCH_PASSPORT_BANK",
                        message="Incohérence de nom entre passeport et relevé bancaire.",
                        why=["Les incohérences (même mineures) peuvent déclencher une demande de clarification."],
                        suggested_fix=["Vérifier l'orthographe, les prénoms/nom, et ajouter une explication si nécessaire."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=passport_doc.doc_id,
                                doc_type=passport_doc.doc_type.value,
                                extracted_key="full_name",
                                value=passport_name,
                                present=True,
                                note="Nom extrait du passeport.",
                            ),
                            DocumentEvidence(
                                doc_id=freshest.doc_id,
                                doc_type=freshest.doc_type.value,
                                extracted_key="account_holder_name",
                                value=acct_name,
                                present=True,
                                note="Nom du titulaire extrait du relevé.",
                            ),
                        ],
                    )
                )

    # Insurance checks
    ins = by_type.get(DocumentType.TRAVEL_INSURANCE, [])
    if ins:
        d0 = ins[0]
        exp = d0.expires_date or _parse_iso_date(d0.extracted.get("expires_date"))
        if exp is None:
            issues.append(
                DocumentIssue(
                    severity="warning",
                    code="INSURANCE_EXPIRY_UNKNOWN",
                    message="Date d'expiration de l'assurance voyage manquante: impossible de vérifier la couverture.",
                    why=["Si l'assurance est requise, elle doit couvrir les dates exactes du séjour."],
                    suggested_fix=["Compléter `expires_date` (ou re-scan OCR) et vérifier les exigences officielles."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=d0.doc_id,
                            doc_type=d0.doc_type.value,
                            extracted_key="expires_date",
                            value=d0.extracted.get("expires_date"),
                            present=False,
                            note="Champ requis pour vérifier la validité/couverture.",
                        )
                    ],
                )
            )
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

        # Schengen-specific: minimum medical coverage amount (heuristic)
        if _is_schengen(destination_region):
            cov_eur = _parse_float(d0.extracted.get("coverage_amount_eur") or d0.extracted.get("medical_coverage_eur"))
            if cov_eur is None:
                issues.append(
                    DocumentIssue(
                        severity="info",
                        code="INSURANCE_COVERAGE_AMOUNT_UNKNOWN_SCHENGEN",
                        message="Assurance (Schengen): montant de couverture médicale non fourni — impossible de vérifier le seuil.",
                        why=["Pour Schengen, une couverture minimale (souvent 30 000€) est généralement exigée — à confirmer sur la source officielle."],
                        suggested_fix=["Compléter `coverage_amount_eur` (ou `medical_coverage_eur`) ou vérifier la police d'assurance."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=d0.doc_id,
                                doc_type=d0.doc_type.value,
                                extracted_key="coverage_amount_eur",
                                value=d0.extracted.get("coverage_amount_eur") or d0.extracted.get("medical_coverage_eur"),
                                present=False,
                                note="Montant de couverture médicale (EUR).",
                            )
                        ],
                    )
                )
            else:
                if cov_eur < 30000.0:
                    issues.append(
                        DocumentIssue(
                            severity="risk",
                            code="INSURANCE_COVERAGE_AMOUNT_LOW_SCHENGEN",
                            message="Assurance (Schengen): montant de couverture médicale possiblement insuffisant (< 30 000€).",
                            why=["Le seuil exact dépend du pays et de la police; 30 000€ est un standard fréquent pour Schengen."],
                            suggested_fix=["Choisir/mettre à jour une assurance conforme aux exigences officielles (et aux dates du voyage)."],
                            evidence=[
                                DocumentEvidence(
                                    doc_id=d0.doc_id,
                                    doc_type=d0.doc_type.value,
                                    extracted_key="coverage_amount_eur",
                                    value=cov_eur,
                                    present=True,
                                    note="Montant de couverture médicale (EUR) utilisé pour la vérification.",
                                )
                            ],
                        )
                    )

    # Invitation letter: key fields + name coherence
    invs = by_type.get(DocumentType.INVITATION_LETTER, [])
    if invs:
        inv = invs[0]
        invitee = _norm(inv.extracted.get("invitee_name") or inv.extracted.get("guest_name"))
        host = _norm(inv.extracted.get("host_name"))
        rel = _norm(inv.extracted.get("relationship"))
        addr = _norm(inv.extracted.get("host_address"))
        missing_keys: list[str] = []
        for k, v in [("invitee_name", invitee), ("host_name", host), ("relationship", rel), ("host_address", addr)]:
            if not v:
                missing_keys.append(k)
        if missing_keys:
            issues.append(
                DocumentIssue(
                    severity="warning",
                    code="INVITATION_MISSING_CORE_FIELDS",
                    message="Lettre d’invitation incomplète (champs clés manquants).",
                    why=["Une invitation incomplète ou vague peut déclencher une demande de preuves supplémentaires."],
                    suggested_fix=["Compléter les champs manquants (nom invité, nom hôte, lien, adresse) ou fournir une lettre plus détaillée."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=inv.doc_id,
                            doc_type=inv.doc_type.value,
                            extracted_key=k,
                            value=inv.extracted.get(k),
                            present=False,
                            note="Champ attendu dans une lettre d'invitation.",
                        )
                        for k in missing_keys
                    ],
                )
            )
        if passport_doc is not None and invitee and _norm(passport_doc.extracted.get("full_name")):
            passport_name = _norm(passport_doc.extracted.get("full_name"))
            if passport_name and not _name_like(passport_name, invitee):
                issues.append(
                    DocumentIssue(
                        severity="warning",
                        code="NAME_MISMATCH_PASSPORT_INVITATION",
                        message="Incohérence de nom entre passeport et lettre d’invitation.",
                        why=["Les incohérences d'identité nécessitent souvent une clarification (orthographe, ordre des noms, translittération)."],
                        suggested_fix=["Corriger la lettre ou ajouter une explication (translittération/alias) si nécessaire."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=passport_doc.doc_id,
                                doc_type=passport_doc.doc_type.value,
                                extracted_key="full_name",
                                value=passport_name,
                                present=True,
                                note="Nom extrait du passeport.",
                            ),
                            DocumentEvidence(
                                doc_id=inv.doc_id,
                                doc_type=inv.doc_type.value,
                                extracted_key="invitee_name",
                                value=invitee,
                                present=True,
                                note="Nom invité extrait de la lettre.",
                            ),
                        ],
                    )
                )

    # Accommodation plan: guest name + date window coherence
    accs = by_type.get(DocumentType.ACCOMMODATION_PLAN, [])
    if accs:
        acc = accs[0]
        guest = _norm(acc.extracted.get("guest_name") or acc.extracted.get("traveler_name") or acc.extracted.get("full_name"))
        if passport_doc is not None and guest and _norm(passport_doc.extracted.get("full_name")):
            passport_name = _norm(passport_doc.extracted.get("full_name"))
            if passport_name and not _name_like(passport_name, guest):
                issues.append(
                    DocumentIssue(
                        severity="warning",
                        code="NAME_MISMATCH_PASSPORT_ACCOMMODATION",
                        message="Incohérence de nom entre passeport et plan d’hébergement.",
                        suggested_fix=["Vérifier que le nom du voyageur correspond exactement (ou expliquer la translittération)."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=passport_doc.doc_id,
                                doc_type=passport_doc.doc_type.value,
                                extracted_key="full_name",
                                value=passport_name,
                                present=True,
                                note="Nom passeport.",
                            ),
                            DocumentEvidence(
                                doc_id=acc.doc_id,
                                doc_type=acc.doc_type.value,
                                extracted_key="guest_name",
                                value=guest,
                                present=True,
                                note="Nom voyageur/hôte extrait de l'hébergement.",
                            ),
                        ],
                    )
                )

    # Itinerary: traveler name coherence + destination hint check
    itins = by_type.get(DocumentType.ITINERARY, [])
    if itins:
        itin = itins[0]
        traveler = _norm(itin.extracted.get("traveler_name") or itin.extracted.get("full_name"))
        if passport_doc is not None and traveler and _norm(passport_doc.extracted.get("full_name")):
            passport_name = _norm(passport_doc.extracted.get("full_name"))
            if passport_name and not _name_like(passport_name, traveler):
                issues.append(
                    DocumentIssue(
                        severity="warning",
                        code="NAME_MISMATCH_PASSPORT_ITINERARY",
                        message="Incohérence de nom entre passeport et itinéraire.",
                        suggested_fix=["Corriger le nom sur l'itinéraire ou expliquer l'écart (prénom manquant, translittération)."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=passport_doc.doc_id,
                                doc_type=passport_doc.doc_type.value,
                                extracted_key="full_name",
                                value=passport_name,
                                present=True,
                                note="Nom passeport.",
                            ),
                            DocumentEvidence(
                                doc_id=itin.doc_id,
                                doc_type=itin.doc_type.value,
                                extracted_key="traveler_name",
                                value=traveler,
                                present=True,
                                note="Nom sur itinéraire.",
                            ),
                        ],
                    )
                )
        dest = _norm(itin.extracted.get("destination") or itin.extracted.get("country") or itin.extracted.get("region"))
        if dest:
            # Soft check: if dest exists but doesn't mention destination_region hint.
            dr = _norm(destination_region)
            if dr and _norm_key(dr) not in _norm_key(dest):
                issues.append(
                    DocumentIssue(
                        severity="info",
                        code="ITINERARY_DESTINATION_MISMATCH",
                        message="Itinéraire: destination indiquée différente du paramètre de zone.",
                        why=["Ce n'est pas forcément un problème, mais une incohérence peut semer le doute."],
                        suggested_fix=["Vérifier que la destination/zone est correcte dans les paramètres et sur l'itinéraire."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=itin.doc_id,
                                doc_type=itin.doc_type.value,
                                extracted_key="destination",
                                value=dest,
                                present=True,
                                note="Destination extraite de l'itinéraire.",
                            )
                        ],
                    )
                )

    # Employment letter: employee_name coherence + freshness (letter_date)
    empls = by_type.get(DocumentType.EMPLOYMENT_LETTER, [])
    if empls:
        el = empls[0]
        emp_name = _norm(el.extracted.get("employee_name") or el.extracted.get("full_name"))
        letter_date = _parse_iso_date(el.extracted.get("letter_date") or el.extracted.get("issued_date"))
        if not emp_name:
            issues.append(
                DocumentIssue(
                    severity="warning",
                    code="EMPLOYMENT_LETTER_NAME_MISSING",
                    message="Attestation employeur: nom du salarié manquant/illisible.",
                    suggested_fix=["Compléter `employee_name` ou fournir une attestation plus lisible."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=el.doc_id,
                            doc_type=el.doc_type.value,
                            extracted_key="employee_name",
                            value=el.extracted.get("employee_name"),
                            present=False,
                            note="Nom du salarié attendu sur l'attestation.",
                        )
                    ],
                )
            )
        if passport_doc is not None and emp_name and _norm(passport_doc.extracted.get("full_name")):
            passport_name = _norm(passport_doc.extracted.get("full_name"))
            if passport_name and not _name_like(passport_name, emp_name):
                issues.append(
                    DocumentIssue(
                        severity="warning",
                        code="NAME_MISMATCH_PASSPORT_EMPLOYMENT",
                        message="Incohérence de nom entre passeport et attestation employeur.",
                        suggested_fix=["Vérifier l'orthographe et ajouter une explication si nécessaire."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=passport_doc.doc_id,
                                doc_type=passport_doc.doc_type.value,
                                extracted_key="full_name",
                                value=passport_name,
                                present=True,
                                note="Nom passeport.",
                            ),
                            DocumentEvidence(
                                doc_id=el.doc_id,
                                doc_type=el.doc_type.value,
                                extracted_key="employee_name",
                                value=emp_name,
                                present=True,
                                note="Nom salarié sur attestation.",
                            ),
                        ],
                    )
                )
        if letter_date is None:
            issues.append(
                DocumentIssue(
                    severity="warning",
                    code="EMPLOYMENT_LETTER_DATE_MISSING",
                    message="Attestation employeur: date manquante/illisible (fraîcheur non vérifiable).",
                    suggested_fix=["Compléter `letter_date` (YYYY-MM-DD) ou fournir une attestation récente."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=el.doc_id,
                            doc_type=el.doc_type.value,
                            extracted_key="letter_date",
                            value=el.extracted.get("letter_date") or el.extracted.get("issued_date"),
                            present=False,
                            note="La date sert à vérifier que la lettre est récente.",
                        )
                    ],
                )
            )
        else:
            if (_today() - letter_date).days > 120:
                issues.append(
                    DocumentIssue(
                        severity="warning",
                        code="EMPLOYMENT_LETTER_OLD",
                        message="Attestation employeur ancienne (> 4 mois).",
                        why=["Souvent, les documents de situation professionnelle doivent être récents."],
                        suggested_fix=["Demander une attestation plus récente et cohérente avec la période de voyage."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=el.doc_id,
                                doc_type=el.doc_type.value,
                                extracted_key="letter_date",
                                value=letter_date.isoformat(),
                                present=True,
                                note="Date utilisée pour vérifier la fraîcheur.",
                            )
                        ],
                    )
                )

    # Sponsor letter: beneficiary name coherence
    sps = by_type.get(DocumentType.SPONSOR_LETTER, [])
    if sps:
        sp = sps[0]
        beneficiary = _norm(sp.extracted.get("beneficiary_name") or sp.extracted.get("invitee_name") or sp.extracted.get("full_name"))
        sponsor_name = _norm(sp.extracted.get("sponsor_name") or sp.extracted.get("host_name"))
        sponsor_amount = _parse_float(sp.extracted.get("sponsor_amount_usd") or sp.extracted.get("amount_usd"))
        if not sponsor_name:
            issues.append(
                DocumentIssue(
                    severity="warning",
                    code="SPONSOR_NAME_MISSING",
                    message="Lettre de sponsor: nom du sponsor manquant/illisible.",
                    suggested_fix=["Compléter `sponsor_name` ou fournir une lettre plus explicite."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=sp.doc_id,
                            doc_type=sp.doc_type.value,
                            extracted_key="sponsor_name",
                            value=sp.extracted.get("sponsor_name") or sp.extracted.get("host_name"),
                            present=False,
                            note="Nom du sponsor attendu sur la lettre.",
                        )
                    ],
                )
            )
        if sponsor_amount is None:
            issues.append(
                DocumentIssue(
                    severity="info",
                    code="SPONSOR_AMOUNT_UNKNOWN",
                    message="Lettre de sponsor: montant de prise en charge non fourni — difficile d'évaluer la cohérence budget/durée.",
                    why=["En pratique, un sponsor doit souvent prouver sa capacité financière et préciser la prise en charge."],
                    suggested_fix=["Compléter `sponsor_amount_usd` (USD) et joindre des preuves financières du sponsor si requis."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=sp.doc_id,
                            doc_type=sp.doc_type.value,
                            extracted_key="sponsor_amount_usd",
                            value=sp.extracted.get("sponsor_amount_usd") or sp.extracted.get("amount_usd"),
                            present=False,
                            note="Montant de prise en charge (USD).",
                        )
                    ],
                )
            )
        if passport_doc is not None and beneficiary and _norm(passport_doc.extracted.get("full_name")):
            passport_name = _norm(passport_doc.extracted.get("full_name"))
            if passport_name and not _name_like(passport_name, beneficiary):
                issues.append(
                    DocumentIssue(
                        severity="warning",
                        code="NAME_MISMATCH_PASSPORT_SPONSOR",
                        message="Incohérence de nom entre passeport et lettre de sponsor.",
                        suggested_fix=["Corriger la lettre ou expliquer l'écart (translittération/alias)."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=passport_doc.doc_id,
                                doc_type=passport_doc.doc_type.value,
                                extracted_key="full_name",
                                value=passport_name,
                                present=True,
                                note="Nom passeport.",
                            ),
                            DocumentEvidence(
                                doc_id=sp.doc_id,
                                doc_type=sp.doc_type.value,
                                extracted_key="beneficiary_name",
                                value=beneficiary,
                                present=True,
                                note="Nom du bénéficiaire sur la lettre.",
                            ),
                        ],
                    )
                )

    # Trip window checks (from itinerary/accommodation) + coherence with passport/insurance/budget
    trip_start, trip_end, trip_evidence = _extract_trip_window(documents)
    if trip_start is None or trip_end is None:
        # Only raise this if the user already provided itinerary/accommodation docs but dates aren't usable.
        has_trip_docs = bool(by_type.get(DocumentType.ITINERARY) or by_type.get(DocumentType.ACCOMMODATION_PLAN))
        if has_trip_docs:
            issues.append(
                DocumentIssue(
                    severity="warning",
                    code="TRIP_DATES_UNKNOWN",
                    message="Dates de voyage manquantes ou illisibles (itinéraire/hébergement): impossible de vérifier la cohérence.",
                    why=[
                        "Les dates influencent les exigences (assurance, validité passeport, cohérence budget).",
                        "Des dates incohérentes déclenchent souvent une demande de clarification.",
                    ],
                    suggested_fix=[
                        "Compléter `start_date`/`end_date` (ou `travel_start_date`/`travel_end_date`) sur l'itinéraire/hébergement.",
                    ],
                    evidence=trip_evidence,
                )
            )
    else:
        if trip_end < trip_start:
            issues.append(
                DocumentIssue(
                    severity="risk",
                    code="TRIP_DATES_INVALID",
                    message="Dates de voyage incohérentes: la fin est avant le début.",
                    suggested_fix=["Corriger les dates (itinéraire/hébergement) et relancer la vérification."],
                    evidence=trip_evidence,
                )
            )
        else:
            # Passport validity relative to trip end
            if passport_doc is not None:
                exp = passport_doc.expires_date or _parse_iso_date(passport_doc.extracted.get("expires_date"))
                if exp is not None:
                    if exp <= trip_end:
                        issues.append(
                            DocumentIssue(
                                severity="risk",
                                code="TRIP_AFTER_PASSPORT_EXPIRES",
                                message="Le voyage se termine après l'expiration du passeport.",
                                why=["La demande est généralement irrecevable si le passeport expire avant/pendant le séjour."],
                                suggested_fix=["Renouveler le passeport ou ajuster les dates de voyage avant dépôt."],
                                evidence=[
                                    DocumentEvidence(
                                        doc_id=passport_doc.doc_id,
                                        doc_type=passport_doc.doc_type.value,
                                        extracted_key="expires_date",
                                        value=exp.isoformat(),
                                        present=True,
                                        note="Expiration passeport.",
                                    ),
                                    *trip_evidence,
                                ],
                            )
                        )
                    else:
                        buffer_days = _region_min_passport_validity_after_trip_days(destination_region)
                        if (exp - trip_end).days < buffer_days:
                            issues.append(
                                DocumentIssue(
                                    severity="warning",
                                    code="PASSPORT_VALIDITY_AFTER_TRIP_SHORT",
                                    message=f"Validité passeport après le voyage possiblement insuffisante (< {buffer_days} jours).",
                                    why=["De nombreux pays exigent une marge de validité après le retour (3 à 6 mois)."],
                                    suggested_fix=["Vérifier l'exigence officielle; envisager un renouvellement préventif."],
                                    evidence=[
                                        DocumentEvidence(
                                            doc_id=passport_doc.doc_id,
                                            doc_type=passport_doc.doc_type.value,
                                            extracted_key="expires_date",
                                            value=exp.isoformat(),
                                            present=True,
                                            note="Expiration passeport.",
                                        ),
                                        *trip_evidence,
                                    ],
                                )
                            )

            # Insurance coverage vs trip window (if insurance present)
            if ins:
                d0 = ins[0]
                cov_start = _parse_iso_date(d0.extracted.get("coverage_start_date") or d0.extracted.get("start_date"))
                cov_end = _parse_iso_date(
                    d0.extracted.get("coverage_end_date") or d0.extracted.get("end_date") or d0.extracted.get("expires_date") or d0.expires_date
                )
                if cov_start is None or cov_end is None:
                    issues.append(
                        DocumentIssue(
                            severity="warning",
                            code="INSURANCE_COVERAGE_DATES_MISSING",
                            message="Dates de couverture assurance manquantes: impossible de vérifier qu'elle couvre tout le séjour.",
                            suggested_fix=["Compléter `coverage_start_date` et `coverage_end_date` (ou dates équivalentes) puis relancer."],
                            evidence=[
                                DocumentEvidence(
                                    doc_id=d0.doc_id,
                                    doc_type=d0.doc_type.value,
                                    extracted_key="coverage_start_date",
                                    value=d0.extracted.get("coverage_start_date"),
                                    present=cov_start is not None,
                                    note="Début de couverture.",
                                ),
                                DocumentEvidence(
                                    doc_id=d0.doc_id,
                                    doc_type=d0.doc_type.value,
                                    extracted_key="coverage_end_date",
                                    value=d0.extracted.get("coverage_end_date") or d0.extracted.get("end_date") or d0.extracted.get("expires_date"),
                                    present=cov_end is not None,
                                    note="Fin de couverture.",
                                ),
                                *trip_evidence,
                            ],
                        )
                    )
                else:
                    if cov_start > trip_start or cov_end < trip_end:
                        issues.append(
                            DocumentIssue(
                                severity="risk",
                                code="INSURANCE_NOT_COVERING_TRIP",
                                message="Assurance voyage: la couverture ne couvre pas l’intégralité des dates du séjour.",
                                why=["Si exigée, l’assurance doit couvrir toutes les dates du voyage (et parfois des garanties minimales)."],
                                suggested_fix=["Ajuster l'assurance aux dates exactes (sans paiement irréversible avant visa)."],
                                evidence=[
                                    DocumentEvidence(
                                        doc_id=d0.doc_id,
                                        doc_type=d0.doc_type.value,
                                        extracted_key="coverage_start_date",
                                        value=cov_start.isoformat(),
                                        present=True,
                                        note="Début de couverture.",
                                    ),
                                    DocumentEvidence(
                                        doc_id=d0.doc_id,
                                        doc_type=d0.doc_type.value,
                                        extracted_key="coverage_end_date",
                                        value=cov_end.isoformat(),
                                        present=True,
                                        note="Fin de couverture.",
                                    ),
                                    *trip_evidence,
                                ],
                            )
                        )

            # Funds sufficiency (heuristic) if we have trip length + balance
            if bank:
                freshest = sorted(bank, key=lambda x: (x.issued_date or date.min), reverse=True)[0]
                bal = _parse_float(freshest.extracted.get("ending_balance_usd"))
                if bal is not None:
                    duration = (trip_end - trip_start).days + 1
                    duration = max(1, int(duration))
                    rate = _region_daily_budget_usd(destination_region)
                    required_est = rate * float(duration) + 300.0  # buffer
                    if bal < required_est:
                        severity = "warning" if bal >= 0.85 * required_est else "risk"
                        issues.append(
                            DocumentIssue(
                                severity=severity,
                                code="FUNDS_ESTIMATE_LOW",
                                message="Capacité financière possiblement insuffisante au regard de la durée estimée du séjour (heuristique).",
                                why=[
                                    "Les consulats comparent souvent durée/budget/ressources et cherchent la cohérence.",
                                    "Ce calcul est une estimation: vérifier les seuils officiels (si publiés).",
                                ],
                                suggested_fix=[
                                    "Fournir des relevés plus solides/récents, cohérents avec la durée, ou expliquer la prise en charge (sponsor).",
                                ],
                                evidence=[
                                    DocumentEvidence(
                                        doc_id=freshest.doc_id,
                                        doc_type=freshest.doc_type.value,
                                        extracted_key="ending_balance_usd",
                                        value=bal,
                                        present=True,
                                        note=f"Solde utilisé (USD). Estimation requise ~ {round(required_est, 0)} USD pour {duration} jours.",
                                    ),
                                    *trip_evidence,
                                ],
                            )
                        )

            # Sponsor amount vs trip estimate (if sponsor letter provides amount)
            if sps and sponsor_amount is not None:
                duration = (trip_end - trip_start).days + 1
                duration = max(1, int(duration))
                rate = _region_daily_budget_usd(destination_region)
                required_est = rate * float(duration) + 300.0
                if sponsor_amount < required_est:
                    sev = "warning" if sponsor_amount >= 0.85 * required_est else "risk"
                    issues.append(
                        DocumentIssue(
                            severity=sev,
                            code="SPONSOR_AMOUNT_LOW_FOR_TRIP",
                            message="Sponsor: montant annoncé possiblement insuffisant pour la durée estimée du séjour (heuristique).",
                            suggested_fix=["Augmenter la prise en charge, réduire la durée, ou fournir preuves complémentaires (hébergement pris en charge, etc.)."],
                            evidence=[
                                DocumentEvidence(
                                    doc_id=sp.doc_id,
                                    doc_type=sp.doc_type.value,
                                    extracted_key="sponsor_amount_usd",
                                    value=sponsor_amount,
                                    present=True,
                                    note=f"Montant utilisé (USD). Estimation requise ~ {round(required_est, 0)} USD pour {duration} jours.",
                                ),
                                *trip_evidence,
                            ],
                        )
                    )

    # Payslips: count, recency, and salary coherence with bank
    slips = by_type.get(DocumentType.PAYSLIPS, [])
    if slips:
        # Extract slip dates
        slip_dates: list[tuple[Document, Optional[date]]] = []
        for s in slips:
            d = _parse_iso_date(s.extracted.get("issued_date") or s.extracted.get("pay_date") or s.extracted.get("month_date"))
            slip_dates.append((s, d))
        # Count slips with valid dates
        dated = [(s, d) for (s, d) in slip_dates if d is not None]
        if len(dated) < 3:
            issues.append(
                DocumentIssue(
                    severity="warning",
                    code="PAYSLIPS_INSUFFICIENT_COUNT",
                    message="Fiches de paie: nombre insuffisant (souvent 3 derniers mois).",
                    why=["Les consulats demandent fréquemment les 3 dernières fiches de paie (ou équivalent)."],
                    suggested_fix=["Ajouter des fiches de paie récentes (3 mois) ou une preuve alternative (contrat, attestation)."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=s.doc_id,
                            doc_type=s.doc_type.value,
                            extracted_key="issued_date",
                            value=s.extracted.get("issued_date") or s.extracted.get("pay_date") or s.extracted.get("month_date"),
                            present=(d is not None),
                            note="Date de paie/émission (pour vérifier le caractère récent).",
                        )
                        for (s, d) in slip_dates[:5]
                    ],
                )
            )
        else:
            # Recency: most recent slip should be recent-ish
            most_recent = sorted(dated, key=lambda x: x[1] or date.min, reverse=True)[0][1]
            if most_recent and (_today() - most_recent).days > 120:
                issues.append(
                    DocumentIssue(
                        severity="warning",
                        code="PAYSLIPS_OLD",
                        message="Fiches de paie anciennes (> 4 mois).",
                        suggested_fix=["Fournir les fiches de paie les plus récentes (3 derniers mois)."],
                        evidence=[
                            DocumentEvidence(
                                doc_id=dated[0][0].doc_id,
                                doc_type=dated[0][0].doc_type.value,
                                extracted_key="issued_date",
                                value=most_recent.isoformat(),
                                present=True,
                                note="Date la plus récente détectée.",
                            )
                        ],
                    )
                )

        # Salary coherence: payslip net vs bank monthly inflow (if provided)
        slip_amounts = []
        for s in slips:
            amt = _parse_float(s.extracted.get("net_salary_usd") or s.extracted.get("salary_usd") or s.extracted.get("net_salary"))
            if amt is not None:
                slip_amounts.append((s, amt))
        if bank and slip_amounts:
            freshest = sorted(bank, key=lambda x: (x.issued_date or date.min), reverse=True)[0]
            inflow = _parse_float(freshest.extracted.get("average_monthly_inflow_usd") or freshest.extracted.get("monthly_income_usd"))
            if inflow is not None:
                avg_slip = sum(a for (_, a) in slip_amounts[:3]) / float(min(3, len(slip_amounts)))
                # flag if mismatch > 35%
                if inflow > 0 and abs(inflow - avg_slip) / inflow > 0.35:
                    issues.append(
                        DocumentIssue(
                            severity="warning",
                            code="INCOME_MISMATCH_PAYSLIPS_BANK",
                            message="Incohérence possible: revenus (fiches de paie) vs entrées bancaires mensuelles.",
                            why=["Les consulats cherchent la cohérence entre revenus déclarés, fiches de paie et relevés bancaires."],
                            suggested_fix=["Vérifier les montants, la devise, et fournir une explication (primes, espèces, autre compte)."],
                            evidence=[
                                DocumentEvidence(
                                    doc_id=freshest.doc_id,
                                    doc_type=freshest.doc_type.value,
                                    extracted_key="average_monthly_inflow_usd",
                                    value=inflow,
                                    present=True,
                                    note="Entrées mensuelles moyennes (USD).",
                                ),
                                DocumentEvidence(
                                    doc_id=slip_amounts[0][0].doc_id,
                                    doc_type=slip_amounts[0][0].doc_type.value,
                                    extracted_key="net_salary_usd",
                                    value=round(avg_slip, 2),
                                    present=True,
                                    note="Moyenne des salaires nets (USD) sur fiches de paie.",
                                ),
                            ],
                        )
                    )

    # Civil status: required if family relationship mentioned in invitation (heuristic)
    civs = by_type.get(DocumentType.CIVIL_STATUS, [])
    if invs:
        inv = invs[0]
        rel = _norm(inv.extracted.get("relationship"))
        if _relationship_implies_family(rel) and not civs:
            issues.append(
                DocumentIssue(
                    severity="warning",
                    code="CIVIL_STATUS_MISSING_FOR_FAMILY_CASE",
                    message="État civil potentiellement requis (relation familiale indiquée dans l'invitation).",
                    why=["Une relation familiale peut nécessiter des preuves (acte de mariage/naissance) selon le cas."],
                    suggested_fix=["Ajouter un document d'état civil pertinent (acte de mariage, naissance, livret de famille)."],
                    evidence=[
                        DocumentEvidence(
                            doc_id="",
                            doc_type=DocumentType.CIVIL_STATUS.value,
                            extracted_key="document",
                            value=None,
                            present=False,
                            note="Document d'état civil manquant (heuristique).",
                        ),
                        DocumentEvidence(
                            doc_id=inv.doc_id,
                            doc_type=inv.doc_type.value,
                            extracted_key="relationship",
                            value=rel,
                            present=bool(rel),
                            note="Relation extraite de la lettre d'invitation.",
                        ),
                    ],
                )
            )

    # Address coherence: invitation host_address vs accommodation address (if both present)
    if invs and accs:
        inv = invs[0]
        acc = accs[0]
        inv_addr = _extract_address_like(inv)
        acc_addr = _extract_address_like(acc)
        if inv_addr and acc_addr and _norm_key(inv_addr) != _norm_key(acc_addr):
            issues.append(
                DocumentIssue(
                    severity="info",
                    code="ADDRESS_MISMATCH_INVITATION_ACCOMMODATION",
                    message="Adresse: invitation vs hébergement différentes (à confirmer).",
                    why=["Ce n'est pas forcément un problème (hôtel vs domicile), mais une incohérence doit être cohérente/expliquée."],
                    suggested_fix=["Vérifier l'adresse exacte et clarifier (ex: hôtel réservé, autre logement)."],
                    evidence=[
                        DocumentEvidence(
                            doc_id=inv.doc_id,
                            doc_type=inv.doc_type.value,
                            extracted_key="host_address",
                            value=inv_addr,
                            present=True,
                            note="Adresse extraite de l'invitation.",
                        ),
                        DocumentEvidence(
                            doc_id=acc.doc_id,
                            doc_type=acc.doc_type.value,
                            extracted_key="accommodation_address",
                            value=acc_addr,
                            present=True,
                            note="Adresse extraite de l'hébergement.",
                        ),
                    ],
                )
            )

    disclaimers = [
        "Ces contrôles sont génériques: la liste officielle des documents dépend du pays, du visa, de la nationalité et du contexte.",
        "Aucune falsification: si un élément manque ou paraît faible, la solution est d'améliorer le dossier, pas de créer de faux documents.",
        "Les contrôles dates/budget sont heuristiques: ils servent à détecter des incohérences, pas à remplacer les exigences officielles.",
    ]

    return DocumentCheckResult(
        missing_document_types=missing,
        issues=issues,
        assumptions=_dedup(assumptions),
        disclaimers=disclaimers,
    )

