"""A polite HTTP fetcher, derived from poc/fetch.py. Every rule of SPEC section 8 is enforced here.

- robots.txt is read per host and obeyed.
- At least 20 seconds between requests to the same host.
- At most CAP_24H requests per host in a rolling 24-hour window, counted from the persistent log,
  failures included.
- A refusal (HTTP 401, 403, 429, 503) stops the host for good. The stop is written to
  harvest/host_stopped.json and only a human can lift it. Stops recorded by the proof of concept in
  poc/data/host_stopped.json are honoured too.
- A dropped connection or a timeout without such a code is normal for DJP (SPEC section 8): it is
  logged and raised as TransientError, so the caller can retry that item in the next round. When
  failures pile up (ROUND_FAIL_MAX of the last FAIL_WINDOW), the round ends early, without a
  permanent stop. Only a long unbroken run of failures (STOP_AFTER_CONSECUTIVE), the pattern of a
  host that has stopped answering us, stops the host for good.
- One honest user agent, no proxy (proxy settings from the environment are ignored on purpose), and
  one fetcher process at a time.
"""
import datetime
import hashlib
import json
import os
import time
import urllib.robotparser
from urllib.parse import urlparse

import requests

from . import config

UA = "Mozilla/5.0 (compatible; riset-peraturan-pajak/0.2; +https://github.com/MufuyuMoku/tax)"
DELAY = 20.0
CAP_24H = 1500
FAIL_WINDOW = 20
ROUND_FAIL_MAX = 6
STOP_AFTER_CONSECUTIVE = 8
REJECT_CODES = (401, 403, 429, 503)

LOG = config.HARVEST / "fetch_log.jsonl"
STOPPED = config.HARVEST / "host_stopped.json"
LEGACY_STOPPED = config.POC_DATA / "host_stopped.json"
RUNLOCK = config.HARVEST / "fetch.run.lock"
CACHE = config.HARVEST / "cache"


class HostStopped(Exception):
    """The host refused us, or was stopped earlier. Only a human lifts this."""


class CapReached(Exception):
    """The rolling 24-hour limit for this host is used up. Continue in a later round."""


class RoundOver(Exception):
    """Too many failures in this round. Stop now, retry in the next round."""


class TransientError(Exception):
    """One request failed without a refusal code. Retry the item in the next round."""


class AlreadyRunning(Exception):
    """Another fetcher process holds the run lock."""


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


# ---------- file lock (Windows: msvcrt; others: fcntl) ----------
def _lock(handle, blocking=True):
    if os.name == "nt":
        import msvcrt
        while True:
            try:
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                return
            except OSError:
                if not blocking:
                    raise
                time.sleep(0.05)
    else:
        import fcntl
        fcntl.flock(handle, fcntl.LOCK_EX | (0 if blocking else fcntl.LOCK_NB))


def _unlock(handle):
    if os.name == "nt":
        import msvcrt
        handle.seek(0)
        msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
    else:
        import fcntl
        fcntl.flock(handle, fcntl.LOCK_UN)


class Fetcher:
    def __init__(self):
        config.HARVEST.mkdir(parents=True, exist_ok=True)
        CACHE.mkdir(exist_ok=True)
        self.session = requests.Session()
        self.session.trust_env = False  # never pick up a proxy from the environment
        self.session.headers["User-Agent"] = UA
        self.last = {}
        self.robots = {}
        self.runlock = None
        self.consecutive = {}

    # ---------- run lock and log ----------
    def acquire(self):
        if self.runlock:
            return
        handle = open(RUNLOCK, "a+")
        try:
            _lock(handle, blocking=False)
        except OSError:
            handle.close()
            raise AlreadyRunning(f"proses pengambil lain sedang berjalan ({RUNLOCK})")
        self.runlock = handle

    def release(self):
        if self.runlock:
            self.runlock.close()
            self.runlock = None

    def log(self, record):
        line = json.dumps(record, ensure_ascii=False) + "\n"
        with open(str(LOG) + ".lock", "a+") as lock:
            _lock(lock)
            try:
                with LOG.open("a", encoding="utf8") as handle:
                    handle.write(line)
                    handle.flush()
                    os.fsync(handle.fileno())
            finally:
                _unlock(lock)

    # ---------- host state ----------
    @staticmethod
    def stopped():
        merged = {}
        for path in (LEGACY_STOPPED, STOPPED):
            if path.exists():
                merged.update(json.loads(path.read_text(encoding="utf8")))
        return merged

    def stop(self, host, reason):
        current = json.loads(STOPPED.read_text(encoding="utf8")) if STOPPED.exists() else {}
        if host not in current:
            current[host] = {"alasan": reason, "sejak": now(), "catatan": "hapus entri ini secara manual untuk mengizinkan lagi"}
            STOPPED.write_text(json.dumps(current, indent=1, ensure_ascii=False) + "\n", encoding="utf8")

    @staticmethod
    def host_records(host):
        records = []
        if LOG.exists():
            with LOG.open(encoding="utf8") as handle:
                for line in handle:
                    try:
                        record = json.loads(line)
                    except ValueError:
                        continue
                    if record.get("host") == host:
                        records.append(record)
        return records

    def state(self, host):
        records = self.host_records(host)
        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)
        recent = [r for r in records if datetime.datetime.fromisoformat(r["retrieved_at"]) >= cutoff]
        window = records[-FAIL_WINDOW:]
        return {
            "n_24h": len(recent),
            "fails_window": sum(1 for r in window if r.get("status") is None),
            "window": len(window),
            "oldest_24h": recent[0]["retrieved_at"] if recent else None,
        }

    def check(self, host):
        stopped = self.stopped()
        if host in stopped:
            raise HostStopped(f"{host} dihentikan: {stopped[host]['alasan']}")
        state = self.state(host)
        if state["n_24h"] >= CAP_24H:
            raise CapReached(f"{host}: {state['n_24h']} permintaan dalam 24 jam terakhir (batas {CAP_24H})")
        if state["fails_window"] > ROUND_FAIL_MAX:
            raise RoundOver(f"{host}: {state['fails_window']} dari {state['window']} permintaan terakhir gagal")

    # ---------- requests ----------
    def request(self, url, params=None):
        self.acquire()
        host = urlparse(url).netloc
        self.check(host)
        wait = DELAY - (time.time() - self.last.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        base = {"host": host, "requested_url": url, "params": params}
        try:
            response = self.session.get(url, params=params, timeout=120)
        except requests.RequestException as error:
            self.last[host] = time.time()
            self.log({**base, "status": None, "error": f"{type(error).__name__}: {repr(error)[:200]}", "retrieved_at": now()})
            self.consecutive[host] = self.consecutive.get(host, 0) + 1
            if self.consecutive[host] >= STOP_AFTER_CONSECUTIVE:
                reason = f"{self.consecutive[host]} permintaan berturut-turut gagal tersambung ({type(error).__name__})"
                self.stop(host, reason)
                raise HostStopped(f"{host}: {reason}") from error
            raise TransientError(f"{type(error).__name__} pada {url}") from error
        self.last[host] = time.time()
        self.consecutive[host] = 0
        meta = {**base, "url": response.url, "status": response.status_code, "retrieved_at": now(),
                "content_type": response.headers.get("content-type"), "bytes": len(response.content)}
        self.log(meta)
        if response.status_code in REJECT_CODES:
            self.stop(host, f"HTTP {response.status_code} pada {url}")
            raise HostStopped(f"{host} menjawab HTTP {response.status_code}")
        return response, meta

    def allowed(self, url):
        parts = urlparse(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in self.robots:
            parser = urllib.robotparser.RobotFileParser()
            response, _ = self.request(origin + "/robots.txt")
            if response.status_code == 200:
                parser.parse(response.text.splitlines())
            elif 400 <= response.status_code < 500:
                parser.parse([])  # no robots.txt: everything is allowed
            else:
                raise TransientError(f"robots.txt {origin} menjawab HTTP {response.status_code}")
            self.robots[origin] = parser
        return self.robots[origin].can_fetch(UA, url)

    def get(self, url, params=None, use_cache=True):
        """(text, meta). Raises PermissionError when robots.txt forbids the URL."""
        key = hashlib.sha1((url + json.dumps(params or {}, sort_keys=True)).encode()).hexdigest()
        body_path, meta_path = CACHE / key, CACHE / (key + ".meta.json")
        if use_cache and body_path.exists():
            return body_path.read_bytes().decode("utf-8", "replace"), json.loads(meta_path.read_text(encoding="utf8"))
        if not self.allowed(url):
            raise PermissionError("robots.txt melarang: " + url)
        response, meta = self.request(url, params=params)
        if response.status_code >= 400:
            raise TransientError(f"HTTP {response.status_code} pada {url}")
        body_path.write_bytes(response.content)
        meta_path.write_text(json.dumps(meta), encoding="utf8")
        return response.content.decode("utf-8", "replace"), meta
