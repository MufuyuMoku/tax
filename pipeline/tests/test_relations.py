"""Tests for relation quotes: the quote is the source sentence, never just the target's name."""
import unittest

from pipeline import relations


def body(*texts):
    return [{"text": t, "section": "batang_tubuh"} for t in texts]


class TestRevocationQuote(unittest.TestCase):
    def test_full_sentence_with_the_revoking_clause(self):
        closing = (
            "Pasal 12\nPada saat Peraturan Pemerintah ini mulai berlaku, Peraturan Pemerintah Nomor 30 Tahun "
            "2020 tentang Penurunan Tarif (Lembaran Negara Republik Indonesia Tahun 2020 Nomor 146), "
            "dicabut dan dinyatakan tidak berlaku."
        )
        found = relations.extract("Penyesuaian", closing, body(closing))
        self.assertEqual(len(found["revokes"]), 1)
        quote = found["revokes"][0]["quote"]
        self.assertIn("Pada saat Peraturan Pemerintah ini mulai berlaku", quote)
        self.assertIn("dicabut dan dinyatakan tidak berlaku", quote)
        self.assertNotEqual(quote, found["revokes"][0]["name"], "nama peraturan bukan kutipan")
        self.assertFalse(found["revokes"][0]["quote_excerpt"])

    def test_partial_revocation_stays_visible(self):
        """The reader must be able to see 'sepanjang mengatur ...' for themselves."""
        closing = (
            "Pasal 37\nPada saat Peraturan Menteri ini mulai berlaku, ketentuan Pasal 4 dan Pasal 5 "
            "Peraturan Menteri Keuangan Nomor 200/PMK.03/2015 tentang Perlakuan Perpajakan, "
            "dicabut dan dinyatakan tidak berlaku."
        )
        found = relations.extract("Tata Cara", closing, body(closing))
        self.assertIn("ketentuan Pasal 4 dan Pasal 5", found["revokes"][0]["quote"])

    def test_long_list_is_excerpted_around_the_target(self):
        items = "; ".join(
            f"{chr(97 + i)}. Peraturan Direktur Jenderal Pajak Nomor PER-{i + 1}/PJ/2010 tentang Hal Nomor {i + 1} "
            "yang panjang sekali judulnya supaya kalimatnya melebihi batas kutipan"
            for i in range(12)
        )
        closing = f"Pasal 1\nPada saat Peraturan Direktur Jenderal ini mulai berlaku: {items}, dicabut dan dinyatakan tidak berlaku."
        found = relations.extract("Pencabutan", closing, body(closing))
        target = next(r for r in found["revokes"] if r["key"][1] == "7")
        self.assertTrue(target["quote_excerpt"])
        self.assertIn("Pada saat Peraturan Direktur Jenderal ini mulai berlaku:", target["quote"])
        self.assertIn("PER-7/PJ/2010", target["quote"])
        self.assertIn("dicabut dan dinyatakan tidak berlaku", target["quote"])
        self.assertNotIn("PER-3/PJ/2010", target["quote"], "potongan memuat butir sasaran, bukan seluruh daftar")

    def test_each_item_with_its_own_verb_gets_its_own_clause(self):
        """PP 55/2022 Pasal 72 ends every item with its own 'dicabut ...;'."""
        closing = (
            "Pasal 72\nPada saat Peraturan Pemerintah ini mulai berlaku:\nPeraturan Pemerintah Nomor 18 Tahun 2009 "
            "tentang Bantuan, dicabut dan dinyatakan tidak berlaku;\nketentuan Pasal 2A Peraturan Pemerintah Nomor 94 "
            "Tahun 2010 tentang Penghitungan, dicabut dan dinyatakan tidak berlaku;\nPeraturan Pemerintah Nomor 30 "
            "Tahun 2020 tentang Penurunan Tarif, dicabut dan dinyatakan tidak berlaku."
        )
        found = {tuple(r["key"][:3]): r for r in relations.extract("Penyesuaian", closing, body(closing))["revokes"]}
        partial = found[("PP", "94", "2010")]
        self.assertIn("Pada saat Peraturan Pemerintah ini mulai berlaku:", partial["quote"])
        self.assertIn("ketentuan Pasal 2A Peraturan Pemerintah Nomor 94", partial["quote"])
        self.assertNotIn("Nomor 30 Tahun 2020", partial["quote"])
        self.assertTrue(partial["quote_excerpt"])
        full = found[("PP", "30", "2020")]
        self.assertTrue(full["quote"].endswith("dicabut dan dinyatakan tidak berlaku."))
        self.assertNotIn("Nomor 94", full["quote"])


class TestAmendmentQuote(unittest.TestCase):
    TITLE = "Perubahan atas Peraturan Pemerintah Nomor 55 Tahun 2022 tentang Penyesuaian"
    PASAL_I = (
        "Pasal I\nBeberapa ketentuan dalam Peraturan Pemerintah Nomor 55 Tahun 2022 tentang Penyesuaian "
        "Pengaturan di Bidang Pajak Penghasilan diubah sebagai berikut:\n1. Ketentuan Pasal 3 diubah"
    )
    TEXT = (
        "PERATURAN PEMERINTAH NOMOR 20 TAHUN 2026 TENTANG PERUBAHAN ATAS PERATURAN PEMERINTAH NOMOR 55 "
        "TAHUN 2022 TENTANG PENYESUAIAN\nMenimbang: a. bahwa Peraturan Pemerintah Nomor 55 Tahun 2022 perlu "
        "diubah;\nMEMUTUSKAN:\n" + PASAL_I
    )

    def test_sentence_from_the_body_not_the_preamble(self):
        entry = relations.extract(self.TITLE, self.TEXT, body(self.PASAL_I))["amends"][0]
        self.assertTrue(entry["quote"].startswith("Beberapa ketentuan dalam Peraturan Pemerintah Nomor 55 Tahun 2022"))
        self.assertTrue(entry["quote"].endswith("diubah sebagai berikut:"))
        self.assertNotIn("quote_note", entry)

    def test_without_body_units_the_preamble_is_still_skipped(self):
        entry = relations.extract(self.TITLE, self.TEXT, [])["amends"][0]
        self.assertTrue(entry["quote"].startswith("Beberapa ketentuan"))

    def test_sentence_without_the_target_number_is_marked(self):
        unit = "Pasal I\nMengubah ketentuan Pasal 1 ayat (3), sehingga keseluruhan Pasal 1 berbunyi sebagai berikut:"
        entry = relations.extract(self.TITLE, self.TEXT, body(unit))["amends"][0]
        self.assertTrue(entry["quote"].startswith("Mengubah ketentuan Pasal 1 ayat (3)"))
        self.assertIn("diambil dari judul", entry["quote_note"])

    def test_missing_sentence_is_said_not_faked(self):
        text = "PERUBAHAN ATAS PERATURAN PEMERINTAH NOMOR 55 TAHUN 2022\nPasal I\nIsi lain tanpa kalimat itu."
        entry = relations.extract("Perubahan atas PP 55", text, body("Pasal I\nIsi lain tanpa kalimat itu."))["amends"][0]
        self.assertIsNone(entry["quote"])
        self.assertIn("tidak ditemukan", entry["quote_unavailable"])


if __name__ == "__main__":
    unittest.main()
