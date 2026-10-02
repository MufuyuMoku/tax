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


# A quote longer than this is cut down to the parts that decide the reading: the opening words,
# the item that names the target regulation, and the clause that says what happens to it.
MAX_QUOTE = 900
GAP = " … "
RE_AMENDING = re.compile(r"\b(?:diubah|mengubah|disisipkan|dihapus|ditambahkan)\b", re.I)
# "... sebagaimana telah diubah dengan ..." describes an earlier amendment; it does not make one.
RE_EARLIER_AMENDMENT = re.compile(r"\b(?:telah|sebagaimana)\b[^,;:]{0,40}$", re.I)
# The colon that closes an amending sentence, not the one in "Nomor :" or "No.:".
RE_CLOSING_COLON = re.compile(r"(?<!Nomor)(?<!Nomor )(?<!No\.)(?<!No\. ):")
# Item boundaries inside a long revoking clause: "a. X; b. Y; dan c. Z, dicabut ...".
RE_LIST_BREAK = re.compile(r";\s*(?:dan\s+|atau\s+)?")
RE_SENTENCE_END = re.compile(r"\.(?=\s+(?:[A-Z(]|[a-z0-9]{1,3}\.\s)|\s*$)")
RE_UNIT_LABEL = re.compile(r"^\s*(?:Pasal\s+[IVXLC\d]+[A-Z]?|[A-Z]{4,}\s*:)\s*")


def references(text):
    """Regulations named in `text`. `name` is only the name; it is never used as a quote."""
    found = []
    for match in RE_REFERENCE.finditer(text):
        type_label, number, year = match.group(1), match.group(2), (match.group(3) or "")
        key = parse(type_label, (number + year).replace("\n", " "))
        if key:
            found.append({
                "key": key,
                "name": match.group(0)[:120].replace("\n", " "),
                "start": match.start(),
                "end": match.end(),
            })
    return found


# The dot after a list marker ("a.", "12.", "iv.") or "No." does not end a sentence.
RE_NOT_AN_END = re.compile(r"(?:^|[\s(])(?:[A-Za-z]{1,2}|\d{1,3}|[ivxIVX]{1,4})$")


def _sentence_ends(text, lower, upper):
    for match in RE_SENTENCE_END.finditer(text, lower, upper):
        if not RE_NOT_AN_END.search(text, max(0, match.start() - 6), match.start()):
            yield match


def _sentence_start(text, position):
    start = 0
    for match in _sentence_ends(text, 0, position):
        start = match.end()
    return start


def _clause_end(text, position):
    """End of the clause that runs through `position`: the next ';' or full stop."""
    semicolon = text.find(";", position)
    stop = next(_sentence_ends(text, position, len(text)), None)
    ends = [e for e in (semicolon + 1 if semicolon != -1 else None, stop.end() if stop else None) if e]
    return min(ends) if ends else len(text)


def _last_break(text, lower, upper):
    """Position just after the last item break in text[lower:upper], or `lower` if there is none."""
    position = lower
    for match in RE_LIST_BREAK.finditer(text, lower, upper):
        position = match.end()
    return position


def revocation_quote(ayat, reference, verb):
    """The sentence of `ayat` that revokes `reference`. Returns (quote, is_excerpt).

    A revoking sentence is either short ("Pada saat ... mulai berlaku, PP Nomor 30 Tahun 2020 ...
    dicabut dan dinyatakan tidak berlaku.") or a list ("Pada saat ... mulai berlaku: a. ...; b. ...;
    dicabut dan dinyatakan tidak berlaku."). A list is cut down to its opening words, the item that
    names this target (where a "sepanjang mengatur ..." or "ketentuan Pasal 2A" restriction sits),
    and the clause that revokes it. Omitted parts are marked with an ellipsis and `is_excerpt` is True.
    """
    start = _sentence_start(ayat, reference["start"])
    end = _clause_end(ayat, verb.end())
    sentence = ayat[start:end].strip()
    # An opening such as "Pada saat Peraturan Menteri ini mulai berlaku:" sits right at the start.
    # A colon further in belongs to an item ("... telah beberapa kali diubah dengan: 1. ..."); a
    # list without an opening of its own (PER-30/PJ/2018 Pasal 1) gets none.
    colon = ayat.find(":", start, min(reference["start"], start + 300))
    opening_end = colon + 1 if colon != -1 else start
    head = ayat[start:opening_end].strip()
    item_left = _last_break(ayat, opening_end, reference["start"])
    skipped_before = bool(ayat[opening_end:item_left].strip())

    if not skipped_before and len(sentence) <= MAX_QUOTE:
        return sentence, False
    if skipped_before:
        lead = head + GAP if head else GAP.lstrip()
    else:
        lead = head + " " if head else ""
    body = ayat[item_left:end].strip()
    if len(lead) + len(body) <= MAX_QUOTE:
        return lead + body, True

    # The verb is shared by the whole list and sits at its end: keep only this target's item.
    item_right = RE_LIST_BREAK.search(ayat, reference["end"], verb.start())
    item = ayat[item_left:item_right.start() + 1 if item_right else verb.start()].strip()
    clause = ayat[_last_break(ayat, reference["end"], verb.start()):end].strip()
    parts = [lead + item]
    if clause and clause not in item:
        parts.append(clause)
    return GAP.join(parts), True


def amendment_quote(body_units, text, reference_key):
    """The sentence that amends the target, e.g. "Beberapa ketentuan dalam Peraturan Pemerintah
    Nomor 55 Tahun 2022 ... diubah sebagai berikut:". Returns (quote, is_excerpt, names_target).

    Looks in the body only, never the preamble, which names the target too but does not amend it.
    A sentence naming the target is preferred. When none does, the first amending sentence of the
    body is taken (older decrees write "Mengubah ketentuan Pasal 1 ayat (3), sehingga ..."), and
    `names_target` is False so the page can say the target number was read from the title.
    """
    units = [re.sub(r"\s+", " ", u["text"]) for u in body_units]
    if not units and text:
        body = re.search(r"\bMEMUTUSKAN\s*:?(.*)", re.sub(r"\s+", " ", text), re.S)
        units = [body.group(1)] if body else []

    fallback = None
    for unit in units:
        lead = RE_UNIT_LABEL.match(unit)
        offset = lead.end() if lead else 0
        for verb in RE_AMENDING.finditer(unit):
            if RE_EARLIER_AMENDMENT.search(unit, max(0, verb.start() - 60), verb.start()):
                continue
            # The amending clause usually opens the unit ("Pasal I Beberapa ketentuan ..."). While no
            # colon has closed that opening, the clause runs from the unit start: OCR leaves stray
            # full stops inside regulation names ("Terdampak. Pandemi"), so a sentence split there
            # would cut the clause in two.
            if offset <= verb.start() and not RE_CLOSING_COLON.search(unit, offset, verb.start()):
                start = offset
            else:
                start = max(_sentence_start(unit, verb.start()), offset)
            colon = RE_CLOSING_COLON.search(unit, verb.end(), verb.end() + 160)
            stop = colon.end() if colon else _clause_end(unit, verb.end())
            sentence = unit[start:stop].strip()
            if not sentence or re.match(r"(?i)^(menimbang|mengingat|bahwa)\b", sentence):
                continue
            if any(r["key"][:3] == tuple(reference_key[:3]) for r in references(sentence)):
                return _cap(sentence) + (True,)
            if fallback is None and verb.start() - start < MAX_QUOTE:
                fallback = _cap(sentence) + (False,)
            break  # only the first amending clause of each unit is a candidate
    return fallback or (None, False, False)


def _cap(sentence):
    if len(sentence) <= MAX_QUOTE:
        return sentence, False
    half = MAX_QUOTE // 2
    return sentence[:half].rstrip() + GAP + sentence[-half:].lstrip(), True


def extract(title, text, body_units):
    """Return {'amends': [...], 'revokes': [...]}.

    Each entry carries `quote`: the source sentence that makes the relation, so a reader can judge
    for themselves whether a revocation is full or "sepanjang mengatur tentang ...". When that
    sentence cannot be found, `quote` is None and `quote_unavailable` says why. The bare name of
    the target regulation is never offered as a quote.
    """
    result = {"amends": [], "revokes": []}

    # "Perubahan atas X Nomor ..." in the title is the clearest signal of an amendment.
    if re.search(r"perubahan", title or "", re.I):
        head = (text or "")[:3000]
        match = re.search(r"PERUBAHAN.{0,40}?ATAS(.{0,600})", head, re.I | re.S)
        if match:
            found = references(match.group(1))
            if found:
                target = found[0]
                quote, cut, names_target = amendment_quote(body_units, text, target["key"])
                entry = {"key": target["key"], "name": target["name"], "quote": quote, "quote_excerpt": cut}
                if quote is None:
                    entry["quote_unavailable"] = (
                        "kalimat perubahan tidak ditemukan di batang tubuh; relasi ini dibaca dari judul peraturan"
                    )
                elif not names_target:
                    entry["quote_note"] = (
                        "nomor peraturan yang diubah tidak terbaca otomatis dari kalimat ini; nomornya diambil dari judul"
                    )
                result["amends"].append(entry)

    # Revocations live in the closing pasal. Read per ayat, taking references before "dicabut".
    chunks = [u["text"] for u in body_units[-4:]] if body_units else [(text or "")[-6000:]]
    for chunk in chunks:
        chunk = re.sub(r"\s+", " ", chunk)
        for ayat in re.split(r"\s\(\d+[a-z]?\)\s", chunk):
            verbs = list(RE_REVOKED.finditer(ayat))
            if not verbs:
                continue
            for reference in references(ayat[:verbs[-1].start()]):
                if reference["key"] in [r["key"] for r in result["revokes"]]:
                    continue
                # The verb that governs a reference is the first one after it: PP 55/2022 ends
                # every item with its own "dicabut ...;", while most lists share one at the end.
                verb = next(v for v in verbs if v.start() >= reference["end"])
                quote, cut = revocation_quote(ayat, reference, verb)
                result["revokes"].append({
                    "key": reference["key"],
                    "name": reference["name"],
                    "quote": quote,
                    "quote_excerpt": cut,
                })
    return result
