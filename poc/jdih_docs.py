"""Ambil halaman detail + PDF utama JDIH untuk daftar slug, ekstrak teks per halaman.

Keluaran: data/jdih_pph_detail.jsonl, raw/jdih/<slug>.pdf, text/jdih/<slug>.txt
"""
import json, re, sys
from pathlib import Path
import pymupdf
from jdih import BASE, rsc_payload, find_json_objects
from fetch import get, HostDown, DailyCapReached

RAW = Path("raw/jdih"); RAW.mkdir(parents=True, exist_ok=True)
TXT = Path("text/jdih"); TXT.mkdir(parents=True, exist_ok=True)


def clean(v):
    if isinstance(v, str) and v.startswith("$D"):
        return v[2:]
    if isinstance(v, str) and v in ("$undefined", "null"):
        return None
    return v


def doc_object(html):
    p = rsc_payload(html)
    objs = [o for o in find_json_objects(p, "Relasi") if "PUU" in o]
    return max(objs, key=lambda x: len(json.dumps(x))) if objs else None, p


def pdf_pages(path):
    """Kembalikan daftar (teks, jumlah_gambar) per halaman."""
    out = []
    with pymupdf.open(path) as d:
        for pg in d:
            out.append((pg.get_text(), len(pg.get_images())))
    return out


def process(slug, out):
    url = BASE + "/dok/" + slug
    html, meta = get(url)
    o, p = doc_object(html)
    status_list = re.findall(r'"status":"([^"]*)"', p)  # status berlaku dari kartu ringkasan
    rec = {"slug": slug, "source_url": url, "retrieved_at": meta["retrieved_at"]}
    if not o:
        rec["error"] = "objek dokumen tidak ditemukan"
        out.write(json.dumps(rec, ensure_ascii=False) + "\n"); return
    puu = o.get("PUU") or {}
    rec.update({
        "id": o["Id"], "nomor": o["Nomor"], "judul": o["Judul"], "jenis": (o.get("Jenis") or {}).get("Keterangan"),
        "teu": o.get("TEU"), "no": puu.get("No"), "tahun": puu.get("Tahun"),
        "tgl_penetapan": clean(puu.get("TglPenetapan")), "tgl_pengundangan": clean(puu.get("TglPengundangan")),
        "tgl_mulai_berlaku": clean(puu.get("TglMulaiBerlaku")), "tgl_selesai_berlaku": clean(puu.get("TglSelesaiBerlaku")),
        "sumber": puu.get("Sumber"), "label": [(l.get("Teks") or "").strip() for l in o.get("Label") or []],
        "relasi": [{"kode": r.get("KodeRelasi"), "jenis": r.get("Jenis"), "nama": r.get("Nama"),
                    "nomor": r.get("Nomor"), "judul": r.get("Judul"), "slug": r.get("Slug"),
                    "tgl": clean(r.get("TglMulaiBerlaku")), "ket": r.get("Keterangan")} for r in o.get("Relasi") or []],
        "files": [{"jenis": f.get("Jenis"), "ket": f.get("Keterangan"), "id": f["MediaCatalog"]["Id"],
                   "nama": f["MediaCatalog"].get("FileName") or "", "size_kb": f["MediaCatalog"].get("Size")}
                  for f in o.get("File") or [] if f.get("MediaCatalog")],
    })
    # status berlaku yang ditampilkan: cari di teks halaman
    m = re.search(r'"children":"(Berlaku|Tidak Berlaku|Tetap|Dicabut)"', p)
    rec["status_tampil"] = m.group(1) if m else None
    mains = [f for f in rec["files"] if f["jenis"] == 1 and f["nama"].lower().endswith(".pdf")]
    if mains:
        f = mains[0]
        purl = f"{BASE}/api/download/{f['id']}/{f['nama']}"
        try:
            data, pm = get(purl, binary=True)
            pp = RAW / (slug + ".pdf"); pp.write_bytes(data)
            pages = pdf_pages(pp)
            txt = "\n\f".join(t for t, _ in pages)
            (TXT / (slug + ".txt")).write_text(txt, encoding="utf8")
            rec.update({"pdf_url": purl, "pdf_retrieved_at": pm["retrieved_at"], "pdf_bytes": len(data),
                        "pages": len(pages), "page_chars": [len(t.strip()) for t, _ in pages],
                        "page_images": [n for _, n in pages], "text_chars": len(txt)})
        except (HostDown, DailyCapReached):
            raise
        except Exception as e:
            rec["pdf_error"] = repr(e)
    else:
        htms = [f for f in rec["files"] if f["jenis"] == 2 and re.search(r"\.html?$", f["nama"], re.I)]
        if htms:
            f = htms[0]
            hurl = f"{BASE}/api/download/{f['id']}/{f['nama']}"
            try:
                data, hm = get(hurl, binary=True)
                (RAW / (slug + ".htm")).write_bytes(data)
                from bs4 import BeautifulSoup
                try:
                    raw = data.decode("utf-8")
                except UnicodeDecodeError:
                    raw = data.decode("cp1252", "replace")
                s = BeautifulSoup(raw, "lxml")
                for t in s(["script", "style"]):
                    t.decompose()
                txt = s.get_text("\n", strip=True)
                (TXT / (slug + ".txt")).write_text(txt, encoding="utf8")
                rec.update({"html_url": hurl, "html_retrieved_at": hm["retrieved_at"], "html_bytes": len(data),
                            "text_chars": len(txt), "format": "html"})
            except (HostDown, DailyCapReached):
                raise
            except Exception as e:
                rec["html_error"] = repr(e)
        else:
            rec["pdf_error"] = "tidak ada PDF/HTML utama"
    out.write(json.dumps(rec, ensure_ascii=False) + "\n"); out.flush()
    print(slug, rec.get("pages"), rec.get("text_chars"), flush=True)


if __name__ == "__main__":
    slugs = [l.strip() for l in open(sys.argv[1], encoding="utf8") if l.strip()]
    outp = Path(sys.argv[2])
    done = set()
    if outp.exists():
        done = {d["slug"] for d in map(json.loads, outp.open(encoding="utf8")) if "error" not in d and "pdf_error" not in d and "html_error" not in d}
    with outp.open("a", encoding="utf8") as out:
        for s in slugs:
            if s not in done:
                try:
                    process(s, out)
                except HostDown:
                    print("host tidak tersedia, berhenti", flush=True); break
                except DailyCapReached:
                    print("batas harian tercapai, berhenti", flush=True); break
                except Exception as e:
                    out.write(json.dumps({"slug": s, "error": repr(e)}) + "\n"); out.flush()
