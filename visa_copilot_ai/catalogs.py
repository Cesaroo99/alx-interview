from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional


def _resources_dir() -> Path:
    return Path(__file__).resolve().parent / "resources"


def load_resource_json(filename: str) -> dict[str, Any]:
    """
    Charge un JSON depuis visa_copilot_ai/resources/.
    """
    path = _resources_dir() / filename
    raw = path.read_text(encoding="utf-8")
    return json.loads(raw)


@dataclass(frozen=True)
class CatalogPack:
    source: str
    path: str
    data: dict[str, Any]


def load_catalog(filename: str) -> CatalogPack:
    path = _resources_dir() / filename
    return CatalogPack(source="bundled", path=str(path), data=load_resource_json(filename))


def list_portals(
    *,
    data: dict[str, Any],
    country: Optional[str] = None,
    provider_type: Optional[str] = None,
    q: Optional[str] = None,
) -> list[dict[str, Any]]:
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        return []
    out: list[dict[str, Any]] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        out.append(dict(it))

    def norm(x: Any) -> str:
        return " ".join(str(x or "").strip().lower().split())

    c = norm(country) if country else ""
    t = norm(provider_type) if provider_type else ""
    qq = norm(q) if q else ""

    def ok(it: dict[str, Any]) -> bool:
        if c and norm(it.get("country")) != c:
            return False
        if t and norm(it.get("provider_type")) != t:
            return False
        if qq:
            blob = " ".join(
                [
                    norm(it.get("name")),
                    norm(it.get("official_url")),
                    " ".join([norm(x) for x in (it.get("tags") or []) if x]),
                ]
            )
            if qq not in blob:
                return False
        return True

    return [it for it in out if ok(it)]


def get_form_template(*, data: dict[str, Any], form_type: str) -> Optional[dict[str, Any]]:
    items = data.get("forms") if isinstance(data, dict) else None
    if not isinstance(items, list):
        return None
    ft = " ".join(str(form_type or "").strip().lower().split())
    for f in items:
        if not isinstance(f, dict):
            continue
        if " ".join(str(f.get("form_type") or "").strip().lower().split()) == ft:
            return dict(f)
    return None


def validate_form_draft(*, template: dict[str, Any], draft_values: dict[str, Any]) -> dict[str, Any]:
    fields = template.get("fields")
    if not isinstance(fields, list):
        return {"ok": False, "errors": ["Template invalide (fields)."], "warnings": []}

    errors: list[str] = []
    warnings: list[str] = []

    for f in fields:
        if not isinstance(f, dict):
            continue
        name = str(f.get("name") or "").strip()
        if not name:
            continue
        required = bool(f.get("required", False))
        val = draft_values.get(name)
        if required and not str(val or "").strip():
            errors.append(f"Champ requis manquant: {name}")

        # checks simples
        if name in {"arrival_date", "departure_date"} and str(val or "").strip():
            s = str(val).strip()
            if not (len(s) == 10 and s[4] == "-" and s[7] == "-"):
                warnings.append(f"Format date suspect pour {name}: attendu YYYY-MM-DD.")

    return {"ok": len(errors) == 0, "errors": errors, "warnings": warnings}

