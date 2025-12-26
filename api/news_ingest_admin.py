from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class LoadResult:
    data: dict[str, Any]
    source: str  # "override" | "embedded" | "cache"
    path: str


def get_sources_override_path() -> str:
    return os.getenv("GLOBALVISA_NEWS_SOURCES_OVERRIDE_PATH", "/app/api/data/news_sources_override.json")


def get_ingested_cache_path() -> str:
    return os.getenv("GLOBALVISA_NEWS_INGESTED_CACHE_PATH", "/app/api/data/news_ingested.json")


def load_sources() -> LoadResult:
    override = get_sources_override_path()
    if override and os.path.exists(override):
        with open(override, "r", encoding="utf-8") as f:
            return LoadResult(data=json.load(f), source="override", path=override)

    from visa_copilot_ai.news_ingest import _load_sources  # noqa: WPS450 - internal acceptable in API layer

    return LoadResult(data=_load_sources(), source="embedded", path="visa_copilot_ai/resources/news_sources.json")


def save_sources_override(data: dict[str, Any]) -> str:
    override = get_sources_override_path()
    os.makedirs(os.path.dirname(override), exist_ok=True)
    with open(override, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    return override


def delete_sources_override() -> bool:
    override = get_sources_override_path()
    if override and os.path.exists(override):
        os.remove(override)
        return True
    return False


def validate_sources(data: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(data, dict):
        return {"ok": False, "errors": ["JSON racine doit être un objet."], "warnings": []}
    if "sources" not in data or not isinstance(data.get("sources"), list):
        return {"ok": False, "errors": ["Clé 'sources' manquante ou invalide (doit être une liste)."], "warnings": []}

    for i, s in enumerate(data["sources"]):
        if not isinstance(s, dict):
            errors.append(f"sources[{i}] doit être un objet.")
            continue
        if not str(s.get("id") or "").strip():
            warnings.append(f"sources[{i}].id manquant (recommandé).")
        if not str(s.get("country") or "").strip():
            errors.append(f"sources[{i}].country manquant.")
        feed = str(s.get("feed_url") or "").strip()
        if not feed:
            errors.append(f"sources[{i}].feed_url manquant.")
        if feed and not (feed.startswith("http://") or feed.startswith("https://")):
            warnings.append(f"sources[{i}].feed_url devrait être http(s): '{feed}'.")
        cat = str(s.get("category") or "").strip().lower()
        if cat and cat not in {"visa_news", "law_change"}:
            warnings.append(f"sources[{i}].category inattendue: '{cat}'.")

    return {"ok": len(errors) == 0, "errors": errors, "warnings": warnings}


def load_ingested_cache() -> LoadResult:
    path = get_ingested_cache_path()
    if path and os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return LoadResult(data=json.load(f), source="cache", path=path)
    return LoadResult(data={"updated_at": None, "items": [], "last_ingest": None}, source="cache", path=path)


def save_ingested_cache(payload: dict[str, Any]) -> str:
    path = get_ingested_cache_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    return path

