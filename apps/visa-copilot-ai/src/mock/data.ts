export const Mock = {
  diagnostic: {
    difficulty_level: "medium",
    refusal_risk_score: 0.47,
    readiness_score: 68.5,
    key_risks: [
      "Aucun historique de voyage récent: crédibilité de retour parfois plus difficile à démontrer.",
      "Profil financier non fourni; budget/durée non évalués.",
    ],
    next_best_actions: [
      "Renforcer les attaches (emploi, études, famille, biens) et la cohérence du plan de voyage.",
      "Ajouter un budget estimatif (épargne, revenus, sponsor) pour vérifier la cohérence.",
      "Préparer itinéraire réaliste, hébergement cohérent, et preuves d'attaches/retour.",
    ],
    anti_scam_warnings: [
      "Ne payez jamais sur un site non officiel: vérifiez le domaine et les liens depuis le site de l'ambassade/gouvernement.",
      "Méfiez-vous des 'agents' promettant une approbation garantie: aucun tiers ne peut garantir une décision consulaire.",
      "Ne partagez pas vos identifiants de portail officiel; utilisez l'app uniquement comme guide.",
    ],
  },
  security: {
    input_url: "https://travel.state.gov/",
    hostname: "travel.state.gov",
    scheme: "https",
    likely_official: true,
    risk_score: 0.22,
    risk_level: "low",
    reasons: ["Le domaine ressemble à un domaine gouvernemental connu (signal positif, non une garantie)."],
    next_safe_steps: [
      "Ouvrir le site en tapant l'adresse depuis une source officielle, pas depuis une publicité.",
      "Vérifier l'orthographe exacte du domaine (lettres doublées, tirets, substitutions).",
      "Ne jamais partager vos identifiants de portail officiel avec un tiers.",
    ],
  },
  dossier: {
    destination_region: "Zone Schengen",
    visa_type: "Visa visiteur / tourisme",
    coherence_score: 78.0,
    readiness_score: 72.0,
    readiness_level: "almost_ready",
    key_risks: [
      "Documents potentiellement requis manquants (template générique).",
      "Passeport proche de l'expiration (< 6 mois).",
    ],
    next_best_actions: [
      "Vérifier la checklist officielle (ambassade/gouvernement) et compléter le dossier avant dépôt.",
      "Vérifier l'exigence officielle; envisager un renouvellement préventif.",
    ],
  },
  trip: {
    destination: "Paris, France",
    start_date: "2026-02-10",
    end_date: "2026-02-18",
    duration_days: 9,
    estimated_budget_usd: 1400,
    budget_level: "medium",
    coherence_warnings: [],
    itinerary_preview: ["Jour 1 — Paris", "Jour 2 — Paris", "Jour 8 — Excursion proche de Paris", "Jour 9 — Excursion proche de Paris"],
  },
  refusal: {
    refusal_reasons: ["insufficient_funds", "ties_not_sufficient"],
    plain_explanation: [
      "Le consulat n'a pas été convaincu que vous pouvez financer le séjour et/ou le retour.",
      "Le consulat n'a pas été convaincu de votre intention de retourner (attaches insuffisantes).",
    ],
    corrective_actions: [
      "Fournir des relevés récents (selon règle officielle) avec mouvements cohérents.",
      "Ajouter preuves d'attaches: contrat/attestation employeur, certificat scolarité, charges, famille, biens, obligations.",
    ],
    plan_b_options: [
      "Repostuler uniquement après correction vérifiable des causes (sinon risque de refus répété).",
      "Si le refus est contestable: vérifier les voies officielles de recours/appeal (selon pays).",
    ],
  },
  costs: {
    currency: "EUR",
    total: 235,
    items: [
      { label: "Frais de visa (officiel)", amount: 90, mandatory: true },
      { label: "Frais de service (centre agréé) — si applicable", amount: 30, mandatory: true },
      { label: "Traductions certifiées (estimation)", amount: 60, mandatory: false },
      { label: "Assurance voyage (estimation) — si requise", amount: 40, mandatory: false },
      { label: "Courrier / retour passeport (estimation)", amount: 15, mandatory: false },
    ],
  },
} as const;

