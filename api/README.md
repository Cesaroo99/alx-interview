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

