"""Build the standard corpus from the proof-of-concept archive. No network requests.

    python -m pipeline.build

Output (rewritten from scratch on every run, deterministic):
    corpus/documents/<id>.json   one file per document
    corpus/pasal/<id>.json       one file per pasal / diktum / amendment article
    corpus/index.json            compact index for listing and, later, search
    corpus/meta.json             counts and input checksums
"""
import hashlib
import json
import re
import shutil
import sys
from collections import defaultdict

from . import attachments, checks, config, pasal, relations, status
from .identity import document_id, parse, variant_of

OUT_OF_SCOPE = re.compile(config.OUT_OF_SCOPE_TITLE, re.I)


def read_jsonl(path):
    with path.open(encoding="utf8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                yield json.loads(line)


def collect():
    """Merge both sources into one dict of documents, keyed by identity."""
    documents = {}

    def slot(key, fallback_id, title):
        if key is None:
            key = ("?", fallback_id, "", variant_of(title))
        if key not in documents:
            documents[key] = {
                "key": key,
                "source_records": [],
                "status_claims": [],
                "texts": [],
                "source_listed_related": [],
                "attachment_urls": [],
                "categories": [],
                "unusable_files": [],
            }
        return documents[key]

    # --- DJP: the list gives every document and its status; the detail page gives the text.
    # PPh comes from the proof of concept; KUP (and later PPN) from pipeline/harvest.py. Which
    # category list a row was found in is kept as provenance (K-051), never the source's own
    # classification fields.
    details = {}
    for path in (config.IN_DJP_DETAIL, config.HARVEST_DJP_DETAIL):
        for row in _read_optional(path):
            if row.get("error"):
                details.setdefault(row["path"], row)
            else:
                details[row["path"]] = row

    djp_rows = [(row, "PPh") for row in read_jsonl(config.IN_DJP_LIST)]
    djp_rows += [(row, row["_kategori_daftar"]) for row in _read_optional(config.HARVEST_DJP_LIST)
                 if row["_kategori_daftar"] in config.DJP_CATEGORIES]

    seen_urls = {}
    for row, category in djp_rows:
        if not row.get("path") or OUT_OF_SCOPE.search(row.get("judul") or ""):
            continue
        url = config.DJP_BASE + row["path"]
        if url in seen_urls:
            # The catalogue lists some documents twice, and some in two categories.
            _add_category(seen_urls[url], category, "daftar_djp")
            continue
        detail = details.get(row["path"], {"error": "detail belum diambil"})
        doc = slot(parse(row.get("jenis"), row.get("nomor"), row.get("judul")), row["path"], row.get("judul"))
        seen_urls[url] = doc
        _add_category(doc, category, "daftar_djp")
        doc["source_records"].append({
            "source": "DJP",
            "url": url,
            "retrieved_at": detail.get("retrieved_at") or row["_retrieved_at"],
            "number_as_written": row.get("nomor"),
            "title_as_written": row.get("judul"),
            "type_as_written": row.get("jenis"),
            "date_as_written": row.get("tanggal"),
            "detail_error": detail.get("error"),
        })
        doc["status_claims"].append({
            "source": "DJP",
            "value_verbatim": row.get("status"),
            "url": url,
            "retrieved_at": row["_retrieved_at"],
            "from_list_url": row["_list_url"],
        })
        for related in detail.get("peraturan_terkait") or []:
            doc["source_listed_related"].append({
                "source": "DJP",
                "text": related.get("text"),
                "url": (config.DJP_BASE + related["href"]) if related.get("href") else None,
                "note": "sumber tidak menyebutkan jenis relasinya",
            })
        for attachment_url in detail.get("lampiran") or []:
            doc["attachment_urls"].append(attachment_url)
        if detail.get("body_text"):
            doc["texts"].append({
                "source": "DJP",
                "format": "html",
                "url": url,
                "retrieved_at": detail["retrieved_at"],
                "text": detail["body_text"],
            })

    # --- JDIH. The status claim comes from JDIH's own listing (poc, 2026-09-21): for the PPh
    # candidates of the proof of concept, and for every KUP/PPN document JDIH also has, matched by
    # number. Document pages fetched in M5 (pipeline/jdih_harvest.py) add JDIH's relations and its
    # validity period, and for the PPh documents only JDIH has, the full text when it passes the
    # text quality rule (K-055).
    jdih_meta = {row["slug"]: row for row in read_jsonl(config.IN_JDIH_META)}
    jdih_detail = {row["slug"]: row for row in read_jsonl(config.IN_JDIH_DETAIL) if not row.get("error")}
    m5_detail = {row["slug"]: row for row in _read_optional(config.HARVEST_JDIH_DETAIL) if not row.get("error")}
    m5_text = {row["slug"]: row for row in _read_optional(config.HARVEST_JDIH_TEXT)}

    wanted = [(c["slug"], "PPh", c.get("alasan")) for c in read_jsonl(config.IN_JDIH_CANDIDATES)]
    jdih_by_key = {}
    for slug in sorted(jdih_meta):
        meta = jdih_meta[slug]
        key = parse(meta.get("bentuk"), meta.get("nomor"), meta.get("judul"))
        if key:
            jdih_by_key.setdefault(key, slug)
    for key in sorted(documents, key=str):
        doc = documents[key]
        m5 = [c["kategori"] for c in doc["categories"] if c["kategori"] in config.DJP_CATEGORIES]
        if m5 and key[0] != "?" and key in jdih_by_key:
            wanted.append((jdih_by_key[key], m5[0], None))

    seen_slugs = set()
    for slug, category, reason in wanted:
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)
        meta = jdih_meta[slug]
        if OUT_OF_SCOPE.search(meta.get("judul") or ""):
            continue
        url = config.JDIH_BASE + "/dok/" + slug
        detail = jdih_detail.get(slug) or m5_detail.get(slug) or {}
        doc = slot(parse(meta.get("bentuk"), meta.get("nomor"), meta.get("judul")), slug, meta.get("judul"))
        if category == "PPh":
            _add_category(doc, "PPh", "pilihan_jdih")
        record = {
            "source": "JDIH",
            "url": url,
            "retrieved_at": meta["_retrieved_at"],
            "number_as_written": meta.get("nomor"),
            "title_as_written": meta.get("judul"),
            "type_as_written": meta.get("bentuk"),
            "date_as_written": meta.get("tanggal_penetapan"),
        }
        if reason is not None:
            record["selected_because"] = reason
        if detail.get("masa_berlaku_tampil"):
            record["validity_as_written"] = detail["masa_berlaku_tampil"]
            record["page_retrieved_at"] = detail["retrieved_at"]
        doc["source_records"].append(record)
        doc["status_claims"].append({
            "source": "JDIH",
            "value_verbatim": meta.get("status"),
            "url": url,
            "retrieved_at": meta["_retrieved_at"],
            "from_list_url": meta.get("_source_list_url"),
        })
        for relation in detail.get("relasi") or []:
            doc["source_listed_related"].append({
                "source": "JDIH",
                "text": f"{relation.get('nama')}: {relation.get('nomor')} — {relation.get('judul')}",
                "url": (config.JDIH_BASE + "/dok/" + relation["slug"]) if relation.get("slug") else None,
                "note": f"jenis relasi menurut JDIH: {relation.get('nama')}",
            })
        text_path = config.POC_TEXT / "jdih" / (slug + ".txt")
        if slug in jdih_detail and text_path.exists():
            detail = jdih_detail[slug]
            doc["texts"].append({
                "source": "JDIH",
                "format": detail.get("format", "pdf"),
                "url": detail.get("pdf_url") or detail.get("html_url") or url,
                "retrieved_at": detail.get("pdf_retrieved_at") or detail.get("html_retrieved_at") or detail["retrieved_at"],
                "text": text_path.read_text(encoding="utf8"),
            })
        elif m5_detail.get(slug, {}).get("file_url"):
            fetched = m5_detail[slug]
            judged = m5_text.get(slug)
            if judged and judged["usable"]:
                doc["texts"].append({
                    "source": "JDIH",
                    "format": fetched["file_type"],
                    "url": fetched["file_url"],
                    "retrieved_at": fetched["file_retrieved_at"],
                    "text": judged["text"],
                })
            else:
                # Invariants 3 and 4: no usable text, so the original file is linked instead.
                doc["unusable_files"].append({
                    "url": fetched["file_url"],
                    "retrieved_at": fetched["file_retrieved_at"],
                    "reason": ("mutu teks berkas belum diperiksa" if not judged
                               else "PDF tanpa lapisan teks (pindaian)" if not judged["hasTextLayer"]
                               else "lapisan teks PDF tidak terbaca (K-055)"),
                })

    return documents


def _read_optional(path):
    """A harvest file: absent until the M5 fetchers have written it."""
    return list(read_jsonl(path)) if path.exists() else []


def _add_category(doc, name, origin):
    entry = {"kategori": name, "asal": origin}
    if entry not in doc["categories"]:
        doc["categories"].append(entry)


def build():
    raw = collect()
    ordered = sorted(raw.values(), key=lambda d: document_id(d["key"]))

    documents, units = [], []
    revoked_by, amended_by = defaultdict(list), defaultdict(list)

    for entry in ordered:
        key = entry["key"]
        doc_id = document_id(key)
        title = next((r["title_as_written"] for r in entry["source_records"] if r.get("title_as_written")), "")

        # The DJP catalogue posts some documents at several URLs, each with its own copy of the
        # text, and those copies are not always identical. Pick the longest (ties broken by URL so
        # the build stays deterministic) and keep the other postings visible rather than dropping them.
        texts = sorted(entry["texts"], key=lambda t: (-len(t["text"]), t["url"]))
        chosen = texts[0] if texts else None
        split = pasal.split(chosen["text"]) if chosen else None

        body_units = [u for u in split["units"] if u["section"] == "batang_tubuh"] if split else []
        found = relations.extract(title, chosen["text"] if chosen else "", body_units)
        for kind in ("revokes", "amends"):
            for relation in found[kind]:
                allowed = relations.may_act_on(key[0], relation["key"][0])
                relation["target_id"] = document_id(relation["key"])
                relation["source_of_reading"] = chosen["source"] if chosen else None
                if allowed is False:
                    relation["rejected"] = (
                        f"hierarki: {key[0]} tidak dapat mencabut/mengubah {relation['key'][0]}"
                    )
                else:
                    # The reverse side carries the acting document's own identity so the page can
                    # write "PP 55/2022" rather than the source's "55 TAHUN 2022".
                    reverse = {
                        "id": doc_id,
                        "key": list(key),
                        "number_as_written": next((r["number_as_written"] for r in entry["source_records"]), None),
                        "title": title,
                        "quote": relation["quote"],
                        "quote_excerpt": relation["quote_excerpt"],
                        "source_of_reading": relation["source_of_reading"],
                    }
                    for optional in ("quote_unavailable", "quote_note"):
                        if relation.get(optional):
                            reverse[optional] = relation[optional]
                    (revoked_by if kind == "revokes" else amended_by)[relation["key"]].append(reverse)
                relation["key"] = list(relation["key"])

        document = {
            "id": doc_id,
            "identity": {"code": key[0], "number": key[1], "year": key[2], "variant": key[3]},
            "title": title,
            "category": "substantif",
            "source_records": entry["source_records"],
            "status_claims": entry["status_claims"],
            "text": {
                "available": bool(chosen),
                "source": chosen["source"] if chosen else None,
                "format": chosen["format"] if chosen else None,
                "url": chosen["url"] if chosen else None,
                "retrieved_at": chosen["retrieved_at"] if chosen else None,
                "chars": len(chosen["text"]) if chosen else 0,
                "unavailable_reason": None if chosen else _no_text_reason(entry),
                "other_postings": [{
                    "source": t["source"],
                    "url": t["url"],
                    "retrieved_at": t["retrieved_at"],
                    "chars": len(t["text"]),
                    "differs_from_chosen": t["text"] != chosen["text"],
                } for t in texts[1:]],
            },
            "structure": split["structure"] if split else None,
            "quality_flags": split["flags"] if split else [],
            "pasal_ids": [],
            "relations": {
                "revokes": found["revokes"],
                "amends": found["amends"],
                "revoked_by": [],
                "amended_by": [],
                "source_listed_related": entry["source_listed_related"],
            },
            "attachments": [attachments.check(url, key) for url in dict.fromkeys(entry["attachment_urls"])],
            "identity_conflicts": [],
            # Which category lists the document was found in: provenance, PPh/KUP/PPN only (K-051).
            "categories": sorted(entry["categories"], key=lambda c: (c["kategori"], c["asal"])),
            "original_files": entry["unusable_files"],
        }
        documents.append(document)

        if split:
            for order, unit in enumerate(split["units"]):
                unit_id = f"{doc_id}--{unit['section'][:1]}{order:03d}-{_label_slug(unit['label'])}"
                units.append({
                    "id": unit_id,
                    "document_id": doc_id,
                    "document_title": title,
                    "document_number": next((r["number_as_written"] for r in entry["source_records"]), None),
                    "order": order,
                    "label": unit["label"],
                    "section": unit["section"],
                    "structure": split["structure"],
                    "text": unit["text"],
                    "chars": len(unit["text"]),
                    "quality_flags": split["flags"],
                    "amendment_items": unit.get("amendment_items"),
                    "quoted_pasal": unit.get("quoted_pasal"),
                    "text_source": {"source": chosen["source"], "url": chosen["url"], "retrieved_at": chosen["retrieved_at"]},
                })
                document["pasal_ids"].append(unit_id)

    # Sources sometimes disagree about a document's type, which splits one regulation into two
    # entries: DJP records PP 20/2026 as "Peraturan Presiden" while JDIH records it as PP. They are
    # not merged here — that would be guessing — but each side points at the other.
    by_number = defaultdict(list)
    for document in documents:
        by_number[(document["identity"]["number"], document["identity"]["year"], document["identity"]["variant"])].append(document)
    for group in by_number.values():
        if len(group) < 2:
            continue
        # Sharing a number and year is normal (PMK 16/2016 and PER-16/PJ/2016 are different
        # regulations), so only an identical title is treated as a sign of the same document.
        for document in group:
            document["identity_conflicts"] = [{
                "id": other["id"],
                "code": other["identity"]["code"],
                "title": other["title"],
                "note": "nomor, tahun, dan judul sama tetapi jenisnya berbeda antar sumber; "
                        "kemungkinan satu peraturan yang sama, tidak digabungkan otomatis",
            } for other in group
                if other["id"] != document["id"] and _same_title(other["title"], document["title"])]

    by_key = {tuple(d["identity"].values()): d for d in documents}
    for key, entries in revoked_by.items():
        if key in by_key:
            by_key[key]["relations"]["revoked_by"] = entries
    for key, entries in amended_by.items():
        if key in by_key:
            by_key[key]["relations"]["amended_by"] = entries

    # Status last: it depends on what other documents' texts say about this one.
    for document in documents:
        key = tuple(document["identity"].values())
        revokers = [short_label(e["key"]) for e in revoked_by.get(key, [])]
        document["status"] = status.resolve(document["status_claims"], revokers)

    checks.check_documents(documents)
    checks.check_units(units, {d["id"] for d in documents})
    write(documents, units)
    return documents, units


# Mirrors regulationLabel() in src/lib/labels.js: "PP 55/2022" rather than the source's "55 TAHUN 2022".
SHORT_TYPE = {"PER-ESELON1": "Per. Eselon I", "KEP-ESELON1": "Kep. Eselon I", "PERPU": "Perpu",
              "PERPRES": "Perpres", "KEPPRES": "Keppres", "INPRES": "Inpres"}


def short_label(key):
    code, number, year, variant = key
    if code == "?":
        return "peraturan yang jenisnya tidak terbaca"
    label = f"{SHORT_TYPE.get(code, code)} {number}/{year}" if year else f"{SHORT_TYPE.get(code, code)} {number}"
    return label + (f" ({variant})" if variant else "")


def _same_title(a, b):
    normalise = lambda t: re.sub(r"[^A-Z0-9]+", " ", (t or "").upper()).strip()
    return bool(normalise(a)) and normalise(a) == normalise(b)


def _no_text_reason(entry):
    sources = {r["source"] for r in entry["source_records"]}
    if entry["unusable_files"]:
        return entry["unusable_files"][0]["reason"] + "; lihat berkas aslinya"
    if any(r.get("detail_error") == "detail belum diambil" for r in entry["source_records"]):
        return "halaman detail sumber belum diambil"
    if any(r.get("detail_error") for r in entry["source_records"]):
        return "halaman detail sumber gagal diambil"
    if sources == {"JDIH"}:
        return "hanya terdaftar di JDIH, dan JDIH berhenti dapat diakses sebelum teksnya diambil"
    return "halaman sumber hanya memuat metadata, tanpa teks dan tanpa lampiran"


def _label_slug(label):
    return re.sub(r"[^a-z0-9]+", "", str(label).lower()) or "x"


def write(documents, units):
    if config.CORPUS.exists():
        shutil.rmtree(config.CORPUS)
    (config.CORPUS / "documents").mkdir(parents=True)
    (config.CORPUS / "pasal").mkdir(parents=True)

    for document in documents:
        _dump(config.CORPUS / "documents" / f"{document['id']}.json", document)
    for unit in units:
        _dump(config.CORPUS / "pasal" / f"{unit['id']}.json", unit)

    index = [{
        "id": d["id"],
        "title": d["title"],
        "code": d["identity"]["code"],
        "number": d["identity"]["number"],
        "year": d["identity"]["year"],
        "variant": d["identity"]["variant"],
        "number_as_written": next((r["number_as_written"] for r in d["source_records"]), None),
        "status": d["status"]["value"],
        "status_uncertain": d["status"]["value"] == "tidak_pasti",
        "sources": sorted({r["source"] for r in d["source_records"]}),
        "categories": sorted({c["kategori"] for c in d["categories"]}),
        "text_available": d["text"]["available"],
        "text_chars": d["text"]["chars"],
        "pasal_count": len([p for p in d["pasal_ids"] if "--b" in p]),
        "structure": d["structure"],
        "quality_flags": d["quality_flags"],
        "attachment_count": len(d["attachments"]),
        "attachment_mismatch": sum(1 for a in d["attachments"] if a["match"] == "tidak_cocok"),
    } for d in documents]
    _dump(config.CORPUS / "index.json", index)

    body_units = [u for u in units if u["section"] == "batang_tubuh"]
    meta = {
        "documents": len(documents),
        "documents_with_text": sum(1 for d in documents if d["text"]["available"]),
        "documents_without_text": sum(1 for d in documents if not d["text"]["available"]),
        "body_units": len(body_units),
        "explanation_units": len(units) - len(body_units),
        "status_counts": _counts(d["status"]["value"] for d in documents),
        "structure_counts": _counts(d["structure"] for d in documents if d["structure"]),
        "documents_with_quality_flags": sum(1 for d in documents if d["quality_flags"]),
        "attachments": sum(len(d["attachments"]) for d in documents),
        "attachment_match_counts": _counts(a["match"] for d in documents for a in d["attachments"]),
        "inputs": {p.name: _sha256(p) for p in config.INPUTS + config.HARVEST_INPUTS if p.exists()},
        "category_counts": _counts(c for d in documents for c in sorted({x["kategori"] for x in d["categories"]})),
        "note": "Dibangun dari arsip poc/ tanpa permintaan jaringan. Jalankan: python -m pipeline.build",
    }
    _dump(config.CORPUS / "meta.json", meta)
    return meta


def _counts(values):
    result = {}
    for value in values:
        result[value] = result.get(value, 0) + 1
    return dict(sorted(result.items()))


def _sha256(path):
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def _dump(path, payload):
    # newline="\n" on purpose: the corpus must be byte-identical on every platform, otherwise
    # "the pipeline is deterministic" would only hold per operating system.
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
        encoding="utf8",
        newline="\n",
    )


if __name__ == "__main__":
    docs, pasal_units = build()
    meta_path = config.CORPUS / "meta.json"
    print(json.dumps(json.loads(meta_path.read_text(encoding="utf8")), ensure_ascii=False, indent=1)[:1200])
    print(f"\n{len(docs)} dokumen, {len(pasal_units)} unit -> {config.CORPUS}", file=sys.stderr)
