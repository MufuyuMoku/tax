"""Normalise a regulation's identity: (type code, number, year, variant).

Two sources write the same regulation differently ("PMK 64 TAHUN 2026" vs "64/PMK.010/2026"),
so merging them needs one normal form. Ported from poc/ident.py with two rules kept:

- KMK numbers repeat across series (KM.1, MK/EF.2, KMK.04), so the series belongs in the key.
- "Ralat" (corrigendum) and "Susunan dalam satu naskah" (consolidated text) share the parent's
  number but are different documents, so the variant belongs in the key.
"""
import re

TYPE_PATTERNS = [
    (r"undang.undang dasar", "UUD"),
    (r"pengganti undang|perpu|perppu", "PERPU"),
    (r"undang.undang", "UU"),
    (r"peraturan pemerintah", "PP"),
    (r"peraturan presiden", "PERPRES"),
    (r"keputusan presiden", "KEPPRES"),
    (r"instruksi presiden", "INPRES"),
    (r"peraturan menteri keuangan|^peraturan menteri$", "PMK"),
    (r"keputusan menteri keuangan|^keputusan menteri$", "KMK"),
    (r"peraturan dirjen pajak|peraturan direktur jenderal pajak", "PER-DJP"),
    (r"keputusan dirjen pajak|keputusan direktur jenderal pajak", "KEP-DJP"),
    (r"surat edaran", "SE"),
    (r"instruksi dirjen pajak", "INS-DJP"),
    (r"nota dinas", "ND-DJP"),
    (r"peraturan unit eselon i", "PER-ESELON1"),
    (r"keputusan unit eselon i", "KEP-ESELON1"),
    (r"peraturan bersama", "PERBER"),
    (r"keputusan bersama", "KEPBER"),
]


def type_code(type_label, number=""):
    """Map a written document type to a short code. The number is often more telling than the label."""
    label = (type_label or "").lower().strip()
    num = (number or "").upper()
    if re.match(r"^\s*SE[\s-]", num):
        return "SE"
    if re.match(r"^\s*(PER|PERDJP)[\s-]", num) and "/PJ" in num:
        return "PER-DJP"
    if re.match(r"^\s*KEP[\s-]", num) and "/PJ" in num:
        return "KEP-DJP"
    for pattern, code in TYPE_PATTERNS:
        if re.search(pattern, label):
            return code
    if "/PMK" in num or num.startswith("PMK"):
        return "PMK"
    if "/KMK" in num or "/KM" in num or num.startswith("KMK"):
        return "KMK"
    return label.upper() or "?"


def variant_of(title):
    """Corrigenda and consolidated texts share a number with their parent but are separate documents."""
    upper = (title or "").upper()
    if upper.startswith("RALAT"):
        return "ralat"
    if "SUSUNAN DALAM SATU NASKAH" in upper or "NASKAH KONSOLIDASI" in upper:
        return "konsolidasi"
    return None


def parse(type_label, number, title=None):
    """Return (code, number, year, variant) or None when the number cannot be read."""
    num = (number or "").upper().replace(" ", " ")
    code = type_code(type_label, num)
    variant = variant_of(title)

    match = re.search(r"(\d+[A-Z]?)\s+TAHUN\s+(\d{4})", num)
    if match:
        return (code, match.group(1).lstrip("0") or "0", match.group(2), variant)

    # "168/PMK.010/2023", "329/KM.1/2007", "PER-16/PJ/2016", "SE-16/PJ.4/1995"
    match = re.search(
        r"(?:PER|KEP|SE|PERDJP)?[\s-]*(\d+[A-Z]?)\s*/\s*([A-Z][A-Z.0-9]*(?:\s*/\s*[A-Z.0-9]+)*?)\s*/\s*(\d{4})",
        num,
    )
    if match:
        serial = match.group(1).lstrip("0") or "0"
        if code == "KMK":
            series = re.sub(r"\s+", "", match.group(2))
            return (code, serial + "/" + series, match.group(3), variant)
        return (code, serial, match.group(3), variant)

    match = re.search(r"(\d+)\D+(\d{4})\s*$", num)
    if match:
        return (code, match.group(1).lstrip("0") or "0", match.group(2), variant)
    return None


def document_id(key):
    """Stable, file-safe id for a key, e.g. ('PMK','168','2023',None) -> 'pmk-168-2023'."""
    code, number, year, variant = key
    parts = [code, number, year] + ([variant] if variant else [])
    slug = "-".join(str(p) for p in parts).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    return slug
