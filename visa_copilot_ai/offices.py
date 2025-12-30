from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Optional

import importlib.resources as pkg_resources


@dataclass(frozen=True)
class OfficeHours:
    day: str  # mon..sun
    open: Optional[str] = None  # "HH:MM"
    close: Optional[str] = None  # "HH:MM"
    note: str = ""


@dataclass(frozen=True)
class OfficeGeo:
    lat: float
    lng: float


@dataclass(frozen=True)
class OfficeContacts:
    email: str = ""
    phone: str = ""


@dataclass(frozen=True)
class Office:
    id: str
    type: str  # embassy | consulate | tls | vfs
    name: str
    country: str
    city: str
    address: str
    geo: Optional[OfficeGeo] = None
    hours: list[OfficeHours] = field(default_factory=list)
    contacts: OfficeContacts = field(default_factory=OfficeContacts)
    official_url: str = ""
    services: list[str] = field(default_factory=list)
    disclaimer: str = ""


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


def _load_offices() -> dict[str, Any]:
    """
    Source:
    - embedded: visa_copilot_ai/resources/offices.json
    - override: GLOBALVISA_OFFICES_PATH (modifiable sans toucher au code)
    """

    override = os.getenv("GLOBALVISA_OFFICES_PATH", "").strip()
    if override:
        try:
            with open(override, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    with pkg_resources.files("visa_copilot_ai").joinpath("resources/offices.json").open("r", encoding="utf-8") as f:
        return json.load(f)


def _parse_office(raw: dict[str, Any]) -> Office:
    geo = raw.get("geo")
    geo_obj = None
    if isinstance(geo, dict) and geo.get("lat") is not None and geo.get("lng") is not None:
        try:
            geo_obj = OfficeGeo(lat=float(geo["lat"]), lng=float(geo["lng"]))
        except Exception:
            geo_obj = None

    contacts_raw = raw.get("contacts") if isinstance(raw.get("contacts"), dict) else {}
    contacts = OfficeContacts(email=_norm(contacts_raw.get("email")), phone=_norm(contacts_raw.get("phone")))

    hours_list: list[OfficeHours] = []
    if isinstance(raw.get("hours"), list):
        for h in raw["hours"]:
            if not isinstance(h, dict):
                continue
            hours_list.append(
                OfficeHours(
                    day=_norm(h.get("day")).lower(),
                    open=_norm(h.get("open")) or None,
                    close=_norm(h.get("close")) or None,
                    note=_norm(h.get("note")),
                )
            )

    services = [str(x).strip().lower() for x in (raw.get("services") or []) if str(x).strip()]

    return Office(
        id=_norm(raw.get("id")) or _norm(f"{raw.get('type', 'office')}-{raw.get('country','')}-{raw.get('city','')}"),
        type=_norm(raw.get("type")).lower(),
        name=_norm(raw.get("name")),
        country=_norm(raw.get("country")),
        city=_norm(raw.get("city")),
        address=_norm(raw.get("address")),
        geo=geo_obj,
        hours=hours_list,
        contacts=contacts,
        official_url=_norm(raw.get("official_url")),
        services=services,
        disclaimer=_norm(raw.get("disclaimer")),
    )


def _duration_minutes(open_hhmm: str, close_hhmm: str) -> Optional[int]:
    try:
        oh, om = open_hhmm.split(":")
        ch, cm = close_hhmm.split(":")
        o = int(oh) * 60 + int(om)
        c = int(ch) * 60 + int(cm)
        if c < o:
            return None
        return c - o
    except Exception:
        return None


def _critical_hours(hours: list[OfficeHours]) -> list[str]:
    """
    MVP: on considère "critique" une plage d'ouverture très courte (<= 3h)
    ou une note qui contient 'biométr'/'biometr'.
    """

    critical_days: list[str] = []
    for h in hours:
        if h.open and h.close:
            d = _duration_minutes(h.open, h.close)
            if d is not None and d <= 180:
                critical_days.append(h.day)
                continue
        note = (h.note or "").lower()
        if "biométr" in note or "biometr" in note:
            critical_days.append(h.day)
    # dedup keep order
    out: list[str] = []
    seen: set[str] = set()
    for d in critical_days:
        if d and d not in seen:
            seen.add(d)
            out.append(d)
    return out


def list_offices(
    *,
    country: Optional[str] = None,
    city: Optional[str] = None,
    office_type: Optional[str] = None,
    service: Optional[str] = None,
    q: Optional[str] = None,
    data: Optional[dict[str, Any]] = None,
) -> list[dict[str, Any]]:
    """
    Retourne une liste filtrée (prête pour l'API/UI).
    """

    src = data if isinstance(data, dict) else _load_offices()
    items = src.get("offices") if isinstance(src.get("offices"), list) else []

    c = _norm(country).lower()
    ci = _norm(city).lower()
    t = _norm(office_type).lower()
    s = _norm(service).lower()
    query = _norm(q).lower()

    out: list[Office] = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        o = _parse_office(raw)

        if c and _norm(o.country).lower() != c:
            continue
        if ci and _norm(o.city).lower() != ci:
            continue
        if t and _norm(o.type).lower() != t:
            continue
        if s and s not in [x.lower() for x in o.services]:
            continue
        if query:
            hay = " ".join([o.name, o.country, o.city, o.address, " ".join(o.services)]).lower()
            if query not in hay:
                continue

        out.append(o)

    out.sort(key=lambda x: (_norm(x.country).lower(), _norm(x.city).lower(), _norm(x.name).lower()))

    return [office_to_dict(x) for x in out]


def office_to_dict(o: Office) -> dict[str, Any]:
    return {
        "id": o.id,
        "type": o.type,
        "name": o.name,
        "country": o.country,
        "city": o.city,
        "address": o.address,
        "geo": ({"lat": o.geo.lat, "lng": o.geo.lng} if o.geo else None),
        "hours": [{"day": h.day, "open": h.open, "close": h.close, "note": h.note} for h in o.hours],
        "critical_hours_days": _critical_hours(o.hours),
        "contacts": {"email": o.contacts.email, "phone": o.contacts.phone},
        "official_url": o.official_url,
        "services": list(o.services),
        "disclaimer": o.disclaimer,
    }

