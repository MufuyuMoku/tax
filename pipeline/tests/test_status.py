"""Tests for status resolution. The rule under test: never guess (SPEC invariant 1)."""
import unittest

from pipeline import status


def claim(source, value, url="https://example.test/doc", retrieved_at="2026-09-21T00:00:00+00:00"):
    return {"source": source, "value_verbatim": value, "url": url, "retrieved_at": retrieved_at}


class TestAgreement(unittest.TestCase):
    def test_both_sources_agree(self):
        result = status.resolve([claim("JDIH", "Berlaku"), claim("DJP", "Aktif")])
        self.assertEqual(result["value"], "berlaku")
        self.assertEqual(result["reasons"], [])
        self.assertEqual(result["note"], "disepakati JDIH & DJP")

    def test_single_source_is_marked_as_such(self):
        result = status.resolve([claim("DJP", "Dicabut")])
        self.assertEqual(result["value"], "tidak_berlaku")
        self.assertTrue(result["note"].startswith("klaim satu sumber saja"))

    def test_verbatim_value_is_kept(self):
        claims = [claim("DJP", "Diubah/Disempurnakan/Dicabut sebagian")]
        status.resolve(claims)
        self.assertEqual(claims[0]["value_verbatim"], "Diubah/Disempurnakan/Dicabut sebagian")
        self.assertEqual(claims[0]["value_normalized"], "diubah_atau_dicabut_sebagian")


class TestDisagreement(unittest.TestCase):
    def test_sources_disagree(self):
        """PP 30/2020: JDIH says it is no longer in force, DJP says it is active."""
        result = status.resolve([claim("JDIH", "Tidak Berlaku"), claim("DJP", "Aktif")])
        self.assertEqual(result["value"], "tidak_pasti")
        self.assertIn("status berbeda antar sumber", result["reasons"])

    def test_one_source_contradicts_itself(self):
        """PP 46/1996 appears twice in JDIH with different statuses."""
        result = status.resolve([claim("JDIH", "Berlaku"), claim("JDIH", "Tidak Berlaku")])
        self.assertEqual(result["value"], "tidak_pasti")
        self.assertIn("status berbeda dalam satu sumber (rekaman ganda)", result["reasons"])

    def test_partial_revocation_never_becomes_in_force(self):
        result = status.resolve([
            claim("JDIH", "Berlaku"),
            claim("DJP", "Diubah/Disempurnakan/Dicabut sebagian"),
        ])
        self.assertEqual(result["value"], "tidak_pasti")

    def test_empty_status(self):
        result = status.resolve([claim("JDIH", "")])
        self.assertEqual(result["value"], "tidak_pasti")
        self.assertIn("status kosong di sumber", result["reasons"])

    def test_no_claims_at_all(self):
        result = status.resolve([])
        self.assertEqual(result["value"], "tidak_pasti")
        self.assertIn("tidak ada klaim status", result["reasons"])


class TestTextEvidence(unittest.TestCase):
    def test_in_force_but_another_text_revokes_it(self):
        result = status.resolve([claim("DJP", "Aktif")], revoked_by_text=["PP 55 TAHUN 2022"])
        self.assertEqual(result["value"], "tidak_pasti")
        self.assertTrue(any("PP 55 TAHUN 2022" in reason for reason in result["reasons"]))

    def test_revocation_evidence_agrees_with_status(self):
        result = status.resolve([claim("DJP", "Dicabut")], revoked_by_text=["PP 55 TAHUN 2022"])
        self.assertEqual(result["value"], "tidak_berlaku", "bukti pencabutan menguatkan, bukan mengaburkan")


class TestVocabulary(unittest.TestCase):
    def test_unknown_value_is_never_silently_mapped(self):
        result = status.resolve([claim("DJP", "Entah apa")])
        self.assertEqual(result["value"], "lain:entah apa")

    def test_amended_and_already_revoked_is_not_in_force(self):
        result = status.resolve([claim("DJP", "Diubah/Disempurnakan dan Sudah dicabut")])
        self.assertEqual(result["value"], "tidak_berlaku")


if __name__ == "__main__":
    unittest.main()
