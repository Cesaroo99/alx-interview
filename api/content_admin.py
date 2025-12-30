from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ContentLoadResult:
    data: dict[str, Any]
    source: str  # "override" | "embedded"
    path: str


def _ensure_dir(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)


def get_offices_override_path() -> str:
    return os.getenv("GLOBALVISA_OFFICES_OVERRIDE_PATH", "/app/api/data/offices_override.json")


def get_news_override_path() -> str:
    return os.getenv("GLOBALVISA_NEWS_OVERRIDE_PATH", "/app/api/data/news_override.json")


def load_offices_data() -> ContentLoadResult:
    override = get_offices_override_path()
    if override and os.path.exists(override):
        with open(override, "r", encoding="utf-8") as f:
            return ContentLoadResult(data=json.load(f), source="override", path=override)

    from visa_copilot_ai.offices import _load_offices  # noqa: WPS450 - internal acceptable in API layer

    return ContentLoadResult(data=_load_offices(), source="embedded", path="visa_copilot_ai/resources/offices.json")


def save_offices_override(data: dict[str, Any]) -> str:
    override = get_offices_override_path()
    _ensure_dir(override)
    with open(override, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    return override


def delete_offices_override() -> bool:
    override = get_offices_override_path()
    if override and os.path.exists(override):
        os.remove(override)
        return True
    return False


def load_news_data() -> ContentLoadResult:
    override = get_news_override_path()
    if override and os.path.exists(override):
        with open(override, "r", encoding="utf-8") as f:
            return ContentLoadResult(data=json.load(f), source="override", path=override)

    from visa_copilot_ai.news import _load_news  # noqa: WPS450 - internal acceptable in API layer

    return ContentLoadResult(data=_load_news(), source="embedded", path="visa_copilot_ai/resources/news.json")


def save_news_override(data: dict[str, Any]) -> str:
    override = get_news_override_path()
    _ensure_dir(override)
    with open(override, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    return override


def delete_news_override() -> bool:
    override = get_news_override_path()
    if override and os.path.exists(override):
        os.remove(override)
        return True
    return False


def validate_offices_data(data: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(data, dict):
        return {"ok": False, "errors": ["JSON racine doit être un objet."], "warnings": []}
    if "offices" not in data or not isinstance(data.get("offices"), list):
        errors.append("Clé 'offices' manquante ou invalide (doit être une liste).")
        return {"ok": False, "errors": errors, "warnings": warnings}

    for i, o in enumerate(data["offices"]):
        if not isinstance(o, dict):
            errors.append(f"offices[{i}] doit être un objet.")
            continue
        if not str(o.get("id") or "").strip():
            warnings.append(f"offices[{i}].id manquant (recommandé).")
        if not str(o.get("type") or "").strip():
            errors.append(f"offices[{i}].type manquant.")
        if not str(o.get("country") or "").strip():
            errors.append(f"offices[{i}].country manquant.")
        if not str(o.get("city") or "").strip():
            errors.append(f"offices[{i}].city manquant.")
        if not str(o.get("name") or "").strip():
            warnings.append(f"offices[{i}].name manquant (recommandé).")
        if "services" in o and not isinstance(o.get("services"), list):
            errors.append(f"offices[{i}].services doit être une liste.")

    return {"ok": len(errors) == 0, "errors": errors, "warnings": warnings}


def validate_news_data(data: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(data, dict):
        return {"ok": False, "errors": ["JSON racine doit être un objet."], "warnings": []}
    if "items" not in data or not isinstance(data.get("items"), list):
        errors.append("Clé 'items' manquante ou invalide (doit être une liste).")
        return {"ok": False, "errors": errors, "warnings": warnings}

    for i, it in enumerate(data["items"]):
        if not isinstance(it, dict):
            errors.append(f"items[{i}] doit être un objet.")
            continue
        if not str(it.get("id") or "").strip():
            warnings.append(f"items[{i}].id manquant (recommandé).")
        cat = str(it.get("category") or "").strip().lower()
        if cat not in {"visa_news", "law_change"}:
            warnings.append(f"items[{i}].category inattendue: '{cat}' (attendu visa_news|law_change).")
        if not str(it.get("country") or "").strip():
            errors.append(f"items[{i}].country manquant.")
        if not str(it.get("title") or "").strip():
            warnings.append(f"items[{i}].title manquant (recommandé).")
        if "tags" in it and not isinstance(it.get("tags"), list):
            errors.append(f"items[{i}].tags doit être une liste.")

    return {"ok": len(errors) == 0, "errors": errors, "warnings": warnings}

