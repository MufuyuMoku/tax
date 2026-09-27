"""Normalisasi identitas peraturan: (jenis, nomor, tahun) dari berbagai gaya penulisan nomor."""
import re

JENIS_MAP = [
    (r"undang.undang dasar", "UUD"), (r"pengganti undang|perpu|perppu", "PERPU"), (r"undang.undang", "UU"),
    (r"peraturan pemerintah", "PP"), (r"peraturan presiden", "PERPRES"), (r"keputusan presiden", "KEPPRES"),
    (r"instruksi presiden", "INPRES"),
    (r"peraturan menteri keuangan|^peraturan menteri$", "PMK"), (r"keputusan menteri keuangan|^keputusan menteri$", "KMK"),
    (r"peraturan dirjen pajak|peraturan direktur jenderal pajak", "PER-DJP"),
    (r"keputusan dirjen pajak|keputusan direktur jenderal pajak", "KEP-DJP"),
    (r"surat edaran", "SE"), (r"instruksi dirjen pajak", "INS-DJP"), (r"nota dinas", "ND-DJP"),
    (r"peraturan unit eselon i", "PER-ESELON1"), (r"keputusan unit eselon i", "KEP-ESELON1"),
    (r"peraturan bersama", "PERBER"), (r"keputusan bersama", "KEPBER"),
]


def jenis_code(jenis, nomor=""):
    j = (jenis or "").lower().strip()
    n = (nomor or "").upper()
    # nomor sering lebih informatif daripada jenis
    if re.match(r"^\s*SE[\s-]", n):
        return "SE"
    if re.match(r"^\s*(PER|PERDJP)[\s-]", n) and "/PJ" in n:
        return "PER-DJP"
    if re.match(r"^\s*KEP[\s-]", n) and "/PJ" in n:
        return "KEP-DJP"
    for pat, code in JENIS_MAP:
        if re.search(pat, j):
            return code
    if "/PMK" in n or n.startswith("PMK"):
        return "PMK"
    if "/KMK" in n or "/KM" in n or n.startswith("KMK"):
        return "KMK"
    return j.upper() or "?"


def ident(jenis, nomor):
    """Kembalikan kunci ('PMK', '168', '2023') atau None bila tidak bisa diurai."""
    n = (nomor or "").upper().replace(" ", " ")
    code = jenis_code(jenis, n)
    # "PMK 64 TAHUN 2026", "7 TAHUN 1983", "UU 24 TAHUN 2004"
    m = re.search(r"(\d+[A-Z]?)\s+TAHUN\s+(\d{4})", n)
    if m:
        return (code, m.group(1).lstrip("0") or "0", m.group(2))
    # "168/PMK.010/2023", "329/KM.1/2007", "PER-16/PJ/2016", "SE-16/PJ.4/1995", "KEP-185/PJ/2026"
    m = re.search(r"(?:PER|KEP|SE|PERDJP)?[\s-]*(\d+[A-Z]?)\s*/\s*([A-Z][A-Z.0-9]*(?:\s*/\s*[A-Z.0-9]+)*?)\s*/\s*(\d{4})", n)
    if m:
        no = m.group(1).lstrip("0") or "0"
        if code == "KMK":  # nomor KMK berulang antar seri (KM.1, MK/EF.2, KMK.04, ...): seri ikut jadi kunci
            seri = re.sub(r"\s+", "", m.group(2))
            return (code, no + "/" + seri, m.group(3))
        return (code, no, m.group(3))
    m = re.search(r"(\d+)\D+(\d{4})\s*$", n)
    if m:
        return (code, m.group(1).lstrip("0") or "0", m.group(2))
    return None


if __name__ == "__main__":
    for j, n in [("Peraturan Menteri", "PMK 64 TAHUN 2026"), ("Undang-Undang", "7 TAHUN 1983"),
                 ("Keputusan Menteri Keuangan", "329/KM.1/2007"), ("Peraturan Dirjen Pajak", "PER-16/PJ/2016"),
                 ("Peraturan Unit Eselon I", "PerDJP 52/PJ/2008"), ("Lainnya", "SE SE-16/PJ.4/1995"),
                 ("Peraturan Menteri", "111/PMK.03/2010"), ("Keputusan Dirjen Pajak", "KEP-185/PJ/2026"),
                 ("Peraturan Menteri Keuangan", "168 TAHUN 2023"), ("Keputusan Menteri", "1228/KMK.011/1984")]:
        print(n, "->", ident(j, n))
