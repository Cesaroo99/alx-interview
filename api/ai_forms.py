from __future__ import annotations

import json
import os
from typing import Any

from fastapi import HTTPException

from .openai_responses import call_openai_responses
from .procedure_store import add_audit, get_procedure, get_step, load_draft
from .forms_catalog import get_form


def _require_openai() -> None:
    if not (os.getenv("OPENAI_API_KEY") or "").strip():
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY non configurée sur le serveur.")


def _json_or_text(output: str) -> dict[str, Any]:
    s = (output or "").strip()
    if not s:
        return {}
    # tentative JSON stricte
    try:
        return json.loads(s)
    except Exception:
        # fallback: enveloppe
        return {"text": s}


def suggest_for_field(*, procedure_id: str, step_id: str, field_id: str, locale: str, user_input: str | None) -> dict[str, Any]:
    _require_openai()
    proc = get_procedure(procedure_id)
    if not proc:
        raise HTTPException(status_code=404, detail="procedure introuvable")
    step = get_step(procedure_id, step_id)
    if not step:
        raise HTTPException(status_code=404, detail="step introuvable")
    form = get_form(proc["form_id"])
    if not form:
        raise HTTPException(status_code=404, detail="form introuvable")
    draft = load_draft(procedure_id, step_id) or {"data": {}}

    prompt = (
        "You are GlobalVisa Form Assistant.\n"
        "CRITICAL RULES:\n"
        "- You NEVER submit or auto-fill official forms.\n"
        "- You only provide suggested text/instructions that the user may copy manually.\n"
        "- Return ONLY valid JSON.\n\n"
        f"Locale: {locale}\n"
        f"Procedure: type={proc.get('type')} intent={proc.get('intent')} country={proc.get('country')}\n"
        f"Form ID: {proc.get('form_id')}\n"
        f"Step: {step.get('step_key')}\n"
        f"Field: {field_id}\n"
        f"Current draft fields (JSON): {json.dumps(draft.get('data') or {}, ensure_ascii=False)}\n"
        f"User input (optional): {user_input or ''}\n\n"
        "Return JSON with this shape:\n"
        "{\n"
        '  "suggestions": [{"text": "...", "rationale": "...", "confidence": 0.0-1.0}],\n'
        '  "warnings": ["..."],\n'
        '  "missing_inputs": ["..."]\n'
        "}\n"
    )

    raw, text = call_openai_responses(input_text=prompt, store=False)
    parsed = _json_or_text(text)
    add_audit(
        procedure_id=procedure_id,
        actor="ai",
        action="ai.suggest",
        payload={"step_id": step_id, "field_id": field_id, "locale": locale, "response": parsed},
    )
    return {"engine": "openai_responses", "result": parsed}


def validate_step(*, procedure_id: str, step_id: str, locale: str) -> dict[str, Any]:
    _require_openai()
    proc = get_procedure(procedure_id)
    if not proc:
        raise HTTPException(status_code=404, detail="procedure introuvable")
    step = get_step(procedure_id, step_id)
    if not step:
        raise HTTPException(status_code=404, detail="step introuvable")
    draft = load_draft(procedure_id, step_id) or {"data": {}}

    prompt = (
        "You are GlobalVisa Validator.\n"
        "Return ONLY valid JSON.\n"
        "- Identify inconsistencies, missing critical info, risky phrasing.\n"
        "- Do NOT invent laws or URLs.\n\n"
        f"Locale: {locale}\n"
        f"Procedure: type={proc.get('type')} intent={proc.get('intent')} country={proc.get('country')}\n"
        f"Step: {step.get('step_key')}\n"
        f"Draft fields (JSON): {json.dumps(draft.get('data') or {}, ensure_ascii=False)}\n\n"
        "Return JSON with this shape:\n"
        "{\n"
        '  "ok": true|false,\n'
        '  "field_feedback": {"field_id": {"level":"info|warning|error", "message":"..."}},\n'
        '  "global_warnings": ["..."],\n'
        '  "blocking_issues": ["..."],\n'
        '  "recommended_actions": ["..."]\n'
        "}\n"
    )

    raw, text = call_openai_responses(input_text=prompt, store=False)
    parsed = _json_or_text(text)
    add_audit(procedure_id=procedure_id, actor="ai", action="ai.validate", payload={"step_id": step_id, "locale": locale, "response": parsed})
    return {"engine": "openai_responses", "result": parsed}


def next_steps(*, procedure_id: str, completed_step_id: str, locale: str) -> dict[str, Any]:
    _require_openai()
    proc = get_procedure(procedure_id)
    if not proc:
        raise HTTPException(status_code=404, detail="procedure introuvable")
    step = get_step(procedure_id, completed_step_id)
    if not step:
        raise HTTPException(status_code=404, detail="step introuvable")

    prompt = (
        "You are GlobalVisa Procedure Orchestrator.\n"
        "Return ONLY valid JSON.\n"
        "- You decide next steps and recommendations.\n"
        "- Keep it practical, official-only.\n\n"
        f"Locale: {locale}\n"
        f"Procedure: type={proc.get('type')} intent={proc.get('intent')} country={proc.get('country')}\n"
        f"Completed step: {step.get('step_key')}\n\n"
        "Return JSON with this shape:\n"
        "{\n"
        '  "recommendations": ["..."],\n'
        '  "next_actions": [{"type":"open_official_site|prepare_document|fill_field|review", "label":"...", "target":"..."}]\n'
        "}\n"
    )

    raw, text = call_openai_responses(input_text=prompt, store=False)
    parsed = _json_or_text(text)
    add_audit(procedure_id=procedure_id, actor="ai", action="ai.next_steps", payload={"completed_step_id": completed_step_id, "locale": locale, "response": parsed})
    return {"engine": "openai_responses", "result": parsed}

