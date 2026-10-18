"""Fetch from JDIH Kemenkeu (M5), resumable, with its own limit and state in harvest/jdih/ (K-054).

    .venv/Scripts/python -m pipeline.jdih_harvest jalan --tanpa-vpn
    .venv/Scripts/python -m pipeline.jdih_harvest kemajuan
    .venv/Scripts/python -m pipeline.jdih_harvest sapu --tanpa-vpn      (status sweep, K-100)
    .venv/Scripts/python -m pipeline.jdih_harvest rencana-sapu

Queues, in this order (owner, 2026-10-05):
    a. KUP: the document page of every KUP document in the DJP list that JDIH also has, for JDIH's
       own status claim (validity period, revocations);
    b. PPN: the same for the PPN documents in the DJP list fetched so far;
    c. PPh: the document page and the full-text file of the PPh documents only JDIH has;
    d. M7 (2026-10-10): the other DJP categories, as a and b.
Which DJP document is which JDIH document is decided by the number, as in pipeline.build.

Every rule of SPEC section 8 holds (polite.py), the same as for DJP (owner, 2026-10-08, K-062): a
refusal code stops JDIH for good; a timeout or dropped connection is retried in the next round, and
the round rules of polite.py apply; a 404 is recorded as "tidak ada di sumber" and skipped.
Source classification ("Label") is never kept (K-010). harvest/BERHENTI ends the round cleanly.
"""
import argparse
import json
import math
import re
import sys

from . import config, net_guard
from .identity import parse
from .polite import NOT_FOUND, CapReached, Fetcher, HostStopped, NotFound, RoundOver, TransientError, now

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


# ---------- new listing (M9, K-091) ----------
# JDIH's search lists every type newest first, ten to a page. Court rulings are out of scope.
BENTUK = ["Undang-Undang", "Peraturan Pemerintah Pengganti Undang-Undang", "Peraturan Pemerintah",
          "Peraturan Presiden", "Peraturan Menteri", "Keputusan Menteri", "Peraturan Unit Eselon I",
          "Keputusan Unit Eselon I", "Lainnya", "Instruksi Menteri"]
LIST_NEW = config.HARVEST_JDIH_LIST_NEW


def new_listing(fetcher, max_pages=3):
    """Page 1 of each type, then page 2, 3, ... while a page still holds documents never seen (the
    proof of concept's listing of 2026-09-21 and earlier runs). Returns (requests, new rows)."""
    known = {row["produk_hukum_id"] for row in read_jsonl(config.IN_JDIH_META)}
    known |= {row["produk_hukum_id"] for row in read_jsonl(LIST_NEW)}
    requests, found = 0, 0
    for bentuk in BENTUK:
        for page in range(1, max_pages + 1):
            if STOP_SIGNAL.exists():
                return requests, found
            try:
                html, meta = fetcher.get(BASE + "/search", params={"bentuk": bentuk, "order": "desc", "page": page}, use_cache=False)
            except TransientError as error:
                requests += 1
                print(f"daftar JDIH {bentuk} halaman {page}: gagal ({error}); diulang besok", flush=True)
                break
            requests += 1
            fresh = 0
            for item in find_json_objects(rsc_payload(html), "produk_hukum_id"):
                row = item.get("data", item)
                if "produk_hukum_id" not in row or row["produk_hukum_id"] in known:
                    continue
                known.add(row["produk_hukum_id"])
                row.pop("blocks", None)
                if isinstance(row.get("abstrak"), str) and row["abstrak"].startswith("$"):
                    row["abstrak"] = None
                for field in ("label", "tematik"):
                    row.pop(field, None)  # the source's classification is never kept (K-010)
                row["_source_list_url"] = meta["url"]
                row["_retrieved_at"] = meta["retrieved_at"]
                append_jsonl(LIST_NEW, row)
                fresh += 1
            found += fresh
            print(f"daftar JDIH {bentuk} halaman {page}: {fresh} baru", flush=True)
            if fresh == 0:
                break
    return requests, found


# ---------- status sweep (K-100) ----------
# JDIH's status of documents already known changes too (revoked, replaced). Its list pages show the
# status of ten documents each; a few of them are read every night, round-robin over every type,
# so the whole list is read again about once a month, like the DJP sweep (pipeline/pembaruan.py).
SWEEP_OUT = config.HARVEST_JDIH_SWEEP
SWEEP_STATE = ROOT / "sapuan.json"
SWEEP_DAYS = 30
PER_PAGE = 10
COMPARED = ("status", "nomor", "judul", "bentuk")


def load_sweep_state():
    if SWEEP_STATE.exists():
        return json.loads(SWEEP_STATE.read_text(encoding="utf8"))
    return {"cursor": {"bentuk": 0, "page": 1}, "runs": []}


def save_sweep_state(state):
    state["runs"] = state["runs"][-60:]  # two months of nights is enough to look back on
    SWEEP_STATE.write_text(json.dumps(state, indent=1, ensure_ascii=False) + "\n", encoding="utf8")


def known_listing():
    """The latest JDIH list row of every document: proof of concept, new listing, earlier sweeps."""
    rows = read_jsonl(config.IN_JDIH_META) + sorted(read_jsonl(LIST_NEW) + read_jsonl(SWEEP_OUT), key=lambda r: r.get("_retrieved_at") or "")
    return {row["produk_hukum_id"]: row for row in rows if row.get("produk_hukum_id")}


def sweep_pages_per_type(known=None):
    """Pages of every type's list, from the documents known per type, plus one page of margin for
    documents added since. Types are those of the new listing (court rulings are out of scope)."""
    known = known if known is not None else known_listing()
    count = {bentuk: 0 for bentuk in BENTUK}
    for row in known.values():
        if row.get("bentuk") in count:
            count[row["bentuk"]] += 1
    return {bentuk: math.ceil(n / PER_PAGE) + 1 for bentuk, n in count.items() if n}


def sweep_per_night(pages):
    return math.ceil(sum(pages.values()) / SWEEP_DAYS)


def sweep_pages(state, count, pages):
    """The next `count` (type, page) pairs of the round-robin sweep; advances the cursor. Pages are
    1-based, as in JDIH's search."""
    names = list(pages)
    cursor = state["cursor"]
    out = []
    while len(out) < count and names:
        name = names[cursor["bentuk"] % len(names)]
        if cursor["page"] > pages[name]:
            cursor["bentuk"] = (cursor["bentuk"] + 1) % len(names)
            cursor["page"] = 1
            continue
        out.append((name, cursor["page"]))
        cursor["page"] += 1
    return out


def classify(old, row):
    """("baru" | "berubah" | "sama", changed fields) of a list row against the last known one."""
    if old is None:
        return "baru", []
    changed = [f for f in COMPARED if (old.get(f) or "") != (row.get(f) or "")]
    return ("berubah" if changed else "sama"), changed


def clean_row(item):
    row = dict(item.get("data", item))
    row.pop("blocks", None)
    if isinstance(row.get("abstrak"), str) and row["abstrak"].startswith("$"):
        row["abstrak"] = None
    for field in ("label", "tematik"):
        row.pop(field, None)  # the source's classification is never kept (K-010)
    return row


def sweep(fetcher, state, count=None):
    """Reads the next pages of the sweep. Keeps rows that are new or whose status, number, title or
    type changed; counts the rest. Returns the summary of this night."""
    known = known_listing()
    pages = sweep_pages_per_type(known)
    count = count or sweep_per_night(pages)
    summary = {"mulai": now(), "halaman": 0, "baris": 0, "baru": 0, "berubah": 0, "gagal": 0, "akhir_daftar": 0}
    for bentuk, page in sweep_pages(state, count, pages):
        if STOP_SIGNAL.exists():
            break
        try:
            html, meta = fetcher.get(BASE + "/search", params={"bentuk": bentuk, "order": "desc", "page": page}, use_cache=False)
        except TransientError as error:
            summary["gagal"] += 1
            print(f"sapu JDIH {bentuk} halaman {page}: gagal ({error}); terbaca lagi pada putaran sapuan berikutnya", flush=True)
            continue
        summary["halaman"] += 1
        items = [i for i in find_json_objects(rsc_payload(html), "produk_hukum_id") if "produk_hukum_id" in i.get("data", i)]
        if not items:
            summary["akhir_daftar"] += 1  # past the end of this type's list: the margin page
            print(f"sapu JDIH {bentuk} halaman {page}: kosong (akhir daftar)", flush=True)
            continue
        changed_here = 0
        for item in items:
            row = clean_row(item)
            summary["baris"] += 1
            reason, fields = classify(known.get(row["produk_hukum_id"]), row)
            if reason == "sama":
                continue
            row.update({"_source_list_url": meta["url"], "_retrieved_at": meta["retrieved_at"], "_alasan": reason})
            if fields:
                row["_berubah"] = fields
            append_jsonl(SWEEP_OUT, row)
            known[row["produk_hukum_id"]] = row
            summary[reason] += 1
            changed_here += 1
        print(f"sapu JDIH {bentuk} halaman {page}: {changed_here} baru atau berubah dari {len(items)}", flush=True)
    summary["selesai"] = now()
    summary["kursor"] = dict(state["cursor"])
    state["runs"].append(summary)
    save_sweep_state(state)
    return summary


def sweep_plan():
    pages = sweep_pages_per_type()
    total = sum(pages.values())
    nightly = sweep_per_night(pages)
    return "\n".join([
        f"Daftar JDIH: {len(pages)} jenis, {total} halaman ({PER_PAGE} dokumen per halaman, termasuk 1 halaman cadangan per jenis).",
        f"Sapuan per malam: {nightly} halaman, sekitar {math.ceil(nightly * 20 / 60)} menit dengan jeda 20 detik.",
        f"Seluruh daftar terbaca ulang setiap {math.ceil(total / nightly)} malam.",
        "Batas per host tetap 1.500 permintaan per 24 jam (polite.py), bersama langkah JDIH lainnya.",
    ])


# ---------- queues ----------
def jdih_listing():
    """JDIH documents by number key: the proof of concept's full JDIH listing (2026-09-21), then the
    documents listed since (M9) and those the status sweep found (K-100)."""
    by_key, by_slug = {}, {}
    for row in read_jsonl(config.IN_JDIH_META) + read_jsonl(LIST_NEW) + read_jsonl(SWEEP_OUT):
        by_slug[row["slug"]] = row
        key = parse(row.get("bentuk"), row.get("nomor"), row.get("judul"))
        if key:
            by_key.setdefault(key, row)
    return by_key, by_slug


def queues():
    by_key, by_slug = jdih_listing()
    # KUP, PPN and PPh first (M5 order); then the M7 categories of pipeline.harvest, so JDIH's status
    # claim is queued for every new DJP document JDIH also has.
    from .harvest import CATEGORIES
    out = {"KUP": [], "PPN": [], "PPh": [], **{name: [] for name in CATEGORIES if name not in ("KUP", "PPN")}}
    out_of_scope = re.compile(config.OUT_OF_SCOPE_TITLE, re.I)
    from .harvest import lainnya_in_scope
    lainnya = lainnya_in_scope()
    # DJP documents found by the automatic update are queued like the others (M9).
    # From the automatic update, only regulations it found new (K-095): rows it saw unchanged while
    # sweeping were queued too at first, 93 JDIH requests in one day for pages the build never reads.
    # PPh list rows are not queued here: PPh documents get JDIH pages only when JDIH alone has them.
    update_rows = [r for r in read_jsonl(config.HARVEST_UPDATE_LIST) if r.get("_alasan") == "baru" and r["_kategori_daftar"] != "PPh"]
    for row in read_jsonl(DJP_LIST) + update_rows:
        name = row["_kategori_daftar"]
        if name not in out:
            continue
        if out_of_scope.search(row.get("judul") or ""):
            continue  # weekly exchange-rate and interest-rate decrees (SPEC section 3)
        if name == "Lainnya" and row.get("path") not in lainnya:
            continue  # outside the owner's scope for "Lainnya", or undecided (K-088)
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
    return {(d["antrean"], d["slug"]) for d in read_jsonl(DETAIL_OUT) if d.get("error") in (None, NOT_FOUND)}


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
    for name in out:
        for slug in out[name]:
            if (name, slug) in have:
                continue
            if STOP_SIGNAL.exists():
                return done, "dihentikan dengan berkas harvest/BERHENTI; jalankan lagi untuk melanjutkan"
            if limit is not None and done >= limit:
                return done, f"batas {limit} permintaan putaran ini"
            url = f"{BASE}/dok/{slug}"
            try:
                html, meta = fetcher.get(url)
            except NotFound:
                done += 1
                append_jsonl(DETAIL_OUT, {"antrean": name, "slug": slug, "source_url": url, "retrieved_at": now(),
                                          "error": NOT_FOUND})
                print(f"{name} {slug}: {NOT_FOUND} (404), dilewati", flush=True)
                continue
            except TransientError as error:
                done += 1
                print(f"{name} {slug}: gagal ({error}); diulang di putaran berikutnya", flush=True)
                continue
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
                    try:
                        data, file_meta = fetcher.get(file_url, binary=True)
                    except NotFound:
                        done += 1
                        entry.update({"file_url": file_url, "file_error": NOT_FOUND})
                        append_jsonl(DETAIL_OUT, entry)
                        print(f"{name} {slug}: berkas {NOT_FOUND} (404); dokumen tetap tanpa teks", flush=True)
                        continue
                    except TransientError as error:
                        done += 1
                        print(f"{name} {slug}: berkas gagal ({error}); diulang di putaran berikutnya", flush=True)
                        continue
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


def check_addresses(fetcher, count=5, seed=20261008):
    """Whether the proof of concept's JDIH addresses (2026-09-21) still hold: `count` random addresses
    still in the queue, one request each. The pages are cached, so the next round does not fetch them
    again. A 404 is never answered by guessing a new address format."""
    import random
    out, _ = queues()
    have = done_slugs()
    remaining = sorted(slug for name in out for slug in out[name] if (name, slug) not in have)
    sample = random.Random(seed).sample(remaining, min(count, len(remaining)))
    results = []
    for slug in sample:
        url = f"{BASE}/dok/{slug}"
        try:
            html, meta = fetcher.get(url)
            found = parse_document(html) is not None
            results.append((slug, f"HTTP {meta['status']}" + ("" if found else ", data dokumen tidak ada di halaman")))
        except NotFound:
            results.append((slug, "HTTP 404"))
        except TransientError as error:
            results.append((slug, f"gagal: {error}"))
    return remaining, results


def report():
    out, _ = queues()
    have = done_slugs()
    lines = []
    for name in out:
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
    parser.add_argument("perintah", choices=["jalan", "daftar-baru", "sapu", "rencana-sapu", "kemajuan", "cek-alamat"])
    parser.add_argument("--tanpa-vpn", action="store_true")
    parser.add_argument("--batas", type=int, default=None)
    args = parser.parse_args(argv)
    if args.perintah == "kemajuan":
        print(report())
        return 0
    if args.perintah == "rencana-sapu":
        print(sweep_plan())
        return 0
    net_guard.require_plain_connection(args.tanpa_vpn)
    ROOT.mkdir(parents=True, exist_ok=True)
    fetcher = Fetcher(root=ROOT)
    started = now()
    if args.perintah == "cek-alamat":
        try:
            fetcher.acquire()
            remaining, results = check_addresses(fetcher)
        finally:
            fetcher.release()
        print(f"antrean tersisa: {len(remaining)} alamat; contoh acak:")
        for slug, result in results:
            print(f"  /dok/{slug}: {result}")
        return 0
    code = 0
    try:
        fetcher.acquire()
        if args.perintah == "daftar-baru":
            requests, found = new_listing(fetcher)
            end = f"daftar baru: {found} dokumen baru dari {requests} permintaan"
        elif args.perintah == "sapu":
            s = sweep(fetcher, load_sweep_state(), args.batas)
            end = (f"sapuan status: {s['halaman']} halaman, {s['baris']} baris; {s['baru']} baru, {s['berubah']} berubah, "
                   f"{s['gagal']} gagal; kursor {s['kursor']['bentuk']}:{s['kursor']['page']}")
        else:
            done, end = run(fetcher, args.batas)
    except HostStopped as error:
        end, code = f"JDIH DIHENTIKAN: {error}", 2  # exit 2: a refusal, for the automatic update (M9)
    except (CapReached, RoundOver) as error:
        end = f"berhenti untuk putaran ini: {error}"
    finally:
        fetcher.release()
    print(f"putaran JDIH {started} - {now()}: {end}")
    print(report())
    return code


if __name__ == "__main__":
    sys.exit(main())
