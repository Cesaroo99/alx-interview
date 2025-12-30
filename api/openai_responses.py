from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Tuple


def _extract_output_text(resp: dict[str, Any]) -> str:
    """
    Extrait un texte "humain" depuis un objet Response OpenAI.
    On supporte plusieurs formes pour rester robuste.
    """
    if isinstance(resp.get("output_text"), str) and resp["output_text"].strip():
        return resp["output_text"].strip()

    output = resp.get("output")
    if isinstance(output, list):
        parts: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content")
            if not isinstance(content, list):
                continue
            for c in content:
                if not isinstance(c, dict):
                    continue
                if c.get("type") == "output_text" and isinstance(c.get("text"), str):
                    parts.append(c["text"])
        text = "\n".join([p.strip() for p in parts if p.strip()]).strip()
        if text:
            return text

    # Fallback "best effort"
    return ""


def call_openai_responses(
    *,
    input_text: str,
    model: str | None = None,
    store: bool = False,
    timeout_s: float = 30.0,
) -> Tuple[dict[str, Any], str]:
    """
    Appelle l'API OpenAI Responses via HTTP (sans dépendance externe).

    Configuration:
    - OPENAI_API_KEY: obligatoire
    - OPENAI_BASE_URL: optionnel (défaut: https://api.openai.com)
    - OPENAI_MODEL: optionnel (défaut: gpt-5-nano)
    """
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY manquant.")

    base_url = (os.getenv("OPENAI_BASE_URL") or "https://api.openai.com").rstrip("/")
    url = f"{base_url}/v1/responses"

    payload = {
        "model": (model or os.getenv("OPENAI_MODEL") or "gpt-5-nano"),
        "input": input_text,
        "store": bool(store),
    }

    req = urllib.request.Request(
        url=url,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        data=json.dumps(payload).encode("utf-8"),
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as r:  # noqa: S310 - URL fixed, key in env
            raw = r.read().decode("utf-8")
            resp = json.loads(raw)
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        raise RuntimeError(f"OpenAI HTTP {getattr(e, 'code', '???')}: {body or str(e)}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"OpenAI connexion impossible: {e}") from e

    text = _extract_output_text(resp) if isinstance(resp, dict) else ""
    return resp, text

