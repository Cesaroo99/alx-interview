from __future__ import annotations

import json
import os
from typing import Any

from fastapi import HTTPException

from .openai_responses import call_openai_responses


def _require_openai() -> None:
    if not (os.getenv("OPENAI_API_KEY") or "").strip():
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY non configurée sur le serveur.")


def _parse_json_strict(text: str) -> dict[str, Any]:
    s = (text or "").strip()
    if not s:
        return {}
    try:
        return json.loads(s)
    except Exception as e:
        # Sécurise: ne renvoie jamais de texte libre au frontend, uniquement une erreur structurée.
        return {"error": "ai_output_not_json", "raw": s[:2000]}


def build_plan_from_action(*, locale: str, goal: dict[str, Any], context: dict[str, Any], current_plan: dict[str, Any] | None, action: dict[str, Any]) -> dict[str, Any]:
    """
    IA = décisionnaire unique. Elle retourne un plan complet (steps + next).
    """
    _require_openai()

    prompt = (
        "You are GlobalVisa Dynamic Journey Engine.\n"
        "ROLE:\n"
        "- You are the single decision maker for: next steps, suggestions, validations, resources.\n"
        "- The app NEVER submits forms. User remains responsible.\n"
        "- You MUST return ONLY valid JSON.\n\n"
        f"Locale: {locale}\n\n"
        f"Goal (JSON): {json.dumps(goal, ensure_ascii=False)}\n"
        f"User context (JSON): {json.dumps(context, ensure_ascii=False)}\n"
        f"Current plan (JSON, may be null): {json.dumps(current_plan or {}, ensure_ascii=False)}\n"
        f"New user action (JSON): {json.dumps(action, ensure_ascii=False)}\n\n"
        "Return JSON with this shape:\n"
        "{\n"
        '  "plan": {\n'
        '    "title": {"fr":"...", "en":"..."},\n'
        '    "objective": {"fr":"...", "en":"..."},\n'
        '    "status": "in_progress|blocked|done"\n'
        "  },\n"
        '  "steps": [\n'
        "    {\n"
        '      "key": "stable_step_key",\n'
        '      "ordering": 1,\n'
        '      "status": "not_started|in_progress|done|blocked",\n'
        '      "title": {"fr":"...", "en":"..."},\n'
        '      "description": {"fr":"...", "en":"..."},\n'
        '      "resources": [{"type":"official_link|form|doc","title":{"fr":"...","en":"..."}, "url":"..."}],\n'
        '      "actions": [{"type":"open_url|open_form|prepare_doc|write_text|review","label":{"fr":"...","en":"..."}, "target":"..."}],\n'
        '      "suggestions": [{"field":"...", "text":{"fr":"...","en":"..."}, "why":{"fr":"...","en":"..."}}],\n'
        '      "alerts": [{"level":"info|warning|error", "text":{"fr":"...","en":"..."}}]\n'
        "    }\n"
        "  ],\n"
        '  "next": {\n'
        '    "step_key": "stable_step_key",\n'
        '    "action": {"type":"...", "label":{"fr":"...","en":"..."}, "target":"..."},\n'
        '    "why": [{"fr":"...","en":"..."}]\n'
        "  }\n"
        "}\n"
    )

    _raw, out_text = call_openai_responses(input_text=prompt, store=False)
    return _parse_json_strict(out_text)

