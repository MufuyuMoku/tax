"""OCR halaman PDF hasil pindai dengan RapidOCR (ONNX, lokal). Mengembalikan teks + skor keyakinan."""
import sys, json, statistics
import numpy as np
import pymupdf
from rapidocr_onnxruntime import RapidOCR

_eng = None


def engine():
    global _eng
    if _eng is None:
        _eng = RapidOCR()
    return _eng


def ocr_page(page, dpi=200):
    pix = page.get_pixmap(dpi=dpi)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
    if pix.n == 4:
        img = img[:, :, :3]
    res, _ = engine()(img)
    if not res:
        return "", []
    # urutkan per baris: kelompokkan menurut y tengah
    boxes = sorted(res, key=lambda r: (round(((r[0][0][1] + r[0][2][1]) / 2) / 15), r[0][0][0]))
    lines, cur, cur_y = [], [], None
    for b in boxes:
        y = (b[0][0][1] + b[0][2][1]) / 2
        if cur_y is not None and abs(y - cur_y) > 12:
            lines.append(" ".join(x[1] for x in sorted(cur, key=lambda r: r[0][0][0]))); cur = []
        cur.append(b); cur_y = y
    if cur:
        lines.append(" ".join(x[1] for x in sorted(cur, key=lambda r: r[0][0][0])))
    return "\n".join(lines), [float(b[2]) for b in res]


def ocr_pdf(path, pages=None):
    out = []
    with pymupdf.open(path) as d:
        for i, pg in enumerate(d):
            if pages is not None and i not in pages:
                continue
            txt, conf = ocr_page(pg)
            out.append({"page": i, "text": txt, "n_boxes": len(conf),
                        "conf_mean": round(statistics.mean(conf), 3) if conf else None,
                        "conf_low_frac": round(sum(c < 0.8 for c in conf) / len(conf), 3) if conf else None})
    return out


if __name__ == "__main__":
    r = ocr_pdf(sys.argv[1], pages=set(range(int(sys.argv[2]))) if len(sys.argv) > 2 else None)
    print(json.dumps(r, ensure_ascii=False, indent=1))
