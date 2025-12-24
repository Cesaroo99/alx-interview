from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass, field
from typing import Any, Optional
from urllib.parse import urlparse


# Heuristiques minimales "official-only".
# On préfère des signaux conservateurs (prévention > correction).
GOVERNMENT_SUFFIXES = (
    ".gov",
    ".gov.uk",
    ".gov.au",
    ".gov.br",
    ".gov.in",
    ".gc.ca",
    ".gouv.fr",
    ".gob.es",
    ".bund.de",
    ".admin.ch",
    ".gov.za",
)

KNOWN_SHORTENERS = {
    "bit.ly",
    "t.co",
    "tinyurl.com",
    "goo.gl",
    "ow.ly",
    "is.gd",
    "cutt.ly",
    "shorturl.at",
    "rebrand.ly",
}

SUSPICIOUS_TLDS = {
    ".top",
    ".xyz",
    ".click",
    ".monster",
    ".zip",
    ".mov",
}

SUSPICIOUS_KEYWORDS = (
    "guarantee",
    "100%",
    "approved",
    "approval",
    "agent",
    "agency",
    "fasttrack",
    "urgent",
    "discount",
    "promo",
    "official-visa",
    "evisa-official",
)


@dataclass(frozen=True)
class UrlSecurityVerdict:
    """
    Verdict de sécurité explicable.

    - risk_score: 0..1 (heuristique)
    - risk_level: "low" | "medium" | "high"
    - likely_official: n'est PAS une garantie; simplement "signal faible/fort"
    """

    input_url: str
    normalized_url: str
    hostname: str
    scheme: str
    likely_official: bool
    risk_score: float
    risk_level: str
    reasons: list[str] = field(default_factory=list)
    next_safe_steps: list[str] = field(default_factory=list)
    disclaimers: list[str] = field(default_factory=list)


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _is_ip(hostname: str) -> bool:
    try:
        ipaddress.ip_address(hostname)
        return True
    except Exception:
        return False


def _normalize_url(url: str) -> str:
    u = (url or "").strip()
    # Si l'utilisateur colle sans schéma, on force https pour parsing cohérent.
    if u and "://" not in u:
        u = "https://" + u
    return u


def verify_official_url(url: str, expected_country: Optional[str] = None) -> UrlSecurityVerdict:
    """
    Vérifie une URL avant interaction (anti-scam).

    expected_country: optionnel, pour ajouter un rappel (pas de blocage strict).
    """

    raw = (url or "").strip()
    normalized = _normalize_url(raw)
    parsed = urlparse(normalized)
    hostname = (parsed.hostname or "").lower()
    scheme = (parsed.scheme or "").lower()

    reasons: list[str] = []
    next_steps: list[str] = []

    # Base risk: internet is hostile; start medium.
    risk = 0.45

    if not raw:
        return UrlSecurityVerdict(
            input_url=url,
            normalized_url=normalized,
            hostname="",
            scheme="",
            likely_official=False,
            risk_score=0.95,
            risk_level="high",
            reasons=["URL manquante: impossible de vérifier un portail."],
            next_safe_steps=["Copier/coller le lien exact depuis le site officiel de l'ambassade/gouvernement."],
            disclaimers=[
                "Ce module réduit le risque de scam, mais ne peut pas garantir qu'un site est officiel.",
            ],
        )

    if scheme not in {"https", "http"}:
        risk += 0.25
        reasons.append("Schéma inhabituel: utilisez uniquement https (ou à défaut http) pour les portails officiels.")
    elif scheme == "http":
        risk += 0.20
        reasons.append("Le site n'utilise pas https: risque élevé (phishing/interception).")
        next_steps.append("N'entrez aucune donnée personnelle sur http; chercher la version https via une source officielle.")
    else:
        risk -= 0.05

    if not hostname:
        risk += 0.30
        reasons.append("Nom de domaine introuvable: l'URL semble invalide.")
        next_steps.append("Reprendre le lien depuis la source officielle (ambassade/gouvernement).")
    else:
        if _is_ip(hostname):
            risk += 0.35
            reasons.append("Le lien pointe vers une adresse IP: très rare pour les sites officiels.")
            next_steps.append("Éviter: utiliser le domaine officiel (ex: *.gov, *.gouv, *.gc.ca).")

        # Shorteners mask destination.
        if hostname in KNOWN_SHORTENERS:
            risk += 0.35
            reasons.append("Lien raccourci: la destination réelle est masquée (risque de phishing).")
            next_steps.append("Exiger l'URL complète du portail officiel (non raccourcie).")

        # Punycode / IDN can be used for lookalikes.
        if "xn--" in hostname:
            risk += 0.25
            reasons.append("Domaine en punycode (IDN): peut être utilisé pour des homographes/imitations.")
            next_steps.append("Vérifier le domaine via le site officiel de l'ambassade/gouvernement (pas via publicité).")

        # Suspicious TLDs (not definitive, but common in scams).
        for tld in SUSPICIOUS_TLDS:
            if hostname.endswith(tld):
                risk += 0.15
                reasons.append(f"TLD souvent utilisé dans des scams: '{tld}'.")
                break

        # Government suffix signal (positive).
        gov_hit = any(hostname.endswith(suf) for suf in GOVERNMENT_SUFFIXES)
        if gov_hit:
            risk -= 0.18
            reasons.append("Le domaine ressemble à un domaine gouvernemental connu (signal positif, non une garantie).")
        else:
            # If it contains "gov" but not a government suffix -> suspicious mimic.
            if "gov" in hostname:
                risk += 0.12
                reasons.append("Le domaine contient 'gov' sans correspondre à un suffixe gouvernemental connu (possible imitation).")

        # Too many subdomains can hide a real brand.
        parts = hostname.split(".")
        if len(parts) >= 5:
            risk += 0.08
            reasons.append("Nombre élevé de sous-domaines: vérifier attentivement le domaine principal.")

        # Keyword-based suspicion (path + host).
        hay = (hostname + " " + (parsed.path or "") + " " + (parsed.query or "")).lower()
        for kw in SUSPICIOUS_KEYWORDS:
            if kw in hay:
                risk += 0.10
                reasons.append("Motif marketing/agent/promo détecté dans l'URL (souvent associé aux scams).")
                break

        # Tracking parameters are not always bad, but can indicate ads/phishing.
        if re.search(r"(utm_|gclid=|fbclid=)", parsed.query or "", flags=re.IGNORECASE):
            risk += 0.06
            reasons.append("Paramètres de tracking détectés: privilégier un lien direct depuis une source officielle.")

    # Country reminder (not strict).
    if expected_country:
        next_steps.append(
            f"Confirmer le portail via une page officielle liée à '{expected_country}' (ambassade/gouvernement)."
        )

    # Universal safe steps.
    next_steps.extend(
        [
            "Ouvrir le site en tapant l'adresse depuis une source officielle, pas depuis une publicité.",
            "Vérifier l'orthographe exacte du domaine (lettres doublées, tirets, substitutions).",
            "Ne jamais partager vos identifiants de portail officiel avec un tiers.",
        ]
    )

    risk_score = _clamp(risk, 0.02, 0.98)
    if risk_score < 0.33:
        level = "low"
    elif risk_score < 0.62:
        level = "medium"
    else:
        level = "high"

    likely_official = risk_score < 0.35 and bool(hostname) and scheme == "https"

    # De-dup with order
    def _dedup(seq: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for x in seq:
            x2 = " ".join((x or "").strip().split())
            if not x2 or x2 in seen:
                continue
            seen.add(x2)
            out.append(x2)
        return out

    return UrlSecurityVerdict(
        input_url=raw,
        normalized_url=normalized,
        hostname=hostname,
        scheme=scheme,
        likely_official=likely_official,
        risk_score=round(float(risk_score), 3),
        risk_level=level,
        reasons=_dedup(reasons),
        next_safe_steps=_dedup(next_steps),
        disclaimers=[
            "Ce verdict est heuristique: il réduit le risque de scam mais ne peut pas certifier qu'un site est officiel.",
            "La source de vérité reste le site de l'ambassade/gouvernement du pays concerné.",
        ],
    )


def security_verdict_to_dict(v: UrlSecurityVerdict) -> dict[str, Any]:
    return {
        "input_url": v.input_url,
        "normalized_url": v.normalized_url,
        "hostname": v.hostname,
        "scheme": v.scheme,
        "likely_official": bool(v.likely_official),
        "risk_score": float(v.risk_score),
        "risk_level": v.risk_level,
        "reasons": list(v.reasons),
        "next_safe_steps": list(v.next_safe_steps),
        "disclaimers": list(v.disclaimers),
    }

