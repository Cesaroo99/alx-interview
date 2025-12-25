from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass(frozen=True)
class RefusalAnalysis:
    refusal_reasons: list[str]
    plain_explanation: list[str]
    likely_root_causes: list[str]
    corrective_actions: list[str]
    plan_b_options: list[str]
    anti_scam_warnings: list[str]
    disclaimers: list[str]


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


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


# Très générique: codes fréquents (Schengen/visiteur) + thèmes.
REASON_MAP: dict[str, dict[str, list[str]]] = {
    "insufficient_funds": {
        "explain": [
            "Le consulat n'a pas été convaincu que vous pouvez financer le séjour et/ou le retour.",
        ],
        "root": [
            "Financement insuffisamment démontré (relevés bancaires faibles ou incohérents).",
            "Absence de preuves stables de revenus.",
            "Budget/jour irréaliste par rapport au plan de voyage.",
        ],
        "actions": [
            "Fournir des relevés récents (selon règle officielle) avec mouvements cohérents.",
            "Ajouter preuves de revenus (bulletins, contrat, registre entreprise) et/ou sponsor officiel documenté.",
            "Rendre le plan de voyage plus réaliste (durée, hébergements, activités) et aligner le budget.",
        ],
    },
    "purpose_not_clear": {
        "explain": [
            "Le motif du voyage n'a pas été jugé clair ou crédible.",
        ],
        "root": [
            "Itinéraire trop vague ou trop ambitieux.",
            "Documents de support (invitation/admission) insuffisants.",
            "Contradictions entre formulaire, lettres et justificatifs.",
        ],
        "actions": [
            "Clarifier le motif en une narration simple et cohérente (qui/quoi/quand/où/pourquoi/financement).",
            "Ajouter pièces officielles: invitation, admission, agenda pro, preuves de lien familial si applicable.",
            "Vérifier la cohérence totale: dates, adresses, employeur, revenus, historique de voyage.",
        ],
    },
    "ties_not_sufficient": {
        "explain": [
            "Le consulat n'a pas été convaincu de votre intention de retourner (attaches insuffisantes).",
        ],
        "root": [
            "Statut pro instable ou mal documenté.",
            "Attaches familiales/économiques non démontrées.",
            "Historique de voyage faible.",
        ],
        "actions": [
            "Ajouter preuves d'attaches: contrat/attestation employeur, certificat scolarité, charges, famille, biens, obligations.",
            "Raccourcir la durée et limiter les changements de ville/hébergement.",
            "Éviter les incohérences (ex: congés non justifiés, sponsor flou).",
        ],
    },
    "documents_not_reliable": {
        "explain": [
            "Certains documents ont été jugés non fiables, incomplets ou non vérifiables.",
        ],
        "root": [
            "Documents illisibles ou scans de mauvaise qualité.",
            "Informations incohérentes entre pièces.",
            "Documents non officiels (captures d'écran, montages).",
        ],
        "actions": [
            "Fournir des documents officiels, lisibles, complets (tampons/QR/coordonnées).",
            "Éviter tout document modifié; demander des attestations officielles à la source.",
            "Expliquer toute anomalie (ex: variations de nom) avec justificatifs (état civil).",
        ],
    },
    "overstay_risk": {
        "explain": [
            "Le consulat a estimé un risque de dépassement de séjour ou d'usage non conforme du visa.",
        ],
        "root": [
            "Profil jugé à risque au regard du motif et des attaches.",
            "Séjour long vs ressources/justification.",
            "Historique (refus précédents, incohérences).",
        ],
        "actions": [
            "Rendre la demande plus conservatrice: durée raisonnable, motif clair, pièces solides.",
            "Joindre une lettre explicative factuelle répondant aux motifs du refus précédent.",
            "Éviter les réservations non remboursables; prouver la capacité de retour (attaches).",
        ],
    },
}


def explain_refusal(
    *,
    refusal_reasons: list[str],
    refusal_letter_text: Optional[str] = None,
) -> RefusalAnalysis:
    """
    Explication de refus + plan d'amélioration.
    Inputs attendus:
    - refusal_reasons: liste de codes génériques (ex: 'insufficient_funds')
    - refusal_letter_text: texte libre (optionnel) pour contexte (non analysé finement ici)
    """

    reasons = [_norm(r).lower() for r in (refusal_reasons or []) if _norm(r)]
    if not reasons and _norm(refusal_letter_text):
        reasons = ["purpose_not_clear"]

    explain: list[str] = []
    root: list[str] = []
    actions: list[str] = []

    for r in reasons:
        data = REASON_MAP.get(r)
        if data:
            explain += data["explain"]
            root += data["root"]
            actions += data["actions"]
        else:
            explain.append("Motif de refus non reconnu: besoin d'aligner les pièces avec le motif officiel.")
            actions.append("Ajouter le code exact/phrase officielle du refus pour une analyse plus précise.")

    plan_b = [
        "Repostuler uniquement après correction vérifiable des causes (sinon risque de refus répété).",
        "Choisir un visa/objectif plus cohérent avec le profil (ex: court séjour plus simple, motif mieux documenté).",
        "Renforcer l'historique (voyages plus modestes/regionaux) et la stabilité (emploi/études) avant une demande plus difficile.",
        "Si le refus est contestable: vérifier les voies officielles de recours/appeal (selon pays).",
    ]

    anti_scam = [
        "Méfiez-vous des 'agents' qui promettent d'effacer un refus ou d'obtenir une 'approbation garantie'.",
        "N'achetez pas de faux documents: cela augmente fortement le risque de ban/interdiction.",
        "Utilisez uniquement les portails officiels pour toute nouvelle demande ou recours.",
    ]

    disclaimers = [
        "Cette analyse est générique et ne remplace pas les explications officielles du consulat.",
        "Les procédures de recours varient par pays: vérifier la source officielle.",
    ]

    return RefusalAnalysis(
        refusal_reasons=_dedup(reasons),
        plain_explanation=_dedup(explain),
        likely_root_causes=_dedup(root),
        corrective_actions=_dedup(actions),
        plan_b_options=_dedup(plan_b),
        anti_scam_warnings=anti_scam,
        disclaimers=disclaimers,
    )


def refusal_to_dict(r: RefusalAnalysis) -> dict[str, Any]:
    return {
        "refusal_reasons": list(r.refusal_reasons),
        "plain_explanation": list(r.plain_explanation),
        "likely_root_causes": list(r.likely_root_causes),
        "corrective_actions": list(r.corrective_actions),
        "plan_b_options": list(r.plan_b_options),
        "anti_scam_warnings": list(r.anti_scam_warnings),
        "disclaimers": list(r.disclaimers),
    }

