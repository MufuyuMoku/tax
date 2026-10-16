"""Can automatic updates run from this machine? (M9, K-090) Four requests, nothing else:

    robots.txt and the first list page of the DJP catalogue,
    robots.txt and the first search page of JDIH,

with the same fetcher, user agent and 20-second delay as every harvest (polite.py). The fetcher keeps
its log and stop file in a temporary folder of its own: a refusal seen from here (for example from
GitHub's servers abroad) is reported, but never stops the hosts for the owner's own machine. Stops
already written by a human (harvest/host_stopped.json, poc/data/host_stopped.json) are honoured.

    python -m pipeline.uji_tempat --tanpa-vpn

Prints one line per request and a JSON summary; the exit code is 0 when both hosts answered.
"""
import argparse
import json
import sys
import tempfile
import time
from pathlib import Path

from . import net_guard
from .harvest import LIST
from .polite import UA, Fetcher, HostStopped, NotFound, TransientError

TARGETS = [
    ("www.pajak.go.id", LIST, {"field_kategori_peraturan_target_id": "13927", "page": 0}),
    ("jdih.kemenkeu.go.id", "https://jdih.kemenkeu.go.id/search", {"bentuk": "PMK", "order": "desc", "page": 1}),
]


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m pipeline.uji_tempat", description=__doc__.split("\n\n")[0])
    parser.add_argument("--tanpa-vpn", action="store_true", help="konfirmasi bahwa koneksi ini tanpa VPN atau proxy")
    args = parser.parse_args(argv)
    net_guard.require_plain_connection(args.tanpa_vpn)

    results = []
    with tempfile.TemporaryDirectory() as tmp:
        fetcher = Fetcher(root=Path(tmp))
        for host, url, params in TARGETS:
            started = time.time()
            row = {"host": host, "user_agent": UA}
            try:
                body, meta = fetcher.get(url, params=params, use_cache=False)
                robots = json.loads((Path(tmp) / "fetch_log.jsonl").read_text(encoding="utf8").splitlines()[-2])
                row.update({"robots_txt": robots.get("status"), "halaman": meta["status"], "byte": meta["bytes"], "hasil": "terjangkau"})
            except PermissionError as error:
                row.update({"hasil": "robots.txt melarang", "galat": str(error)})
            except HostStopped as error:
                row.update({"hasil": "DITOLAK", "galat": str(error)})
            except NotFound as error:
                row.update({"hasil": "404", "galat": str(error)})
            except TransientError as error:
                row.update({"hasil": "tidak terjangkau", "galat": str(error)})
            row["detik"] = round(time.time() - started, 1)
            print(json.dumps(row, ensure_ascii=False), flush=True)
            results.append(row)
        fetcher.release()
        log = [json.loads(line) for line in (Path(tmp) / "fetch_log.jsonl").read_text(encoding="utf8").splitlines()]
    print("permintaan:", json.dumps([{k: r.get(k) for k in ("host", "requested_url", "status", "error", "retrieved_at")} for r in log], ensure_ascii=False))
    ok = all(r["hasil"] == "terjangkau" for r in results)
    print("RINGKASAN:", "kedua host terjangkau" if ok else "ada host yang tidak terjangkau atau menolak")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
