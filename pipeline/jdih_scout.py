"""JDIH reconnaissance for M5, offline part: what the proof of concept's JDIH listing already says.

    python -m pipeline.jdih_scout

Reads poc/data/jdih_metadata.jsonl (every JDIH document, listed 2026-09-21), harvest/djp_list.jsonl
(the KUP and PPN catalogue lists) and corpus/. Prints counts only; writes nothing and sends nothing.
"""
import collections
import json

from . import config
from .identity import parse

LIST_OUT = config.HARVEST / "djp_list.jsonl"


def read_jsonl(path):
    with path.open(encoding="utf8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def main():
    jdih = {}
    for row in read_jsonl(config.IN_JDIH_META):
        key = parse(row.get("bentuk"), row.get("nomor"), row.get("judul"))
        if key:
            jdih.setdefault(key, row)
    by_slug = {row["slug"]: row for row in read_jsonl(config.IN_JDIH_META)}
    print(f"JDIH (daftar bukti konsep): {len(by_slug)} dokumen, {len(jdih)} nomor terbaca")

    seen = {}
    for row in read_jsonl(LIST_OUT):
        if not row.get("path"):
            continue
        key = parse(row.get("jenis"), row.get("nomor"), row.get("judul"))
        seen.setdefault(row["_kategori_daftar"], {})[row["path"]] = key
    for name, rows in sorted(seen.items()):
        keys = [k for k in rows.values() if k]
        hits = [jdih[k] for k in keys if k in jdih]
        statuses = collections.Counter(h["status"] for h in hits)
        print(f"{name}: {len(rows)} dokumen di daftar DJP, {len(keys)} nomor terbaca, {len(hits)} ditemukan di JDIH "
              f"(status JDIH: {dict(statuses)}), {sum(1 for h in hits if h.get('full_text_pdf'))} dengan PDF teks penuh")

    index = json.loads((config.ROOT / "corpus" / "index.json").read_text(encoding="utf8"))
    only = [d for d in index if d["sources"] == ["JDIH"]]
    with_pdf = with_text_now = 0
    for doc in only:
        record = json.loads((config.ROOT / "corpus" / "documents" / (doc["id"] + ".json")).read_text(encoding="utf8"))
        slugs = [r["url"].rsplit("/", 1)[-1] for r in record["source_records"] if r["source"] == "JDIH"]
        if any(by_slug.get(s, {}).get("full_text_pdf") for s in slugs):
            with_pdf += 1
        with_text_now += doc["text_available"]
    print(f"PPh JDIH-only di korpus: {len(only)} dokumen, {with_text_now} sudah berteks, "
          f"{with_pdf} punya berkas teks penuh di daftar JDIH")


if __name__ == "__main__":
    main()
