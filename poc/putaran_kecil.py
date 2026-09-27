"""Putaran kecil yang disetujui: 22 detail DJP yang gagal (1 percobaan masing-masing) + sampel OCR ~20 lampiran.

Pengaman tambahan di atas fetch.py:
- Tidak berjalan sebelum 2026-09-23 22:00 WIB (15:00 UTC).
- Batas keras 45 permintaan jaringan untuk seluruh putaran (termasuk robots.txt).
- Jeda 20 detik (fetch.HOST_DELAY). Berhenti total pada HostDown/DailyCapReached.
Jalankan:  ..\.venv\Scripts\python putaran_kecil.py
"""
import json, re, sys, datetime
from pathlib import Path
import fetch
from fetch import HostDown, DailyCapReached

# Hanya boleh berjalan di luar jam kerja WIB: pukul 22.00 sampai 05.59.
# Dasarnya: kegagalan pajak.go.id 2-3% pada pukul 09-12 WIB, 0% pada pukul 07, 21, dan 22.
WIB = datetime.timezone(datetime.timedelta(hours=7))
JAM_BOLEH = set(range(22, 24)) | set(range(0, 6))
HARD_CAP = 45
BASE = "https://www.pajak.go.id"

_n = 0
_orig = fetch._request


def _counted(url, **kw):
    global _n
    if _n >= HARD_CAP:
        raise DailyCapReached(f"batas putaran {HARD_CAP} permintaan tercapai")
    _n += 1
    return _orig(url, **kw)


fetch._request = _counted


def retry_failed():
    from djp_enum import parse_detail, RAW
    D = [json.loads(l) for l in open("data/djp_pph_detail.jsonl", encoding="utf8")]
    ok = {d["path"] for d in D if not d.get("error")}
    kurs = re.compile(r"nilai\s+kurs\s+sebagai\s+dasar|tarif\s+bunga\s+sebagai\s+dasar|nilai\s+dasar\s+perhitungan\s+bea\s+masuk", re.I)
    judul = {json.loads(l)["path"]: json.loads(l)["judul"] for l in open("data/djp_pph_list.jsonl", encoding="utf8")}
    failed = []
    for d in D:
        p = d["path"]
        if d.get("error") and p not in ok and p not in failed and not kurs.search(judul.get(p, "")):
            failed.append(p)
    print("gagal sebelumnya:", len(failed), flush=True)
    with open("data/djp_pph_detail.jsonl", "a", encoding="utf8") as out:
        for p in failed:
            try:
                h, m = fetch.get(BASE + p)
            except (HostDown, DailyCapReached):
                raise
            except Exception as e:
                out.write(json.dumps({"path": p, "error": str(e), "putaran": "2026-09-23"}) + "\n"); out.flush()
                print("gagal lagi:", p[-50:], flush=True)
                continue
            slug = p.rstrip("/").split("/")[-1]
            (RAW / (slug + ".html")).write_text(h, encoding="utf8")
            d = parse_detail(h)
            d.update({"path": p, "source_url": m["url"], "retrieved_at": m["retrieved_at"], "putaran": "2026-09-23"})
            out.write(json.dumps(d, ensure_ascii=False) + "\n"); out.flush()
            print("ok:", slug[:50], len(d["body_text"]), flush=True)


def main():
    n = datetime.datetime.now(WIB)
    if n.hour not in JAM_BOLEH:
        sys.exit(f"Belum waktunya: sekarang {n:%H:%M} WIB. Putaran ini hanya boleh pukul 22.00-05.59 WIB.")
    print("mulai", n.strftime("%Y-%m-%d %H:%M"), "WIB", flush=True)
    try:
        retry_failed()
        import ocr_sample
        ocr_sample.main(n=20)
    except (HostDown, DailyCapReached, fetch.AlreadyRunning) as e:
        print("BERHENTI:", e, flush=True)
    print("permintaan jaringan putaran ini:", _n, flush=True)


if __name__ == "__main__":
    main()
