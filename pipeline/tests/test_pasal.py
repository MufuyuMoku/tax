"""Tests for the pasal splitter. Cases are taken from real defects found in the source texts."""
import unittest

from pipeline import pasal


class TestPlainRegulation(unittest.TestCase):
    def test_splits_arabic_pasal(self):
        text = "PERATURAN X\nPasal 1\nsatu\nPasal 2\ndua\nPasal 3\nmulai berlaku."
        result = pasal.split(text)
        self.assertEqual(result["structure"], "biasa")
        self.assertEqual([u["label"] for u in result["units"]], ["1", "2", "3"])
        self.assertEqual(result["body_count"], 3)
        self.assertEqual(result["flags"], [])

    def test_separates_explanation(self):
        text = "Pasal 1\nisi\nPENJELASAN\nPasal 1\npenjelasan pasal 1"
        result = pasal.split(text)
        sections = [(u["label"], u["section"]) for u in result["units"]]
        self.assertEqual(sections, [("1", "batang_tubuh"), ("1", "penjelasan")])
        self.assertEqual(result["body_count"], 1)
        self.assertEqual(result["explanation_count"], 1)


class TestAmendingRegulation(unittest.TestCase):
    """Pasal I carries the amended regulation's provisions; Pasal II is the closing article."""

    TEXT = (
        "PERUBAHAN ATAS PMK 101\n"
        "Pasal I\n"
        "Beberapa ketentuan diubah sebagai berikut:\n"
        "1. Ketentuan Pasal 1 diubah sehingga berbunyi:\n"
        "Pasal 1\n"
        "Penghasilan Tidak Kena Pajak ...\n"
        "2. Di antara Pasal 3 dan Pasal 4 disisipkan 1 (satu) pasal, yakni Pasal 3A:\n"
        "Pasal 3A\n"
        "bla\n"
        "Pasal II\n"
        "Peraturan Menteri ini mulai berlaku pada tanggal diundangkan."
    )

    def test_structure_and_top_level_units(self):
        result = pasal.split(self.TEXT)
        self.assertEqual(result["structure"], "perubahan")
        self.assertEqual([u["label"] for u in result["units"]], ["I", "II"])

    def test_quoted_pasal_are_not_own_pasal(self):
        result = pasal.split(self.TEXT)
        first = result["units"][0]
        self.assertEqual(first["quoted_pasal"], ["1", "3A"])
        self.assertEqual([i["number"] for i in first["amendment_items"]], [1, 2])
        self.assertEqual(first["amendment_items"][0]["action"], "diubah")
        self.assertEqual(first["amendment_items"][1]["action"], "disisipkan")
        self.assertIn("3A", first["amendment_items"][1]["target_pasal"])


class TestSourceDefects(unittest.TestCase):
    def test_roman_anomaly_is_flagged_and_label_kept(self):
        """PP 42/1985 writes its first pasal as 'Pasal I' although it is not an amending regulation."""
        text = "PERATURAN PEMERINTAH\nBAB I\nPasal I\n(1) satu\nPasal 2\ndua\nPasal 3\ntiga"
        result = pasal.split(text)
        self.assertNotEqual(result["structure"], "perubahan")
        self.assertIn("anomali_romawi:I", result["flags"])
        self.assertEqual(result["units"][0]["label"], "I", "label tidak boleh diubah otomatis")

    def test_missing_roman_one_is_flagged(self):
        """PER-7/PJ/2024 is an amending regulation whose 'Pasal I' is typed 'Pasal 1'."""
        text = "PERUBAHAN ATAS PER-04\nPasal 1\nBeberapa ketentuan diubah\nPasal II\nmulai berlaku"
        result = pasal.split(text)
        self.assertNotEqual(result["structure"], "perubahan")
        self.assertIn("anomali_romawi:II", result["flags"])

    def test_duplicate_pasal_is_flagged(self):
        """PMK 72/2023 prints 'Pasal 3' twice; the second should have been Pasal 5."""
        text = "X\nPasal 1\na\nPasal 2\nb\nPasal 3\nc\nPasal 4\nd\nPasal 3\ne"
        result = pasal.split(text)
        self.assertIn("pasal_ganda", result["flags"])

    def test_gap_in_numbering_is_flagged(self):
        text = "X\nPasal 1\na\nPasal 39\nb\nPasal 4\nc\nPasal 40\nd"
        result = pasal.split(text)
        self.assertTrue(any(f.startswith("urutan_loncat") for f in result["flags"]))


class TestDecisions(unittest.TestCase):
    def test_diktum_instead_of_pasal(self):
        text = "KEPUTUSAN MENTERI\nMEMUTUSKAN:\nKESATU\nmenetapkan A\nKEDUA\nmenetapkan B"
        result = pasal.split(text)
        self.assertEqual(result["structure"], "diktum")
        self.assertEqual([u["label"] for u in result["units"]], ["KESATU", "KEDUA"])

    def test_text_without_any_unit_is_flagged(self):
        result = pasal.split("Selengkapnya lihat di Lampiran")
        self.assertIn("tidak_ada_pasal", result["flags"])
        self.assertEqual(result["body_count"], 0)


if __name__ == "__main__":
    unittest.main()
