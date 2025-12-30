from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .models import UserProfile


@dataclass(frozen=True)
class FieldGuidance:
    form_type: str
    field_name: str
    explanation: str
    suggested_value: Optional[str]
    consistency_checks: list[str]
    why: list[str]
    warnings: list[str]
    disclaimers: list[str]


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


def get_field_guidance(
    *,
    form_type: str,
    field_name: str,
    profile: UserProfile,
    context: Optional[dict[str, Any]] = None,
) -> FieldGuidance:
    """
    Aide au remplissage (sans automatisation):
    - explique le champ
    - propose une valeur à partir du profil (si possible)
    - liste des checks de cohérence
    """

    ftype = _norm(form_type).lower()
    fname = _norm(field_name).lower()
    ctx = context or {}

    explanation = "Champ de formulaire."
    suggested: Optional[str] = None
    checks: list[str] = []
    why: list[str] = []
    warnings: list[str] = []

    # Champs communs (génériques)
    if fname in {"full_name", "name", "surname", "given_name"}:
        explanation = "Nom tel qu'il apparaît sur le passeport (orthographe exacte, ordre selon champ)."
        suggested = None  # on évite d'inventer sans OCR/passeport extrait
        checks += [
            "Comparer avec le passeport (page identité) caractère par caractère.",
            "Respecter les accents/traits d'union selon le passeport (si le portail les accepte).",
        ]
        why += ["Le moindre écart de nom peut bloquer la demande ou créer une suspicion d'incohérence."]

    elif fname in {"nationality", "citizenship"}:
        explanation = "Nationalité (citoyenneté) telle qu'indiquée sur le passeport."
        suggested = _norm(profile.nationality) or None
        checks += ["Doit correspondre au passeport."]
        why += ["Certaines règles et formulaires changent selon la nationalité."]

    elif fname in {"profession", "occupation", "job_title"}:
        explanation = "Profession/occupation actuelle (cohérente avec justificatifs)."
        suggested = _norm(profile.profession) or None
        checks += [
            "Doit correspondre à l'attestation employeur / registre / certificat scolarité.",
            "Éviter les intitulés trop vagues si des preuves sont demandées.",
        ]
        why += ["La cohérence socio-professionnelle est un signal important de crédibilité."]

    elif fname in {"purpose_of_trip", "travel_purpose"}:
        explanation = "Motif principal du voyage (catégorie de visa)."
        suggested = profile.travel_purpose.value
        checks += [
            "Doit correspondre aux documents (invitation, admission, itinéraire).",
            "Ne pas sélectionner une catégorie 'facile' si elle ne correspond pas au vrai motif.",
        ]
        why += ["Une mauvaise catégorie est une cause fréquente de refus."]

    elif fname in {"travel_dates", "arrival_date", "departure_date"}:
        explanation = "Dates de voyage (doivent être réalistes et alignées avec l'itinéraire et l'assurance si requise)."
        suggested = None
        checks += [
            "Aligner les dates avec l'itinéraire/hébergement.",
            "Aligner avec l'assurance (si requise) et la disponibilité du congé/école/travail.",
        ]
        why += ["Les contradictions de dates créent un risque d'incohérence."]

    elif fname in {"address", "home_address"}:
        explanation = "Adresse de résidence actuelle (preuve possible: facture, attestation)."
        suggested = _norm(ctx.get("home_address")) or None
        checks += [
            "Doit correspondre aux justificatifs de domicile si demandés.",
        ]
        why += ["Une adresse cohérente facilite la vérification et réduit les doutes."]

    elif fname in {"bank_balance", "funds", "sponsor"}:
        explanation = "Informations de financement (fonds personnels et/ou sponsor)."
        suggested = None
        checks += [
            "Doit correspondre aux relevés bancaires et justificatifs de revenus.",
            "Le sponsor doit être documenté officiellement (lettre + justificatifs).",
        ]
        why += ["Le financement est un des motifs de refus les plus fréquents."]
        warnings += ["Ne jamais falsifier des montants ou documents. Si c'est faible, ajuster le plan/durée."]

    else:
        # fallback
        explanation = "Champ non encore couvert par le gabarit: remplir strictement selon les instructions officielles."
        checks += ["Lire l'aide officielle du portail/ambassade pour ce champ."]
        why += ["Les portails officiels ont des exigences spécifiques (formats, caractères, pièces)."]

    disclaimers = [
        "Cette aide ne remplit pas le formulaire à votre place et ne soumet rien.",
        "Toujours suivre l'instruction officielle du champ sur le portail (source de vérité).",
    ]

    return FieldGuidance(
        form_type=ftype,
        field_name=fname,
        explanation=explanation,
        suggested_value=suggested,
        consistency_checks=checks,
        why=why,
        warnings=warnings,
        disclaimers=disclaimers,
    )


def field_guidance_to_dict(g: FieldGuidance) -> dict[str, Any]:
    return {
        "form_type": g.form_type,
        "field_name": g.field_name,
        "explanation": g.explanation,
        "suggested_value": g.suggested_value,
        "consistency_checks": list(g.consistency_checks),
        "why": list(g.why),
        "warnings": list(g.warnings),
        "disclaimers": list(g.disclaimers),
    }

