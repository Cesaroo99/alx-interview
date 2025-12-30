from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any


DEFAULT_EMBEDDED_HINT = "visa_copilot_ai/resources/visa_rules.json"


@dataclass(frozen=True)
class RulesLoadResult:
    rules: dict[str, Any]
    source: str  # "override" | "embedded"
    path: str


def get_override_path() -> str:
    # Path inside repo/container. In production you can mount a disk.
    return os.getenv("GLOBALVISA_RULES_OVERRIDE_PATH", "/app/api/data/visa_rules_override.json")


def load_rules() -> RulesLoadResult:
    override = get_override_path()
    if override and os.path.exists(override):
        with open(override, "r", encoding="utf-8") as f:
            return RulesLoadResult(rules=json.load(f), source="override", path=override)
    # Fallback: rely on embedded rules via eligibility._load_rules environment default
    # We return empty marker path to be explicit.
    from visa_copilot_ai.eligibility import _load_rules  # noqa: WPS450 - internal but acceptable for API layer

    return RulesLoadResult(rules=_load_rules(), source="embedded", path=DEFAULT_EMBEDDED_HINT)


def save_override_rules(rules: dict[str, Any]) -> str:
    override = get_override_path()
    os.makedirs(os.path.dirname(override), exist_ok=True)
    with open(override, "w", encoding="utf-8") as f:
        json.dump(rules, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    return override


def delete_override_rules() -> bool:
    override = get_override_path()
    if override and os.path.exists(override):
        os.remove(override)
        return True
    return False


def validate_rules(rules: dict[str, Any]) -> dict[str, Any]:
    """
    Validation légère:
    - structure minimale
    - poids raisonnables (somme > 0)
    - thresholds cohérents
    """

    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(rules, dict):
        return {"ok": False, "errors": ["Règles invalides: JSON racine doit être un objet."], "warnings": []}

    if "countries" not in rules or not isinstance(rules.get("countries"), dict):
        errors.append("Clé 'countries' manquante ou invalide (doit être un objet).")

    countries = rules.get("countries") if isinstance(rules.get("countries"), dict) else {}
    for c_name, c_cfg in countries.items():
        if not isinstance(c_cfg, dict):
            errors.append(f"countries.{c_name}: doit être un objet.")
            continue
        visa_types = c_cfg.get("visa_types")
        if visa_types is None:
            continue
        if not isinstance(visa_types, dict):
            errors.append(f"countries.{c_name}.visa_types: doit être un objet.")
            continue
        for v_name, v_cfg in visa_types.items():
            if not isinstance(v_cfg, dict):
                errors.append(f"countries.{c_name}.visa_types.{v_name}: doit être un objet.")
                continue
            weights = v_cfg.get("weights")
            if not isinstance(weights, dict) or not weights:
                warnings.append(f"{c_name}.{v_name}: 'weights' manquant/vide (score peu fiable).")
                continue
            try:
                total = sum(float(x) for x in weights.values())
            except Exception:
                errors.append(f"{c_name}.{v_name}: 'weights' contient des valeurs non numériques.")
                continue
            if total <= 0:
                errors.append(f"{c_name}.{v_name}: somme des poids <= 0.")
            if total < 0.8 or total > 1.2:
                warnings.append(f"{c_name}.{v_name}: somme des poids={total:.2f} (conseillé ~1.0).")

            th = v_cfg.get("thresholds") or {}
            if not isinstance(th, dict):
                errors.append(f"{c_name}.{v_name}: thresholds doit être un objet.")
                continue
            green = th.get("green", 70)
            orange = th.get("orange", 40)
            try:
                green_i = int(green)
                orange_i = int(orange)
                if not (0 <= orange_i <= green_i <= 100):
                    errors.append(f"{c_name}.{v_name}: thresholds invalides (0 <= orange <= green <= 100).")
            except Exception:
                errors.append(f"{c_name}.{v_name}: thresholds.green/orange doivent être des entiers.")

    return {"ok": len(errors) == 0, "errors": errors, "warnings": warnings}

