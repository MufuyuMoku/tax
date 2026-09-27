"""Pemecah teks peraturan menjadi pasal, plus pemeriksaan mutu urutan pasal.

Konvensi penyusunan peraturan: peraturan perubahan memakai pasal bernomor Romawi.
  Pasal I  -> memuat ketentuan peraturan lain yang diubah (dikutip, termasuk judul "Pasal N" milik peraturan yang diubah)
  Pasal II -> ketentuan penutup
Judul "Pasal N" di dalam Pasal I BUKAN pasal milik peraturan perubahan; disimpan sebagai daftar perubahan.
Label pasal tidak pernah diubah otomatis; pola janggal ditandai untuk diperiksa manusia.
"""
import re

ROMAWI = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10}
RE_PASAL = re.compile(r"^\s*pasal\s+(\d{1,3}\s?[A-Z]?|[IVX]{1,5})\s*$", re.I | re.M)
RE_PENJELASAN = re.compile(r"^\s*PENJELASAN\s*$|^\s*PENJELASAN\s+ATAS\b", re.M)
# "1. Ketentuan Pasal 4 ayat (2) diubah ...", "3. Di antara Pasal 9 dan Pasal 10 disisipkan 1 (satu) pasal, yakni Pasal 9A"
RE_ANGKA = re.compile(r"^\s*(\d{1,3})\.\s+(?=(?:Ketentuan|Di antara|Pasal|Penjelasan|Lampiran|Judul|Bab|Bagian|Diantara)\b)", re.M)


RE_DIKTUM = re.compile(r"^\s*(KESATU|KEDUA|KETIGA|KEEMPAT|KELIMA|KEENAM|KETUJUH|KEDELAPAN|KESEMBILAN|KESEPULUH|"
                       r"KESEBELAS|KEDUA\s?BELAS|KETIGA\s?BELAS|KEEMPAT\s?BELAS|KELIMA\s?BELAS)\s*:?", re.M)


def normalize(t):
    t = t.replace(" ", " ").replace("\f", "\n")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"(?im)^\s*pasal\s*\n\s*(\d{1,3}[A-Z]?)\s*$", r"Pasal \1", t)
    return t


def lab(m):
    return re.sub(r"\s+", "", m.group(1)).upper()


def is_roman(l):
    return l in ROMAWI


def split(text):
    t = normalize(text)
    pj = RE_PENJELASAN.search(t)
    body_end = pj.start() if pj else len(t)
    ms = list(RE_PASAL.finditer(t))
    body_ms = [m for m in ms if m.start() < body_end]
    pen_ms = [m for m in ms if m.start() >= body_end]
    labels = [lab(m) for m in body_ms]
    romans = [l for l in labels if is_roman(l)]
    flags = []

    # Struktur perubahan: minimal Pasal I dan Pasal II berurutan di batang tubuh
    struktur = "biasa"
    if "I" in romans and "II" in romans and labels.index("I") < labels.index("II"):
        struktur = "perubahan"
    elif romans:
        flags.append("anomali_romawi:" + ",".join(romans))  # mis. hanya "Pasal I" lalu 2,3,...: periksa manusia

    parts = []
    if struktur == "perubahan":
        top = [m for m in body_ms if is_roman(lab(m))]
        for i, m in enumerate(top):
            end = top[i + 1].start() if i + 1 < len(top) else body_end
            seg = t[m.start():end]
            item = {"pasal": lab(m), "bagian": "batang_tubuh", "offset": m.start(), "teks": seg.strip()}
            if lab(m) == "I":
                item["perubahan"] = perubahan(seg)
                item["pasal_dikutip"] = [lab(x) for x in RE_PASAL.finditer(seg) if not is_roman(lab(x))]
            parts.append(item)
    else:
        for i, m in enumerate(body_ms):
            end = body_ms[i + 1].start() if i + 1 < len(body_ms) else body_end
            parts.append({"pasal": lab(m), "bagian": "batang_tubuh", "offset": m.start(), "teks": t[m.start():end].strip()})
        flags += check([p["pasal"] for p in parts])
    for i, m in enumerate(pen_ms):
        end = pen_ms[i + 1].start() if i + 1 < len(pen_ms) else len(t)
        parts.append({"pasal": lab(m), "bagian": "penjelasan", "offset": m.start(), "teks": t[m.start():end].strip()})
    body = [p for p in parts if p["bagian"] == "batang_tubuh"]
    if not body:
        # Keputusan (KMK/KEP) memakai diktum KESATU, KEDUA, ... bukan pasal
        dk = list(RE_DIKTUM.finditer(t, 0, body_end))
        for i, m in enumerate(dk):
            end = dk[i + 1].start() if i + 1 < len(dk) else body_end
            parts.insert(i, {"pasal": m.group(1).upper(), "bagian": "batang_tubuh", "offset": m.start(),
                             "teks": t[m.start():end].strip()})
        if dk:
            struktur = "diktum"
        else:
            flags.append("tidak_ada_pasal")
        body = [p for p in parts if p["bagian"] == "batang_tubuh"]
    return {"struktur": struktur, "pasal": parts, "n_batang_tubuh": len(body),
            "n_penjelasan": len(parts) - len(body), "ada_penjelasan": bool(pj), "flags": flags, "chars": len(t)}


def perubahan(seg):
    """Pecah isi Pasal I menjadi butir perubahan bernomor (angka 1., 2., ...)."""
    ms = list(RE_ANGKA.finditer(seg))
    out = []
    for i, m in enumerate(ms):
        end = ms[i + 1].start() if i + 1 < len(ms) else len(seg)
        txt = seg[m.start():end].strip()
        head = txt[:300]
        target = re.findall(r"Pasal\s+(\d{1,3}[A-Z]?)", head)
        aksi = re.search(r"\b(diubah|dihapus|disisipkan|ditambahkan|ditambah)\b", head, re.I)
        out.append({"angka": int(m.group(1)), "pasal_sasaran": target[:3], "aksi": aksi.group(1).lower() if aksi else None,
                    "teks": txt})
    return out


def num(label):
    m = re.match(r"(\d+)([A-Z]?)", label)
    return (int(m.group(1)), m.group(2)) if m else (None, "")


def check(labels):
    flags = []
    nums = [num(l) for l in labels if not is_roman(l)]
    arabic = [n for n, suf in nums if n is not None and suf == ""]
    if arabic and arabic[0] != 1 and not (labels and is_roman(labels[0]) and arabic[0] == 2):
        flags.append("tidak_mulai_dari_1")
    gaps = [(a, b) for a, b in zip(arabic, arabic[1:]) if b != a + 1]
    if gaps:
        flags.append("urutan_loncat:" + ",".join(f"{a}->{b}" for a, b in gaps[:5]))
    if len(set(labels)) != len(labels):
        flags.append("pasal_ganda")
    return flags
