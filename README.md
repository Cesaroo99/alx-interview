## Visa Copilot AI

Visa Copilot AI est un **copilote IA** qui aide les voyageurs et migrants à réussir leurs démarches visa/immigration **de A à Z**, en restant **100% dans le cadre officiel**.

- **Ce que l'app fait**: guider, vérifier, expliquer, détecter les risques, protéger contre les scams.
- **Ce que l'app ne fait pas**: ne remplace pas les ambassades, ne soumet pas de dossier à votre place, ne contourne aucun portail officiel.

### Modules livrés dans ce dépôt (noyau)

- **AI Visa Diagnostic (offline / heuristique)**: calcule un score de risque et un score de “visa readiness”, puis liste des risques et actions recommandées avec des explications (“pourquoi”).
- **Anti-scam & sécurité**: vérification d’URL (https, raccourcisseurs, punycode/homographes, lookalikes) + recommandations “safe steps”.
- **Gestion de documents (structure + cohérence)**: checklist générique par zone/visa + alertes (passeport expirant, relevés trop anciens, etc.).
- **Vérification & scoring de dossier**: combine profil + documents → score de cohérence + readiness globale + plan d’actions.
- **Travel Intelligence (SIMULATION)**: itinéraire crédible “visa-compliant” (sans réservation/payments).
- **Refusal explanation & plan B**: explication claire des motifs (templates) + corrections + alternatives.
- **Form filling guidance**: explication de champs + suggestion de valeur (quand possible) + checks de cohérence (sans soumission).
- **Appointment & cost assistance**: calcul de coûts à partir de montants officiels fournis + avertissements anti-frais douteux.

### Utilisation rapide (CLI)

Diagnostic (compat):

```bash
python3 -m visa_copilot_ai --profile examples/profile_example.json --pretty
```

### Anti-scam: vérifier une URL (official-only)

```bash
python3 -m visa_copilot_ai verify-url --url "https://travel.state.gov/" --pretty
```

### Vérifier un dossier (profil + documents)

```bash
python3 -m visa_copilot_ai verify-dossier --input examples/dossier_input_example.json --pretty
```

### Générer un itinéraire (simulation)

```bash
python3 -m visa_copilot_ai plan-trip --input examples/trip_input_example.json --pretty
```

### Expliquer un refus + plan B

```bash
python3 -m visa_copilot_ai explain-refusal --input examples/refusal_input_example.json --pretty
```

### Estimer des coûts (à partir de montants officiels fournis)

```bash
python3 -m visa_copilot_ai estimate-costs --input examples/costs_input_example.json --pretty
```

### Aide champ formulaire (explicable, sans soumission)

```bash
python3 -m visa_copilot_ai guide-field --input examples/field_guidance_input_example.json --pretty
```

### Tests

```bash
python3 -m unittest
```

### Frontend (Web + iOS + Android)

Le frontend unifié (Expo / React Native) est dans `apps/visa-copilot-ai` et tourne sur **web**, **iOS** et **Android** avec le même codebase.

```bash
cd apps/visa-copilot-ai
npm run web
# ou:
# npm run android
# npm run ios (sur macOS, sinon via Expo Go)
```

