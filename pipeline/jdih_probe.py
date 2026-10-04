"""JDIH test request (M5). JDIH has its own limit and state files in harvest/jdih/.

    .venv/Scripts/python -m pipeline.jdih_probe --tanpa-vpn

Sends at most two requests: robots.txt, then one document page (PMK 81 Tahun 2024, a KUP
regulation), and reports what the page shows. Every rule of SPEC section 8 holds: the first refusal
of any kind stops the host for good (polite.py), and this command never retries.
"""
import argparse
import json
import re
import sys

from . import config, net_guard
from .polite import Fetcher, HostStopped, TransientError

BASE = "https://jdih.kemenkeu.go.id"
TEST_PAGE = BASE + "/dok/pmk-81-tahun-2024"
ROOT = config.HARVEST / "jdih"


def rsc_payload(html):
    """The page data of a Next.js page (from poc/jdih.py)."""
    parts = re.findall(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)', html)
    return "".join(json.loads('"' + p + '"') for p in parts)


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m pipeline.jdih_probe")
    parser.add_argument("--tanpa-vpn", action="store_true")
    args = parser.parse_args(argv)
    net_guard.require_plain_connection(args.tanpa_vpn)
    ROOT.mkdir(parents=True, exist_ok=True)
    fetcher = Fetcher(root=ROOT)
    try:
        if not fetcher.allowed(TEST_PAGE):
            print("robots.txt JDIH melarang halaman uji; berhenti.")
            return 1
        print("robots.txt: diizinkan")
        html, meta = fetcher.get(TEST_PAGE, use_cache=False)
    except (HostStopped, TransientError) as error:
        print(f"UJI GAGAL, tidak diulang: {error}")
        return 1
    finally:
        fetcher.release()
    payload = rsc_payload(html)
    period = re.search(r'"children":"([^"]*s\.d\.[^"]*)"', payload)
    print(f"halaman uji: HTTP {meta['status']}, {meta['bytes']} bita, data halaman {len(payload)} karakter")
    print(f"masa berlaku tampil: {period.group(1) if period else 'tidak ditemukan'}")
    has_relations = '"Relasi"' in payload
    files = len(re.findall('"MediaCatalog"', payload))
    print(f"relasi terstruktur: {'ya' if has_relations else 'tidak'}; berkas unduhan: {files}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
