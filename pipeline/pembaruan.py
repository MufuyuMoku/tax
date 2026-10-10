"""Incremental update of the DJP catalogue (M7, K-085): new regulations and changed ones, without
fetching every detail page again. Runs on any machine with Python 3 and pipeline/requirements-ambil.txt
(a laptop or a small Linux server). Every rule of SPEC section 8 holds (polite.py): a refusal stops
the host for good, and only a human lifts it.

    python -m pipeline.pembaruan rencana                 what one run would request; no network
    python -m pipeline.pembaruan jalan --tanpa-vpn       one run
    python -m pipeline.pembaruan jalan --tanpa-vpn --sapu 60 --batas 300

How "new" and "changed" are found, cheaply:

1. New. Every category list of the catalogue is ordered newest first. Page 0 of each list is fetched
   (fresh, never from the cache), then page 1, 2, ... until a page holds no unknown regulation, at most
   --halaman-baru pages per category. A regulation whose path was never seen is new.
2. Changed. The list rows carry what can change (status, title, number, type, date), so a list page
   shows changes for five regulations at once, without their detail pages. Each run sweeps the next
   --sapu list pages, round-robin over the categories, from a cursor kept in harvest/pembaruan.json;
   the whole catalogue (about 1,700 list pages) is swept every ceil(1,700 / sapu) runs. A row that
   differs from the last known row of its path marks the regulation as changed.
3. Hints. A new regulation's detail page names related regulations ("peraturan terkait"); a new
   regulation often revokes or amends them, so their detail pages are fetched again at once instead
   of waiting for the sweep.
4. Details. The detail page of every new, changed or hinted regulation is fetched (fresh).

Output, appended, never rewritten (pipeline/build.py does not read these yet; they enter the site
with v1.1):
    harvest/pembaruan_daftar.jsonl    list rows seen by updates, with _alasan: baru / berubah / sama
    harvest/pembaruan_detail.jsonl    detail pages fetched by updates, with _alasan
    harvest/pembaruan.json            sweep cursor and one line per run
harvest/BERHENTI ends a run cleanly between two requests.
"""
import argparse
import datetime
import json
import math
import sys

from bs4 import BeautifulSoup

from . import config, net_guard
from .harvest import BASE, CATEGORIES, LIST, OUT_OF_SCOPE, STOP_SIGNAL, append_jsonl, parse_detail, read_jsonl, rows
from .polite import CapReached, Fetcher, HostStopped, NotFound, RoundOver, TransientError

# PPh's list came from the proof of concept; it is updated like the others.
LISTS = {"PPh": "13928", **CATEGORIES}
STATE = config.HARVEST / "pembaruan.json"
LIST_OUT = config.HARVEST / "pembaruan_daftar.jsonl"
DETAIL_OUT = config.HARVEST / "pembaruan_detail.jsonl"
FIELDS = ("status", "judul", "nomor", "jenis", "tanggal")


def load_state():
    if STATE.exists():
        return json.loads(STATE.read_text(encoding="utf8"))
    return {"cursor": {"category": 0, "page": 0}, "runs": []}


def save_state(state):
    STATE.write_text(json.dumps(state, indent=1, ensure_ascii=False) + "\n", encoding="utf8")


def known_rows():
    """The last known list row of every path: proof of concept, harvest, then earlier updates."""
    latest = {}
    for path in (config.IN_DJP_LIST, config.HARVEST_DJP_LIST, LIST_OUT):
        for row in read_jsonl(path):
            if row.get("path"):
                latest[row["path"]] = row
    return latest


def last_pages():
    """Last page number of every list, from the harvest state (M5/M7) and the proof of concept."""
    state = json.loads((config.HARVEST / "state.json").read_text(encoding="utf8"))
    pages = {name: c["last_page"] for name, c in state["categories"].items() if c.get("last_page") is not None}
    counts = json.loads((config.POC_DATA / "djp_kategori_counts.json").read_text(encoding="utf8"))
    pages.setdefault("PPh", counts["PPh"]["halaman"] - 1)
    return {name: pages[name] for name in LISTS if name in pages}


def sweep_pages(state, count):
    """The next `count` (category, page) pairs of the round-robin sweep; advances the cursor."""
    pages = last_pages()
    names = list(pages)
    cursor = state["cursor"]
    out = []
    while len(out) < count and names:
        name = names[cursor["category"] % len(names)]
        if cursor["page"] > pages[name]:
            cursor["category"] = (cursor["category"] + 1) % len(names)
            cursor["page"] = 0
            continue
        out.append((name, cursor["page"]))
        cursor["page"] += 1
    return out


def differs(old, new):
    return [field for field in FIELDS if (old.get(field) or "") != (new.get(field) or "")]


class Run:
    def __init__(self, fetcher, state, limit=None):
        self.fetcher, self.state, self.limit = fetcher, state, limit
        self.known = known_rows()
        self.requests = 0
        self.counts = {"halaman_baru": 0, "halaman_sapu": 0, "baru": 0, "berubah": 0, "petunjuk": 0, "detail": 0, "gagal": 0}
        self.details = {}  # path -> reason, in order

    def budget(self):
        return not STOP_SIGNAL.exists() and (self.limit is None or self.requests < self.limit)

    def list_page(self, name, page):
        html, meta = self.fetcher.get(LIST, params={"field_kategori_peraturan_target_id": LISTS[name], "page": page}, use_cache=False)
        self.requests += 1
        found = []
        for row in rows(BeautifulSoup(html, "lxml")):
            if not row.get("path"):
                continue
            old = self.known.get(row["path"])
            if old is None:
                reason = "baru"
            elif differs(old, row):
                reason = "berubah"
            else:
                reason = "sama"
            record = {**row, "_kategori_daftar": name, "_list_url": meta["url"], "_list_page": page,
                      "_retrieved_at": meta["retrieved_at"], "_alasan": reason}
            if reason == "berubah":
                record["_berubah"] = differs(old, row)
            found.append(record)
            self.known[row["path"]] = record
            if reason != "sama" and not OUT_OF_SCOPE.search(row.get("judul") or ""):
                self.details.setdefault(row["path"], reason)
                self.counts[reason] += 1
        append_jsonl(LIST_OUT, found)
        return found

    def new_regulations(self, max_pages):
        for name in LISTS:
            for page in range(max_pages):
                if not self.budget():
                    return
                try:
                    found = self.list_page(name, page)
                except TransientError as error:
                    self.counts["gagal"] += 1
                    print(f"baru {name} halaman {page}: gagal ({error})", flush=True)
                    break
                self.counts["halaman_baru"] += 1
                fresh = sum(1 for r in found if r["_alasan"] == "baru")
                print(f"baru {name} halaman {page}: {fresh} baru dari {len(found)}", flush=True)
                if fresh == 0:
                    break

    def sweep(self, count):
        for name, page in sweep_pages(self.state, count):
            if not self.budget():
                return
            try:
                found = self.list_page(name, page)
            except TransientError as error:
                self.counts["gagal"] += 1
                print(f"sapu {name} halaman {page}: gagal ({error})", flush=True)
                continue
            self.counts["halaman_sapu"] += 1
            changed = [r for r in found if r["_alasan"] == "berubah"]
            print(f"sapu {name} halaman {page}: {len(changed)} berubah dari {len(found)}", flush=True)

    def fetch_details(self):
        queue = list(self.details.items())
        while queue and self.budget():
            path, reason = queue.pop(0)
            try:
                html, meta = self.fetcher.get(BASE + path, use_cache=False)
                self.requests += 1
                detail = parse_detail(html)
                detail.update({"path": path, "source_url": meta["url"], "retrieved_at": meta["retrieved_at"], "_alasan": reason})
                append_jsonl(DETAIL_OUT, [detail])
                self.counts["detail"] += 1
                print(f"detail ({reason}): {path[:70]}", flush=True)
                if reason == "baru":
                    # Regulations a new one names are likely revoked or amended by it: check them now.
                    for related in detail.get("peraturan_terkait") or []:
                        href = related.get("href") or ""
                        if href.startswith(BASE):
                            href = href[len(BASE):]
                        if href in self.known and href not in self.details:
                            self.details[href] = "petunjuk"
                            self.counts["petunjuk"] += 1
                            queue.append((href, "petunjuk"))
            except NotFound:
                self.requests += 1
                append_jsonl(DETAIL_OUT, [{"path": path, "source_url": BASE + path, "error": "tidak ada di sumber", "_alasan": reason}])
            except TransientError as error:
                self.requests += 1
                self.counts["gagal"] += 1
                print(f"detail {path[:70]}: gagal ({error}); dicoba lagi pada pembaruan berikutnya", flush=True)


def plan(sapu, max_pages):
    pages = last_pages()
    total = sum(p + 1 for p in pages.values())
    lists = len(pages)
    low = lists + sapu
    high = lists * max_pages + sapu
    return "\n".join([
        f"Daftar katalog: {lists} kategori, {total:,} halaman daftar.".replace(f"{total:,}", f"{total:,}".replace(",", ".")),
        f"Satu kali pembaruan: {lists} sampai {lists * max_pages} halaman untuk peraturan baru, {sapu} halaman sapuan,",
        "  ditambah satu halaman detail per peraturan baru, berubah, atau yang disebut peraturan baru.",
        f"  Tanpa peraturan baru: sekitar {low} permintaan; batas atas halaman daftar {high}.",
        f"  Dengan jeda 20 detik: sekitar {math.ceil(low * 20 / 60)} menit.",
        f"Seluruh katalog tersapu setiap {math.ceil(total / sapu)} kali pembaruan.",
        f"Batas per host: {1500} permintaan per 24 jam (polite.py).",
    ])


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m pipeline.pembaruan", description=__doc__.split("\n\n")[0])
    parser.add_argument("perintah", choices=["rencana", "jalan"])
    parser.add_argument("--tanpa-vpn", action="store_true", help="konfirmasi bahwa koneksi ini tanpa VPN atau proxy")
    parser.add_argument("--sapu", type=int, default=60, help="halaman daftar yang disapu untuk mencari perubahan (bawaan 60)")
    parser.add_argument("--halaman-baru", type=int, default=3, help="paling banyak sekian halaman per kategori untuk peraturan baru (bawaan 3)")
    parser.add_argument("--batas", type=int, default=None, help="paling banyak sekian permintaan dalam satu kali jalan")
    args = parser.parse_args(argv)

    if args.perintah == "rencana":
        print(plan(args.sapu, args.halaman_baru))
        return 0

    # Updates compare with what is known: every list must have been fetched once in full first
    # (python -m pipeline.harvest jalan), or a whole category would count as new.
    harvest = json.loads((config.HARVEST / "state.json").read_text(encoding="utf8"))
    unfinished = [name for name, c in harvest["categories"].items()
                  if c.get("last_page") is None or len(c["pages_done"]) != c["last_page"] + 1]
    if unfinished:
        print("Pengambilan awal belum selesai untuk: " + ", ".join(unfinished)
              + ". Selesaikan dulu dengan: python -m pipeline.harvest jalan --tanpa-vpn")
        return 1
    net_guard.require_plain_connection(args.tanpa_vpn)
    if STOP_SIGNAL.exists():
        STOP_SIGNAL.unlink()  # left over from an earlier clean stop
    state = load_state()
    fetcher = Fetcher()
    run = Run(fetcher, state, limit=args.batas)
    started = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    ending = "selesai"
    try:
        fetcher.acquire()
        run.new_regulations(args.halaman_baru)
        run.sweep(args.sapu)
        run.fetch_details()
        if STOP_SIGNAL.exists():
            ending = "dihentikan dengan berkas harvest/BERHENTI"
    except (CapReached, RoundOver) as error:
        ending = f"berhenti: {error}"
    except HostStopped as error:
        ending = f"BERHENTI TOTAL: {error}"
    finally:
        fetcher.release()
        state["runs"].append({"mulai": started, "selesai": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
                              "permintaan": run.requests, **run.counts, "akhir": ending})
        save_state(state)
    print(ending)
    print(json.dumps({"permintaan": run.requests, **run.counts}, ensure_ascii=False))
    return 2 if ending.startswith("BERHENTI TOTAL") else 0


if __name__ == "__main__":
    sys.exit(main())
