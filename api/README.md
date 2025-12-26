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
- `GET /offices` (ambassades/consulats/TLS/VFS)
- `GET /news` (actu visa & lois, inclut cache ingéré)

### Admin (protégé par `GLOBALVISA_ADMIN_KEY`)

- Éligibilité (règles): `GET/POST validate/PUT/DELETE /admin/eligibility/rules`
- Contenu “offices”: `GET/POST validate/PUT/DELETE /admin/offices`
- Contenu “news”: `GET/POST validate/PUT/DELETE /admin/news`
- Sources ingestion news: `GET/POST validate/PUT/DELETE /admin/news/sources`
- Ingestion news:
  - `GET /admin/news/ingest/status`
  - `POST /admin/news/ingest/run`

