## Visa Copilot AI

Visa Copilot AI est un **copilote IA** qui aide les voyageurs et migrants à réussir leurs démarches visa/immigration **de A à Z**, en restant **100% dans le cadre officiel**.

- **Ce que l'app fait**: guider, vérifier, expliquer, détecter les risques, protéger contre les scams.
- **Ce que l'app ne fait pas**: ne remplace pas les ambassades, ne soumet pas de dossier à votre place, ne contourne aucun portail officiel.

### Module livré dans ce dépôt (premier noyau)

- **AI Visa Diagnostic (offline / heuristique)**: calcule un score de risque et un score de “visa readiness”, puis liste des risques et actions recommandées avec des explications (“pourquoi”).
- **Anti-scam**: avertissements systématiques (sites officiels uniquement, pas de promesses d’approbation, pas de partage d’identifiants).

### Utilisation rapide (CLI)

Exemple:

```bash
python -m visa_copilot_ai --profile examples/profile_example.json --pretty
```

### Tests

```bash
python -m unittest
```

