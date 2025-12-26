from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Optional
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

import importlib.resources as pkg_resources


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


def _iso_now() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _sha_id(*parts: str) -> str:
    h = hashlib.sha1("|".join([_norm(x) for x in parts if _norm(x)]).encode("utf-8")).hexdigest()
    return h[:14]


def _load_sources() -> dict[str, Any]:
    """
    Source:
    - embedded: visa_copilot_ai/resources/news_sources.json
    - override: GLOBALVISA_NEWS_SOURCES_PATH (modifiable sans toucher au code)
    """

    override = os.getenv("GLOBALVISA_NEWS_SOURCES_PATH", "").strip()
    if override:
        try:
            with open(override, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    with pkg_resources.files("visa_copilot_ai").joinpath("resources/news_sources.json").open("r", encoding="utf-8") as f:
        return json.load(f)


def load_sources_list(data: Optional[dict[str, Any]] = None) -> list[dict[str, Any]]:
    src = data if isinstance(data, dict) else _load_sources()
    out = src.get("sources") if isinstance(src.get("sources"), list) else []
    return [x for x in out if isinstance(x, dict)]


def _first_text(elem: Optional[ET.Element], tags: list[str]) -> str:
    if elem is None:
        return ""
    for t in tags:
        x = elem.find(t)
        if x is not None and x.text:
            return _norm(x.text)
    return ""


def _parse_rss_or_atom(xml_text: str) -> list[dict[str, str]]:
    """
    Retourne une liste brute [{title, link, published_at}] issue de RSS/Atom.
    Très permissif (namespace-agnostic au mieux).
    """

    if not _norm(xml_text):
        return []

    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return []

    # RSS: channel/item
    channel = root.find("channel")
    if channel is None:
        channel = root.find("./rss/channel")
    if channel is not None:
        items = []
        for it in channel.findall("item"):
            title = _first_text(it, ["title"])
            link = _first_text(it, ["link"])
            pub = _first_text(it, ["pubDate", "published", "dc:date"])
            items.append({"title": title, "link": link, "published_at": pub})
        return items

    # Atom: {feed}/{entry} (namespace may exist)
    # We handle namespace by matching localname.
    def localname(tag: str) -> str:
        return tag.split("}", 1)[-1] if "}" in tag else tag

    entries: list[ET.Element] = []
    if localname(root.tag) == "feed":
        for child in list(root):
            if localname(child.tag) == "entry":
                entries.append(child)

    items2 = []
    for e in entries:
        title = ""
        link = ""
        published = ""
        for child in list(e):
            ln = localname(child.tag)
            if ln == "title" and child.text and not title:
                title = _norm(child.text)
            if ln == "link" and not link:
                href = child.attrib.get("href")
                if href:
                    link = _norm(href)
            if ln in {"updated", "published"} and child.text and not published:
                published = _norm(child.text)
        items2.append({"title": title, "link": link, "published_at": published})
    return items2


def _fetch_url(url: str, *, timeout_sec: int = 10) -> str:
    req = Request(url, headers={"User-Agent": "GlobalVisaBot/0.1 (+official-only)"})
    with urlopen(req, timeout=timeout_sec) as resp:
        raw = resp.read()
        # best-effort utf-8
        try:
            return raw.decode("utf-8")
        except Exception:
            return raw.decode("latin-1", errors="ignore")


@dataclass(frozen=True)
class IngestResult:
    ok: bool
    fetched_sources: int
    new_items: int
    total_items: int
    errors: list[str]
    updated_at: str


def ingest_news(
    *,
    sources: Optional[list[dict[str, Any]]] = None,
    existing_items: Optional[list[dict[str, Any]]] = None,
    fetcher: Optional[Callable[[str], str]] = None,
    max_per_source: int = 20,
    max_total: int = 400,
) -> tuple[list[dict[str, Any]], IngestResult]:
    """
    Ingestion RSS/Atom -> items compatibles avec visa_copilot_ai/news.py.
    - Pas de dépendances externes.
    - Échoue en douceur (retourne errors).
    """

    srcs = sources if isinstance(sources, list) else load_sources_list()
    fetch = fetcher or (lambda u: _fetch_url(u, timeout_sec=10))
    existing = existing_items if isinstance(existing_items, list) else []

    # index by id
    by_id: dict[str, dict[str, Any]] = {}
    for it in existing:
        if isinstance(it, dict) and _norm(it.get("id")):
            by_id[_norm(it["id"])] = dict(it)

    errors: list[str] = []
    new_count = 0
    fetched = 0

    for s in srcs:
        if len(by_id) >= max_total:
            break

        feed_url = _norm(s.get("feed_url"))
        if not feed_url:
            continue

        try:
            xml = fetch(feed_url)
            fetched += 1
        except Exception as e:
            errors.append(f"{_norm(s.get('id') or feed_url)}: fetch failed: {e}")
            continue

        raw_items = _parse_rss_or_atom(xml)[: max(1, int(max_per_source or 20))]

        # map -> our item schema
        for r in raw_items:
            if len(by_id) >= max_total:
                break
            title = _norm(r.get("title"))
            link = _norm(r.get("link"))
            if not title and not link:
                continue
            nid = f"ing_{_sha_id(_norm(s.get('id')), title, link)}"

            if nid in by_id:
                continue

            source_type = _norm(s.get("source_type")).lower()
            reliability = 0.85 if source_type == "government" else 0.65

            tags = [str(x).strip().lower() for x in (s.get("default_tags") or []) if str(x).strip()]
            country = _norm(s.get("country"))
            category = _norm(s.get("category") or "visa_news").lower()

            by_id[nid] = {
                "id": nid,
                "category": category,
                "country": country,
                "tags": tags,
                "title": title or "(sans titre)",
                "summary": "",
                "source_name": _norm(s.get("source_name")),
                "source_url": link or _norm(s.get("source_url")),
                "published_at": _norm(r.get("published_at")) or _iso_now(),
                "status": "published",
                "reliability_score": reliability,
            }
            new_count += 1

        # throttle a bit
        time.sleep(0.05)

    merged = list(by_id.values())
    # Sort newest first (best-effort ISO or rss date string left as-is)
    merged.sort(key=lambda x: _norm(x.get("published_at")), reverse=True)

    meta = IngestResult(
        ok=True,
        fetched_sources=fetched,
        new_items=new_count,
        total_items=len(merged),
        errors=errors,
        updated_at=_iso_now(),
    )
    if errors and fetched == 0:
        meta = IngestResult(
            ok=False,
            fetched_sources=fetched,
            new_items=new_count,
            total_items=len(merged),
            errors=errors,
            updated_at=_iso_now(),
        )
    return merged, meta

