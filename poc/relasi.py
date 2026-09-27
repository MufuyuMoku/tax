"""Ekstraksi relasi dari teks peraturan: mencabut & mengubah."""
import re
from ident import ident

JENIS_REF = (r"(Undang-[Uu]ndang|Peraturan Pemerintah Pengganti Undang-[Uu]ndang|Peraturan Pemerintah|Peraturan Presiden|"
             r"Keputusan Presiden|Peraturan Menteri Keuangan|Keputusan Menteri Keuangan|"
             r"Peraturan Direktur Jenderal Pajak|Keputusan Direktur Jenderal Pajak|Surat Edaran Direktur Jenderal Pajak)")
RE_REF = re.compile(JENIS_REF + r"\s+(?:Republik Indonesia\s+)?Nomor\s*:?\s*([A-Z]*[-\s]?\d+[A-Z]?(?:\s*/\s*[A-Z][A-Za-z.0-9]*)*(?:\s*/\s*\d{4})?)(\s+Tahun\s+\d{4})?", re.S | re.I)
RE_CABUT = re.compile(r"(dicabut\s+dan\s+dinyatakan\s+tidak\s+berlaku|dinyatakan\s+tidak\s+berlaku|dicabut)", re.I)


def refs(s):
    out = []
    for m in RE_REF.finditer(s):
        jenis, nomor, tahun = m.group(1), m.group(2), (m.group(3) or "")
        k = ident(jenis, (nomor + tahun).replace("\n", " "))
        if k:
            out.append({"key": k, "teks": m.group(0)[:120].replace("\n", " ")})
    return out


def sentences(t):
    t = re.sub(r"\s+", " ", t)
    return re.split(r"(?<=[;.])\s+(?=[A-Z0-9a-z])", t)


def extract(judul, text, pasal_body):
    """judul: judul dokumen; text: teks penuh; pasal_body: list pasal batang tubuh dari pasal.split()."""
    rel = {"mengubah": [], "mencabut": []}
    # Mengubah: dari judul "Perubahan (Kedua) atas X Nomor ..."
    if re.search(r"perubahan", judul or "", re.I):
        head = (text or "")[:3000]
        m = re.search(r"PERUBAHAN.{0,40}?ATAS(.{0,600})", head, re.I | re.S)
        if m:
            rs = refs(m.group(1))
            if rs:
                rel["mengubah"].append(rs[0])
    # Mencabut: per ayat di pasal-pasal terakhir; rujukan yang muncul sebelum kata 'dicabut'
    chunks = [p["teks"] for p in pasal_body[-4:]] if pasal_body else [(text or "")[-6000:]]
    for c in chunks:
        c = re.sub(r"\s+", " ", c)
        for ayat in re.split(r"\s\(\d+[a-z]?\)\s", c):
            last = None
            for last in RE_CABUT.finditer(ayat):
                pass
            if not last:
                continue
            for r in refs(ayat[:last.start()]):
                if r["key"] not in [x["key"] for x in rel["mencabut"]]:
                    rel["mencabut"].append(r)
    return rel


# Hierarki peraturan: yang lebih rendah tidak dapat mencabut/mengubah yang lebih tinggi.
RANK = {"UUD": 0, "TAP MPR": 1, "UU": 2, "PERPU": 2, "PP": 3, "PERPRES": 4, "KEPPRES": 4, "INPRES": 4,
        "PMK": 5, "KMK": 5, "PERBER": 5, "KEPBER": 5,
        "PER-DJP": 6, "KEP-DJP": 6, "INS-DJP": 6, "SE": 7, "ND-DJP": 7,
        "PER-ESELON1": 6, "KEP-ESELON1": 6}


def boleh_mencabut(pencabut_kode, sasaran_kode):
    """True bila secara hierarki mungkin; None bila salah satu kode tak dikenal."""
    a, b = RANK.get(pencabut_kode), RANK.get(sasaran_kode)
    if a is None or b is None:
        return None
    return a <= b
