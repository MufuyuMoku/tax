"""Paths and shared constants for the data pipeline.

Input is the proof-of-concept archive under poc/. The pipeline never makes network requests:
everything it needs was fetched during the proof of concept and is committed (except the raw
page archive and the HTTP cache, which are deliberately kept out of the repository).
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POC = ROOT / "poc"
POC_DATA = POC / "data"
POC_TEXT = POC / "text"
CORPUS = ROOT / "corpus"

# Input files, all produced by the proof of concept.
IN_DJP_LIST = POC_DATA / "djp_pph_list.jsonl"
IN_DJP_DETAIL = POC_DATA / "djp_pph_detail.jsonl"
IN_JDIH_META = POC_DATA / "jdih_metadata.jsonl"
IN_JDIH_CANDIDATES = POC_DATA / "jdih_pph_candidates.jsonl"
IN_JDIH_DETAIL = POC_DATA / "jdih_pph_detail.jsonl"
INPUTS = [IN_DJP_LIST, IN_DJP_DETAIL, IN_JDIH_META, IN_JDIH_CANDIDATES, IN_JDIH_DETAIL]

DJP_BASE = "https://www.pajak.go.id"
JDIH_BASE = "https://jdih.kemenkeu.go.id"

# Weekly exchange-rate and monthly interest-rate decrees are out of the product's scope
# (SPEC section 3). They are counted, never processed.
OUT_OF_SCOPE_TITLE = (
    r"nilai\s+kurs\s+sebagai\s+dasar|tarif\s+bunga\s+sebagai\s+dasar|"
    r"nilai\s+dasar\s+perhitungan\s+bea\s+masuk"
)

# M5: KUP and PPN are fetched from the DJP catalogue by pipeline/harvest.py. Fetched lists and
# details (text included) are committed here, like poc/data, so the corpus can be rebuilt without
# the network. The HTTP cache and lock files are not committed.
HARVEST = ROOT / "harvest"
