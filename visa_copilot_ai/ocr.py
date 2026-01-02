from __future__ import annotations

import base64
import re
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().split())


def _to_iso_date(s: str) -> Optional[str]:
    t = _norm(s)
    if not t:
        return None
    # YYYY-MM-DD
    m = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", t)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    # DD/MM/YYYY or DD.MM.YYYY
    m = re.search(r"\b(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})\b", t)
    if m:
        dd = int(m.group(1))
        mm = int(m.group(2))
        yy = int(m.group(3))
        if 1 <= mm <= 12 and 1 <= dd <= 31:
            return f"{yy:04d}-{mm:02d}-{dd:02d}"
    return None


def _parse_float(s: str) -> Optional[float]:
    raw0 = _norm(s).replace(" ", "")
    # Handle 1,234.56 vs 1.234,56
    if "," in raw0 and "." in raw0:
        # decide decimal separator by last occurrence
        if raw0.rfind(".") > raw0.rfind(","):
            # 1,234.56 -> remove commas
            raw = raw0.replace(",", "")
        else:
            # 1.234,56 -> remove dots, comma -> dot
            raw = raw0.replace(".", "").replace(",", ".")
    elif "," in raw0:
        # treat comma as decimal separator
        raw = raw0.replace(",", ".")
    else:
        raw = raw0

    m = re.search(r"(-?\d+(?:\.\d+)?)", raw)
    if not m:
        return None
    try:
        return float(m.group(1))
    except Exception:
        return None


@dataclass(frozen=True)
class OcrExtractResult:
    ok: bool
    text: str
    extracted: dict[str, Any]
    warnings: list[str]
    engine: str
    took_ms: int


def _extract_fields_from_text(text: str) -> dict[str, Any]:
    """
    Extraction heuristique (MVP) depuis un texte OCR/PDF.
    On alimente le "extracted" utilisé partout dans l'app.
    """
    t = text or ""
    tl = t.lower()
    out: dict[str, Any] = {}

    # Passport number (very rough): try explicit labels first
    for pat in [
        r"(passport\s*(no|number|n°)\s*[:\-]?\s*([A-Z0-9]{6,12}))",
        r"(num[eé]ro\s+de\s+passeport\s*[:\-]?\s*([A-Z0-9]{6,12}))",
    ]:
        m = re.search(pat, t, flags=re.IGNORECASE)
        if m:
            cand = m.group(m.lastindex or 0)
            cand = re.sub(r"[^A-Z0-9]", "", cand.upper())
            if 6 <= len(cand) <= 12:
                out["passport_number"] = cand
                break

    # If still missing, fallback to any alnum block likely to be passport number
    if "passport_number" not in out:
        m = re.search(r"\b([A-Z]{1,2}\d{5,10})\b", t.upper())
        if m:
            out["passport_number"] = m.group(1)

    # Dates: issued / expiry
    # Look for keywords around dates
    date_hits: list[tuple[str, str]] = []
    for m in re.finditer(r"\b(\d{4}-\d{2}-\d{2})\b|\b(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{4})\b", t):
        raw = m.group(0)
        iso = _to_iso_date(raw) or ""
        if not iso:
            continue
        start = max(0, m.start() - 25)
        end = min(len(t), m.end() + 25)
        ctx = tl[start:end]
        date_hits.append((iso, ctx))

    for iso, ctx in date_hits:
        if any(k in ctx for k in ["expire", "expiry", "exp.", "date of expiry", "date d'expiration", "valid until", "valide jusqu"]):
            out.setdefault("expires_date", iso)
        if any(k in ctx for k in ["issue", "issued", "date of issue", "date d'emission", "date d'émission", "délivr", "deliver"]):
            out.setdefault("issued_date", iso)

    # If only one date and nothing else, keep it as issued_date hint
    if "issued_date" not in out and "expires_date" not in out and date_hits:
        out["issued_date"] = date_hits[0][0]

    # Full name (very rough, prefer explicit labels)
    m = re.search(r"(full\s+name|nom\s+complet)\s*[:\-]?\s*([A-Z][A-Z \-']{3,})", t, flags=re.IGNORECASE)
    if m:
        out["full_name"] = _norm(m.group(2))

    # Bank statement: ending balance (USD heuristic)
    m = re.search(r"(ending\s+balance|solde\s+final|closing\s+balance)\s*[:\-]?\s*([0-9][0-9\s,\.]+)", t, flags=re.IGNORECASE)
    if m:
        val = _parse_float(m.group(2))
        if val is not None:
            out["ending_balance_usd"] = val

    # Account holder name
    m = re.search(r"(account\s+holder|titulaire\s+du\s+compte)\s*[:\-]?\s*([A-Z][A-Z \-']{3,})", t, flags=re.IGNORECASE)
    if m:
        out["account_holder_name"] = _norm(m.group(2))

    # Insurance coverage amount
    m = re.search(r"(coverage|couverture)\s*[:\-]?\s*(EUR|USD|\€|\$)?\s*([0-9][0-9\s,\.]+)", t, flags=re.IGNORECASE)
    if m:
        val = _parse_float(m.group(3))
        if val is not None:
            out["coverage_amount"] = val

    return out


def _extract_text_from_pdf(data: bytes) -> tuple[str, list[str], str]:
    warnings: list[str] = []
    try:
        from pypdf import PdfReader

        reader = PdfReader(io_bytes=data)
        parts: list[str] = []
        for page in reader.pages[:12]:
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                continue
        txt = "\n".join([p for p in parts if p.strip()]).strip()
        if not txt:
            warnings.append("PDF: texte non extractible (scan image). OCR image requis.")
        return txt, warnings, "pypdf"
    except Exception as e:
        warnings.append(f"PDF extraction erreur: {e}")
        return "", warnings, "pypdf"


def _extract_text_from_image(data: bytes) -> tuple[str, list[str], str]:
    warnings: list[str] = []
    try:
        from PIL import Image
        from io import BytesIO

        img = Image.open(BytesIO(data)).convert("RGB")
    except Exception as e:
        return "", [f"Image invalide: {e}"], "none"

    # pytesseract requires the system tesseract binary; we degrade gracefully.
    try:
        import pytesseract  # type: ignore

        txt = pytesseract.image_to_string(img) or ""
        txt = txt.strip()
        if not txt:
            warnings.append("OCR image: aucun texte détecté.")
        return txt, warnings, "tesseract"
    except Exception as e:
        warnings.append("OCR image non disponible sur le serveur (tesseract manquant).")
        warnings.append(f"Détail: {e}")
        return "", warnings, "tesseract_unavailable"


def extract_from_base64(
    *,
    content_base64: str,
    mime_type: str,
) -> OcrExtractResult:
    start = time.time()
    warnings: list[str] = []
    mt = _norm(mime_type).lower()
    if not mt:
        warnings.append("mime_type manquant; tentative auto.")
    try:
        data = base64.b64decode(content_base64.encode("utf-8"), validate=False)
    except Exception:
        return OcrExtractResult(ok=False, text="", extracted={}, warnings=["Base64 invalide."], engine="none", took_ms=int((time.time() - start) * 1000))

    text = ""
    engine = "none"
    if "pdf" in mt:
        text, w, engine = _extract_text_from_pdf(data)
        warnings.extend(w)
    elif any(x in mt for x in ["png", "jpeg", "jpg", "image"]):
        text, w, engine = _extract_text_from_image(data)
        warnings.extend(w)
    else:
        # heuristic: try pdf if starts with %PDF
        if data[:4] == b"%PDF":
            text, w, engine = _extract_text_from_pdf(data)
            warnings.extend(w)
        else:
            warnings.append(f"Type non supporté pour OCR: {mime_type}")

    extracted = _extract_fields_from_text(text) if text else {}

    # always stamp meta
    extracted["_ocr"] = {
        "engine": engine,
        "extracted_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "warnings": warnings[:6],
    }

    return OcrExtractResult(
        ok=True,
        text=text,
        extracted=extracted,
        warnings=warnings,
        engine=engine,
        took_ms=int((time.time() - start) * 1000),
    )


# --- helpers to allow PdfReader from bytes without writing files ---
class io_bytes:  # noqa: N801 - small adapter
    def __init__(self, data: bytes):
        from io import BytesIO

        self._bio = BytesIO(data)

    def read(self, n: int = -1) -> bytes:
        return self._bio.read(n)

    def seek(self, pos: int, whence: int = 0) -> int:
        return self._bio.seek(pos, whence)

    def tell(self) -> int:
        return self._bio.tell()

