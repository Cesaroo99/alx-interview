## Visa Copilot AI API (backend)

API minimale pour connecter le frontend Expo aux modules Python.

### Lancer en local

Depuis `/workspace`:

```bash
python3 -m pip install -r api/requirements.txt
python3 -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### Endpoints

- `GET /health`
- `POST /diagnose`
- `POST /verify-url`
- `POST /verify-dossier`
- `POST /plan-trip`
- `POST /explain-refusal`
- `POST /estimate-costs`
- `POST /guide-field`
- `POST /ai/respond` (proxy minimal OpenAI Responses)
- `GET /offices` (ambassades/consulats/TLS/VFS)
- `GET /news` (actu visa & lois, inclut cache ingéré)

### OpenAI (optionnel)

Pour activer les réponses LLM dans `POST /copilot/chat` et utiliser `POST /ai/respond`, configure:

- `OPENAI_API_KEY` (obligatoire)
- `OPENAI_MODEL` (optionnel, défaut: `gpt-5-nano`)
- `OPENAI_BASE_URL` (optionnel, défaut: `https://api.openai.com`)

Exemple:

```bash
export OPENAI_API_KEY="..."
export OPENAI_MODEL="gpt-5-nano"
```

### Admin (protégé par `GLOBALVISA_ADMIN_KEY`)

- Éligibilité (règles): `GET/POST validate/PUT/DELETE /admin/eligibility/rules`
- Contenu “offices”: `GET/POST validate/PUT/DELETE /admin/offices`
- Contenu “news”: `GET/POST validate/PUT/DELETE /admin/news`
- Sources ingestion news: `GET/POST validate/PUT/DELETE /admin/news/sources`
- Ingestion news:
  - `GET /admin/news/ingest/status`
  - `POST /admin/news/ingest/run`

