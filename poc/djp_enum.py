"""Enumerasi katalog peraturan www.pajak.go.id (Drupal views, 5 item/halaman).

Tahap 1: jumlah dokumen per kategori (untuk estimasi seluruh pajak).
Tahap 2: seluruh daftar kategori PPh -> data/djp_pph_list.jsonl
Tahap 3: halaman detail setiap dokumen PPh -> data/djp_pph_detail.jsonl + raw/djp/<slug>.html
"""
import json, re, sys
from pathlib import Path
from bs4 import BeautifulSoup
from fetch import get, HostDown, DailyCapReached

BASE = "https://www.pajak.go.id"
LIST = BASE + "/id/peraturan"
KAT = {"13932": "BM", "14029": "BPHTB", "13931": "BPHTB Lainnya", "13927": "KUP", "13933": "Lainnya",
       "13930": "PBB", "13928": "PPh", "13929": "PPN", "All": "Semua"}
RAW = Path("raw/djp"); RAW.mkdir(parents=True, exist_ok=True)


def last_page(s):
    for a in s.select("a[href]"):
        if "Last" in a.get_text() or a.get("title", "").lower().startswith("ke halaman terakhir"):
            m = re.search(r"page=(\d+)", a["href"])
            if m:
                return int(m.group(1))
    return 0


def rows(s):
    out = []
    for r in s.select(".views-row"):
        f = lambda c: (r.select_one(".views-field-" + c) or BeautifulSoup("", "lxml")).get_text(" ", strip=True)
        a = r.select_one(".views-field-field-nomor-dokumen a")
        out.append({"nomor": f("field-nomor-dokumen"), "judul": f("title"), "jenis": f("field-jenis-dokumen"),
                    "tanggal": f("field-tanggal-peraturan"), "status": f("field-status-peraturan"),
                    "path": a["href"] if a else None})
    return out


def stage1():
    res = {}
    for k, name in KAT.items():
        h, m = get(LIST, params={"field_kategori_peraturan_target_id": k, "page": 0})
        s = BeautifulSoup(h, "lxml")
        lp = last_page(s)
        hl, _ = get(LIST, params={"field_kategori_peraturan_target_id": k, "page": lp})
        n_last = len(rows(BeautifulSoup(hl, "lxml")))
        res[name] = {"kategori_id": k, "halaman": lp + 1, "perkiraan_dokumen": lp * 5 + n_last, "retrieved_at": m["retrieved_at"]}
        print(name, res[name], flush=True)
    Path("data/djp_kategori_counts.json").write_text(json.dumps(res, indent=1, ensure_ascii=False), encoding="utf8")


def stage2():
    out = open("data/djp_pph_list.jsonl", "w", encoding="utf8")
    h, m = get(LIST, params={"field_kategori_peraturan_target_id": "13928", "page": 0})
    lp = last_page(BeautifulSoup(h, "lxml"))
    for p in range(lp + 1):
        h, m = get(LIST, params={"field_kategori_peraturan_target_id": "13928", "page": p})
        for r in rows(BeautifulSoup(h, "lxml")):
            r.update({"_list_url": m["url"], "_list_page": p, "_retrieved_at": m["retrieved_at"]})
            out.write(json.dumps(r, ensure_ascii=False) + "\n")
        out.flush()
        print("list", p, "/", lp, flush=True)


def parse_detail(h):
    s = BeautifulSoup(h, "lxml")
    art = s.find("article") or s
    def fld(name, multi=False):
        el = art.select_one(".field--name-" + name)
        if not el:
            return [] if multi else None
        items = el.select(".field__item") or [el]
        if multi:
            return [{"text": i.get_text(" ", strip=True), "href": (i.select_one("a") or {}).get("href") if i.select_one("a") else None} for i in items]
        return items[-1].get_text(" ", strip=True)
    body = art.select_one(".field--name-field-body-dalam-html")
    files = [a["href"] for a in art.select("a[href]") if re.search(r"\.(pdf|docx?|xlsx?|zip)(\?|$)", a["href"], re.I)]
    title = s.find("h1")
    return {"judul": title.get_text(" ", strip=True) if title else None,
            "jenis": fld("field-jenis-dokumen"), "nomor": fld("field-nomor-dokumen"),
            "tanggal": fld("field-tanggal-peraturan"), "status": fld("field-status-peraturan"),
            "kategori": [x["text"] for x in fld("field-kategori-peraturan", True)],
            "peraturan_terkait": fld("field-peraturan-terkait", True),
            "tag": [x["text"] for x in fld("field-tag-peraturan", True)],
            "lampiran": files,
            "body_html_len": len(str(body)) if body else 0,
            "body_text": body.get_text("\n", strip=True) if body else ""}


def stage3():
    done = set()
    outp = Path("data/djp_pph_detail.jsonl")
    if outp.exists():
        done = {json.loads(l)["path"] for l in outp.open(encoding="utf8")}
    # KMK kurs & tarif bunga berkala di luar cakupan produk: hanya dihitung dari daftar, detailnya tidak diambil.
    kurs = re.compile(r"nilai\s+kurs\s+sebagai\s+dasar|tarif\s+bunga\s+sebagai\s+dasar|nilai\s+dasar\s+perhitungan\s+bea\s+masuk", re.I)
    paths = []
    for l in open("data/djp_pph_list.jsonl", encoding="utf8"):
        r = json.loads(l)
        p = r["path"]
        if p and p not in paths and not kurs.search(r["judul"]):
            paths.append(p)
    with outp.open("a", encoding="utf8") as out:
        for i, p in enumerate(paths):
            if p in done:
                continue
            try:
                h, m = get(BASE + p)
            except (HostDown, DailyCapReached) as e:
                print("berhenti:", repr(e), flush=True); break
            except Exception as e:
                out.write(json.dumps({"path": p, "error": str(e)}) + "\n"); continue
            slug = p.rstrip("/").split("/")[-1]
            (RAW / (slug + ".html")).write_text(h, encoding="utf8")
            d = parse_detail(h)
            d.update({"path": p, "source_url": m["url"], "retrieved_at": m["retrieved_at"]})
            out.write(json.dumps(d, ensure_ascii=False) + "\n"); out.flush()
            print("detail", i, "/", len(paths), slug[:50], len(d["body_text"]), flush=True)


if __name__ == "__main__":
    for st in sys.argv[1:]:
        {"1": stage1, "2": stage2, "3": stage3}[st]()
