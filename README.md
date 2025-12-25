## GlobalVisa

GlobalVisa est un **copilote IA** qui aide les voyageurs et migrants à réussir leurs démarches visa/immigration **de A à Z**, en restant **100% dans le cadre officiel**.

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

### Modules frontend (MVP)

- **Onboarding intelligent**: 1 question par écran + résumé + diagnostic initial.
- **Documents**: import PDF/photo + stockage local + liste (OCR à brancher ensuite).
- **Dossier**: appel API `/verify-dossier` (profil + documents) → score + risques + actions.
- **Copilot**: chat MVP via API `/copilot/chat` (guidance + actions rapides).
- **Rendez-vous**: rappels MVP (prochaine itération: persistance + notifications).
- **Abonnements**: écran pricing + checkout Flutterwave (MVP via navigateur).

### API pour connecter le frontend

L’API FastAPI est dans `api/` (elle expose les modules Python via JSON).

```bash
python3 -m pip install -r api/requirements.txt
python3 -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

Dans le frontend, configurez la variable:
- `EXPO_PUBLIC_API_BASE_URL` (ex: `http://localhost:8000`)

### Déploiement Render (frontend web + backend API) — prêt

Le repo contient maintenant un blueprint Render `render.yaml` (déploiement “1‑clic”):
- **Backend**: service web Docker (`api/Dockerfile`)
- **Frontend web**: site statique (build `expo export -p web`)

Important:
- Après création sur Render, mettez `EXPO_PUBLIC_API_BASE_URL` du service web sur l’URL Render du backend (ex: `https://visa-copilot-ai-api.onrender.com`).

