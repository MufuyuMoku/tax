"""Split a regulation's text into units: pasal, amendment items, or diktum.

Ported from poc/pasal.py. Drafting conventions that matter here:

- An amending regulation numbers its pasal in Roman numerals: Pasal I carries the provisions of the
  regulation being amended, Pasal II the closing provisions. A "Pasal N" heading inside Pasal I
  belongs to the amended regulation, not to this one, so it is recorded as an amendment item.
- Keputusan (KMK/KEP) use diktum (KESATU, KEDUA, ...) instead of pasal.
- Labels are never rewritten. Odd patterns are flagged for a human; the proof of concept found
  those to be typos in the source text itself, not parsing errors (LAPORAN section 4.6).
"""
import re

ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10}
# The suffix letter of "Pasal 4A" must sit on the same line. An earlier version used `\s?`, which
# let a newline through, so "Pasal 1" followed by a line starting with "a" was read as "Pasal 1A".
RE_PASAL = re.compile(r"^[ \t]*(?:PASAL|Pasal|pasal)[ \t]+(\d{1,3}[ \t]?[A-Z]?|[IVX]{1,5})[ \t]*$", re.M)
RE_EXPLANATION = re.compile(r"^\s*PENJELASAN\s*$|^\s*PENJELASAN\s+ATAS\b", re.M)
RE_DIKTUM = re.compile(
    r"^\s*(KESATU|KEDUA|KETIGA|KEEMPAT|KELIMA|KEENAM|KETUJUH|KEDELAPAN|KESEMBILAN|KESEPULUH|"
    r"KESEBELAS|KEDUA\s?BELAS|KETIGA\s?BELAS|KEEMPAT\s?BELAS|KELIMA\s?BELAS)\s*:?",
    re.M,
)
# "1. Ketentuan Pasal 4 ayat (2) diubah ...", "3. Di antara Pasal 9 dan Pasal 10 disisipkan ..."
RE_ITEM = re.compile(
    r"^\s*(\d{1,3})\.\s+(?=(?:Ketentuan|Di antara|Pasal|Penjelasan|Lampiran|Judul|Bab|Bagian|Diantara)\b)",
    re.M,
)


def normalize(text):
    text = text.replace(" ", " ").replace("\f", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    # PDF extraction sometimes breaks "Pasal" and its number onto separate lines.
    text = re.sub(r"(?im)^\s*pasal\s*\n\s*(\d{1,3}[A-Z]?)\s*$", r"Pasal \1", text)
    return text


def _label(match):
    return re.sub(r"\s+", "", match.group(1)).upper()


def is_roman(label):
    return label in ROMAN


def split(text):
    """Return {structure, units, flags, chars}. `units` keeps source order."""
    body = normalize(text)
    explanation = RE_EXPLANATION.search(body)
    body_end = explanation.start() if explanation else len(body)

    matches = list(RE_PASAL.finditer(body))
    body_matches = [m for m in matches if m.start() < body_end]
    explanation_matches = [m for m in matches if m.start() >= body_end]
    labels = [_label(m) for m in body_matches]
    romans = [l for l in labels if is_roman(l)]
    flags = []

    structure = "biasa"
    if "I" in romans and "II" in romans and labels.index("I") < labels.index("II"):
        structure = "perubahan"
    elif romans:
        # e.g. only "Pasal I" followed by 2, 3, ... : a typo in the source, flagged for a human
        flags.append("anomali_romawi:" + ",".join(romans))

    units = []
    if structure == "perubahan":
        top = [m for m in body_matches if is_roman(_label(m))]
        for i, match in enumerate(top):
            end = top[i + 1].start() if i + 1 < len(top) else body_end
            segment = body[match.start():end]
            unit = {
                "label": _label(match),
                "section": "batang_tubuh",
                "offset": match.start(),
                "text": segment.strip(),
            }
            if _label(match) == "I":
                unit["amendment_items"] = amendment_items(segment)
                unit["quoted_pasal"] = [_label(m) for m in RE_PASAL.finditer(segment) if not is_roman(_label(m))]
            units.append(unit)
    else:
        for i, match in enumerate(body_matches):
            end = body_matches[i + 1].start() if i + 1 < len(body_matches) else body_end
            units.append({
                "label": _label(match),
                "section": "batang_tubuh",
                "offset": match.start(),
                "text": body[match.start():end].strip(),
            })
        flags += check_sequence([u["label"] for u in units])

    for i, match in enumerate(explanation_matches):
        end = explanation_matches[i + 1].start() if i + 1 < len(explanation_matches) else len(body)
        units.append({
            "label": _label(match),
            "section": "penjelasan",
            "offset": match.start(),
            "text": body[match.start():end].strip(),
        })

    if not [u for u in units if u["section"] == "batang_tubuh"]:
        diktum = list(RE_DIKTUM.finditer(body, 0, body_end))
        for i, match in enumerate(diktum):
            end = diktum[i + 1].start() if i + 1 < len(diktum) else body_end
            units.insert(i, {
                "label": match.group(1).upper(),
                "section": "batang_tubuh",
                "offset": match.start(),
                "text": body[match.start():end].strip(),
            })
        if diktum:
            structure = "diktum"
        else:
            flags.append("tidak_ada_pasal")

    body_units = [u for u in units if u["section"] == "batang_tubuh"]
    return {
        "structure": structure,
        "units": units,
        "body_count": len(body_units),
        "explanation_count": len(units) - len(body_units),
        "has_explanation": bool(explanation),
        "flags": flags,
        "chars": len(body),
    }


def amendment_items(segment):
    """Split the contents of Pasal I into numbered amendment items."""
    matches = list(RE_ITEM.finditer(segment))
    items = []
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(segment)
        text = segment[match.start():end].strip()
        head = text[:300]
        action = re.search(r"\b(diubah|dihapus|disisipkan|ditambahkan|ditambah)\b", head, re.I)
        items.append({
            "number": int(match.group(1)),
            "target_pasal": re.findall(r"Pasal\s+(\d{1,3}[A-Z]?)", head)[:3],
            "action": action.group(1).lower() if action else None,
            "text": text,
        })
    return items


def _number(label):
    match = re.match(r"(\d+)([A-Z]?)", label)
    return (int(match.group(1)), match.group(2)) if match else (None, "")


def check_sequence(labels):
    """Flag odd numbering. Never renames a label: the source text is reported as it is."""
    flags = []
    numbers = [_number(l) for l in labels if not is_roman(l)]
    arabic = [n for n, suffix in numbers if n is not None and suffix == ""]
    if arabic and arabic[0] != 1 and not (labels and is_roman(labels[0]) and arabic[0] == 2):
        flags.append("tidak_mulai_dari_1")
    gaps = [(a, b) for a, b in zip(arabic, arabic[1:]) if b != a + 1]
    if gaps:
        flags.append("urutan_loncat:" + ",".join(f"{a}->{b}" for a, b in gaps[:5]))
    if len(set(labels)) != len(labels):
        flags.append("pasal_ganda")
    return flags
