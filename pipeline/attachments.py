"""Match the regulation number in an attachment's file name against its parent document.

SPEC invariant 6. The proof of concept found a real case in a sample of ten: the page for
PER-20/PJ/2019 carries `Lampiran PER_23_PJ_2020.pdf`, whose contents belong to PER-23/PJ/2020
(LAPORAN section 5.1b). So an attachment is never shown as the document's own without checking.

Three outcomes, and no fourth:
- "cocok"          : file name and parent document agree.
- "tidak_cocok"    : a number was read and it differs. Flagged, not hidden.
- "tidak_terverifikasi": no number in the file name. Treated as unverified, never as a match.
"""
import re
from urllib.parse import unquote

from .identity import type_code


def file_name(url):
    return unquote(url.rsplit("/", 1)[-1])


def _clean(name):
    name = re.sub(r"\.(pdf|docx?|xlsx?|zip)$", "", name, flags=re.I)
    name = name.replace("_", " ").replace("%20", " ")
    name = re.sub(r"^\s*lampiran\s*", "", name, flags=re.I)
    return re.sub(r"\s+", " ", name).strip()


# Each pattern yields (code token, serial, year). The earliest match in the file name wins:
# a file name leads with the document's own number, and any later number is context, as in
# "PP_20_2026_Perubahan PP 55 Tahun 2022.pdf".
PATTERNS = [
    # "PER 8 TAHUN 2026", "PP NOMOR 29 TAHUN 2020", and run together: "PMK141TAHUN2023", "PMK10 Tahun 2025"
    (r"\b(PER|PERDJP|KEP|SE|PMK|KMK|PP|PERPRES|UU)[\s-]*(?:NOMOR\s*)?(\d{1,4})[A-Z]?\s*TAHUN\s*(\d{4})\b", (1, 2, 3)),
    # "PER-24 PJ 2021", "PER 23 PJ 2020", "KEP 79 PJ 2025"
    (r"\b(PER|KEP|SE)\b[\s-]*(\d{1,4})[A-Z]?\s*[-\s]\s*PJ[.\d]*\s*[-\s]\s*(\d{4})\b", (1, 2, 3)),
    # No separators at all: "PER18PJ2021", "KEP79PJ2025", "PER02PJ2024"
    (r"\b(PER|KEP|SE)\s*-?\s*(\d{1,4})\s*PJ[.\d]*\s*(\d{4})\b", (1, 2, 3)),
    # "PMK113PMK032022", "KMK744KM042020", "KMK 507 KMK 04 1995"
    (r"\b(PMK|KMK)\s*(\d{1,4})\s*(?:PMK|KMK|KM)\.?\s*\d{2,3}\s*(\d{4})\b", (1, 2, 3)),
    # "113/PMK.03/2022"; the same thing once separators are cleaned: "141 PMK.010 2021"
    (r"\b(\d{1,4})\s*/\s*(PMK|KMK|KM|PJ)[.\d]*\s*/\s*(\d{4})\b", (2, 1, 3)),
    (r"\b(\d{1,4})\s+(PMK|KMK|KM|PJ)[.\d]*\s+(\d{4})\b", (2, 1, 3)),
    # "PP 20 2026", "PMK 80 2024": type, number and year separated only by spaces
    (r"\b(PER|KEP|SE|PMK|KMK|PP|PERPRES|UU)\s+(\d{1,4})\s+(\d{4})\b", (1, 2, 3)),
]


def parse_file_name(name):
    """Return (code, number, year) read from an attachment file name, or None."""
    text = _clean(name).upper()
    best = None
    for pattern, (code_group, serial_group, year_group) in PATTERNS:
        match = re.search(pattern, text)
        if not match:
            continue
        candidate = (
            match.start(),
            _code_of(match.group(code_group)),
            match.group(serial_group).lstrip("0") or "0",
            match.group(year_group),
        )
        if best is None or candidate[0] < best[0]:
            best = candidate
    return None if best is None else best[1:]


def _code_of(token):
    return {
        "PER": "PER-DJP", "PERDJP": "PER-DJP", "KEP": "KEP-DJP", "SE": "SE",
        "PMK": "PMK", "KMK": "KMK", "PP": "PP", "PERPRES": "PERPRES", "UU": "UU",
    }.get(token, token)


def base_number(number):
    """KMK keys carry their series ('744/KM.4'); compare on the serial part only."""
    return str(number).split("/", 1)[0]


def check(url, document_key):
    """Return the attachment record, including its match result."""
    name = file_name(url)
    parsed = parse_file_name(name)
    record = {"url": url, "file_name": name, "parsed_number": None, "match": "tidak_terverifikasi"}
    if not parsed:
        record["note"] = "nomor peraturan tidak terbaca dari nama berkas"
        return record

    code, number, year = parsed
    record["parsed_number"] = {"code": code, "number": number, "year": year}
    doc_code, doc_number, doc_year = document_key[0], base_number(document_key[1]), document_key[2]
    same_number = number == base_number(doc_number) and year == doc_year
    same_code = code == doc_code or type_code(code) == doc_code
    if same_number and same_code:
        record["match"] = "cocok"
    else:
        record["match"] = "tidak_cocok"
        record["note"] = (
            f"nama berkas menyebut {code} {number}/{year}, dokumen ini {doc_code} {doc_number}/{doc_year}"
        )
    return record
