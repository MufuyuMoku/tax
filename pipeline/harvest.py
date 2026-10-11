"""Fetch category lists of the DJP regulation catalogue and their detail pages: KUP and PPN (M5), the
other categories (M7). Derived from poc/djp_enum.py.

The owner runs this; it can also be run from a session. It resumes where it stopped.

    .venv/Scripts/python -m pipeline.harvest uji --tanpa-vpn       one request: robots.txt
    .venv/Scripts/python -m pipeline.harvest intai --tanpa-vpn     first and last list page per category
    .venv/Scripts/python -m pipeline.harvest jalan --tanpa-vpn     one round, until done or a limit is hit
    .venv/Scripts/python -m pipeline.harvest kemajuan              progress, no network

Order of work in a round: KUP list, KUP details, PPN list, PPN details, then every M7 list in the
order of CATEGORIES, then the M7 details. KUP is finished first because it is what the users
need first (owner, 2026-10-04, K-053). A list page or detail that fails
without a refusal stays in the queue for the next round.

Files (harvest/):
    state.json                 progress: last page per category, pages done, details to retry
    djp_list.jsonl             one row per catalogue row, with the category list it was found in
    djp_detail.jsonl           one row per detail page fetched (text included)
    fetch_log.jsonl            every request, successful or not (polite.py)
    host_stopped.json          hosts stopped by a refusal; only a human removes entries
Not committed: cache/ (raw HTTP responses) and lock files.

Source classification (the detail page's own "kategori" and "tag" fields) is never written to the
committed files (K-010). Which category list a row was found in is recorded: it is a fact about
how we fetched it, already kept for PPh in poc/data/djp_pph_list.jsonl as `_list_url`.
"""
import argparse
import datetime
import json
import re
import sys

from bs4 import BeautifulSoup

from . import config, net_guard
from .polite import CAP_24H, NOT_FOUND, CapReached, Fetcher, HostStopped, NotFound, RoundOver, TransientError

BASE = config.DJP_BASE
LIST = BASE + "/id/peraturan"
# Ids as in poc/djp_enum.py and poc/data/djp_kategori_counts.json. M5: KUP and PPN. M7 (2026-10-10):
# the other lists of the catalogue, smallest first; PPh came from the proof of concept. Fetching a
# category does not put it on the site: pipeline/build.py only reads config.DJP_CATEGORIES.
CATEGORIES = {
    "KUP": "13927",
    "PPN": "13929",
    "BPHTB Lainnya": "13931",
    "BM": "13932",
    "BPHTB": "14029",
    "PBB": "13930",
    "Lainnya": "13933",
}
M5 = ("KUP", "PPN")
STATE = config.HARVEST / "state.json"
STOP_SIGNAL = config.HARVEST / "BERHENTI"  # created by a human to end the current round cleanly
LIST_OUT = config.HARVEST / "djp_list.jsonl"
DETAIL_OUT = config.HARVEST / "djp_detail.jsonl"
OUT_OF_SCOPE = re.compile(config.OUT_OF_SCOPE_TITLE, re.I)


# ---------- parsing, from poc/djp_enum.py ----------
def last_page(soup):
    for a in soup.select("a[href]"):
        if "Last" in a.get_text() or a.get("title", "").lower().startswith("ke halaman terakhir"):
            match = re.search(r"page=(\d+)", a["href"])
            if match:
                return int(match.group(1))
    return 0


def rows(soup):
    out = []
    for row in soup.select(".views-row"):
        def field(name):
            node = row.select_one(".views-field-" + name)
            return node.get_text(" ", strip=True) if node else ""
        link = row.select_one(".views-field-field-nomor-dokumen a")
        out.append({
            "nomor": field("field-nomor-dokumen"),
            "judul": field("title"),
            "jenis": field("field-jenis-dokumen"),
            "tanggal": field("field-tanggal-peraturan"),
            "status": field("field-status-peraturan"),
            "path": link["href"] if link else None,
        })
    return out


def parse_detail(html):
    soup = BeautifulSoup(html, "lxml")
    article = soup.find("article") or soup

    def field(name, multi=False):
        node = article.select_one(".field--name-" + name)
        if not node:
            return [] if multi else None
        items = node.select(".field__item") or [node]
        if multi:
            return [{"text": i.get_text(" ", strip=True),
                     "href": i.select_one("a").get("href") if i.select_one("a") else None} for i in items]
        return items[-1].get_text(" ", strip=True)

    body = article.select_one(".field--name-field-body-dalam-html")
    files = [a["href"] for a in article.select("a[href]") if re.search(r"\.(pdf|docx?|xlsx?|zip)(\?|$)", a["href"], re.I)]
    title = soup.find("h1")
    # "kategori" and "tag" are the source's classification: deliberately not kept (K-010).
    return {
        "judul": title.get_text(" ", strip=True) if title else None,
        "jenis": field("field-jenis-dokumen"),
        "nomor": field("field-nomor-dokumen"),
        "tanggal": field("field-tanggal-peraturan"),
        "status": field("field-status-peraturan"),
        "peraturan_terkait": field("field-peraturan-terkait", True),
        "lampiran": files,
        "body_html_len": len(str(body)) if body else 0,
        "body_text": body.get_text("\n", strip=True) if body else "",
    }


# ---------- state ----------
def load_state():
    state = json.loads(STATE.read_text(encoding="utf8")) if STATE.exists() else {"categories": {}, "detail_retry": [], "rounds": []}
    # Categories added after the state file was written (M7) start empty.
    for name, cid in CATEGORIES.items():
        state["categories"].setdefault(name, {"id": cid, "last_page": None, "pages_done": []})
    return state


def save_state(state):
    config.HARVEST.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf8")


def read_jsonl(path):
    if not path.exists():
        return []
    out = []
    with path.open(encoding="utf8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def append_jsonl(path, records):
    with path.open("a", encoding="utf8", newline="\n") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def pph_paths():
    """Paths already fetched for the PPh corpus by the proof of concept: no need to fetch again."""
    return {r["path"] for r in read_jsonl(config.IN_DJP_DETAIL) if r.get("path") and not r.get("error")}


# ---------- work ----------
def fetch_list_page(fetcher, state, name, page):
    category = state["categories"][name]
    html, meta = fetcher.get(LIST, params={"field_kategori_peraturan_target_id": category["id"], "page": page})
    soup = BeautifulSoup(html, "lxml")
    if category["last_page"] is None or page == 0:
        category["last_page"] = last_page(soup)
    found = rows(soup)
    append_jsonl(LIST_OUT, [{**r, "_kategori_daftar": name, "_list_url": meta["url"], "_list_page": page,
                             "_retrieved_at": meta["retrieved_at"]} for r in found])
    if page not in category["pages_done"]:
        category["pages_done"].append(page)
        category["pages_done"].sort()
    save_state(state)
    return len(found)


def list_complete(state, name):
    category = state["categories"][name]
    return category["last_page"] is not None and len(category["pages_done"]) == category["last_page"] + 1


SCOPE_LAINNYA = config.ROOT / "src" / "data" / "cakupan-lainnya.json"


def lainnya_in_scope():
    """Paths of "Lainnya" that enter the corpus (owner, 2026-10-11, K-088): only masuk true. Excluded
    and undecided ones are not fetched. The file is edited by people; scripts/cakupan-lainnya.mjs
    writes its first proposal."""
    if not SCOPE_LAINNYA.exists():
        return set()
    data = json.loads(SCOPE_LAINNYA.read_text(encoding="utf8"))
    return {entry["path"] for entry in data["peraturan"] if entry.get("masuk") is True}


def detail_queue(name):
    """Paths in this category's list that still need their detail page."""
    have = pph_paths() | {d["path"] for d in read_jsonl(DETAIL_OUT) if d.get("error") in (None, NOT_FOUND)}
    wanted = lainnya_in_scope() if name == "Lainnya" else None
    queue = []
    for row in read_jsonl(LIST_OUT):
        path = row.get("path")
        if row["_kategori_daftar"] != name or not path or path in have or path in queue:
            continue
        if OUT_OF_SCOPE.search(row.get("judul") or ""):
            continue  # weekly exchange-rate and interest-rate decrees: counted, not fetched (SPEC section 3)
        if wanted is not None and path not in wanted:
            continue  # "Lainnya" outside the owner's scope, or not decided yet (K-088)
        queue.append(path)
    return queue


def fetch_detail(fetcher, path):
    html, meta = fetcher.get(BASE + path)
    detail = parse_detail(html)
    detail.update({"path": path, "source_url": meta["url"], "retrieved_at": meta["retrieved_at"]})
    append_jsonl(DETAIL_OUT, [detail])


def run(fetcher, state, limit=None, pages=None, tally=None):
    """One round. `pages` limits list work to these page numbers (used by `intai`). `tally["n"]`
    follows the request count, so a round that ends on an exception still records how many it made."""
    done = 0
    retry_lists = []

    def budget():
        if tally is not None:
            tally["n"] = done
        # A human can end a round between two requests by creating harvest/BERHENTI.
        if STOP_SIGNAL.exists():
            return False
        return limit is None or done < limit

    def lists(name):
        nonlocal done
        category = state["categories"][name]
        todo = [0] if category["last_page"] is None else []
        while budget():
            if not todo:
                wanted = range(category["last_page"] + 1) if category["last_page"] is not None else []
                todo = [p for p in wanted if p not in category["pages_done"] and (name, p) not in retry_lists
                        and (pages is None or p in pages(category["last_page"]))]
                if not todo:
                    break
            page = todo.pop(0)
            try:
                count = fetch_list_page(fetcher, state, name, page)
                done += 1
                print(f"daftar {name} halaman {page}/{category['last_page']}: {count} baris", flush=True)
            except TransientError as error:
                done += 1
                retry_lists.append((name, page))
                print(f"daftar {name} halaman {page}: gagal ({error}); diulang di putaran berikutnya", flush=True)

    def details(name):
        nonlocal done
        if not list_complete(state, name):
            return
        for path in detail_queue(name):
            if not budget():
                break
            try:
                fetch_detail(fetcher, path)
                if path in state["detail_retry"]:
                    state["detail_retry"].remove(path)
                done += 1
                print(f"detail {name}: {path[:70]}", flush=True)
            except TransientError as error:
                done += 1
                if path not in state["detail_retry"]:
                    state["detail_retry"].append(path)
                print(f"detail {name}: gagal ({error}); diulang di putaran berikutnya", flush=True)
            except NotFound:
                done += 1
                append_jsonl(DETAIL_OUT, [{"path": path, "source_url": BASE + path, "error": NOT_FOUND}])
                print(f"detail {name}: {path[:70]} {NOT_FOUND} (404), dilewati", flush=True)
            except PermissionError as error:
                print(f"detail {name}: {error}", flush=True)
            save_state(state)

    if pages is not None:
        for name in CATEGORIES:
            lists(name)
        return done
    # Owner's order (2026-10-04, K-053): KUP completely first (list, then details), because KUP is
    # what the users need first; then the PPN list and the PPN details.
    for name in M5:
        lists(name)
        details(name)
    # M7 (K-085): every list first, since the lists alone tell how many regulations are new (overlap
    # with the corpus, exchange-rate decrees) and so what the phone would store; then the details.
    for name in CATEGORIES:
        if name not in M5:
            lists(name)
    for name in CATEGORIES:
        if name not in M5:
            details(name)
    return done


def report(state):
    lines = []
    list_rows = read_jsonl(LIST_OUT)
    details = read_jsonl(DETAIL_OUT)
    pph = pph_paths()
    for name in CATEGORIES:
        category = state["categories"][name]
        mine = [r for r in list_rows if r["_kategori_daftar"] == name]
        unique = {r["path"] for r in mine if r.get("path")}
        total_pages = None if category["last_page"] is None else category["last_page"] + 1
        in_scope = {r["path"] for r in mine if r.get("path") and not OUT_OF_SCOPE.search(r.get("judul") or "")}
        lines.append(f"{name}: halaman daftar {len(category['pages_done'])}/{total_pages or '?'}, "
                     f"{len(mine)} baris, {len(unique)} dokumen unik, "
                     f"{len(unique & pph)} sudah ada di korpus PPh, {len(unique - in_scope)} di luar cakupan (kurs/bunga)")
        if list_complete(state, name):
            fetched = {d["path"] for d in details if not d.get("error")} & unique
            queue = detail_queue(name)
            lines.append(f"  detail: {len(fetched)} diambil, {len(queue)} tersisa, "
                         f"{len([p for p in state['detail_retry'] if p in unique])} menunggu diulang")
    both = {}
    for row in list_rows:
        if row.get("path"):
            both.setdefault(row["path"], set()).add(row["_kategori_daftar"])
    lines.append(f"Dokumen di KUP dan PPN sekaligus: {sum(1 for c in both.values() if len(c) > 1)}")
    fetcher = Fetcher()
    host = "www.pajak.go.id"
    host_state = fetcher.state(host)
    stopped = fetcher.stopped()
    lines.append(f"{host}: {host_state['n_24h']} permintaan dalam 24 jam terakhir (batas {CAP_24H}); "
                 f"{'DIHENTIKAN: ' + stopped[host]['alasan'] if host in stopped else 'tidak dihentikan'}")
    if host_state["oldest_24h"] and host_state["n_24h"] >= CAP_24H:
        oldest = datetime.datetime.fromisoformat(host_state["oldest_24h"])
        lines.append(f"  kuota pulih bertahap mulai {(oldest + datetime.timedelta(hours=24)).isoformat()}")
    jdih = Fetcher(root=config.HARVEST / "jdih")  # JDIH keeps its own log and limit (K-054)
    jdih_host = "jdih.kemenkeu.go.id"
    jdih_stops = jdih.stopped()
    jdih_note = "DIHENTIKAN: " + jdih_stops[jdih_host]["alasan"] if jdih_host in jdih_stops else "tidak dihentikan"
    lines.append(f"{jdih_host}: {jdih.state(jdih_host)['n_24h']} permintaan dalam 24 jam terakhir (batas {CAP_24H}); {jdih_note}")
    for entry in state["rounds"][-5:]:
        lines.append(f"putaran {entry['mulai']} - {entry['selesai']}: {entry['permintaan']} permintaan, {entry['akhir']}")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m pipeline.harvest", description=__doc__.split("\n\n")[0])
    parser.add_argument("perintah", choices=["uji", "intai", "jalan", "kemajuan"])
    parser.add_argument("--tanpa-vpn", action="store_true", help="konfirmasi bahwa koneksi ini tanpa VPN atau proxy")
    parser.add_argument("--batas", type=int, default=None, help="paling banyak sekian permintaan halaman di putaran ini")
    args = parser.parse_args(argv)

    state = load_state()
    if args.perintah == "kemajuan":
        print(report(state))
        return 0

    net_guard.require_plain_connection(args.tanpa_vpn)
    if STOP_SIGNAL.exists():
        STOP_SIGNAL.unlink()  # left over from the previous round's clean stop
    fetcher = Fetcher()
    started = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    ending = "selesai"
    count = 0
    tally = {"n": 0}
    try:
        if args.perintah == "uji":
            allowed = fetcher.allowed(LIST + "?field_kategori_peraturan_target_id=13927&page=0")
            print(f"robots.txt terbaca; katalog peraturan {'boleh' if allowed else 'TIDAK boleh'} diambil.")
            return 0 if allowed else 1
        if args.perintah == "intai":
            count = run(fetcher, state, pages=lambda last: {0, last}, tally=tally)
            ending = "pengintaian"
        else:
            count = run(fetcher, state, limit=args.batas, tally=tally)
            if STOP_SIGNAL.exists():
                ending = "dihentikan dengan berkas harvest/BERHENTI; jalankan lagi untuk melanjutkan"
    except (CapReached, RoundOver) as error:
        ending = f"berhenti untuk putaran ini: {error}"
    except HostStopped as error:
        ending = f"BERHENTI TOTAL: {error}"
    finally:
        fetcher.release()
        count = max(count, tally["n"])
        if args.perintah != "uji":
            state["rounds"].append({"mulai": started, "selesai": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
                                    "permintaan": count, "akhir": ending})
            save_state(state)
    print(ending)
    print(report(state))
    return 2 if ending.startswith("BERHENTI TOTAL") else 0


if __name__ == "__main__":
    sys.exit(main())
