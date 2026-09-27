"""Sampel lampiran PDF resmi dari pajak.go.id: ukur lapisan teks per halaman, OCR halaman pindaian.

Halaman dianggap pindaian bila teks tertanam < 50 karakter dan halaman memuat gambar.
Kualitas OCR diukur dengan (a) skor keyakinan RapidOCR, (b) proporsi kata yang dikenal kamus
kecil dari korpus teks HTML DJP (kata yang muncul >= 3 kali), dan (c) contoh nyata.
Keluaran: data/ocr_sample.jsonl, raw/djp_lampiran/*.pdf, out/ocr_contoh/*.txt
"""
import json, re, random, collections
from pathlib import Path
import pymupdf
from fetch import get, HostDown, DailyCapReached
import ocr

RAW = Path("raw/djp_lampiran"); RAW.mkdir(parents=True, exist_ok=True)
EX = Path("out/ocr_contoh"); EX.mkdir(parents=True, exist_ok=True)
KURS = re.compile(r"nilai\s+kurs|tarif\s+bunga\s+sebagai", re.I)


def vocab():
    c = collections.Counter()
    for l in open("data/djp_pph_detail.jsonl", encoding="utf8"):
        d = json.loads(l)
        for w in re.findall(r"[a-zA-Z]{3,}", d.get("body_text") or ""):
            c[w.lower()] += 1
    return {w for w, n in c.items() if n >= 3}


def main(n=20, ocr_pages=3):
    D = [json.loads(l) for l in open("data/djp_pph_detail.jsonl", encoding="utf8")]
    D = [d for d in D if not d.get("error") and d.get("lampiran") and not KURS.search(d.get("judul") or "")]
    by_decade = collections.defaultdict(list)
    for d in D:
        y = re.search(r"(\d{4})", d.get("tanggal") or "")
        by_decade[(int(y.group(1)) // 5) * 5 if y else 0].append(d)
    random.seed(7)
    pick = []
    keys = sorted(by_decade)
    while len(pick) < n and any(by_decade.values()):
        for k in keys:
            if by_decade[k] and len(pick) < n:
                pick.append(by_decade[k].pop(random.randrange(len(by_decade[k]))))
    V = vocab()
    done = {json.loads(l).get("url", "") for l in open("data/ocr_sample.jsonl", encoding="utf8")} \
        if Path("data/ocr_sample.jsonl").exists() else set()
    out = open("data/ocr_sample.jsonl", "a", encoding="utf8")
    for d in pick:
        u = d["lampiran"][0]
        if u in done or u.replace("https://www.pajak.go.id", "https://www.pajak.go.id") in done:
            continue
        try:
            data, meta = get(u, binary=True)
        except (HostDown, DailyCapReached):
            raise
        except Exception as e:
            out.write(json.dumps({"url": u, "nomor": d["nomor"], "error": repr(e)[:200]}, ensure_ascii=False) + "\n")
            out.flush()
            print("gagal:", u[-50:], flush=True)
            continue
        fn = RAW / (re.sub(r"[^\w.-]", "_", u.split("/")[-1])[:120])
        fn.write_bytes(data)
        rec = {"nomor": d["nomor"], "tanggal": d["tanggal"], "judul": d["judul"], "url": meta["url"],
               "retrieved_at": meta["retrieved_at"], "bytes": len(data)}
        try:
            doc = pymupdf.open(fn)
        except Exception as e:
            rec["error"] = repr(e); out.write(json.dumps(rec, ensure_ascii=False) + "\n"); continue
        pages = [(len(p.get_text().strip()), len(p.get_images())) for p in doc]
        scanned = [i for i, (c, im) in enumerate(pages) if c < 50 and im > 0]
        rec.update({"pages": len(pages), "scanned_pages": len(scanned), "text_pages": len(pages) - len(scanned),
                    "embedded_chars": sum(c for c, _ in pages)})
        if scanned:
            res = ocr.ocr_pdf(fn, pages=set(scanned[:ocr_pages]))
            words = [w.lower() for r in res for w in re.findall(r"[a-zA-Z]{3,}", r["text"])]
            rec["ocr"] = [{k: r[k] for k in ("page", "n_boxes", "conf_mean", "conf_low_frac")} for r in res]
            rec["ocr_words"] = len(words)
            rec["ocr_known_word_frac"] = round(sum(w in V for w in words) / len(words), 3) if words else None
            (EX / (fn.stem + ".txt")).write_text(
                "\n\n=== halaman berikut ===\n\n".join(f"[hal {r['page'] + 1}] conf={r['conf_mean']}\n{r['text']}" for r in res),
                encoding="utf8")
        out.write(json.dumps(rec, ensure_ascii=False) + "\n"); out.flush()
        print(rec["nomor"], rec.get("pages"), "pindaian:", rec.get("scanned_pages"), rec.get("ocr_known_word_frac"), flush=True)


if __name__ == "__main__":
    main()
