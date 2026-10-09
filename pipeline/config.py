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
HARVEST_DJP_LIST = HARVEST / "djp_list.jsonl"
HARVEST_DJP_DETAIL = HARVEST / "djp_detail.jsonl"
HARVEST_JDIH_DETAIL = HARVEST / "jdih" / "jdih_detail.jsonl"
HARVEST_JDIH_TEXT = HARVEST / "jdih" / "teks_berkas.jsonl"  # scripts/jdih-pdf-text.mjs (K-055)
HARVEST_INPUTS = [HARVEST_DJP_LIST, HARVEST_DJP_DETAIL, HARVEST_JDIH_DETAIL, HARVEST_JDIH_TEXT]

# Categories of the DJP catalogue that are in the corpus. M5 runs in two stages (SPEC section 7):
# KUP first; PPN is added here once its details are fetched. PPh comes from the proof of concept.
DJP_CATEGORIES = ["KUP"]

# Text of the full-text files fetched from JDIH in M5 (PPh documents only JDIH has). Approved by the
# owner on 2026-10-09 together with its effect on the evaluation set (K-066): PPh median 5 -> 6.
# When off, the documents stay without text and link to the fetched original file.
PUBLISH_JDIH_FILE_TEXT = True

