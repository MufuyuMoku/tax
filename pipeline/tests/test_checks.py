"""Tests for the invariant checks: a violation must fail the build, not slip through."""
import unittest

from pipeline import checks


def document(**overrides):
    base = {
        "id": "pmk-1-2020",
        "source_records": [{"source": "DJP", "url": "https://example.test/a", "retrieved_at": "2026-09-21T00:00:00+00:00"}],
        "status_claims": [{
            "source": "DJP", "value_verbatim": "Aktif", "value_normalized": "berlaku",
            "url": "https://example.test/a", "retrieved_at": "2026-09-21T00:00:00+00:00",
        }],
        "status": {"value": "berlaku", "reasons": []},
        "text": {"available": True, "chars": 10},
        "relations": {"revokes": [], "amends": [], "revoked_by": [], "amended_by": []},
        "attachments": [],
    }
    base.update(overrides)
    return base


class TestInvariants(unittest.TestCase):
    def test_valid_document_passes(self):
        checks.check_documents([document()])

    def test_source_record_without_url_fails(self):
        doc = document(source_records=[{"source": "DJP", "url": "", "retrieved_at": "2026-09-21T00:00:00+00:00"}])
        with self.assertRaises(checks.InvariantViolation):
            checks.check_documents([doc])

    def test_invented_status_fails(self):
        doc = document(status={"value": "berlaku", "reasons": []},
                       status_claims=[{"source": "DJP", "value_verbatim": "Dicabut", "value_normalized": "tidak_berlaku",
                                       "url": "https://example.test/a", "retrieved_at": "2026-09-21T00:00:00+00:00"}])
        with self.assertRaises(checks.InvariantViolation):
            checks.check_documents([doc])

    def test_uncertain_without_reason_fails(self):
        doc = document(status={"value": "tidak_pasti", "reasons": []})
        with self.assertRaises(checks.InvariantViolation):
            checks.check_documents([doc])

    def test_missing_text_without_reason_fails(self):
        doc = document(text={"available": False, "chars": 0})
        with self.assertRaises(checks.InvariantViolation):
            checks.check_documents([doc])

    def test_missing_text_with_reason_passes(self):
        doc = document(text={"available": False, "chars": 0,
                             "unavailable_reason": "halaman sumber hanya memuat metadata"})
        checks.check_documents([doc])

    def test_relation_without_quote_fails(self):
        doc = document(relations={"revokes": [{"key": ["PMK", "2", "2019", None]}], "amends": [],
                                  "revoked_by": [], "amended_by": []})
        with self.assertRaises(checks.InvariantViolation):
            checks.check_documents([doc])

    def test_relation_with_reason_instead_of_quote_passes(self):
        doc = document(relations={"revokes": [], "amends": [{"key": ["PP", "55", "2022", None], "quote": None,
                                                             "quote_unavailable": "kalimat tidak ditemukan"}],
                                  "revoked_by": [], "amended_by": []})
        checks.check_documents([doc])

    def test_name_used_as_quote_fails(self):
        name = "Peraturan Pemerintah Nomor 30 Tahun 2020"
        doc = document(relations={"revokes": [{"key": ["PP", "30", "2020", None], "name": name, "quote": name}],
                                  "amends": [], "revoked_by": [], "amended_by": []})
        with self.assertRaises(checks.InvariantViolation):
            checks.check_documents([doc])

    def test_attachment_without_match_result_fails(self):
        doc = document(attachments=[{"url": "https://example.test/x.pdf"}])
        with self.assertRaises(checks.InvariantViolation):
            checks.check_documents([doc])


if __name__ == "__main__":
    unittest.main()
