from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .documents import DocumentType, required_documents_template
from .models import UserProfile


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


def _is_schengen(dest: str, visa_type: str) -> bool:
    x = f"{dest} {visa_type}".lower()
    return "schengen" in x or "france" in x or "videx" in x


def _is_uk(dest: str, visa_type: str) -> bool:
    x = f"{dest} {visa_type}".lower()
    return "uk" in x or "royaume" in x or "united kingdom" in x


def _is_usa(dest: str, visa_type: str) -> bool:
    x = f"{dest} {visa_type}".lower()
    return "usa" in x or "états" in x or "united states" in x or "ds-160" in x


@dataclass(frozen=True)
class Step:
    id: str
    name: str
    category: str
    status: str  # Not started | In progress | Completed | Blocked
    instruction_now: str
    blocked_until: list[str] = field(default_factory=list)
    blocked_reason: Optional[str] = None
    estimated_duration: Optional[str] = None
    priority: str = "Medium"  # Low | Medium | High
    action_key: Optional[str] = None
    suggested_events: list[dict[str, Any]] = field(default_factory=list)
    substeps: list["Step"] = field(default_factory=list)


@dataclass(frozen=True)
class TimelineOutput:
    steps: list[Step]
    next_actions: list[str]
    dependencies: list[dict[str, Any]]
    final_user_prompt: str


def _status(*, completed: bool, in_progress: bool, blocked: bool) -> str:
    if completed:
        return "Completed"
    if blocked:
        return "Blocked"
    if in_progress:
        return "In progress"
    return "Not started"


def generate_procedure_timeline(
    *,
    profile: UserProfile,
    destination_region: str,
    visa_type: str,
    document_types_present: list[str],
    dossier_ready: bool,
    travel_plan_ready: bool,
    costs_ready: bool,
    appointment_ready: bool,
    submission_started: bool,
    manual_completed_step_ids: Optional[list[str]] = None,
) -> TimelineOutput:
    dest = _norm(destination_region)
    vt = _norm(visa_type)
    completed_ids = {(_norm(x).lower()) for x in (manual_completed_step_ids or []) if _norm(x)}

    doc_types = {(_norm(x).lower()) for x in (document_types_present or []) if _norm(x)}

    # Required documents by template (heuristic)
    req = required_documents_template(visa_type=vt or "visitor", destination_region=dest or "destination")
    req_set = {d.value for d in req}
    missing = sorted([x for x in req_set if x not in doc_types])

    has_passport = DocumentType.PASSPORT.value in doc_types
    has_photo = DocumentType.PHOTO.value in doc_types

    schengen = _is_schengen(dest, vt)
    uk = _is_uk(dest, vt)
    usa = _is_usa(dest, vt)

    # Signals for progress
    docs_ready = has_passport and has_photo and len(missing) <= 2
    docs_in_progress = len(doc_types) > 0 and not docs_ready

    # Steps with dependencies
    steps: list[Step] = []

    def is_done(step_id: str) -> bool:
        return step_id.lower() in completed_ids

    # 1) Choice of visa
    s1_id = "choice"
    s1_done = is_done(s1_id)
    steps.append(
        Step(
            id=s1_id,
            name="Confirmer le type de visa & la destination",
            category="Choice of Visa",
            status=_status(completed=s1_done, in_progress=not s1_done, blocked=False),
            instruction_now="Vérifiez que le motif, le visa_type et la destination correspondent exactement à votre objectif.",
            estimated_duration="10–20 min",
            priority="High",
            action_key="open_eligibility",
            suggested_events=[
                {"type": "other", "title": "Procédure: confirmer visa & destination", "notes": "Vérifier visa_type/destination/motif avant de commencer les formulaires."}
            ],
        )
    )

    # 2) Documents
    doc_step_id = "documents"
    doc_done = is_done(doc_step_id) or docs_ready
    doc_blocked = False
    doc_sub: list[Step] = []

    doc_sub.append(
        Step(
            id="documents_upload",
            name="Uploader / centraliser les documents",
            category="Documents",
            status=_status(completed=has_passport and has_photo, in_progress=len(doc_types) > 0, blocked=False),
            instruction_now="Ajoutez vos documents dans le coffre (passeport, photo, relevés, attestations).",
            estimated_duration="30–90 min",
            priority="High",
            action_key="open_documents",
            suggested_events=[{"type": "other", "title": "Procédure: uploader documents", "notes": "Ajouter les pièces clés dans le coffre."}],
        )
    )
    doc_sub.append(
        Step(
            id="documents_ocr",
            name="OCR & extraction des champs",
            category="Documents",
            status=_status(
                completed=bool(has_passport and ("_ocr" in {})),  # completion is tracked client-side; keep in-progress by default
                in_progress=has_passport,
                blocked=not has_passport,
            ),
            instruction_now="Lancez l’OCR sur les documents clés pour remplir automatiquement les champs (passeport, dates, montants).",
            blocked_until=["Passport uploaded"] if not has_passport else [],
            blocked_reason=None if has_passport else "Impossible sans passeport dans le coffre.",
            estimated_duration="5–20 min / document",
            priority="High",
            action_key="open_documents",
            suggested_events=[{"type": "other", "title": "Procédure: OCR documents", "notes": "Lancer l’OCR sur passeport/relevés/assurance pour auto-remplir les champs."}],
        )
    )
    doc_sub.append(
        Step(
            id="documents_verify",
            name="Vérifier la cohérence du dossier",
            category="Documents",
            status=_status(completed=dossier_ready, in_progress=docs_in_progress or dossier_ready, blocked=not len(doc_types)),
            instruction_now="Lancez la vérification dossier pour détecter les incohérences (dates, assurance, fonds, noms).",
            blocked_until=["Documents uploaded"] if not len(doc_types) else [],
            blocked_reason=None if len(doc_types) else "Impossible sans documents.",
            estimated_duration="5–10 min",
            priority="High",
            action_key="open_dossier",
            suggested_events=[{"type": "other", "title": "Procédure: vérifier dossier", "notes": "Corriger incohérences détectées (dates/noms/fonds/assurance)."}],
        )
    )

    steps.append(
        Step(
            id=doc_step_id,
            name="Documents (préparer → OCR → vérifier)",
            category="Documents",
            status=_status(completed=doc_done, in_progress=docs_in_progress or dossier_ready, blocked=doc_blocked),
            instruction_now=("Uploader les documents manquants: " + ", ".join(missing[:6]) + ("…" if len(missing) > 6 else "")) if missing else "Documents principaux en place. Passez à l’itinéraire/coûts.",
            blocked_until=[],
            estimated_duration="1–3 jours (selon disponibilité)",
            priority="High",
            action_key="open_documents",
            substeps=doc_sub,
        )
    )

    # 3) Itinerary & Coherence
    itin_id = "itinerary"
    itin_blocked = not docs_ready
    itin_done = is_done(itin_id) or travel_plan_ready
    steps.append(
        Step(
            id=itin_id,
            name="Itinéraire & cohérence",
            category="Itinerary & Coherence",
            status=_status(completed=itin_done, in_progress=travel_plan_ready, blocked=itin_blocked),
            instruction_now="Générez un itinéraire visa‑compliant (sans réservation) et corrigez les alertes.",
            blocked_until=["Documents ready"] if itin_blocked else [],
            blocked_reason="Commencez par préparer le minimum documentaire (passeport, preuve de fonds, etc.)." if itin_blocked else None,
            estimated_duration="30–60 min",
            priority="High",
            action_key="open_travel",
            suggested_events=[{"type": "other", "title": "Procédure: générer itinéraire", "notes": "Générer un itinéraire visa-compliant et résoudre les alertes."}],
        )
    )

    # 4) Costs & Payments
    costs_id = "costs"
    costs_blocked = not docs_ready
    costs_done = is_done(costs_id) or costs_ready
    steps.append(
        Step(
            id=costs_id,
            name="Coûts & paiements",
            category="Costs & Payments",
            status=_status(completed=costs_done, in_progress=costs_ready, blocked=costs_blocked),
            instruction_now="Estimez les frais officiels + détectez les frais suspects, puis planifiez le paiement.",
            blocked_until=["Documents ready"] if costs_blocked else [],
            blocked_reason="Certaines estimations dépendent de votre visa_type et des pièces." if costs_blocked else None,
            estimated_duration="15–30 min",
            priority="High",
            action_key="open_costs",
            suggested_events=[{"type": "payment", "title": "Procédure: estimer coûts & planifier paiement", "notes": "Entrer frais officiels + vérifier alertes de frais suspects."}],
        )
    )

    # 5) Forms / Portal
    forms_id = "forms"
    forms_blocked = not docs_ready
    forms_done = is_done(forms_id)
    forms_name = "Formulaire en ligne (portail officiel)"
    if usa:
        forms_name = "Formulaire DS‑160"
    elif uk:
        forms_name = "Formulaire UKVI"
    elif schengen:
        forms_name = "Formulaire Schengen (France‑Visas/VIDEX…)"

    forms_sub: list[Step] = []
    if schengen:
        forms_sub = [
            Step(
                id="forms_schengen_draft",
                name="Brouillon + cohérence (Schengen)",
                category="Forms",
                status=_status(completed=False, in_progress=docs_ready, blocked=not docs_ready),
                instruction_now="Remplir le brouillon et copier/coller dans le portail (noms/dates exacts).",
                blocked_until=["Documents ready"] if not docs_ready else [],
                blocked_reason="Besoin des infos exactes du passeport." if not docs_ready else None,
                estimated_duration="45–90 min",
                priority="High",
                action_key="open_forms",
                suggested_events=[{"type": "other", "title": "Procédure: remplir formulaire Schengen", "notes": "Brouillon + assistant de champs avant saisie sur portail."}],
            ),
            Step(
                id="forms_schengen_insurance",
                name="Assurance & couverture (si requise)",
                category="Forms",
                status=_status(completed=DocumentType.TRAVEL_INSURANCE.value in doc_types, in_progress=DocumentType.TRAVEL_INSURANCE.value in doc_types, blocked=not docs_ready),
                instruction_now="Vérifier couverture et dates alignées avec le voyage.",
                blocked_until=["Documents ready"] if not docs_ready else [],
                blocked_reason=None if docs_ready else "Documents manquants.",
                estimated_duration="10–30 min",
                priority="Medium",
                action_key="open_documents",
            ),
        ]
    if uk:
        forms_sub = [
            Step(
                id="forms_uk_draft",
                name="Brouillon + UKVI",
                category="Forms",
                status=_status(completed=False, in_progress=docs_ready, blocked=not docs_ready),
                instruction_now="Remplir UKVI (profil, emploi/études, finances) + cohérence dossier.",
                blocked_until=["Documents ready"] if not docs_ready else [],
                blocked_reason="Infos passeport/attaches requises." if not docs_ready else None,
                estimated_duration="60–120 min",
                priority="High",
                action_key="open_forms",
            )
        ]
    if usa:
        forms_sub = [
            Step(
                id="forms_ds160",
                name="Remplir DS‑160",
                category="Forms",
                status=_status(completed=False, in_progress=docs_ready, blocked=not docs_ready),
                instruction_now="Remplir DS‑160 (identité/passeport/voyage) en cohérence stricte.",
                blocked_until=["Documents ready"] if not docs_ready else [],
                blocked_reason="Infos passeport requises." if not docs_ready else None,
                estimated_duration="60–150 min",
                priority="High",
                action_key="open_forms",
            )
        ]

    steps.append(
        Step(
            id=forms_id,
            name=forms_name,
            category="Forms",
            status=_status(completed=forms_done, in_progress=not forms_done and docs_ready, blocked=forms_blocked),
            instruction_now="Utilisez le brouillon de formulaire + l’assistant pour remplir le portail officiel.",
            blocked_until=["Documents ready"] if forms_blocked else [],
            blocked_reason="Le remplissage nécessite les infos exactes du passeport et des pièces." if forms_blocked else None,
            estimated_duration="45–120 min",
            priority="High",
            action_key="open_forms",
            suggested_events=[{"type": "other", "title": f"Procédure: {forms_name}", "notes": "Utiliser brouillon + assistant; ne pas soumettre sans cohérence."}],
            substeps=forms_sub,
        )
    )

    # 6) Appointments
    appt_id = "appointments"
    appt_blocked = not (docs_ready and costs_ready)
    appt_done = is_done(appt_id) or appointment_ready
    steps.append(
        Step(
            id=appt_id,
            name="Rendez‑vous / biométrie",
            category="Appointments",
            status=_status(completed=appt_done, in_progress=appointment_ready, blocked=appt_blocked),
            instruction_now="Ouvrez le portail/centre agréé et planifiez le rendez‑vous. Enregistrez les dates dans la timeline.",
            blocked_until=[x for x in ["Documents ready" if not docs_ready else "", "Costs ready" if not costs_ready else ""] if x],
            blocked_reason="Souvent, le RDV dépend de la catégorie et/ou du paiement et des pièces prêtes." if appt_blocked else None,
            estimated_duration="10–30 min (booking) + délai variable",
            priority="High",
            action_key="open_appointments",
            suggested_events=[{"type": "appointment", "title": "Procédure: planifier RDV/biométrie", "notes": "Ouvrir portail/centre agréé et enregistrer la date dans la timeline."}],
        )
    )

    # 7) Submission & Tracking
    sub_id = "submission"
    sub_blocked = not (docs_ready and travel_plan_ready and costs_ready)
    sub_done = is_done(sub_id) or submission_started
    steps.append(
        Step(
            id=sub_id,
            name="Soumission & suivi",
            category="Submission & Tracking",
            status=_status(completed=sub_done, in_progress=submission_started, blocked=sub_blocked),
            instruction_now="Soumettez, sauvegardez les reçus, puis créez des rappels de suivi (statut, collecte passeport).",
            blocked_until=[x for x in ["Documents ready" if not docs_ready else "", "Itinerary ready" if not travel_plan_ready else "", "Costs ready" if not costs_ready else ""] if x],
            blocked_reason="Ne soumettez pas avant d’avoir un dossier cohérent (évite refus répété)." if sub_blocked else None,
            estimated_duration="30–60 min",
            priority="High",
            action_key="open_portals",
            suggested_events=[{"type": "submission", "title": "Procédure: soumission & suivi", "notes": "Soumettre + sauvegarder reçus + suivre statut."}],
        )
    )

    # Next actions (ready and not completed)
    ready = [s for s in steps if s.status in {"Not started", "In progress"}]
    blocked = [s for s in steps if s.status == "Blocked"]
    next_actions: list[str] = []
    for s in ready[:4]:
        next_actions.append(f"{s.name}: {s.instruction_now}")
    if blocked:
        next_actions.append("Étapes bloquées: voir prérequis ci‑dessous.")

    dependencies: list[dict[str, Any]] = []
    for s in blocked:
        dependencies.append({"step_id": s.id, "step_name": s.name, "blocked_until": list(s.blocked_until), "blocked_reason": s.blocked_reason})

    final_prompt = (
        "Voici votre timeline personnalisée. Souhaitez-vous :\n"
        "1) Vous focaliser sur la prochaine étape actionnable ?\n"
        "2) Voir toutes les étapes bloquées et leurs prérequis ?\n"
        "3) Exporter cette timeline avec des rappels de suivi ?"
    )

    return TimelineOutput(steps=steps, next_actions=next_actions, dependencies=dependencies, final_user_prompt=final_prompt)


def procedure_timeline_to_dict(out: TimelineOutput) -> dict[str, Any]:
    def step_to_dict(s: Step) -> dict[str, Any]:
        return {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "status": s.status,
            "instruction_now": s.instruction_now,
            "blocked_until": list(s.blocked_until),
            "blocked_reason": s.blocked_reason,
            "estimated_duration": s.estimated_duration,
            "priority": s.priority,
            "action_key": s.action_key,
            "suggested_events": list(s.suggested_events or []),
            "substeps": [step_to_dict(x) for x in (s.substeps or [])],
        }

    return {
        "A_timeline_view": [step_to_dict(s) for s in out.steps],
        "B_next_action_summary": list(out.next_actions),
        "C_dependencies": list(out.dependencies),
        "final_user_prompt": out.final_user_prompt,
    }

