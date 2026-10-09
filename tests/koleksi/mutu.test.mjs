// Text quality of imported PDFs (K-043) and references that follow the corpus (K-042), on mock
// documents only (invariant 10).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { assessText, decodeTextFile, extractPdf, extractPlain } from "../../src/lib/collection/extract.js";
import { findReferences, refreshReferences } from "../../src/lib/collection/references.js";
import { collectionPayload, makeRecord, newId } from "../../src/lib/collection/records.js";
import { buildSearchPayload } from "../../src/lib/search/payload.js";
import { SearchEngine } from "../../src/lib/search/engine.js";
import { normToken } from "../../src/lib/search/normalize.js";

const DIR = path.join("tests", "fixtures", "koleksi");
const read = (name) => {
  const b = fs.readFileSync(path.join(DIR, name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const { payload } = buildSearchPayload();
const vocabulary = new SearchEngine(payload).vocabularySet();
const isKnown = (word) => vocabulary.has(normToken(word, payload.ocr));

test("a PDF whose font has no Unicode map has a text layer, but it is judged unreadable", async () => {
  const extracted = await extractPdf(read("se-tanpa-tounicode.pdf"), pdfjs);
  assert.equal(extracted.hasTextLayer, true, "pdf.js does return characters");
  const quality = assessText(extracted.text, isKnown);
  assert.equal(quality.readable, false);
  assert.ok(quality.knownRatio < 0.1, JSON.stringify(quality));
});

test("readable mock documents pass the same check", async () => {
  for (const kind of ["se", "nd", "penegasan", "putusan"]) {
    const extracted = await extractPdf(read(`${kind}-teks.pdf`), pdfjs);
    assert.equal(assessText(extracted.text, isKnown).readable, true, kind);
    assert.equal(assessText(decodeTextFile(read(`${kind}.txt`)), isKnown).readable, true, kind);
  }
});

test("replacement characters make text unreadable", () => {
  const broken = "Pasal 1 ��� �� pajak ���� penghasilan ���";
  assert.equal(assessText(broken, isKnown).readable, false);
});

async function garbledRecord(override) {
  const extracted = await extractPdf(read("se-tanpa-tounicode.pdf"), pdfjs);
  return makeRecord({
    id: newId(),
    meta: { kind: "SE", number: "SE-901/PJ/2026", date: "2026-09-01", subject: "Perihal tiruan rusak", note: "" },
    source: "pdf",
    file: { name: "se-tanpa-tounicode.pdf", type: "application/pdf", bytes: read("se-tanpa-tounicode.pdf") },
    extracted,
    quality: assessText(extracted.text, isKnown),
    readableOverride: override,
    references: findReferences(extracted.text, payload.docs, "SE-901/PJ/2026"),
    referencesCorpus: payload.corpus.fingerprint,
    importedAt: "2026-10-03T00:00:00.000Z",
  });
}

test("unreadable text is kept, but not shown as content and not searched", async () => {
  const record = await garbledRecord(false);
  assert.equal(record.hasText, false);
  assert.equal(record.text, null);
  assert.ok(record.unreadableText.length > 100, "teks rusak tetap disimpan");
  assert.deepEqual(record.references, []);
  const engine = new SearchEngine(collectionPayload([record], payload));
  engine.search("Perihal tiruan rusak");
  assert.equal(engine.page(0, 1)[0].id, record.id, "tetap ditemukan lewat isian");
  assert.equal(engine.page(0, 1)[0].units.length, 0, "isinya tidak ikut dicari");
});

test("the user can say the text is readable after all", async () => {
  const record = await garbledRecord(true);
  assert.equal(record.hasText, true);
  assert.equal(record.readableOverride, true);
  assert.equal(record.unreadableText, null);
});

test("the corpus fingerprint is stable across builds", () => {
  assert.match(payload.corpus.fingerprint, /^[0-9a-f]{16}$/);
  assert.equal(buildSearchPayload().payload.corpus.fingerprint, payload.corpus.fingerprint);
});

test("references are matched again when the corpus fingerprint changes, and only then", async () => {
  const text = decodeTextFile(read("se.txt"));
  // An older corpus without PMK 81/2024 (before KUP entered it in M5).
  const older = payload.docs.filter((d) => d.id !== "pmk-81-2024");
  const record = await makeRecord({
    id: newId(),
    meta: { kind: "SE", number: "SE-901/PJ/2026", date: "", subject: "", note: "" },
    source: "txt",
    file: null,
    extracted: extractPlain(text),
    references: findReferences(text, older, "SE-901/PJ/2026"),
    referencesCorpus: "corpus-lama",
    importedAt: "2026-10-03T00:00:00.000Z",
  });
  assert.deepEqual(refreshReferences([record], older, "corpus-lama"), []);
  // The current corpus also has PMK 81/2024: the reference that was text becomes a link.
  const changed = refreshReferences([record], payload.docs, "corpus-baru");
  assert.equal(changed.length, 1);
  const pmk81 = record.references.find((r) => r.number.serial === "81");
  assert.deepEqual(pmk81.matches.map((m) => m.id), ["pmk-81-2024"]);
  assert.equal(record.referencesCorpus, "corpus-baru");
});
