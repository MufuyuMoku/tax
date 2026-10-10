"""Incremental update (M7, K-085): the sweep cursor and change detection, without the network."""
import unittest
from unittest import mock

from pipeline import pembaruan


class SweepTest(unittest.TestCase):
    def test_round_robin_covers_every_page_once_then_wraps(self):
        state = {"cursor": {"category": 0, "page": 0}, "runs": []}
        with mock.patch.object(pembaruan, "last_pages", return_value={"A": 2, "B": 1}):
            first = pembaruan.sweep_pages(state, 4)
            second = pembaruan.sweep_pages(state, 4)
        self.assertEqual(first, [("A", 0), ("A", 1), ("A", 2), ("B", 0)])
        self.assertEqual(second, [("B", 1), ("A", 0), ("A", 1), ("A", 2)])

    def test_cursor_survives_a_shorter_list(self):
        state = {"cursor": {"category": 0, "page": 9}, "runs": []}
        with mock.patch.object(pembaruan, "last_pages", return_value={"A": 2, "B": 1}):
            self.assertEqual(pembaruan.sweep_pages(state, 2), [("B", 0), ("B", 1)])


class ChangeTest(unittest.TestCase):
    def test_status_change_is_seen_and_retrieval_fields_are_not(self):
        old = {"status": "Aktif", "judul": "X", "nomor": "1", "jenis": "PMK", "tanggal": "2026-01-01", "_retrieved_at": "a"}
        new = {**old, "status": "Dicabut", "_retrieved_at": "b"}
        self.assertEqual(pembaruan.differs(old, new), ["status"])
        self.assertEqual(pembaruan.differs(old, {**old, "_retrieved_at": "c"}), [])


if __name__ == "__main__":
    unittest.main()
