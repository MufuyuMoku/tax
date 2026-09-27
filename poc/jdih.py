"""Pembaca halaman JDIH Kemenkeu (Next.js RSC): ekstrak payload JSON dari self.__next_f."""
import json, re
from fetch import get

BASE = "https://jdih.kemenkeu.go.id"


def rsc_payload(html):
    parts = re.findall(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)', html)
    return "".join(json.loads('"' + p + '"') for p in parts)


def find_json_objects(text, key):
    """Cari objek JSON yang memuat '"key":' dan kembalikan hasil parse-nya (objek terluar terdekat)."""
    out = []
    dec = json.JSONDecoder()
    for m in re.finditer(r'"%s":' % re.escape(key), text):
        # mundur ke '{' pembuka yang bisa di-parse
        i = m.start()
        depth = 0
        j = i
        while j > 0:
            j -= 1
            c = text[j]
            if c == '}':
                depth += 1
            elif c == '{':
                if depth == 0:
                    try:
                        obj, end = dec.raw_decode(text, j)
                        if end > i:
                            out.append(obj)
                            break
                    except ValueError:
                        pass
                else:
                    depth -= 1
    return out


def search(params):
    html, meta = get(BASE + "/search", params=params)
    p = rsc_payload(html)
    res = find_json_objects(p, "pageCount")
    return res, p, meta
