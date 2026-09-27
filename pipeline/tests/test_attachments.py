"""Tests for attachment number matching (SPEC invariant 6)."""
import unittest

from pipeline import attachments

BASE = "https://www.pajak.go.id/sites/default/files/"


class TestFileNameParsing(unittest.TestCase):
    def test_reads_common_spellings(self):
        cases = {
            "Lampiran PMK 80 TAHUN 2024.pdf": ("PMK", "80", "2024"),
            "Lampiran_PER-24_PJ_2021.pdf": ("PER-DJP", "24", "2021"),
            "Lampiran PER18PJ2021.pdf": ("PER-DJP", "18", "2021"),
            "KEP79PJ2025.pdf": ("KEP-DJP", "79", "2025"),
            "Lampiran%20PMK113PMK032022.pdf": ("PMK", "113", "2022"),
            "LAMPIRAN%20KMK744KM042020.pdf": ("KMK", "744", "2020"),
            "Lampiran_PP_Nomor_29_Tahun_2020.pdf": ("PP", "29", "2020"),
            "Lampiran_141_PMK.010_2021.pdf": ("PMK", "141", "2021"),
        }
        for name, expected in cases.items():
            with self.subTest(name=name):
                self.assertEqual(attachments.parse_file_name(name), expected)

    def test_earliest_number_wins(self):
        """The document's own number leads the file name; later numbers are context."""
        name = "PP_20_2026_Perubahan PP 55 Tahun 2022.pdf"
        self.assertEqual(attachments.parse_file_name(name), ("PP", "20", "2026"))

    def test_title_only_file_name_yields_nothing(self):
        self.assertIsNone(attachments.parse_file_name("KEBIJAKAN PERPAJAKAN SEHUBUNGAN DENGAN.pdf"))


class TestMatching(unittest.TestCase):
    def test_match(self):
        result = attachments.check(BASE + "Lampiran%20PMK%2080%20TAHUN%202024.pdf", ("PMK", "80", "2024", None))
        self.assertEqual(result["match"], "cocok")

    def test_real_mismatch_from_the_proof_of_concept(self):
        """PER-20/PJ/2019 carries the attachment of PER-23/PJ/2020 (LAPORAN section 5.1b)."""
        result = attachments.check(BASE + "lampiran/Lampiran%20PER_23_PJ_2020.pdf", ("PER-DJP", "20", "2019", None))
        self.assertEqual(result["match"], "tidak_cocok")
        self.assertIn("PER-DJP 23/2020", result["note"])

    def test_no_number_is_unverified_not_a_match(self):
        result = attachments.check(BASE + "KEBIJAKAN%20PERPAJAKAN.pdf", ("KEP-DJP", "55", "2026", None))
        self.assertEqual(result["match"], "tidak_terverifikasi")
        self.assertIsNone(result["parsed_number"])

    def test_kmk_series_difference_still_matches(self):
        """The document key keeps the KMK series ('744/KM.4'); the file name spells it 'KM04'."""
        result = attachments.check(BASE + "LAMPIRAN%20KMK744KM042020.pdf", ("KMK", "744/KM.4", "2020", None))
        self.assertEqual(result["match"], "cocok")

    def test_wrong_year_is_a_mismatch(self):
        result = attachments.check(BASE + "Lampiran%20PMK%2080%20TAHUN%202024.pdf", ("PMK", "80", "2023", None))
        self.assertEqual(result["match"], "tidak_cocok")

    def test_file_name_is_decoded(self):
        result = attachments.check(BASE + "Lampiran%20PER%208%20Tahun%202026.pdf", ("PER-DJP", "8", "2026", None))
        self.assertEqual(result["file_name"], "Lampiran PER 8 Tahun 2026.pdf")
        self.assertEqual(result["match"], "cocok")


if __name__ == "__main__":
    unittest.main()
