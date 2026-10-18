"""JDIH status sweep (K-100): the round-robin cursor, change detection, and what is kept, without the network."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from pipeline import jdih_harvest as j


class SweepPagesTest(unittest.TestCase):
    def test_round_robin_over_types_then_wraps(self):
        state = {"cursor": {"bentuk": 0, "page": 1}, "runs": []}
        pages = {"UU": 2, "PP": 1}
        self.assertEqual(j.sweep_pages(state, 4, pages), [("UU", 1), ("UU", 2), ("PP", 1), ("UU", 1)])
        self.assertEqual(state["cursor"], {"bentuk": 0, "page": 2})

    def test_pages_per_type_have_one_page_of_margin(self):
        known = {str(i): {"bentuk": "Undang-Undang"} for i in range(21)}
        self.assertEqual(j.sweep_pages_per_type(known), {"Undang-Undang": 4})
        self.assertEqual(j.sweep_per_night({"a": 881}), 30)


class ClassifyTest(unittest.TestCase):
    def test_status_change_is_seen_and_other_fields_are_not(self):
        old = {"status": "Berlaku", "nomor": "1", "judul": "X", "bentuk": "UU", "image": "a", "_retrieved_at": "x"}
        self.assertEqual(j.classify(old, {**old, "status": "Tidak Berlaku"}), ("berubah", ["status"]))
        self.assertEqual(j.classify(old, {**old, "image": "b", "_retrieved_at": "y"}), ("sama", []))
        self.assertEqual(j.classify(None, old), ("baru", []))


class SweepTest(unittest.TestCase):
    def test_only_new_and_changed_rows_are_kept_and_the_night_is_recorded(self):
        old = {"produk_hukum_id": "a", "slug": "pmk-1", "status": "Berlaku", "nomor": "1", "judul": "A", "bentuk": "Peraturan Menteri"}
        same = {"produk_hukum_id": "b", "slug": "pmk-2", "status": "Berlaku", "nomor": "2", "judul": "B", "bentuk": "Peraturan Menteri"}
        listing = [{"data": {**old, "status": "Tidak Berlaku", "label": "kelas"}}, {"data": same}, {"data": {**same, "produk_hukum_id": "c", "slug": "pmk-3"}}]
        fetcher = mock.Mock()
        fetcher.get.return_value = ("<html>", {"url": "https://jdih.kemenkeu.go.id/search?page=1", "retrieved_at": "2026-10-17T00:00:00+00:00"})
        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch.object(j, "SWEEP_OUT", Path(tmp) / "sapuan.jsonl"), \
                mock.patch.object(j, "SWEEP_STATE", Path(tmp) / "sapuan.json"), \
                mock.patch.object(j, "STOP_SIGNAL", Path(tmp) / "BERHENTI"), \
                mock.patch.object(j, "known_listing", return_value={"a": old, "b": same}), \
                mock.patch.object(j, "rsc_payload", side_effect=lambda html: html), \
                mock.patch.object(j, "find_json_objects", return_value=listing):
            state = {"cursor": {"bentuk": 0, "page": 1}, "runs": []}
            summary = j.sweep(fetcher, state, count=1)
            kept = [json.loads(line) for line in (Path(tmp) / "sapuan.jsonl").read_text(encoding="utf8").splitlines()]
            saved = json.loads((Path(tmp) / "sapuan.json").read_text(encoding="utf8"))
        self.assertEqual([(r["slug"], r["_alasan"]) for r in kept], [("pmk-1", "berubah"), ("pmk-3", "baru")])
        self.assertEqual(kept[0]["_berubah"], ["status"])
        self.assertNotIn("label", kept[0])  # the source's classification is never kept (K-010)
        self.assertEqual((summary["halaman"], summary["baris"], summary["baru"], summary["berubah"]), (1, 3, 1, 1))
        self.assertEqual(len(saved["runs"]), 1)
        self.assertEqual(fetcher.get.call_args.kwargs["use_cache"], False)


if __name__ == "__main__":
    unittest.main()
