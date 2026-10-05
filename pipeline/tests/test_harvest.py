"""Offline tests for the M5 fetcher: no request ever leaves this machine. The HTTP session is
replaced by a fake, and every file the fetcher writes goes to a temporary folder.

Needs the fetcher's dependencies (pipeline/requirements-ambil.txt); skipped without them.
"""
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HAVE_DEPS = all(importlib.util.find_spec(m) for m in ("requests", "bs4", "lxml"))

LIST_HTML = """
<div class="views-row">
  <div class="views-field-field-nomor-dokumen"><a href="/id/peraturan/contoh-satu">PER-1/PJ/2026</a></div>
  <div class="views-field-title">CONTOH TIRUAN SATU</div>
  <div class="views-field-field-jenis-dokumen">Peraturan Dirjen Pajak</div>
  <div class="views-field-field-tanggal-peraturan">1 Januari 2026</div>
  <div class="views-field-field-status-peraturan">Aktif</div>
</div>
<div class="views-row">
  <div class="views-field-field-nomor-dokumen"><a href="/id/peraturan/contoh-dua">2 TAHUN 2026</a></div>
  <div class="views-field-title">CONTOH TIRUAN DUA</div>
</div>
<a href="/id/peraturan?field_kategori_peraturan_target_id=13927&amp;page=253" title="Ke halaman terakhir">Last</a>
"""

DETAIL_HTML = """
<h1>CONTOH TIRUAN SATU</h1>
<article>
  <div class="field--name-field-nomor-dokumen"><div class="field__item">PER-1/PJ/2026</div></div>
  <div class="field--name-field-kategori-peraturan"><div class="field__item">KUP</div></div>
  <div class="field--name-field-tag-peraturan"><div class="field__item">tag tiruan</div></div>
  <div class="field--name-field-body-dalam-html"><p>Pasal 1</p><p>Isi tiruan.</p></div>
  <a href="/sites/default/files/lampiran.pdf">lampiran</a>
</article>
"""


class FakeResponse:
    def __init__(self, status=200, text="", url="https://www.pajak.go.id/x"):
        self.status_code = status
        self.content = text.encode("utf8")
        self.text = text
        self.url = url
        self.headers = {"content-type": "text/html"}


@unittest.skipUnless(HAVE_DEPS, "dependensi pengambil belum terpasang (pipeline/requirements-ambil.txt)")
class TestParsing(unittest.TestCase):
    def test_list_rows_and_last_page(self):
        from bs4 import BeautifulSoup
        from pipeline import harvest
        soup = BeautifulSoup(LIST_HTML, "lxml")
        self.assertEqual(harvest.last_page(soup), 253)
        found = harvest.rows(soup)
        self.assertEqual([r["path"] for r in found], ["/id/peraturan/contoh-satu", "/id/peraturan/contoh-dua"])
        self.assertEqual(found[0]["status"], "Aktif")

    def test_detail_keeps_text_but_never_the_source_classification(self):
        from pipeline import harvest
        detail = harvest.parse_detail(DETAIL_HTML)
        self.assertIn("Isi tiruan.", detail["body_text"])
        self.assertEqual(detail["lampiran"], ["/sites/default/files/lampiran.pdf"])
        self.assertNotIn("kategori", detail, "klasifikasi sumber tidak boleh disimpan (K-010)")
        self.assertNotIn("tag", detail)


@unittest.skipUnless(HAVE_DEPS, "dependensi pengambil belum terpasang (pipeline/requirements-ambil.txt)")
class TestPoliteFetcher(unittest.TestCase):
    def setUp(self):
        from pipeline import polite
        self.polite = polite
        self.tmp = Path(tempfile.mkdtemp())
        patches = {
            "LOG": self.tmp / "fetch_log.jsonl", "STOPPED": self.tmp / "host_stopped.json",
            "LEGACY_STOPPED": self.tmp / "legacy_stopped.json", "RUNLOCK": self.tmp / "run.lock",
            "CACHE": self.tmp / "cache", "DELAY": 0.0,
        }
        self.patchers = [mock.patch.object(polite, k, v) for k, v in patches.items()]
        self.patchers.append(mock.patch.object(polite.config, "HARVEST", self.tmp))
        for p in self.patchers:
            p.start()
        self.fetcher = polite.Fetcher()

    def tearDown(self):
        self.fetcher.release()
        for p in self.patchers:
            p.stop()

    def answer(self, *responses):
        self.fetcher.session.get = mock.Mock(side_effect=list(responses))

    def test_no_proxy_from_the_environment(self):
        self.assertFalse(self.fetcher.session.trust_env)

    def test_refusal_stops_the_host_for_good(self):
        self.answer(FakeResponse(429))
        with self.assertRaises(self.polite.HostStopped):
            self.fetcher.request("https://www.pajak.go.id/id/peraturan")
        stopped = json.loads((self.tmp / "host_stopped.json").read_text(encoding="utf8"))
        self.assertIn("www.pajak.go.id", stopped)
        self.answer(FakeResponse(200))
        with self.assertRaises(self.polite.HostStopped):
            self.fetcher.request("https://www.pajak.go.id/id/peraturan")

    def test_legacy_stop_from_the_proof_of_concept_is_honoured(self):
        (self.tmp / "legacy_stopped.json").write_text(json.dumps({"jdih.kemenkeu.go.id": {"alasan": "TLS"}}), encoding="utf8")
        with self.assertRaises(self.polite.HostStopped):
            self.fetcher.request("https://jdih.kemenkeu.go.id/")

    def test_dropped_connection_is_retried_later_not_a_stop(self):
        import requests
        self.answer(requests.ConnectionError("Remote end closed connection"))
        with self.assertRaises(self.polite.TransientError):
            self.fetcher.request("https://www.pajak.go.id/a")
        self.assertFalse((self.tmp / "host_stopped.json").exists())

    def test_many_failures_end_the_round(self):
        import requests
        self.answer(*[requests.ConnectionError("x")] * 7 + [FakeResponse(200)] * 3)
        for _ in range(7):
            with self.assertRaises(self.polite.TransientError):
                self.fetcher.request("https://www.pajak.go.id/a")
            self.fetcher.consecutive["www.pajak.go.id"] = 0  # isolate the round rule from the stop rule
        with self.assertRaises(self.polite.RoundOver):
            self.fetcher.request("https://www.pajak.go.id/a")
        self.assertFalse((self.tmp / "host_stopped.json").exists())

    def test_failures_of_an_earlier_round_do_not_block_a_new_round(self):
        old = {"host": "www.pajak.go.id", "status": None, "error": "x", "retrieved_at": "2026-01-01T00:00:00+00:00"}
        with (self.tmp / "fetch_log.jsonl").open("w", encoding="utf8") as handle:
            for _ in range(20):
                handle.write(json.dumps(old) + chr(10))
        self.answer(FakeResponse(200))
        response, _ = self.fetcher.request("https://www.pajak.go.id/a")
        self.assertEqual(response.status_code, 200)

    def test_a_long_unbroken_run_of_failures_stops_the_host(self):
        import requests
        self.answer(*[requests.ConnectionError("TLS")] * 8)
        with mock.patch.object(self.polite, "ROUND_FAIL_MAX", 100):
            for _ in range(7):
                with self.assertRaises(self.polite.TransientError):
                    self.fetcher.request("https://www.pajak.go.id/a")
            with self.assertRaises(self.polite.HostStopped):
                self.fetcher.request("https://www.pajak.go.id/a")
        self.assertIn("www.pajak.go.id", json.loads((self.tmp / "host_stopped.json").read_text(encoding="utf8")))

    def test_rolling_24_hour_cap(self):
        record = {"host": "www.pajak.go.id", "status": 200, "retrieved_at": self.polite.now()}
        with (self.tmp / "fetch_log.jsonl").open("w", encoding="utf8") as handle:
            for _ in range(self.polite.CAP_24H):
                handle.write(json.dumps(record) + "\n")
        with self.assertRaises(self.polite.CapReached):
            self.fetcher.request("https://www.pajak.go.id/a")

    def test_robots_txt_is_obeyed(self):
        self.answer(FakeResponse(200, "User-agent: *\nDisallow: /search/\n"))
        with self.assertRaises(PermissionError):
            self.fetcher.get("https://www.pajak.go.id/search/apa")
        self.assertEqual(self.fetcher.session.get.call_count, 1, "hanya robots.txt yang diminta")

    def test_a_host_root_keeps_its_own_log_and_stop(self):
        jdih = self.polite.Fetcher(root=self.tmp / "jdih")
        jdih.session.get = mock.Mock(side_effect=[FakeResponse(403, url="https://jdih.kemenkeu.go.id/")])
        with self.assertRaises(self.polite.HostStopped):
            jdih.request("https://jdih.kemenkeu.go.id/")
        jdih.release()
        self.assertTrue((self.tmp / "jdih" / "fetch_log.jsonl").exists())
        self.assertFalse((self.tmp / "fetch_log.jsonl").exists(), "log DJP tidak tersentuh")
        self.assertIn("jdih.kemenkeu.go.id", jdih.stopped())

    def test_only_one_fetcher_process(self):
        self.fetcher.acquire()
        other = self.polite.Fetcher()
        with self.assertRaises(self.polite.AlreadyRunning):
            other.acquire()


class TestNetGuard(unittest.TestCase):
    def test_proxy_in_the_environment_blocks(self):
        from pipeline import net_guard
        with mock.patch.dict(os.environ, {"HTTPS_PROXY": "http://127.0.0.1:8080"}), \
                mock.patch.object(net_guard, "_windows_findings", return_value=([], [])):
            found, _ = net_guard.check()
            self.assertTrue(any("HTTPS_PROXY" in f for f in found))
            with self.assertRaises(SystemExit):
                net_guard.require_plain_connection(confirmed=True)

    def test_unconfirmed_run_is_refused(self):
        from pipeline import net_guard
        with mock.patch.object(net_guard, "check", return_value=([], ["tidak terlihat"])), \
                mock.patch("builtins.input", return_value="ya"), mock.patch("builtins.print"):
            with self.assertRaises(SystemExit):
                net_guard.require_plain_connection(confirmed=False)


if __name__ == "__main__":
    unittest.main()
