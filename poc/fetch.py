"""Pengambil HTTP yang sopan: robots.txt, jeda per host, jendela 24 jam bergulir, ambang kegagalan, log terkunci.

Semua keadaan pengaman dibaca dari berkas (bukan memori proses), sehingga berlaku lintas proses dan lintas hari:
- data/fetch_log.jsonl      : satu baris JSON per permintaan (berhasil maupun gagal), ditulis di bawah kunci berkas.
- data/host_stopped.json    : host yang dihentikan + alasan + waktu. Hanya manusia yang boleh menghapus entri.
- data/fetch.run.lock       : hanya satu proses pengambil boleh berjalan pada satu waktu (satu penulis log).
"""
import json, os, time, hashlib, datetime, urllib.robotparser, atexit
from pathlib import Path
from urllib.parse import urlparse
import requests

UA = "Mozilla/5.0 (compatible; riset-peraturan-pajak/0.1; +https://github.com/MufuyuMoku/tax)"
DELAY = 20.0  # detik antar permintaan ke host yang sama (bawaan)
HOST_DELAY = {"jdih.kemenkeu.go.id": 20.0, "www.pajak.go.id": 20.0, "pajak.go.id": 20.0}
# Batas permintaan per host dalam jendela 24 jam BERGULIR (termasuk yang gagal).
HOST_CAP_24H = {"jdih.kemenkeu.go.id": 1500, "www.pajak.go.id": 1500, "pajak.go.id": 1500}
# Ambang kegagalan: bila lebih dari FAIL_MAX dari FAIL_WINDOW permintaan terakhir ke host gagal (jenis apa pun:
# putus koneksi, waktu habis, TLS, HTTP >= 400), host dihentikan. Putus koneksi berulang = penolakan.
FAIL_WINDOW, FAIL_MAX = 20, 3
# Kode HTTP yang langsung dianggap penolakan.
REJECT_CODES = (401, 403, 429, 503)

ROOT = Path(__file__).parent
CACHE = ROOT / "cache"
DATA = ROOT / "data"
LOG = DATA / "fetch_log.jsonl"
STOPPED = DATA / "host_stopped.json"
RUNLOCK = DATA / "fetch.run.lock"
CACHE.mkdir(exist_ok=True)
DATA.mkdir(exist_ok=True)

_s = requests.Session()
_s.headers["User-Agent"] = UA
_last = {}
_robots = {}
_runlock_fh = None


class HostDown(Exception):
    """Host dihentikan (penolakan, ambang kegagalan, atau dihentikan manual)."""


class DailyCapReached(Exception):
    """Batas permintaan dalam jendela 24 jam bergulir tercapai."""


class AlreadyRunning(Exception):
    """Ada proses pengambil lain yang sedang berjalan."""


# ---------- kunci berkas (Windows: msvcrt; lainnya: fcntl) ----------
def _lock(fh):
    if os.name == "nt":
        import msvcrt
        while True:
            try:
                fh.seek(0); msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1); return
            except OSError:
                time.sleep(0.05)
    else:
        import fcntl
        fcntl.flock(fh, fcntl.LOCK_EX)


def _unlock(fh):
    if os.name == "nt":
        import msvcrt
        fh.seek(0); msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
    else:
        import fcntl
        fcntl.flock(fh, fcntl.LOCK_UN)


def _acquire_runlock():
    """Satu proses pengambil saja. Kunci dilepas otomatis saat proses berakhir."""
    global _runlock_fh
    if _runlock_fh:
        return
    fh = open(RUNLOCK, "a+")
    try:
        if os.name == "nt":
            import msvcrt
            fh.seek(0); msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        fh.close()
        raise AlreadyRunning("proses pengambil lain sedang berjalan (" + str(RUNLOCK) + ")")
    _runlock_fh = fh
    atexit.register(fh.close)


def _log(rec):
    line = json.dumps(rec, ensure_ascii=False) + "\n"
    with open(str(LOG) + ".lock", "a+") as lk:
        _lock(lk)
        try:
            with LOG.open("a", encoding="utf8") as f:
                f.write(line); f.flush(); os.fsync(f.fileno())
        finally:
            _unlock(lk)


def read_log():
    """Kembalikan (records, jumlah_baris_rusak)."""
    recs, bad = [], 0
    if LOG.exists():
        for l in LOG.open(encoding="utf8"):
            try:
                recs.append(json.loads(l))
            except ValueError:
                bad += 1
    return recs, bad


def _host_of(rec):
    return rec.get("host") or urlparse(rec.get("url") or rec.get("requested_url") or "").netloc


def _ts(rec):
    return datetime.datetime.fromisoformat(rec["retrieved_at"])


def _failed(rec):
    st = rec.get("status")
    return st is None or st >= 400


# ---------- keadaan host ----------
def stopped_hosts():
    return json.loads(STOPPED.read_text(encoding="utf8")) if STOPPED.exists() else {}


def stop_host(host, reason):
    st = stopped_hosts()
    if host not in st:
        st[host] = {"alasan": reason, "sejak": now(), "catatan": "hapus entri ini secara manual untuk mengizinkan lagi"}
        STOPPED.write_text(json.dumps(st, indent=1, ensure_ascii=False), encoding="utf8")


def host_state(host):
    recs, bad = read_log()
    mine = [r for r in recs if _host_of(r) == host]
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)
    n24 = sum(1 for r in mine if _ts(r) >= cutoff)
    lastN = mine[-FAIL_WINDOW:]
    return {"n_24h": n24, "fails_lastN": sum(_failed(r) for r in lastN), "lastN": len(lastN), "log_rusak": bad}


def _check(host):
    if host in stopped_hosts():
        raise HostDown(f"{host} dihentikan: {stopped_hosts()[host]['alasan']}")
    s = host_state(host)
    if s["fails_lastN"] > FAIL_MAX:
        reason = f"{s['fails_lastN']} dari {s['lastN']} permintaan terakhir gagal"
        stop_host(host, reason)
        raise HostDown(f"{host}: {reason}")
    cap = HOST_CAP_24H.get(host)
    if cap is not None and s["n_24h"] >= cap:
        raise DailyCapReached(f"{host}: {s['n_24h']} permintaan dalam 24 jam terakhir (batas {cap})")


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def _request(url, **kw):
    """Satu permintaan terjaga: kunci proses, cek host, jeda, log, klasifikasi penolakan."""
    _acquire_runlock()
    host = urlparse(url).netloc
    _check(host)
    wait = HOST_DELAY.get(host, DELAY) - (time.time() - _last.get(host, 0))
    if wait > 0:
        time.sleep(wait)
    base = {"host": host, "requested_url": url, "params": kw.get("params")}
    try:
        r = _s.get(url, timeout=120, **kw)
    except requests.RequestException as e:
        _last[host] = time.time()
        _log({**base, "status": None, "error": type(e).__name__ + ": " + repr(e)[:200], "retrieved_at": now()})
        _check(host)  # bisa langsung menghentikan host bila ambang terlewati
        raise
    _last[host] = time.time()
    meta = {**base, "url": r.url, "status": r.status_code, "retrieved_at": now(),
            "content_type": r.headers.get("content-type"), "bytes": len(r.content)}
    _log(meta)
    if r.status_code in REJECT_CODES:
        stop_host(host, f"HTTP {r.status_code} pada {url}")
        raise HostDown(f"{host} menjawab HTTP {r.status_code}")
    _check(host)
    return r, meta


def allowed(url):
    p = urlparse(url)
    host = p.scheme + "://" + p.netloc
    if host not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        r, _ = _request(host + "/robots.txt")
        rp.parse(r.text.splitlines() if r.status_code == 200 else [])
        _robots[host] = rp
    return _robots[host].can_fetch(UA, url)


def get(url, binary=False, use_cache=True, **kw):
    """Kembalikan (content, meta). meta berisi url dan waktu ambil."""
    key = hashlib.sha1((url + json.dumps(kw.get("params", {}), sort_keys=True)).encode()).hexdigest()
    cp, mp = CACHE / key, CACHE / (key + ".meta.json")
    if use_cache and cp.exists():
        meta = json.loads(mp.read_text())
        data = cp.read_bytes()
        return (data if binary else data.decode("utf-8", "replace")), meta
    if not allowed(url):
        raise PermissionError("robots.txt melarang: " + url)
    r, meta = _request(url, **kw)
    r.raise_for_status()
    cp.write_bytes(r.content)
    mp.write_text(json.dumps(meta))
    return (r.content if binary else r.content.decode("utf-8", "replace")), meta


def page_text(html):
    from bs4 import BeautifulSoup
    s = BeautifulSoup(html, "lxml")
    for t in s(["script", "style"]):
        t.decompose()
    return s.get_text("\n", strip=True)
