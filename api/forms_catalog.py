from __future__ import annotations

import json
import os
from typing import Any, Optional


FORMS_DIR = os.getenv("GLOBALVISA_FORMS_DIR", "api/forms")


def _load_json(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def list_forms(
    *,
    form_type: str | None = None,
    country: str | None = None,
    intent: str | None = None,
) -> list[dict[str, Any]]:
    if not os.path.isdir(FORMS_DIR):
        return []
    out: list[dict[str, Any]] = []
    for name in sorted(os.listdir(FORMS_DIR)):
        if not name.endswith(".json"):
            continue
        data = _load_json(os.path.join(FORMS_DIR, name))
        meta = data.get("meta") if isinstance(data.get("meta"), dict) else {}
        if form_type and str(meta.get("type", "")).lower() != form_type.lower():
            continue
        if country and str(meta.get("country", "")).lower() != country.lower():
            continue
        if intent and str(meta.get("intent", "")).lower() != intent.lower():
            continue
        out.append({"id": data.get("id"), "meta": meta})
    return out


def get_form(form_id: str) -> dict[str, Any] | None:
    if not os.path.isdir(FORMS_DIR):
        return None
    for name in os.listdir(FORMS_DIR):
        if not name.endswith(".json"):
            continue
        path = os.path.join(FORMS_DIR, name)
        data = _load_json(path)
        if str(data.get("id")) == str(form_id):
            return data
    return None


def select_form_id(*, form_type: str, country: str, intent: str) -> str | None:
    forms = list_forms(form_type=form_type, country=country, intent=intent)
    if forms:
        return str(forms[0]["id"])
    # fallback: match sans intent
    forms2 = list_forms(form_type=form_type, country=country, intent=None)
    if forms2:
        return str(forms2[0]["id"])
    return None

