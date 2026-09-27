"""Hitung seluruh angka untuk laporan dari out/korpus_pph.json + data mentah. Tanpa jaringan."""
import json, re, collections, datetime, statistics
from pathlib import Path
import fetch

K = json.load(open("out/korpus_pph.json", encoding="utf8"))
SUB = [d for d in K if d["kategori"] == "substantif"]
R = {}


def jl(p):
    return [json.loads(l) for l in open(p, encoding="utf8")] if Path(p).exists() else []


# ---------- 1. cakupan sumber ----------
djp_list = jl("data/djp_pph_list.jsonl")
kurs_re = re.compile(r"nilai\s+kurs\s+sebagai\s+dasar|tarif\s+bunga\s+sebagai\s+dasar|nilai\s+dasar\s+perhitungan\s+bea\s+masuk", re.I)
djp_kurs = [r for r in djp_list if kurs_re.search(r["judul"])]
djp_sub = [r for r in djp_list if not kurs_re.search(r["judul"])]
jmeta = jl("data/jdih_metadata.jsonl")
jcand = jl("data/jdih_pph_candidates.jsonl")
sub_paths = {r["path"] for r in djp_sub}
det = {d["path"]: d for d in jl("data/djp_pph_detail.jsonl") if not d.get("error") and d["path"] in sub_paths}
R["sumber"] = {
    "djp_kategori": json.load(open("data/djp_kategori_counts.json", encoding="utf8")),
    "djp_pph_baris_daftar": len(djp_list), "djp_pph_url_unik": len({r["path"] for r in djp_list}),
    "djp_pph_kurs": len(djp_kurs), "djp_pph_substantif_baris": len(djp_sub),
    "djp_substantif_url_unik": len({r["path"] for r in djp_sub}),
    "djp_detail_ok": len(det), "djp_detail_gagal": len({d["path"] for d in jl("data/djp_pph_detail.jsonl") if d.get("error")} - set(det)),
    "djp_detail_tanpa_teks": sum(1 for p, d in det.items() if not d.get("body_text")),
    "djp_detail_kurs_terlanjur_diambil": len([d for d in jl("data/djp_pph_detail.jsonl") if not d.get("error") and d["path"] not in sub_paths]),
    "jdih_total_dokumen": len(jmeta), "jdih_kandidat_pph": len(jcand),
    "jdih_detail_terambil": len(jl("data/jdih_pph_detail.jsonl")),
}

# ---------- 2. dokumen gabungan ----------
R["korpus"] = {
    "dokumen_unik": len(K), "substantif": len(SUB), "kurs_berkala": len(K) - len(SUB),
    "hanya_djp": sum(1 for d in SUB if {r["sumber"] for r in d["rekaman"]} == {"DJP"}),
    "hanya_jdih": sum(1 for d in SUB if {r["sumber"] for r in d["rekaman"]} == {"JDIH"}),
    "dua_sumber": sum(1 for d in SUB if len({r["sumber"] for r in d["rekaman"]}) == 2),
    "punya_teks": sum(1 for d in SUB if d["teks"]),
    "tanpa_teks": sum(1 for d in SUB if not d["teks"]),
    "tanpa_teks_hanya_jdih": sum(1 for d in SUB if not d["teks"] and {r["sumber"] for r in d["rekaman"]} == {"JDIH"}),
    "tanpa_teks_djp_detail_gagal": sum(1 for d in SUB if not d["teks"] and any(r.get("detail_error") for r in d["rekaman"])),
    "tanpa_teks_djp_halaman_kosong": sum(1 for d in SUB if not d["teks"] and any(r.get("tanpa_teks") for r in d["rekaman"])),
    "tanpa_teks_tapi_ada_lampiran": sum(1 for d in SUB if not d["teks"] and any(r.get("lampiran") for r in d["rekaman"])),
    "varian_ralat": sum(1 for d in SUB if d["key"][-1] == "ralat"),
    "varian_konsolidasi": sum(1 for d in SUB if d["key"][-1] == "konsolidasi"),
    "kunci_tak_terurai": sum(1 for d in SUB if d["key"][0] == "?"),
}
R["korpus"]["per_jenis"] = collections.Counter(d["key"][0] for d in SUB).most_common()

# ---------- 3. ukuran teks ----------
chars = []
for d in SUB:
    for t in d["teks"]:
        n = len(Path(t["path"]).read_text(encoding="utf8"))
        chars.append(n)
        t["chars"] = n
tot = sum(chars)
R["ukuran"] = {"dokumen_berteks": len([d for d in SUB if d["teks"]]), "total_karakter": tot,
               "total_mb_utf8": round(tot / 1024 / 1024, 1),
               "rata2_karakter": int(statistics.mean(chars)) if chars else 0,
               "median_karakter": int(statistics.median(chars)) if chars else 0,
               "maks_karakter": max(chars) if chars else 0}

# ---------- 4. pemecahan pasal ----------
stru = collections.Counter()
flags = collections.Counter()
pasal_total = 0
for d in SUB:
    for p in d["pecahan"]:
        stru[p["struktur"]] += 1
        pasal_total += p["n_batang_tubuh"]
        for f in p["flags"]:
            flags[f.split(":")[0]] += 1
R["pasal"] = {"unit_batang_tubuh": pasal_total, "struktur": dict(stru), "tanda": dict(flags),
              "dokumen_bertanda": sum(1 for d in SUB if any(p["flags"] for p in d["pecahan"]))}

# ---------- 5. status ----------
st = collections.Counter(d["status"]["nilai"] for d in SUB)
pasangan = collections.Counter()
beda_antar_sumber = []
for d in SUB:
    vals = {c["sumber"]: c["nilai_normal"] for c in d["klaim_status"]}
    if len(vals) == 2 and len(set(vals.values())) > 1:
        pasangan[(vals["JDIH"], vals["DJP"])] += 1
        beda_antar_sumber.append(d)
R["status"] = {
    "nilai": dict(st),
    "dua_sumber_dibandingkan": sum(1 for d in SUB if len({c["sumber"] for c in d["klaim_status"]}) == 2),
    "dua_sumber_sepakat": sum(1 for d in SUB if len({c["sumber"] for c in d["klaim_status"]}) == 2
                              and len({c["nilai_normal"] for c in d["klaim_status"]}) == 1),
    "beda_antar_sumber": len(beda_antar_sumber),
    "pasangan_beda": {f"JDIH={a} vs DJP={b}": n for (a, b), n in pasangan.most_common()},
    "beda_dalam_satu_sumber": sum(1 for d in SUB if any(
        len({c["nilai_normal"] for c in d["klaim_status"] if c["sumber"] == s}) > 1 for s in ("JDIH", "DJP"))),
    "hanya_satu_sumber": sum(1 for d in SUB if len({c["sumber"] for c in d["klaim_status"]}) == 1),
    "bertentangan_dengan_teks": sum(1 for d in SUB if d["dicabut_oleh_teks"] and
                                    any(c["nilai_normal"] == "berlaku" for c in d["klaim_status"])),
}
R["status"]["contoh_beda"] = [{"key": d["key"], "judul": d["judul"][:80],
                               "klaim": [{k: c[k] for k in ("sumber", "nilai_asli", "url", "retrieved_at")} for c in d["klaim_status"]]}
                              for d in beda_antar_sumber[:12]]

# ---------- 6. relasi ----------
nm = sum(1 for d in SUB if d["relasi_teks"]["mencabut"])
ng = sum(1 for d in SUB if d["relasi_teks"]["mengubah"])
judul_perubahan = [d for d in SUB if re.search(r"perubahan", d["judul"] or "", re.I)]
keys = {tuple(d["key"][:3]) for d in K}
tertaut = lambda lst: sum(1 for x in lst if tuple(x["key"]) in keys)
R["relasi"] = {
    "dok_dengan_mencabut": nm, "dok_dengan_mengubah": ng,
    "judul_mengandung_perubahan": len(judul_perubahan),
    "perubahan_terdeteksi": sum(1 for d in judul_perubahan if d["relasi_teks"]["mengubah"]),
    "acuan_mencabut": sum(len(d["relasi_teks"]["mencabut"]) for d in SUB),
    "acuan_mencabut_ketemu_di_korpus": sum(tertaut(d["relasi_teks"]["mencabut"]) for d in SUB),
    "acuan_mengubah": sum(len(d["relasi_teks"]["mengubah"]) for d in SUB),
    "acuan_mengubah_ketemu_di_korpus": sum(tertaut(d["relasi_teks"]["mengubah"]) for d in SUB),
    "djp_peraturan_terkait_terisi": sum(1 for d in SUB if any(r["sumber"] == "DJP" for r in d["relasi_sumber"])),
    "jdih_relasi_terstruktur": sum(1 for d in SUB if any(r["sumber"] == "JDIH" for r in d["relasi_sumber"])),
}

# ---------- 7. antrean periksa manusia ----------
antre = {"status_tidak_pasti": [d for d in SUB if d["status"]["nilai"] == "tidak_pasti"],
         "tanda_struktur": [d for d in SUB if any(p["flags"] for p in d["pecahan"])],
         "tanpa_teks": [d for d in SUB if not d["teks"]],
         "kunci_tak_terurai": [d for d in SUB if d["key"][0] == "?"]}
union = {tuple(map(str, d["key"])) for v in antre.values() for d in v}
R["periksa_manusia"] = {k: len(v) for k, v in antre.items()}
R["periksa_manusia"]["gabungan_unik"] = len(union)
R["periksa_manusia"]["persen_dari_substantif"] = round(100 * len(union) / len(SUB), 1)

# ---------- 8. log jaringan ----------
recs, bad = fetch.read_log()
per_host = collections.Counter(fetch._host_of(r) for r in recs)
pajak = [r for r in recs if fetch._host_of(r) in ("www.pajak.go.id", "pajak.go.id")]
WIB = datetime.timezone(datetime.timedelta(hours=7))
jam = collections.defaultdict(lambda: [0, 0])
for r in pajak:
    h = datetime.datetime.fromisoformat(r["retrieved_at"]).astimezone(WIB).hour
    jam[h][0] += 1
    if fetch._failed(r):
        jam[h][1] += 1
R["jaringan"] = {"total_permintaan": len(recs), "baris_log_rusak": bad, "per_host": dict(per_host),
                 "pajak_total": len(pajak), "pajak_gagal": sum(1 for r in pajak if fetch._failed(r)),
                 "per_jam_wib": {f"{h:02d}": {"permintaan": v[0], "gagal": v[1],
                                              "persen_gagal": round(100 * v[1] / v[0], 1)} for h, v in sorted(jam.items())}}

# ---------- 9. estimasi seluruh pajak ----------
kat = R["sumber"]["djp_kategori"]
total_katalog = kat["Semua"]["perkiraan_dokumen"]
pph_kurs_share = len(djp_kurs)
sub_est = total_katalog - pph_kurs_share
avg = R["ukuran"]["rata2_karakter"]
R["estimasi_seluruh_pajak"] = {
    "katalog_djp_semua_kategori": total_katalog,
    "dikurangi_kurs_bunga_berkala": pph_kurs_share,
    "perkiraan_dokumen_substantif": sub_est,
    "rata2_karakter_per_dokumen_dari_sampel_pph": avg,
    "perkiraan_teks_mb": round(sub_est * avg / 1024 / 1024, 1),
    "perkiraan_teks_mb_rentang": [round(sub_est * avg * 0.7 / 1024 / 1024, 1), round(sub_est * avg * 1.5 / 1024 / 1024, 1)],
    "catatan": "Asumsi: (a) semua KMK kurs/bunga terdaftar di kategori PPh sehingga dikurangkan sekali; "
               "(b) rata-rata panjang teks kategori lain sama dengan PPh; (c) belum termasuk SE DJP (tidak ada di katalog) "
               "dan dokumen yang hanya ada di JDIH; (d) 1 karakter = 1 byte UTF-8 untuk teks Indonesia (hampir semua ASCII).",
}

json.dump(R, open("out/metrik.json", "w", encoding="utf8"), ensure_ascii=False, indent=1, default=str)
print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
