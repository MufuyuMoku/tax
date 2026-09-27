"""Pilih kandidat dokumen PPh dari metadata JDIH. Alasan pemilihan dicatat per dokumen."""
import json, re, sys

RE_JUDUL = re.compile(
    r"pajak\s+penghasilan|pajak\s+pengasilan|\bpph\b|penghasilan\s+tidak\s+kena\s+pajak|penghasilan\s+kena\s+pajak|"
    r"pemotongan\s+pajak\s+penghasilan|norma\s+penghitungan\s+penghasilan|penghasilan\s+neto|"
    r"harga\s+transfer|transfer\s+pricing|kesepakatan\s+harga\s+transfer|tax\s+holiday|pengurangan\s+pajak\s+penghasilan|"
    r"fasilitas\s+pajak\s+penghasilan|penyusutan\s+harta|super\s+deduction|dividen|bunga\s+obligasi|natura|imbalan\s+bunga\s+.*penghasilan|"
    r"pajak\s+atas\s+(bunga|dividen|hadiah|penghasilan)|tarif\s+efektif\s+rata|penghindaran\s+pajak\s+berganda|p3b",
    re.I)
RE_LABEL = re.compile(r"pajak\s+penghasilan|\bpph\b|pasal\s+(21|22|23|25|26|4\s*ayat)", re.I)


class MissingLabelField(Exception):
    """The `label` field is gone from the committed metadata, so this script cannot run truthfully."""


def pick(d):
    if "label" not in d:
        raise MissingLabelField(
            "data/jdih_metadata.jsonl tidak lagi memuat bidang 'label'. Klasifikasi sumber sengaja "
            "dihapus dari berkas yang di-commit (lihat K-010 di docs/DECISIONS.md), sehingga "
            "pemilihan ini tidak bisa diulang di sini tanpa menghasilkan daftar yang lebih sedikit "
            "secara diam-diam. Hasil pemilihan yang sah sudah tersimpan di "
            "data/jdih_pph_candidates.jsonl. Untuk menjalankan ulang, pakai salinan penuh di luar repo."
        )
    why = []
    if RE_JUDUL.search(d.get("judul") or ""):
        why.append("judul")
    if any(RE_LABEL.search(l or "") for l in d.get("label") or []):
        why.append("label")
    return why


if __name__ == "__main__":
    rows = [json.loads(l) for l in open("data/jdih_metadata.jsonl", encoding="utf8")]
    picked = []
    for d in rows:
        why = pick(d)  # raises MissingLabelField before anything is written
        if why:
            picked.append({"slug": d["slug"], "nomor": d["nomor"], "bentuk": d["bentuk"], "judul": d["judul"],
                           "status": d["status"], "label": d["label"], "alasan": why})
    with open("data/jdih_pph_candidates.jsonl", "w", encoding="utf8") as out:
        for r in picked:
            out.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(len(picked))
