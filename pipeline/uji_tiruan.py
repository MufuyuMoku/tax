"""Fake changes for the end-to-end test of the automatic update (M9, K-091). TEST DATA ONLY.

    python -m pipeline.uji_tiruan

Appends, to the update files of the harvest folder (TAX_HARVEST, or harvest/ of a throwaway checkout,
never the published data), what an update run would have found:
    1. a new regulation in the KUP list, with a detail page of two articles;
    2. a status change: the DJP list now says "Dicabut" for PMK 117/2024 (in reality "Aktif").
The workflow runs this only with input uji, in the runner's own checkout, and never pushes.
"""
import datetime
import os
import sys

from . import config
from .harvest import append_jsonl

NOW = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
LIST_URL = "https://www.pajak.go.id/id/peraturan?field_kategori_peraturan_target_id=13927&page=0"
NEW_PATH = "/id/peraturan/uji-tiruan-pembaruan-otomatis-m9"


def main():
    if config.HARVEST.resolve() == (config.ROOT / "harvest").resolve() and "GITHUB_ACTIONS" not in os.environ:
        raise SystemExit("Data tiruan hanya untuk folder uji: setel TAX_HARVEST ke salinan harvest/, atau jalankan di Actions.")
    new_row = {
        "nomor": "999/PMK.03/2026", "judul": "UJI TIRUAN PEMBARUAN OTOMATIS (BUKAN PERATURAN SUNGGUHAN)",
        "jenis": "Peraturan Menteri Keuangan", "tanggal": "2026-10-16", "status": "Aktif", "path": NEW_PATH,
        "_kategori_daftar": "KUP", "_list_url": LIST_URL, "_list_page": 0, "_retrieved_at": NOW, "_alasan": "baru",
    }
    changed_row = {
        "nomor": "117 TAHUN 2024", "judul": "TATA CARA PENGHAPUSAN PIUTANG PAJAK", "jenis": "Peraturan Menteri Keuangan",
        "tanggal": "2024-12-23", "status": "Dicabut", "path": "/id/peraturan/tata-cara-penghapusan-piutang-pajak",
        "_kategori_daftar": "KUP", "_list_url": LIST_URL, "_list_page": 10, "_retrieved_at": NOW,
        "_alasan": "berubah", "_berubah": ["status"],
    }
    detail = {
        "judul": new_row["judul"], "jenis": new_row["jenis"], "nomor": new_row["nomor"], "tanggal": new_row["tanggal"],
        "status": "Aktif", "peraturan_terkait": [], "lampiran": [], "body_html_len": 400,
        "body_text": "Pasal 1\nPeraturan ini hanya data tiruan untuk menguji pembaruan otomatis Saku Pajak.\n"
                     "Pasal 2\nPeraturan tiruan ini tidak pernah diterbitkan dan tidak berlaku.",
        "path": NEW_PATH, "source_url": config.DJP_BASE + NEW_PATH, "retrieved_at": NOW, "_alasan": "baru",
    }
    append_jsonl(config.HARVEST_UPDATE_LIST, [new_row, changed_row])
    append_jsonl(config.HARVEST_UPDATE_DETAIL, [detail])
    print(f"data tiruan ditulis ke {config.HARVEST}: 1 peraturan baru ({new_row['nomor']}), 1 status berubah (PMK 117/2024)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
