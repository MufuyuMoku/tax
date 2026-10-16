"""Automatic update (M9, K-091): what .github/workflows/pembaruan.yml runs. Also runs by hand.

    python -m pipeline.otomatis harian                fetch: new and changed regulations, DJP and JDIH
    python -m pipeline.otomatis terbit [--paksa]      weekly: check, build, test; publish only if all pass

Both write otomatis-laporan.md (not committed): what happened and, when something needs a person,
what to do. The workflow opens a GitHub issue with it when the exit code is not 0.

harian, in order (each step obeys SPEC section 8 through polite.py; a refusal stops that host for
good, and only a human lifts it):
    1. DJP: new, changed and hinted regulations           python -m pipeline.pembaruan jalan
    2. scope of "Lainnya" for new rows                     node scripts/cakupan-lainnya.mjs
    3. DJP: details still missing (e.g. new "Lainnya")     python -m pipeline.harvest jalan
    4. JDIH: documents listed since the last listing       python -m pipeline.jdih_harvest daftar-baru
    5. JDIH: status pages of new documents                 python -m pipeline.jdih_harvest jalan
Exit 0; 2 when a host refused; 1 when a step failed; 3 when people must decide something (new
"Lainnya" regulations whose scope is doubtful).

terbit: builds the corpus into a temporary folder and compares it with the published one (meta.json
aside). No difference: only "terakhir diperiksa" in src/data/pemeriksaan.json is updated. A
difference, unless the last publication is less than 7 days old (--paksa skips that): the change log
is written, rank drops of single questions are recorded and reported (scripts/penurunan-otomatis.mjs),
then npm test (invariants, equivalence, median gate), the site build (offline pages identical) and,
where Chrome is available, the offline test. Any failure restores the published files and exits 1:
nothing is published. Exit 0 with "terbit" in otomatis-hasil.json means: commit and push.
"""
import argparse
import datetime
import filecmp
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from . import config

ROOT = config.ROOT
REPORT = Path(os.environ.get("TAX_LAPORAN") or ROOT / "otomatis-laporan.md")
RESULT = Path(os.environ.get("TAX_HASIL") or ROOT / "otomatis-hasil.json")
CHECKS = ROOT / "src" / "data" / "pemeriksaan.json"
SCOPE = ROOT / "src" / "data" / "cakupan-lainnya.json"
PY = sys.executable


def today():
    return datetime.datetime.now(datetime.timezone.utc).date().isoformat()


def tool(name):
    found = shutil.which(name)
    if not found:
        raise SystemExit(f"{name} tidak ditemukan")
    return found


def run(title, command, env=None, log=None):
    """Run one step; returns (exit code, last lines of its output)."""
    print(f"== {title}: {' '.join(str(c) for c in command)}", flush=True)
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf8", errors="replace",
                            env={**os.environ, **(env or {})})
    output = (result.stdout or "") + (result.stderr or "")
    print(output[-4000:], flush=True)
    lines = output.strip().splitlines()
    # What failed, first: the failing test names and their messages, then the last lines.
    failures = [line for line in lines if line.lstrip().startswith(("not ok ", "✖ ")) or "AssertionError" in line
                or "Error:" in line or "GAGAL" in line][:12]
    tail = "\n".join((["Yang gagal:"] + failures + ["", "Akhir keluaran:"] if failures else []) + lines[-15:])
    if log is not None:
        log.append({"langkah": title, "kode": result.returncode, "keluaran": tail})
    return result.returncode, tail


def write_report(title, lines, needs_people):
    body = [f"# {title}", "", f"Waktu: {datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')}", ""]
    body += lines
    if needs_people:
        body += ["", "## Yang perlu dilakukan manusia", ""] + [f"- {item}" for item in needs_people]
    body += ["", "Panduan: docs/PEMBARUAN.md."]
    REPORT.write_text("\n".join(body) + "\n", encoding="utf8")


def step_lines(log):
    out = []
    for item in log:
        out += [f"## {item['langkah']} (kode keluar {item['kode']})", "", "```", item["keluaran"] or "(tanpa keluaran)", "```", ""]
    return out


# ---------- harian ----------
def harian():
    log = []
    refused, failed = [], []
    steps = [
        ("DJP: peraturan baru dan yang berubah", [PY, "-m", "pipeline.pembaruan", "jalan", "--tanpa-vpn"]),
        ("Cakupan 'Lainnya' untuk baris baru", [tool("node"), "scripts/cakupan-lainnya.mjs"]),
        ("DJP: detail yang masih kurang", [PY, "-m", "pipeline.harvest", "jalan", "--tanpa-vpn"]),
        ("JDIH: daftar dokumen baru", [PY, "-m", "pipeline.jdih_harvest", "daftar-baru", "--tanpa-vpn"]),
        ("JDIH: status dokumen baru", [PY, "-m", "pipeline.jdih_harvest", "jalan", "--tanpa-vpn"]),
    ]
    for title, command in steps:
        code, tail = run(title, command, log=log)
        if code == 2 or "DIHENTIKAN" in tail or "BERHENTI TOTAL" in tail:
            refused.append(title)
        elif code != 0:
            failed.append(title)
    scope = json.loads(SCOPE.read_text(encoding="utf8"))["peraturan"]
    doubtful = [e for e in scope if e.get("masuk") is None]

    needs = []
    if refused:
        needs.append("Host menolak atau dihentikan pada: " + "; ".join(refused) + ". Pengambilan ke host itu berhenti total "
                     "sampai manusia memeriksa dan mencabut berkas berhenti (harvest/host_stopped.json atau "
                     "harvest/jdih/host_stopped.json). Lihat docs/PEMBARUAN.md, bagian 'Mencabut status berhenti'.")
    if failed:
        needs.append("Langkah gagal: " + "; ".join(failed) + ". Baca keluarannya di bawah; jalankan lagi lewat Actions "
                     "(Run workflow) setelah penyebabnya jelas.")
    if doubtful:
        needs.append(f"{len(doubtful)} peraturan 'Lainnya' meragukan menunggu keputusan di src/data/cakupan-lainnya.json "
                     "(daftarnya di docs/LAINNYA-MERAGUKAN.md). Belum diambil sampai diputuskan.")
    code = 2 if refused else 1 if failed else 3 if doubtful else 0
    title = {0: "Pembaruan harian: berhasil", 1: "Pembaruan harian: ada langkah yang gagal",
             2: "Pembaruan harian: host menolak", 3: "Pembaruan harian: perlu keputusan cakupan"}[code]
    write_report(title, step_lines(log), needs)
    RESULT.write_text(json.dumps({"perintah": "harian", "kode": code, "judul": title}, ensure_ascii=False) + "\n", encoding="utf8")
    return code


# ---------- terbit ----------
def same_corpus(a, b):
    """True when two corpora hold the same documents and units (meta.json, with input hashes, aside)."""
    for sub in ("documents", "pasal"):
        left, right = a / sub, b / sub
        names = sorted(p.name for p in left.iterdir())
        if names != sorted(p.name for p in right.iterdir()):
            return False
        match, mismatch, errors = filecmp.cmpfiles(left, right, names, shallow=False)
        if mismatch or errors:
            return False
    return filecmp.cmp(a / "index.json", b / "index.json", shallow=False)


def restore():
    """Put the published files back: nothing of a held publication stays in the working tree."""
    subprocess.run(["git", "checkout", "--", "corpus", "src/data/perubahan.json", "tests/search/garis-dasar.json"], cwd=ROOT)
    subprocess.run(["git", "clean", "-fdq", "--", "corpus"], cwd=ROOT)


def terbit(force=False, offline_test=True):
    checks = json.loads(CHECKS.read_text(encoding="utf8"))
    log = []
    date = today()
    with tempfile.TemporaryDirectory() as tmp:
        fresh = Path(tmp) / "corpus"
        code, _ = run("Bangun korpus dari data terbaru (folder sementara)", [PY, "-m", "pipeline.build"],
                      env={"TAX_CORPUS": str(fresh)}, log=log)
        if code != 0:
            write_report("Terbit ditahan: korpus gagal dibangun (pemeriksaan invarian)", step_lines(log),
                         ["Build korpus gagal; kemungkinan data baru melanggar invarian (checks.py). Baca keluarannya, "
                          "perbaiki data atau pipa, lalu jalankan lagi."])
            return finish("terbit", 1, "Terbit ditahan: korpus gagal dibangun")
        if same_corpus(fresh, config.CORPUS):
            checks["terakhir_diperiksa"] = date
            CHECKS.write_text(json.dumps(checks, indent=1, ensure_ascii=False) + "\n", encoding="utf8")
            write_report("Pembaruan mingguan: tidak ada perubahan data", ["Data diperiksa; tidak ada peraturan baru atau status yang berubah."], [])
            return finish("terbit", 0, "tidak ada perubahan data", published=False, heartbeat=True)
        last = checks.get("terakhir_berubah")
        if not force and last and (datetime.date.fromisoformat(date) - datetime.date.fromisoformat(last)).days < 7:
            write_report("Pembaruan: ada perubahan, terbit menunggu jadwal mingguan", [f"Terakhir terbit {last}."], [])
            return finish("terbit", 0, "menunggu jadwal mingguan", published=False)
        code, summary = run("Catat peraturan baru dan yang berubah", [tool("node"), "scripts/catat-perubahan.mjs", str(config.CORPUS), str(fresh), date], log=log)
        shutil.rmtree(config.CORPUS)
        shutil.copytree(fresh, config.CORPUS)

    code_drop, drops = run("Penurunan peringkat per pertanyaan (dilaporkan)", [tool("node"), "scripts/penurunan-otomatis.mjs", date], log=log)
    reported = []
    try:
        reported = json.loads(drops.splitlines()[-1]).get("dilaporkan", [])
    except (ValueError, IndexError):
        pass
    gates = [("npm test (invarian, kesetaraan, gerbang median)", [tool("npm"), "test"]),
             ("Build situs (halaman luring identik)", [tool("npm"), "run", "build"])]
    if offline_test and os.environ.get("TAX_UJI_LURING", "1") == "1":
        gates.append(("Uji luring di Chrome", [tool("node"), "scripts/uji-luring.mjs"]))
    for title, command in gates:
        code, _ = run(title, command, env={"TAX_CHROME_HEADLESS": "1"}, log=log)
        if code != 0:
            restore()
            write_report(f"Terbit ditahan: {title} gagal", step_lines(log),
                         [f"{title} gagal, jadi data baru tidak diterbitkan dan situs tetap seperti sebelumnya. Baca "
                          "keluarannya; bila karena data baru, perbaiki atau putuskan, lalu jalankan workflow lagi "
                          "dengan 'terbit' dan 'paksa'."])
            return finish("terbit", 1, f"Terbit ditahan: {title} gagal")

    checks["terakhir_diperiksa"] = date
    checks["terakhir_berubah"] = date
    CHECKS.write_text(json.dumps(checks, indent=1, ensure_ascii=False) + "\n", encoding="utf8")
    lines = [f"Ringkasan perubahan: {summary.splitlines()[0] if summary else '-'}", ""]
    needs = []
    if reported:
        lines += ["## Penurunan peringkat yang dilaporkan (tidak menahan terbit)", "", "| Pertanyaan | Sebelum | Sesudah |", "|---|---|---|"]
        lines += [f"| {r['pertanyaan']} | {r['sebelum']} | {r['sesudah']} |" for r in reported]
        needs.append("Tinjau penurunan di atas. Dicatat di tests/search/garis-dasar.json dengan \"otomatis\": true; "
                     "hapus tanda itu bila disetujui, atau minta perbaikan pencarian.")
    write_report("Pembaruan mingguan: data baru diterbitkan", lines + step_lines(log), needs)
    return finish("terbit", 4 if reported else 0, "terbit", published=True)


def finish(command, code, title, published=False, heartbeat=False):
    RESULT.write_text(json.dumps({"perintah": command, "kode": code, "judul": title, "terbit": published, "detak": heartbeat},
                                 ensure_ascii=False) + "\n", encoding="utf8")
    print(title)
    return code


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m pipeline.otomatis", description=__doc__.split("\n\n")[0])
    parser.add_argument("perintah", choices=["harian", "terbit"])
    parser.add_argument("--paksa", action="store_true", help="terbit walau terbit terakhir kurang dari 7 hari lalu")
    parser.add_argument("--tanpa-uji-luring", action="store_true", help="lewati uji luring di Chrome")
    args = parser.parse_args(argv)
    if args.perintah == "harian":
        return harian()
    return terbit(force=args.paksa, offline_test=not args.tanpa_uji_luring)


if __name__ == "__main__":
    sys.exit(main())
