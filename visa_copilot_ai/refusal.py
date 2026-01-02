from __future__ import annotations

from dataclasses import dataclass
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


@dataclass(frozen=True)
class RefusalReasonItem:
    reason: str
    explanation_plain_language: str
    severity_level: str  # Low | Medium | High
    verifiable_factors: list[str]


@dataclass(frozen=True)
class CorrectiveStep:
    step: str
    verification_required: bool
    priority: str  # High | Medium | Low
    related_reason: str


@dataclass(frozen=True)
class PlanBOption:
    visa_or_country_or_strategy: str
    benefits: list[str]
    risks: list[str]
    timeline: str
    notes: list[str]
    alignment_with_user_goals: str


@dataclass(frozen=True)
class RefusalDecisionSupport:
    refusal_summary: list[RefusalReasonItem]
    corrective_steps: list[CorrectiveStep]
    plan_b_options: list[PlanBOption]
    patterns: list[str]
    disclaimers: list[str]
    final_user_prompt: str


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


def _extract_reasons_from_text(text: str) -> list[str]:
    """
    Extraction heuristique (sans OCR):
    - prend un texte (copié/collé / transcript)
    - retourne une liste de codes normalisés de REASON_MAP
    """
    t = _norm(text).lower()
    if not t:
        return []

    hits: list[str] = []

    # Schengen/visiteur: formulations typiques (très fréquentes)
    if any(k in t for k in ["insufficient means", "means of subsistence", "ressources insuffisantes", "insufficient funds", "fonds insuffisants"]):
        hits.append("insufficient_funds")
    if any(
        k in t
        for k in [
            "purpose and conditions",
            "motif et conditions",
            "purpose not clear",
            "justification du séjour",
            "objet du voyage",
            "itinerary not credible",
        ]
    ):
        hits.append("purpose_not_clear")
    if any(
        k in t
        for k in [
            "reasonable doubts",
            "doutes raisonnables",
            "intention to leave",
            "intention de quitter",
            "ties",
            "attaches",
            "return",
            "retour",
        ]
    ):
        hits.append("ties_not_sufficient")
    if any(
        k in t
        for k in [
            "false",
            "fraud",
            "forged",
            "faux",
            "fraude",
            "documents are not reliable",
            "documents non fiables",
            "not authentic",
            "inauthentique",
            "inconsistent",
            "incohérent",
        ]
    ):
        hits.append("documents_not_reliable")
    if any(k in t for k in ["overstay", "dépassement", "illegal stay", "séjour irrégulier", "risk of", "risque de"]):
        hits.append("overstay_risk")

    # Dégradé: si on n'identifie rien, on retombe sur un motif générique
    if not hits and len(t) >= 20:
        hits.append("purpose_not_clear")

    return _dedup(hits)


def _severity_for(code: str) -> str:
    c = _norm(code).lower()
    if c in {"documents_not_reliable", "overstay_risk"}:
        return "High"
    if c in {"insufficient_funds"}:
        return "High"
    if c in {"ties_not_sufficient"}:
        return "Medium"
    if c in {"purpose_not_clear"}:
        return "Medium"
    return "Low"


def _verifiable_factors_for(code: str) -> list[str]:
    c = _norm(code).lower()
    if c == "insufficient_funds":
        return [
            "Relevés bancaires récents (dates/solde/mouvements).",
            "Preuves de revenus (bulletins, contrat, attestations).",
            "Sponsor documenté (lien + montant + preuves de fonds).",
            "Plan de voyage réaliste (durée/budget/jour).",
        ]
    if c == "ties_not_sufficient":
        return [
            "Justificatifs d'emploi/études (attestation, congés, contrat).",
            "Attaches familiales (état civil, enfants, responsabilités).",
            "Attaches matérielles/économiques (bail, propriété, entreprise).",
            "Historique de voyage (visas précédents, retours).",
        ]
    if c == "purpose_not_clear":
        return [
            "Itinéraire cohérent (villes/dates/raison).",
            "Hébergement vérifiable (adresses, réservations annulables).",
            "Invitation/admission/agenda pro selon le motif.",
            "Cohérence formulaire ↔ pièces (noms/dates/adresses).",
        ]
    if c == "documents_not_reliable":
        return [
            "Originaux/attestations officielles (tampons, contacts, QR).",
            "Documents lisibles (scan complet, qualité).",
            "Explications + justificatifs sur toute divergence (noms, dates).",
        ]
    if c == "overstay_risk":
        return [
            "Durée plus courte et motif conservateur.",
            "Justificatifs de retour (emploi/études/famille).",
            "Lettre explicative répondant point par point au refus.",
        ]
    return []


def analyze_refusal(
    *,
    refusal_letter_text: Optional[str] = None,
    refusal_reasons: Optional[list[str]] = None,
    prior_refusals_count: Optional[int] = None,
    travel_objective: Optional[str] = None,
) -> RefusalDecisionSupport:
    """
    Module "discret" d'analyse de refus:
    - extrait des motifs explicites depuis le texte/transcript si besoin
    - produit une sortie structurée A/B/C + prompt final
    """
    reasons = [_norm(r).lower() for r in (refusal_reasons or []) if _norm(r)]
    if not reasons and _norm(refusal_letter_text):
        reasons = _extract_reasons_from_text(str(refusal_letter_text))

    # A. Refusal Summary
    summary: list[RefusalReasonItem] = []
    for r in reasons:
        data = REASON_MAP.get(r)
        explain = (data["explain"][0] if data and data.get("explain") else "Motif détecté dans le refus (à confirmer sur le courrier officiel).")
        summary.append(
            RefusalReasonItem(
                reason=r,
                explanation_plain_language=explain,
                severity_level=_severity_for(r),
                verifiable_factors=_verifiable_factors_for(r),
            )
        )

    # B. Corrective Steps (priorisées)
    steps: list[CorrectiveStep] = []
    for r in reasons:
        data = REASON_MAP.get(r)
        actions = data["actions"] if data and data.get("actions") else ["Ajouter le texte exact du motif officiel pour une analyse plus précise."]
        for a in actions:
            a2 = _norm(a)
            if not a2:
                continue
            prio = "High" if _severity_for(r) == "High" else ("Medium" if _severity_for(r) == "Medium" else "Low")
            verif = True if r in {"insufficient_funds", "ties_not_sufficient", "documents_not_reliable"} else False
            steps.append(CorrectiveStep(step=a2, verification_required=verif, priority=prio, related_reason=r))

    # Dedup steps by text
    uniq: dict[str, CorrectiveStep] = {}
    for s in steps:
        key = _norm(s.step).lower()
        if key not in uniq:
            uniq[key] = s
        else:
            # keep the highest priority when duplicates occur
            rank = {"High": 3, "Medium": 2, "Low": 1}
            if rank.get(s.priority, 1) > rank.get(uniq[key].priority, 1):
                uniq[key] = s
    steps_out = list(uniq.values())
    steps_out.sort(key=lambda x: {"High": 0, "Medium": 1, "Low": 2}.get(x.priority, 3))

    # C. Plan B options (génériques mais actionnables)
    obj = _norm(travel_objective or "").lower()
    align = "Alignement à confirmer (objectif non précisé)."
    if obj:
        align = f"Aligné avec l'objectif: {obj}."

    planb: list[PlanBOption] = [
        PlanBOption(
            visa_or_country_or_strategy="Re-demande (même pays) — dossier corrigé + lettre explicative",
            benefits=["Traite directement les motifs du refus précédent.", "Améliore la cohérence et la vérifiabilité du dossier."],
            risks=["Refus répété si les causes ne sont pas corrigées de façon vérifiable.", "Délais supplémentaires."],
            timeline="Après correction complète (souvent 2–8 semaines selon pièces).",
            notes=["Éviter de re-déposer trop vite sans amélioration mesurable.", "Conserver preuves (reçus, attestations)."],
            alignment_with_user_goals=align,
        ),
        PlanBOption(
            visa_or_country_or_strategy="Objectif plus conservateur — séjour plus court / itinéraire simplifié",
            benefits=["Réduit la charge de preuve.", "Réduit le risque perçu (fonds/attaches)."],
            risks=["Peut ne pas couvrir tout l'objectif initial.", "Peut exiger un nouveau dossier (cohérence)."],
            timeline="Immédiat après ajustement du plan (1–3 semaines préparation).",
            notes=["Limiter les changements de ville/hébergement.", "Budget/jour réaliste + preuves alignées."],
            alignment_with_user_goals=align,
        ),
        PlanBOption(
            visa_or_country_or_strategy="Pays alternatif (exigences plus adaptées) — stratégie régionale",
            benefits=["Peut mieux correspondre au profil (historique, budget, attaches).", "Permet de construire un historique de voyage."],
            risks=["Règles différentes; attention aux incohérences.", "Coûts supplémentaires."],
            timeline="Variable (dépend du pays).",
            notes=["Toujours vérifier la source officielle.", "Ne pas multiplier les dépôts simultanés sans stratégie."],
            alignment_with_user_goals=align,
        ),
        PlanBOption(
            visa_or_country_or_strategy="Parcours indirect (études → travail → long terme) si objectif long terme",
            benefits=["Chemin plus structuré et documentable.", "Peut augmenter la crédibilité via admission/contrat."],
            risks=["Plus long et plus coûteux.", "Exige prérequis (tests, preuves académiques/financières)."],
            timeline="3–18 mois selon parcours.",
            notes=["Préparer preuves académiques/financières solides.", "Éviter les promesses d'“approbation garantie”."],
            alignment_with_user_goals="Aligné si votre objectif est long terme (études/emploi).",
        ),
    ]

    patterns: list[str] = []
    if prior_refusals_count is not None and int(prior_refusals_count or 0) >= 2:
        patterns.append("Plusieurs refus: prioriser les corrections vérifiables et éviter les dépôts répétés sans amélioration tangible.")
    if "documents_not_reliable" in reasons:
        patterns.append("Document fiabilité: c'est souvent un motif à impact élevé. Ne réappliquer qu'avec pièces officielles et vérifiables.")

    disclaimers = [
        "Analyse décisionnelle (estimate): elle ne remplace pas la décision ni les instructions officielles.",
        "Ne jamais fabriquer/modifier des documents. Vérifiez tout paiement et toute procédure via la source officielle.",
    ]

    final_prompt = (
        "Souhaitez-vous :\n"
        "1) Générer une roadmap de re-candidature étape par étape ?\n"
        "2) Préparer un itinéraire Plan B + estimation des coûts ?\n"
        "3) Programmer des rappels pour terminer les actions correctives ?"
    )

    return RefusalDecisionSupport(
        refusal_summary=summary,
        corrective_steps=steps_out,
        plan_b_options=planb,
        patterns=_dedup(patterns),
        disclaimers=disclaimers,
        final_user_prompt=final_prompt,
    )


def refusal_decision_support_to_dict(r: RefusalDecisionSupport) -> dict[str, Any]:
    return {
        "A_refusal_summary": [
            {
                "reason": x.reason,
                "explanation": x.explanation_plain_language,
                "severity_level": x.severity_level,
                "verifiable_factors": list(x.verifiable_factors),
            }
            for x in r.refusal_summary
        ],
        "B_corrective_steps": [
            {
                "step": x.step,
                "verification_required": bool(x.verification_required),
                "priority": x.priority,
                "related_reason": x.related_reason,
            }
            for x in r.corrective_steps
        ],
        "C_plan_b_options": [
            {
                "strategy": x.visa_or_country_or_strategy,
                "benefits": list(x.benefits),
                "risks": list(x.risks),
                "timeline": x.timeline,
                "notes": list(x.notes),
                "alignment_with_user_goals": x.alignment_with_user_goals,
            }
            for x in r.plan_b_options
        ],
        "patterns": list(r.patterns),
        "disclaimers": list(r.disclaimers),
        "final_user_prompt": r.final_user_prompt,
    }

