"""Enumerasi metadata JDIH Kemenkeu per jenis dokumen (10 item/halaman, urut terbaru)."""
import json, re, sys
from jdih import BASE, rsc_payload, find_json_objects
from fetch import get

BENTUK = ["Undang-Undang", "Peraturan Pemerintah Pengganti Undang-Undang", "Peraturan Pemerintah",
          "Peraturan Presiden", "Peraturan Menteri", "Keputusan Menteri", "Peraturan Unit Eselon I",
          "Keputusan Unit Eselon I", "Lainnya", "Putusan Pengadilan Pajak", "Instruksi Menteri"]
OUT = "data/jdih_metadata.jsonl"

seen = set()
try:
    for line in open(OUT, encoding="utf8"):
        seen.add(json.loads(line)["produk_hukum_id"])
except FileNotFoundError:
    pass

with open(OUT, "a", encoding="utf8") as f:
    for b in BENTUK:
        page, pages = 1, None
        while pages is None or page <= pages:
            params = {"bentuk": b, "order": "desc", "page": page}
            html, meta = get(BASE + "/search", params=params)
            p = rsc_payload(html)
            pc = re.findall(r'"pageCount":(\d+)', p)
            pages = int(pc[0]) if pc else 0
            n = 0
            for it in find_json_objects(p, "produk_hukum_id"):
                d = it.get("data", it)
                if "produk_hukum_id" not in d or d["produk_hukum_id"] in seen:
                    continue
                seen.add(d["produk_hukum_id"])
                d.pop("blocks", None)
                if isinstance(d.get("abstrak"), str) and d["abstrak"].startswith("$"):
                    d["abstrak"] = None  # referensi RSC; abstrak lengkap diambil dari halaman dokumen
                d["_source_list_url"] = meta["url"]
                d["_retrieved_at"] = meta["retrieved_at"]
                f.write(json.dumps(d, ensure_ascii=False) + "\n")
                n += 1
            f.flush()
            print(b, page, "/", pages, "baru:", n, flush=True)
            page += 1
