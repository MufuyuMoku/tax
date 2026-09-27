"""Invariant checks over the built corpus. A violation fails the build; nothing is written.

These mirror SPEC section 4. They exist so that a future change cannot quietly drop a source URL,
invent a status, hide a document without text, or show an attachment without its match result.
"""


class InvariantViolation(Exception):
    pass


def check_documents(documents):
    problems = []
    for doc in documents:
        where = doc["id"]

        # Invariant 2: every source record carries its URL and retrieval date.
        if not doc["source_records"]:
            problems.append(f"{where}: tidak ada rekaman sumber")
        for record in doc["source_records"]:
            if not record.get("url") or not record.get("retrieved_at"):
                problems.append(f"{where}: rekaman sumber tanpa url/tanggal ambil")

        # Invariant 1: status is either every claim agreeing, or "tidak_pasti". Never invented.
        claimed = {c["value_normalized"] for c in doc["status_claims"]}
        value = doc["status"]["value"]
        if value != "tidak_pasti" and value not in claimed:
            problems.append(f"{where}: status '{value}' tidak berasal dari klaim sumber {sorted(claimed)}")
        if value == "tidak_pasti" and not doc["status"]["reasons"]:
            problems.append(f"{where}: status tidak pasti tanpa alasan")
        for claim in doc["status_claims"]:
            if not claim.get("url") or not claim.get("retrieved_at"):
                problems.append(f"{where}: klaim status tanpa url/tanggal ambil")

        # Invariant 3: a document without text stays, and says why.
        text = doc["text"]
        if not text["available"] and not text.get("unavailable_reason"):
            problems.append(f"{where}: tanpa teks tetapi tanpa alasan")
        if not text["available"] and not doc["source_records"]:
            problems.append(f"{where}: tanpa teks dan tanpa tautan ke sumber")

        # Invariant 5: every relation carries the sentence it was read from.
        for kind in ("revokes", "amends", "revoked_by", "amended_by"):
            for relation in doc["relations"][kind]:
                if not relation.get("quote"):
                    problems.append(f"{where}: relasi {kind} tanpa kutipan sumber")

        # Invariant 6: every attachment carries a match result.
        for attachment in doc["attachments"]:
            if attachment.get("match") not in ("cocok", "tidak_cocok", "tidak_terverifikasi"):
                problems.append(f"{where}: lampiran tanpa hasil pencocokan nomor")

    if problems:
        raise InvariantViolation(
            f"{len(problems)} pelanggaran invarian, korpus tidak ditulis:\n  - "
            + "\n  - ".join(problems[:20])
            + ("\n  ..." if len(problems) > 20 else "")
        )


def check_units(units, documents_by_id):
    problems = []
    for unit in units:
        if unit["document_id"] not in documents_by_id:
            problems.append(f"{unit['id']}: menunjuk dokumen yang tidak ada")
        if unit["label"] is None:
            problems.append(f"{unit['id']}: label pasal kosong")
    if problems:
        raise InvariantViolation("pasal bermasalah:\n  - " + "\n  - ".join(problems[:20]))
