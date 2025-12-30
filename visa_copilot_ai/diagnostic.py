from __future__ import annotations

from dataclasses import asdict
from typing import Any

from .models import (
    DiagnosticResult,
    EmploymentStatus,
    FinancialProfile,
    Recommendation,
    TravelPurpose,
    UserProfile,
)


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _confidence_from_score(score_0_1: float) -> float:
    return _clamp(score_0_1, 0.05, 0.95)


def _normalize_text(s: str) -> str:
    return " ".join((s or "").strip().split())


def run_visa_diagnostic(profile: UserProfile) -> DiagnosticResult:
    """
    Diagnostic "visa-first" (heuristique) avec explications.

    Important:
    - Ce module ne peut pas connaître les règles exactes par nationalité sans
      intégration aux sources officielles.
    - Les scores ne sont pas des décisions ni des probabilités officielles.
    """

    assumptions: list[str] = []
    key_risks: list[str] = []
    next_actions: list[str] = []

    # --- Sanity / completeness ---
    if profile.age < 0:
        assumptions.append("Âge fourni invalide; traité comme 0.")
    if profile.travel_history_trips_last_5y < 0:
        assumptions.append("Historique de voyage négatif; traité comme 0.")
    if profile.prior_visa_refusals < 0:
        assumptions.append("Nombre de refus négatif; traité comme 0.")

    age = max(0, profile.age)
    trips = max(0, profile.travel_history_trips_last_5y)
    refusals = max(0, profile.prior_visa_refusals)

    nationality = _normalize_text(profile.nationality)
    profession = _normalize_text(profile.profession)

    if not nationality:
        assumptions.append("Nationalité manquante; le diagnostic est très limité.")
        key_risks.append("Nationalité non précisée: impossible d'évaluer l'éligibilité réelle par pays.")
        next_actions.append("Renseigner la nationalité exacte (passeport) pour vérifier les règles officielles.")

    if not profession:
        assumptions.append("Profession manquante; cohérence socio-professionnelle à confirmer.")
        key_risks.append("Profession non précisée: risque de dossier peu cohérent (attaches, justification).")
        next_actions.append("Ajouter la profession + statut (employé, indépendant, étudiant...) et justificatifs associés.")

    # --- Core risk heuristics (0..1) ---
    # Base risk starts medium; we adjust with factors.
    risk = 0.45

    # Refusals are strong risk signals.
    if refusals > 0:
        risk += 0.18 + 0.08 * min(refusals, 3)
        key_risks.append("Antécédents de refus: les consulats exigent souvent une correction claire des causes précédentes.")
        next_actions.append("Récupérer et analyser la lettre/motif officiel de refus; préparer une réponse documentée.")

    # Travel history: more credible return pattern.
    if trips == 0:
        risk += 0.14
        key_risks.append("Aucun historique de voyage récent: crédibilité de retour parfois plus difficile à démontrer.")
        next_actions.append("Renforcer les attaches (emploi, études, famille, biens) et la cohérence du plan de voyage.")
    elif trips <= 2:
        risk += 0.06
    elif trips >= 6:
        risk -= 0.05

    # Age heuristics: not a rule; just typical risk patterns.
    if age < 23 and profile.travel_purpose in {TravelPurpose.TOURISM, TravelPurpose.OTHER}:
        risk += 0.07
        key_risks.append("Jeune profil + tourisme: certains postes demandent des preuves d'attaches plus solides.")
        next_actions.append("Ajouter preuves d'attaches (scolarité/emploi), planning crédible et budget cohérent.")
    if age > 65 and profile.travel_purpose == TravelPurpose.STUDY:
        risk += 0.10
        key_risks.append("Études avec âge atypique: risque d'incohérence perçue si le projet n'est pas très justifié.")
        next_actions.append("Documenter clairement le projet d'études (admission, pertinence, financement, retour).")

    # Employment status: stability signals.
    if profile.employment_status in {EmploymentStatus.UNEMPLOYED, EmploymentStatus.OTHER}:
        risk += 0.08
        key_risks.append("Statut professionnel faible/indéfini: attache au pays de résidence parfois plus difficile à prouver.")
        next_actions.append("Stabiliser/clarifier le statut (contrat, registre, école) et fournir justificatifs officiels.")
    elif profile.employment_status in {EmploymentStatus.EMPLOYED, EmploymentStatus.STUDENT}:
        risk -= 0.03

    # Financial plausibility (minimal, optional).
    fp: FinancialProfile | None = profile.financial_profile
    if fp is None:
        assumptions.append("Profil financier non fourni; budget/durée non évalués.")
        next_actions.append("Ajouter un budget estimatif (épargne, revenus, sponsor) pour vérifier la cohérence.")
    else:
        if fp.monthly_income_usd is None and fp.savings_usd is None and fp.sponsor_available is None:
            assumptions.append("Profil financier vide; traité comme non fourni.")
            next_actions.append("Compléter les informations financières (revenus, épargne, sponsor) si possible.")
        else:
            if fp.savings_usd is not None and fp.savings_usd < 0:
                assumptions.append("Épargne négative; ignorée.")
            if fp.monthly_income_usd is not None and fp.monthly_income_usd < 0:
                assumptions.append("Revenus négatifs; ignorés.")

            savings = fp.savings_usd if (fp.savings_usd is not None and fp.savings_usd > 0) else None
            income = fp.monthly_income_usd if (fp.monthly_income_usd is not None and fp.monthly_income_usd > 0) else None
            sponsor = bool(fp.sponsor_available) if fp.sponsor_available is not None else None

            if savings is None and income is None and sponsor is not True:
                risk += 0.14
                key_risks.append("Finances insuffisamment démontrées: risque de refus pour capacité de prise en charge.")
                next_actions.append("Préparer relevés bancaires, preuves de revenus, ou sponsor officiel avec justificatifs.")
            elif savings is not None and savings < 800:
                risk += 0.06
                key_risks.append("Épargne faible: attention à la cohérence avec la durée et le niveau de vie visé.")
                next_actions.append("Réduire la durée/ambition du voyage ou renforcer les preuves de financement.")
            elif sponsor is True:
                risk -= 0.03

    # Purpose-specific risks.
    if profile.travel_purpose == TravelPurpose.STUDY:
        next_actions.append("Vérifier admission, calendrier, preuves de paiement/financement, et conditions de retour.")
    elif profile.travel_purpose == TravelPurpose.BUSINESS:
        next_actions.append("Préparer lettre d'invitation, agenda pro, et preuve d'emploi/entreprise.")
    elif profile.travel_purpose == TravelPurpose.TOURISM:
        next_actions.append("Préparer itinéraire réaliste, hébergement cohérent, et preuves d'attaches/retour.")

    # Clamp risk score.
    refusal_risk_score = _clamp(risk, 0.05, 0.98)

    # Difficulty level mapping
    if refusal_risk_score < 0.35:
        difficulty = "low"
    elif refusal_risk_score < 0.62:
        difficulty = "medium"
    else:
        difficulty = "high"

    # Readiness score: how ready to submit (not just risk).
    # We approximate readiness as inverse risk + completeness bonus.
    completeness = 0.0
    completeness += 0.25 if nationality else 0.0
    completeness += 0.20 if profession else 0.0
    completeness += 0.15 if profile.employment_status != EmploymentStatus.OTHER else 0.0
    completeness += 0.15 if profile.travel_purpose != TravelPurpose.OTHER else 0.0
    completeness += 0.25 if fp is not None else 0.0
    completeness = _clamp(completeness, 0.0, 1.0)

    readiness = (1.0 - refusal_risk_score) * 70.0 + completeness * 30.0
    readiness_score = _clamp(readiness, 0.0, 100.0)

    # Recommendations (regions/countries) — exploratory, not eligibility.
    regions: list[Recommendation] = []
    hint = _normalize_text(profile.destination_region_hint or "")
    if hint:
        regions.append(
            Recommendation(
                label=hint,
                confidence=0.75,
                why=[
                    "Vous avez indiqué une destination cible; on priorise l'analyse autour de cette zone.",
                    "Les exigences exactes dépendent de la nationalité et des règles officielles en vigueur.",
                ],
            )
        )
    else:
        assumptions.append("Aucune destination cible; suggestions génériques (à confirmer selon règles officielles).")
        regions.extend(
            [
                Recommendation(
                    label="Zone Schengen (à confirmer)",
                    confidence=0.40,
                    why=[
                        "Destination fréquente pour tourisme/affaires.",
                        "Nécessite une vérification stricte des règles officielles par nationalité.",
                    ],
                ),
                Recommendation(
                    label="Royaume-Uni (à confirmer)",
                    confidence=0.35,
                    why=[
                        "Procédure structurée, souvent très documentée.",
                        "Les critères varient fortement selon profil et antécédents.",
                    ],
                ),
                Recommendation(
                    label="Turquie / E-visa (à confirmer)",
                    confidence=0.30,
                    why=[
                        "Pour certaines nationalités, le processus peut être plus simple.",
                        "Toujours vérifier le portail officiel (anti-scam).",
                    ],
                ),
            ]
        )

    # Recommended visa types by purpose.
    vt: list[Recommendation] = []
    if profile.travel_purpose == TravelPurpose.TOURISM:
        vt.append(
            Recommendation(
                label="Visa visiteur / tourisme",
                confidence=_confidence_from_score(0.80),
                why=["Correspond à l'objet déclaré (tourisme).", "Le dossier doit prouver budget, itinéraire et attaches."],
            )
        )
    elif profile.travel_purpose == TravelPurpose.BUSINESS:
        vt.append(
            Recommendation(
                label="Visa visiteur affaires",
                confidence=_confidence_from_score(0.80),
                why=["Correspond à l'objet déclaré (affaires).", "Invitation + agenda + preuves d'activité sont critiques."],
            )
        )
    elif profile.travel_purpose == TravelPurpose.STUDY:
        vt.append(
            Recommendation(
                label="Visa étudiant",
                confidence=_confidence_from_score(0.85),
                why=["Correspond à l'objet déclaré (études).", "Admission + financement + projet cohérent sont déterminants."],
            )
        )
    elif profile.travel_purpose == TravelPurpose.FAMILY:
        vt.append(
            Recommendation(
                label="Visa visite familiale / regroupement (selon pays)",
                confidence=_confidence_from_score(0.70),
                why=["Correspond à l'objet déclaré (famille).", "Preuves de lien + statut de l'hôte sont essentiels."],
            )
        )
    elif profile.travel_purpose == TravelPurpose.TRANSIT:
        vt.append(
            Recommendation(
                label="Visa de transit (si requis)",
                confidence=_confidence_from_score(0.60),
                why=[
                    "Correspond à l'objet déclaré (transit).",
                    "Certaines nationalités doivent un visa même sans sortie de zone aéroportuaire.",
                ],
            )
        )
    elif profile.travel_purpose == TravelPurpose.MEDICAL:
        vt.append(
            Recommendation(
                label="Visa médical / traitement",
                confidence=_confidence_from_score(0.75),
                why=["Correspond à l'objet déclaré (médical).", "Dossier médical + prise en charge financière doivent être clairs."],
            )
        )
    else:
        assumptions.append("Motif non précisé; type de visa non optimisé.")
        vt.append(
            Recommendation(
                label="Type de visa à préciser",
                confidence=0.30,
                why=[
                    "Le type de visa dépend strictement de l'objet du voyage.",
                    "Une mauvaise catégorie augmente fortement le risque de refus.",
                ],
            )
        )
        next_actions.append("Clarifier le motif (tourisme, affaires, études, famille...) avant de commencer les formulaires.")

    # Anti-scam warnings (always).
    anti_scam = [
        "Ne payez jamais sur un site non officiel: vérifiez le domaine et les liens depuis le site de l'ambassade/gouvernement.",
        "Méfiez-vous des 'agents' promettant une approbation garantie: aucun tiers ne peut garantir une décision consulaire.",
        "Ne partagez pas vos identifiants de portail officiel; utilisez l'app uniquement comme guide.",
    ]

    disclaimers = [
        "Ce diagnostic est un outil d'aide: il ne constitue pas un avis juridique.",
        "Les exigences et frais changent: vérifiez toujours la source officielle (ambassade/gouvernement).",
        "Les scores sont heuristiques et servent à prioriser les risques; ils ne prédisent pas une décision.",
    ]

    # De-duplicate actions while keeping order.
    def _dedup(seq: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for x in seq:
            x2 = _normalize_text(x)
            if not x2 or x2 in seen:
                continue
            seen.add(x2)
            out.append(x2)
        return out

    key_risks = _dedup(key_risks)
    next_actions = _dedup(next_actions)
    assumptions = _dedup(assumptions)

    return DiagnosticResult(
        eligible_countries_or_regions=regions,
        recommended_visa_types=vt,
        difficulty_level=difficulty,
        refusal_risk_score=round(refusal_risk_score, 3),
        readiness_score=round(readiness_score, 1),
        key_risks=key_risks,
        next_best_actions=next_actions,
        anti_scam_warnings=anti_scam,
        assumptions=assumptions,
        disclaimers=disclaimers,
    )


def diagnostic_to_dict(result: DiagnosticResult) -> dict[str, Any]:
    """
    Conversion JSON-friendly, stable et explicite.
    """

    def rec_to_dict(r: Recommendation) -> dict[str, Any]:
        return {"label": r.label, "confidence": round(float(r.confidence), 3), "why": list(r.why)}

    return {
        "eligible_countries_or_regions": [rec_to_dict(r) for r in result.eligible_countries_or_regions],
        "recommended_visa_types": [rec_to_dict(r) for r in result.recommended_visa_types],
        "difficulty_level": result.difficulty_level,
        "refusal_risk_score": float(result.refusal_risk_score),
        "readiness_score": float(result.readiness_score),
        "key_risks": list(result.key_risks),
        "next_best_actions": list(result.next_best_actions),
        "anti_scam_warnings": list(result.anti_scam_warnings),
        "assumptions": list(result.assumptions),
        "disclaimers": list(result.disclaimers),
    }


def profile_to_dict(profile: UserProfile) -> dict[str, Any]:
    """
    Sérialisation simple du profil (utile pour logs non sensibles / debug).
    """

    # dataclasses.asdict convertit les Enums en objets Enum; on normalise.
    d = asdict(profile)
    d["employment_status"] = profile.employment_status.value
    d["travel_purpose"] = profile.travel_purpose.value
    if profile.financial_profile is not None:
        d["financial_profile"] = asdict(profile.financial_profile)
    return d

