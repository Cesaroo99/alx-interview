from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

import importlib.resources as pkg_resources


@dataclass(frozen=True)
class NewsItem:
    id: str
    category: str  # visa_news | law_change
    country: str
    tags: list[str] = field(default_factory=list)
    title: str = ""
    summary: str = ""
    source_name: str = ""
    source_url: str = ""
    published_at: str = ""  # ISO-8601 string (kept as string for simplicity)
    status: str = "published"  # draft | published
    reliability_score: float = 0.5


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


def _load_news() -> dict[str, Any]:
    """
    Source:
    - embedded: visa_copilot_ai/resources/news.json
    - override: GLOBALVISA_NEWS_PATH (modifiable sans toucher au code)
    """

    override = os.getenv("GLOBALVISA_NEWS_PATH", "").strip()
    if override:
        try:
            with open(override, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    with pkg_resources.files("visa_copilot_ai").joinpath("resources/news.json").open("r", encoding="utf-8") as f:
        return json.load(f)


def _parse_item(raw: dict[str, Any]) -> NewsItem:
    tags = [str(x).strip().lower() for x in (raw.get("tags") or []) if str(x).strip()]
    try:
        rel = float(raw.get("reliability_score", 0.5))
    except Exception:
        rel = 0.5
    rel = max(0.0, min(1.0, rel))
    return NewsItem(
        id=_norm(raw.get("id")) or "news_unknown",
        category=_norm(raw.get("category")).lower(),
        country=_norm(raw.get("country")),
        tags=tags,
        title=_norm(raw.get("title")),
        summary=_norm(raw.get("summary")),
        source_name=_norm(raw.get("source_name")),
        source_url=_norm(raw.get("source_url")),
        published_at=_norm(raw.get("published_at")),
        status=_norm(raw.get("status") or "published").lower(),
        reliability_score=rel,
    )


def _parse_dt(s: str) -> Optional[datetime]:
    if not s:
        return None
    # very forgiving parser for common ISO strings
    try:
        if s.endswith("Z"):
            s2 = s[:-1] + "+00:00"
        else:
            s2 = s
        return datetime.fromisoformat(s2)
    except Exception:
        return None


def list_news(
    *,
    country: Optional[str] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 30,
    published_only: bool = True,
    data: Optional[dict[str, Any]] = None,
) -> list[dict[str, Any]]:
    src = data if isinstance(data, dict) else _load_news()
    items = src.get("items") if isinstance(src.get("items"), list) else []

    c = _norm(country).lower()
    cat = _norm(category).lower()
    t = _norm(tag).lower()
    query = _norm(q).lower()

    out: list[NewsItem] = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        n = _parse_item(raw)

        if published_only and n.status != "published":
            continue
        if c and _norm(n.country).lower() != c:
            continue
        if cat and _norm(n.category).lower() != cat:
            continue
        if t and t not in [x.lower() for x in n.tags]:
            continue
        if query:
            hay = " ".join([n.title, n.summary, n.country, n.category, " ".join(n.tags), n.source_name]).lower()
            if query not in hay:
                continue

        out.append(n)

    out.sort(key=lambda x: (_parse_dt(x.published_at) or datetime.min), reverse=True)

    lim = max(1, min(int(limit or 30), 200))
    return [news_to_dict(x) for x in out[:lim]]


def news_to_dict(n: NewsItem) -> dict[str, Any]:
    return {
        "id": n.id,
        "category": n.category,
        "country": n.country,
        "tags": list(n.tags),
        "title": n.title,
        "summary": n.summary,
        "source_name": n.source_name,
        "source_url": n.source_url,
        "published_at": n.published_at,
        "reliability_score": float(n.reliability_score),
        "disclaimer": "Information indicative. Vérifier la source officielle avant action.",
    }

