"""Fetch from JDIH Kemenkeu (M5), resumable, with its own limit and state in harvest/jdih/ (K-054).

    .venv/Scripts/python -m pipeline.jdih_harvest jalan --tanpa-vpn
    .venv/Scripts/python -m pipeline.jdih_harvest kemajuan

Queues, in this order (owner, 2026-10-05):
    a. KUP: the document page of every KUP document in the DJP list that JDIH also has, for JDIH's
       own status claim (validity period, revocations);
    b. PPN: the same for the PPN documents in the DJP list fetched so far;
    c. PPh: the document page and the full-text file of the PPh documents only JDIH has.
Which DJP document is which JDIH document is decided by the number, as in pipeline.build.

Every rule of SPEC section 8 holds (polite.py). The first refusal of any kind stops JDIH for good;
the owner asked for no retry after one, so here a dropped connection stops JDIH for good as well.
Source classification ("Label") is never kept (K-010). harvest/BERHENTI ends the round cleanly.
"""
import argparse
import json
import re
import sys

from . import config, net_guard
from .identity import parse
from .polite import CapReached, Fetcher, HostStopped, RoundOver, TransientError, now

BASE = "https://jdih.kemenkeu.go.id"
ROOT = config.HARVEST / "jdih"
DETAIL_OUT = ROOT / "jdih_detail.jsonl"
FILES = ROOT / "files"  # downloaded full-text files; not committed, text is extracted at build
STOP_SIGNAL = config.HARVEST / "BERHENTI"
DJP_LIST = config.HARVEST / "djp_list.jsonl"


def read_jsonl(path):
    if not path.exists():
        return []
    with path.open(encoding="utf8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def append_jsonl(path, record):
    with path.open("a", encoding="utf8", newline="\n") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")


# ---------- page data, from poc/jdih.py and poc/jdih_docs.py ----------
def rsc_payload(html):
    parts = re.findall(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)', html)
    return "".join(json.loads('"' + p + '"') for p in parts)


def find_json_objects(text, key):
    out = []
    decoder = json.JSONDecoder()
    for match in re.finditer(r'"%s":' % re.escape(key), text):
        i = match.start()
        depth, j = 0, i
        while j > 0:
            j -= 1
            c = text[j]
            if c == "}":
                depth += 1
            elif c == "{":
                if depth == 0:
                    try:
                        obj, end = decoder.raw_decode(text, j)
                        if end > i:
                            out.append(obj)
                            break
                    except ValueError:
                        pass
                else:
                    depth -= 1
    return out


def clean(value):
    if isinstance(value, str) and value.startswith("$D"):
        return value[2:]
    if isinstance(value, str) and value in ("$undefined", "null"):
        return None
    return value


def parse_document(html):
    payload = rsc_payload(html)
    objects = [o for o in find_json_objects(payload, "Relasi") if "PUU" in o]
    if not objects:
        return None
    o = max(objects, key=lambda x: len(json.dumps(x)))
    puu = o.get("PUU") or {}
    period = re.search(r'"children":"Tanggal Berlaku"\}\],\["\$","div",null,\{"className":"col-8","children":\["\$","span",null,\{"children":"([^"]*)"', payload)
    # "Label" is the source's classification: deliberately not kept (K-010).
    return {
        "nomor": o.get("Nomor"), "judul": o.get("Judul"), "jenis": (o.get("Jenis") or {}).get("Keterangan"),
        "no": puu.get("No"), "tahun": puu.get("Tahun"),
        "tgl_penetapan": clean(puu.get("TglPenetapan")), "tgl_pengundangan": clean(puu.get("TglPengundangan")),
        "tgl_mulai_berlaku": clean(puu.get("TglMulaiBerlaku")), "tgl_selesai_berlaku": clean(puu.get("TglSelesaiBerlaku")),
        "masa_berlaku_tampil": period.group(1) if period else None,
        "relasi": [{"kode": r.get("KodeRelasi"), "jenis": r.get("Jenis"), "nama": r.get("Nama"), "nomor": r.get("Nomor"),
                    "judul": r.get("Judul"), "slug": r.get("Slug"), "tgl": clean(r.get("TglMulaiBerlaku")),
                    "ket": r.get("Keterangan")} for r in o.get("Relasi") or []],
        "files": [{"jenis": f.get("Jenis"), "ket": f.get("Keterangan"), "id": f["MediaCatalog"]["Id"],
                   "nama": f["MediaCatalog"].get("FileName") or ""} for f in o.get("File") or [] if f.get("MediaCatalog")],
    }


# ---------- queues ----------
def jdih_listing():
    """JDIH documents by number key, from the proof of concept's full JDIH listing (2026-09-21)."""
    by_key, by_slug = {}, {}
    for row in read_jsonl(config.IN_JDIH_META):
        by_slug[row["slug"]] = row
        key = parse(row.get("bentuk"), row.get("nomor"), row.get("judul"))
        if key:
            by_key.setdefault(key, row)
    return by_key, by_slug


def queues():
    by_key, by_slug = jdih_listing()
    out = {"KUP": [], "PPN": [], "PPh": []}
    out_of_scope = re.compile(config.OUT_OF_SCOPE_TITLE, re.I)
    for row in read_jsonl(DJP_LIST):
        name = row["_kategori_daftar"]
        if out_of_scope.search(row.get("judul") or ""):
            continue  # weekly exchange-rate and interest-rate decrees (SPEC section 3)
        key = parse(row.get("jenis"), row.get("nomor"), row.get("judul"))
        hit = by_key.get(key) if key else None
        if hit and hit["slug"] not in out[name]:
            out[name].append(hit["slug"])
    index = json.loads((config.ROOT / "corpus" / "index.json").read_text(encoding="utf8"))
    for doc in index:
        if doc["sources"] != ["JDIH"]:
            continue
        record = json.loads((config.ROOT / "corpus" / "documents" / (doc["id"] + ".json")).read_text(encoding="utf8"))
        for source in record["source_records"]:
            slug = source["url"].rsplit("/", 1)[-1]
            if source["source"] == "JDIH" and slug in by_slug and slug not in out["PPh"]:
                out["PPh"].append(slug)
    return out, by_slug


def done_slugs():
    return {(d["antrean"], d["slug"]) for d in read_jsonl(DETAIL_OUT) if not d.get("error")}


def full_text_file(record, listed):
    """The full-text file to download: the HTML one when there is one (its text is certain), else the PDF."""
    files = record.get("files") or []
    html = [f for f in files if re.search(r"\.html?$", f["nama"], re.I)]
    pdf = [f for f in files if f["nama"].lower().endswith(".pdf") and f["jenis"] == 1]
    chosen = (html or pdf or [None])[0]
    if chosen:
        return f"{BASE}/api/download/{chosen['id']}/{chosen['nama']}"
    return BASE + listed["full_text_pdf"] if listed.get("full_text_pdf") else None


def run(fetcher, limit=None):
    out, by_slug = queues()
    have = done_slugs()
    done = 0
    for name in ("KUP", "PPN", "PPh"):
        for slug in out[name]:
            if (name, slug) in have:
                continue
            if STOP_SIGNAL.exists():
                return done, "dihentikan dengan berkas harvest/BERHENTI; jalankan lagi untuk melanjutkan"
            if limit is not None and done >= limit:
                return done, f"batas {limit} permintaan putaran ini"
            url = f"{BASE}/dok/{slug}"
            html, meta = fetcher.get(url)
            done += 1
            record = parse_document(html)
            entry = {"antrean": name, "slug": slug, "source_url": url, "retrieved_at": meta["retrieved_at"]}
            if record is None:
                entry["error"] = "data dokumen tidak ditemukan di halaman"
                append_jsonl(DETAIL_OUT, entry)
                print(f"{name} {slug}: data dokumen tidak ditemukan", flush=True)
                continue
            entry.update(record)
            if name == "PPh":
                file_url = full_text_file(record, by_slug.get(slug, {}))
                if file_url and not STOP_SIGNAL.exists():
                    data, file_meta = fetcher.get(file_url, binary=True)
                    done += 1
                    FILES.mkdir(parents=True, exist_ok=True)
                    suffix = "." + file_url.rsplit(".", 1)[-1].lower()
                    (FILES / (slug + suffix)).write_bytes(data)
                    entry.update({"file_url": file_url, "file_retrieved_at": file_meta["retrieved_at"],
                                  "file_bytes": file_meta["bytes"], "file_type": suffix.lstrip(".")})
                elif file_url:
                    continue  # stop signal between the two requests: this document is redone next round
            append_jsonl(DETAIL_OUT, entry)
            print(f"{name} {slug}: {entry.get('masa_berlaku_tampil')}", flush=True)
    return done, "semua antrean selesai"


def report():
    out, _ = queues()
    have = done_slugs()
    lines = []
    for name in ("KUP", "PPN", "PPh"):
        got = sum(1 for s in out[name] if (name, s) in have)
        lines.append(f"JDIH {name}: {got} dari {len(out[name])} diambil")
    fetcher = Fetcher(root=ROOT)
    host = "jdih.kemenkeu.go.id"
    stops = fetcher.stopped()
    lines.append(f"{host}: {fetcher.state(host)['n_24h']} permintaan dalam 24 jam terakhir; "
                 f"{'DIHENTIKAN: ' + stops[host]['alasan'] if host in stops else 'tidak dihentikan'}")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m pipeline.jdih_harvest")
    parser.add_argument("perintah", choices=["jalan", "kemajuan"])
    parser.add_argument("--tanpa-vpn", action="store_true")
    parser.add_argument("--batas", type=int, default=None)
    args = parser.parse_args(argv)
    if args.perintah == "kemajuan":
        print(report())
        return 0
    net_guard.require_plain_connection(args.tanpa_vpn)
    ROOT.mkdir(parents=True, exist_ok=True)
    fetcher = Fetcher(root=ROOT)
    started = now()
    try:
        fetcher.acquire()
        done, end = run(fetcher, args.batas)
    except HostStopped as error:
        done, end = None, f"JDIH DIHENTIKAN: {error}"
    except TransientError as error:
        # The owner's rule for JDIH: the smallest refusal stops it for good, without a retry. A dropped
        # connection is how JDIH failed in the proof of concept, so it counts here.
        fetcher.stop("jdih.kemenkeu.go.id", f"gagal tanpa kode HTTP, dihentikan sesuai aturan pemilik: {error}")
        done, end = None, f"JDIH DIHENTIKAN: {error}"
    except (CapReached, RoundOver) as error:
        done, end = None, f"berhenti untuk putaran ini: {error}"
    finally:
        fetcher.release()
    print(f"putaran JDIH {started} - {now()}: {end}")
    print(report())
    return 0


if __name__ == "__main__":
    sys.exit(main())
