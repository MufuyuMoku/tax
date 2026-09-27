"""Gabungkan korpus PPh dari JDIH + DJP, pecah per pasal, tentukan status & relasi, hitung metrik.

Aturan status:
- Setiap klaim status disimpan apa adanya beserta sumber, URL, dan tanggal ambil.
- Nilai dinormalkan; bila klaim-klaim (antar sumber ATAU dalam satu sumber) berbeda -> "tidak_pasti", tidak memilih.
- Klaim kosong -> "tidak_pasti".
- Bila teks peraturan lain dalam korpus menyatakan dokumen ini dicabut sedangkan klaim sumber "berlaku" -> "tidak_pasti".
- Tidak pernah menyimpulkan "berlaku" tanpa klaim sumber.
"""
import json, re, collections
from pathlib import Path
import pasal, relasi
from ident import ident

NORM = {"berlaku": "berlaku", "aktif": "berlaku", "tidak berlaku": "tidak_berlaku", "dicabut": "tidak_berlaku",
        "tetap": "tetap", "diubah/disempurnakan/dicabut sebagian": "diubah_atau_dicabut_sebagian",
        "diubah/disempurnakan dan sudah dicabut": "tidak_berlaku"}
OUT = Path("out"); OUT.mkdir(exist_ok=True)
BASE_DJP = "https://www.pajak.go.id"
RE_KURS = re.compile(r"nilai\s+kurs\s+sebagai\s+dasar|tarif\s+bunga\s+sebagai\s+dasar|nilai\s+dasar\s+perhitungan\s+bea\s+masuk", re.I)


def jl(p):
    return [json.loads(l) for l in open(p, encoding="utf8")] if Path(p).exists() else []


def main():
    docs = collections.OrderedDict()  # key -> merged doc

    def varian(judul):
        j = (judul or "").upper()
        if j.startswith("RALAT"):
            return "ralat"
        if "SUSUNAN DALAM SATU NASKAH" in j or "NASKAH KONSOLIDASI" in j:
            return "konsolidasi"
        return None

    def slot(key, fallback, judul=None):
        k = key or ("?",) + (fallback,)
        v = varian(judul)
        if v:
            k = tuple(k) + (v,)
        if k not in docs:
            docs[k] = {"key": list(k), "rekaman": [], "klaim_status": [], "teks": [], "relasi_sumber": []}
        return docs[k]

    # --- JDIH: semua kandidat PPh dari metadata daftar (status dari kartu daftar); teks bila detail sempat diambil
    jdet = {d["slug"]: d for d in jl("data/jdih_pph_detail.jsonl") if not d.get("error")}
    jmeta = {d["slug"]: d for d in jl("data/jdih_metadata.jsonl")}
    for c in jl("data/jdih_pph_candidates.jsonl"):
        m = jmeta[c["slug"]]
        if RE_KURS.search(m.get("judul") or ""):
            continue  # di luar cakupan produk
        d = jdet.get(c["slug"], {})
        url = "https://jdih.kemenkeu.go.id/dok/" + c["slug"]
        key = ident(m.get("bentuk"), m.get("nomor"))
        s = slot(key, "jdih:" + c["slug"], m.get("judul"))
        s["rekaman"].append({"sumber": "JDIH", "url": url, "retrieved_at": m.get("_retrieved_at"),
                             "nomor": m.get("nomor"), "judul": m.get("judul"), "jenis": m.get("bentuk"),
                             "alasan_pilih": c.get("alasan"), "detail_diambil": bool(d)})
        s["klaim_status"].append({"sumber": "JDIH", "nilai_asli": m.get("status"), "url": url,
                                  "retrieved_at": m.get("_retrieved_at"), "dari": m.get("_source_list_url")})
        for r in d.get("relasi") or []:
            s["relasi_sumber"].append({"sumber": "JDIH", **r, "key": ident(None, r.get("nomor") or "")})
        tp = Path("text/jdih") / (c["slug"] + ".txt")
        if d and tp.exists():
            s["teks"].append({"sumber": "JDIH", "path": str(tp), "format": d.get("format", "pdf"),
                              "url": d.get("pdf_url") or d.get("html_url"),
                              "retrieved_at": d.get("pdf_retrieved_at") or d.get("html_retrieved_at")})
    # --- DJP: semua baris daftar PPh (status dari daftar); detail menambah teks & status halaman detail
    TD = Path("text/djp"); TD.mkdir(parents=True, exist_ok=True)
    ddet = {}
    for d in jl("data/djp_pph_detail.jsonl"):
        if d.get("error"):
            ddet.setdefault(d["path"], d)
        else:
            ddet[d["path"]] = d
    for row in jl("data/djp_pph_list.jsonl"):
        if not row.get("path") or RE_KURS.search(row.get("judul") or ""):
            continue
        d = ddet.get(row["path"], {"error": "detail belum diambil"})
        url = BASE_DJP + row["path"]
        key = ident(row.get("jenis"), row.get("nomor"))
        s = slot(key, "djp:" + row["path"], row.get("judul"))
        if any(r.get("url") == url for r in s["rekaman"]):
            continue  # baris daftar ganda untuk URL yang sama
        s["rekaman"].append({"sumber": "DJP", "url": url, "retrieved_at": d.get("retrieved_at") or row["_retrieved_at"],
                             "nomor": row.get("nomor"), "judul": row.get("judul"), "jenis": row.get("jenis"),
                             "detail_error": d.get("error"), "tanpa_teks": (not d.get("error")) and not d.get("body_text"),
                             "lampiran": d.get("lampiran") or []})
        s["klaim_status"].append({"sumber": "DJP", "nilai_asli": row.get("status"), "url": url,
                                  "retrieved_at": row["_retrieved_at"], "dari": row["_list_url"]})
        for r in d.get("peraturan_terkait") or []:
            s["relasi_sumber"].append({"sumber": "DJP", "nama": "Peraturan Terkait (tanpa jenis relasi)", **r})
        if d.get("body_text"):
            tp = TD / (row["path"].rstrip("/").split("/")[-1] + ".txt")
            tp.write_text(d["body_text"], encoding="utf8")
            s["teks"].append({"sumber": "DJP", "path": str(tp), "format": "html", "url": url,
                              "retrieved_at": d["retrieved_at"]})

    # --- pecah pasal + relasi dari teks
    dicabut_oleh = collections.defaultdict(list)
    diubah_oleh = collections.defaultdict(list)
    for k, s in docs.items():
        judul = next((r["judul"] for r in s["rekaman"] if r.get("judul")), "")
        s["judul"] = judul
        # Kategori tersendiri: penetapan kurs & tarif bunga berkala (mingguan/bulanan). Disimpan, tetapi
        # dipisahkan dari semua angka analisis aturan substantif.
        s["kategori"] = "kurs_bunga_berkala" if RE_KURS.search(judul) else "substantif"
        s["pecahan"] = []
        rel_all = {"mengubah": [], "mencabut": []}
        for t in s["teks"]:
            txt = Path(t["path"]).read_text(encoding="utf8")
            r = pasal.split(txt)
            body = [p for p in r["pasal"] if p["bagian"] == "batang_tubuh"]
            rl = relasi.extract(judul, txt, body)
            for typ in rl:
                for x in rl[typ]:
                    if list(x["key"]) in [y["key"] for y in rel_all[typ]]:
                        continue
                    item = {"key": list(x["key"]), "teks": x["teks"], "dari_teks": t["sumber"]}
                    ok = relasi.boleh_mencabut(s["key"][0], x["key"][0])
                    if ok is False:
                        # mis. PMK "mencabut" UU: mustahil secara hierarki -> rujukan salah tangkap
                        item["ditolak"] = "hierarki: " + s["key"][0] + " tidak dapat mencabut/mengubah " + x["key"][0]
                    rel_all[typ].append(item)
            s["pecahan"].append({"sumber": t["sumber"], "struktur": r["struktur"], "n_batang_tubuh": r["n_batang_tubuh"],
                                 "n_penjelasan": r["n_penjelasan"], "flags": r["flags"], "chars": r["chars"]})
            pj = OUT / "pasal" / t["sumber"].lower()
            pj.mkdir(parents=True, exist_ok=True)
            (pj / (Path(t["path"]).stem + ".json")).write_text(json.dumps(
                {"key": s["key"], "judul": judul, "sumber_teks": t, **r}, ensure_ascii=False), encoding="utf8")
        s["relasi_teks"] = rel_all
        for x in rel_all["mencabut"]:
            if not x.get("ditolak"):
                dicabut_oleh[tuple(x["key"])].append(list(k))
        for x in rel_all["mengubah"]:
            if not x.get("ditolak"):
                diubah_oleh[tuple(x["key"])].append(list(k))

    # --- status
    for k, s in docs.items():
        vals = []
        for c in s["klaim_status"]:
            v = (c["nilai_asli"] or "").strip().lower()
            c["nilai_normal"] = NORM.get(v, "kosong" if not v else "lain:" + v)
            vals.append(c["nilai_normal"])
        s["dicabut_oleh_teks"] = dicabut_oleh.get(k, [])
        s["diubah_oleh_teks"] = diubah_oleh.get(k, [])
        uniq = sorted(set(vals))
        alasan = []
        if not uniq:
            alasan.append("tidak ada klaim status")
        elif "kosong" in uniq:
            alasan.append("status kosong di sumber")
        if len(uniq) > 1:
            src = {c["sumber"] for c in s["klaim_status"]}
            alasan.append("status berbeda " + ("antar sumber" if len(src) > 1 else "dalam satu sumber (rekaman ganda)"))
        if s["dicabut_oleh_teks"] and any(v == "berlaku" for v in uniq):
            alasan.append("sumber menyatakan berlaku, tetapi teks " + ", ".join(" ".join(x) for x in s["dicabut_oleh_teks"]) + " mencabutnya")
        if alasan:
            s["status"] = {"nilai": "tidak_pasti", "alasan": alasan}
        else:
            s["status"] = {"nilai": uniq[0], "alasan": [],
                           "catatan": "hanya satu sumber" if len({c["sumber"] for c in s["klaim_status"]}) == 1 else "disepakati JDIH & DJP"}

    json.dump(list(docs.values()), open(OUT / "korpus_pph.json", "w", encoding="utf8"), ensure_ascii=False, indent=1, default=list)
    print("dokumen:", len(docs))


if __name__ == "__main__":
    main()
