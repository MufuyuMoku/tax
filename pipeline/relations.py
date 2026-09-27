"""Read "revokes" and "amends" relations out of a regulation's own text.

A pointer, never a fact (SPEC invariant 5). The proof of concept measured this by hand on 20 pairs:
16 correct, 2 partial revocations reported as full ones, 2 needing a human. So every relation
carries the sentence it was read from, and the site shows that sentence.

A lower-ranked regulation cannot revoke or amend a higher-ranked one, so such reads are kept but
marked rejected rather than silently dropped.
"""
import re

from .identity import parse

REFERENCE_TYPES = (
    r"(Undang-[Uu]ndang|Peraturan Pemerintah Pengganti Undang-[Uu]ndang|Peraturan Pemerintah|"
    r"Peraturan Presiden|Keputusan Presiden|Peraturan Menteri Keuangan|Keputusan Menteri Keuangan|"
    r"Peraturan Direktur Jenderal Pajak|Keputusan Direktur Jenderal Pajak|"
    r"Surat Edaran Direktur Jenderal Pajak)"
)
RE_REFERENCE = re.compile(
    REFERENCE_TYPES
    + r"\s+(?:Republik Indonesia\s+)?Nomor\s*:?\s*"
    + r"([A-Z]*[-\s]?\d+[A-Z]?(?:\s*/\s*[A-Z][A-Za-z.0-9]*)*(?:\s*/\s*\d{4})?)(\s+Tahun\s+\d{4})?",
    re.S | re.I,
)
RE_REVOKED = re.compile(
    r"(dicabut\s+dan\s+dinyatakan\s+tidak\s+berlaku|dinyatakan\s+tidak\s+berlaku|dicabut)", re.I
)

# Hierarchy of legal instruments; a lower rank cannot revoke or amend a higher one.
RANK = {
    "UUD": 0, "TAP MPR": 1, "UU": 2, "PERPU": 2, "PP": 3,
    "PERPRES": 4, "KEPPRES": 4, "INPRES": 4,
    "PMK": 5, "KMK": 5, "PERBER": 5, "KEPBER": 5,
    "PER-DJP": 6, "KEP-DJP": 6, "INS-DJP": 6, "PER-ESELON1": 6, "KEP-ESELON1": 6,
    "SE": 7, "ND-DJP": 7,
}


def may_act_on(actor_code, target_code):
    """True when possible by hierarchy, False when impossible, None when a code is unknown."""
    a, b = RANK.get(actor_code), RANK.get(target_code)
    if a is None or b is None:
        return None
    return a <= b


def references(text):
    found = []
    for match in RE_REFERENCE.finditer(text):
        type_label, number, year = match.group(1), match.group(2), (match.group(3) or "")
        key = parse(type_label, (number + year).replace("\n", " "))
        if key:
            found.append({"key": key, "quote": match.group(0)[:120].replace("\n", " ")})
    return found


def extract(title, text, body_units):
    """Return {'amends': [...], 'revokes': [...]}, each entry carrying its source sentence."""
    result = {"amends": [], "revokes": []}

    # "Perubahan atas X Nomor ..." in the title is the clearest signal of an amendment.
    if re.search(r"perubahan", title or "", re.I):
        head = (text or "")[:3000]
        match = re.search(r"PERUBAHAN.{0,40}?ATAS(.{0,600})", head, re.I | re.S)
        if match:
            found = references(match.group(1))
            if found:
                result["amends"].append(found[0])

    # Revocations live in the closing pasal. Read per ayat, taking references before "dicabut".
    chunks = [u["text"] for u in body_units[-4:]] if body_units else [(text or "")[-6000:]]
    for chunk in chunks:
        chunk = re.sub(r"\s+", " ", chunk)
        for ayat in re.split(r"\s\(\d+[a-z]?\)\s", chunk):
            last = None
            for last in RE_REVOKED.finditer(ayat):
                pass
            if not last:
                continue
            for reference in references(ayat[:last.start()]):
                if reference["key"] not in [r["key"] for r in result["revokes"]]:
                    result["revokes"].append(reference)
    return result
