// The personal collection (M4) on the mock documents in tests/fixtures/koleksi, which are invented
// (invariant 10). Extraction, references to public regulations, search, and the backup round trip.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { decodeTextFile, extractPdf, extractPlain } from "../../src/lib/collection/extract.js";
import { findReferences } from "../../src/lib/collection/references.js";
import { collectionPayload, makeRecord, metadataText, newId } from "../../src/lib/collection/records.js";
import { exportBackup, mergeRecords, parseBackup, BackupError } from "../../src/lib/collection/backup.js";
import { buildSearchPayload } from "../../src/lib/search/payload.js";
import { SearchEngine } from "../../src/lib/search/engine.js";

const DIR = path.join("tests", "fixtures", "koleksi");
const KINDS = { se: "SE", nd: "ND", penegasan: "penegasan", putusan: "putusan" };
const NUMBERS = { se: "SE-901/PJ/2026", nd: "ND-902/PJ.03/2026", penegasan: "S-903/PJ.03/2026", putusan: "PUT-904/PP/M.XA/15/2026" };
const read = (name) => {
  const buffer = fs.readFileSync(path.join(DIR, name));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};
const { payload: publicPayload } = buildSearchPayload();

test("a PDF with a text layer gives its text; a scanned one gives none", async () => {
  for (const kind of Object.keys(KINDS)) {
    const withText = await extractPdf(read(`${kind}-teks.pdf`), pdfjs);
    assert.equal(withText.hasTextLayer, true, kind);
    assert.ok(withText.text.includes("DOKUMEN TIRUAN UNTUK PENGUJIAN"), kind);
    assert.ok(withText.text.includes(NUMBERS[kind]), kind);
    const scanned = await extractPdf(read(`${kind}-pindai.pdf`), pdfjs);
    assert.equal(scanned.hasTextLayer, false, kind);
    assert.equal(scanned.text, "", kind);
  }
});

test("extraction leaves the caller's PDF bytes untouched", async () => {
  const bytes = read("se-teks.pdf");
  const copy = new Uint8Array(bytes).slice();
  await extractPdf(bytes, pdfjs);
  assert.deepEqual(new Uint8Array(bytes), copy);
});

test(".txt files and pasted text are kept as written", () => {
  const text = decodeTextFile(read("nd.txt"));
  assert.ok(text.startsWith("DOKUMEN TIRUAN"));
  assert.equal(extractPlain("baris satu\r\nbaris dua\r\n").text, "baris satu\nbaris dua");
  assert.equal(extractPlain("   \n ").hasTextLayer, false);
});

test("references to public regulations are linked, with the sentence they come from", () => {
  const refs = findReferences(decodeTextFile(read("se.txt")), publicPayload.docs, NUMBERS.se);
  const byWritten = Object.fromEntries(refs.map((r) => [r.written, r]));
  assert.deepEqual(byWritten["Peraturan Menteri Keuangan Nomor 168 Tahun 2023"].matches.map((m) => m.id), ["pmk-168-2023"]);
  assert.deepEqual(byWritten["PER-11/PJ/2025"].matches.map((m) => m.id), ["per-djp-11-2025"]);
  assert.ok(byWritten["Peraturan Pemerintah Nomor 58 Tahun 2023"].sentence.includes("tarif efektif"));
  // PMK 81/2024 entered the corpus with KUP (M5).
  assert.deepEqual(byWritten["Peraturan Menteri Keuangan Nomor 81 Tahun 2024"].matches.map((m) => m.id), ["pmk-81-2024"]);
  // Not in the corpus: kept as text, never linked to a guess.
  assert.deepEqual(byWritten["Peraturan Menteri Keuangan Nomor 999 Tahun 2099"].matches, []);
  // The document's own number is not a reference.
  assert.ok(!refs.some((r) => r.number.serial === "901"));
});

test("one regulation's type does not leak into the next number", () => {
  const refs = findReferences(decodeTextFile(read("putusan.txt")), publicPayload.docs, NUMBERS.putusan);
  assert.deepEqual(refs.map((r) => r.matches.map((m) => m.id)[0]), ["pmk-141-2015", "uu-36-2008"]);
});

async function allRecords() {
  const records = [];
  let clock = 0;
  for (const [kind, code] of Object.entries(KINDS)) {
    for (const [variant, source] of [["teks", "pdf"], ["pindai", "pdf"], ["txt", "txt"]]) {
      const name = variant === "txt" ? `${kind}.txt` : `${kind}-${variant}.pdf`;
      const bytes = read(name);
      const extracted = source === "txt" ? extractPlain(decodeTextFile(bytes)) : await extractPdf(bytes, pdfjs);
      records.push(
        await makeRecord({
          id: newId(),
          meta: { kind: code, number: NUMBERS[kind], date: "2026-09-01", subject: `Perihal tiruan ${kind} ${variant}`, note: "catatan uji" },
          source,
          file: { name, type: source === "pdf" ? "application/pdf" : "text/plain", bytes },
          extracted,
          references: findReferences(extracted.text, publicPayload.docs, NUMBERS[kind]),
          importedAt: new Date(Date.UTC(2026, 9, 2, 0, 0, clock++)).toISOString(),
        })
      );
    }
  }
  records.push(
    await makeRecord({
      id: newId(),
      meta: { kind: "lainnya", number: "", date: "", subject: "Catatan tempel", note: "" },
      source: "tempel",
      file: null,
      extracted: extractPlain("Teks tempel tiruan tentang bonus tahunan pegawai."),
      references: [],
      importedAt: new Date(Date.UTC(2026, 9, 2, 0, 1, 0)).toISOString(),
    })
  );
  return records;
}

test("the collection is searched with the same engine; a scan only by what the user typed", async () => {
  const records = await allRecords();
  const engine = new SearchEngine(collectionPayload(records, publicPayload));
  // "Majelis" is in the body of the putusan: found in the text versions, not in the scan.
  engine.search("majelis");
  const hits = engine.page(0, 20);
  const scan = records.find((r) => r.file && r.file.name === "putusan-pindai.pdf");
  assert.ok(hits.length >= 2);
  assert.ok(!hits.some((h) => h.id === scan.id), "isi pindaian tidak boleh tercari");
  // The scan is found by its metadata.
  engine.search("perihal tiruan putusan pindai");
  assert.equal(engine.page(0, 1)[0].id, scan.id);
  assert.ok(metadataText(scan).includes("Putusan Pengadilan Pajak"));
  // By its own number, through the same number parser as public regulations.
  engine.search("SE-901/PJ/2026");
  assert.ok(engine.page(0, 5).every((h) => h.private));
});

test("every record is unverified", async () => {
  for (const record of await allRecords()) assert.equal(record.verified, false);
});

test("backup round trip: export, delete all, restore, compare byte for byte", async () => {
  const records = await allRecords();
  const first = exportBackup(records);
  let store = records.slice();
  store = []; // delete everything
  const restored = await parseBackup(first);
  store = mergeRecords(store, restored, "ganti").records;
  const second = exportBackup(store);
  assert.equal(Buffer.compare(Buffer.from(first), Buffer.from(second)), 0, "cadangan kedua harus sama persis");
  for (const original of records.filter((r) => r.file)) {
    const back = store.find((r) => r.id === original.id);
    assert.equal(Buffer.compare(Buffer.from(back.file.bytes), Buffer.from(original.file.bytes)), 0, original.file.name);
  }
});

test("restore asks for a mode: merge keeps what is there, replace takes the backup", async () => {
  const records = await allRecords();
  const restored = await parseBackup(exportBackup(records.slice(0, 3)));
  const merged = mergeRecords(records.slice(2), restored, "gabung");
  assert.equal(merged.added, 2);
  assert.equal(merged.skipped, 1);
  assert.equal(merged.records.length, records.length);
  assert.equal(mergeRecords(records, restored, "ganti").records.length, 3);
  assert.throws(() => mergeRecords(records, restored, "entah"));
});

test("a damaged backup is refused, not half restored", async () => {
  const records = await allRecords();
  const text = new TextDecoder().decode(exportBackup(records));
  const record = records.find((r) => r.file);
  const damaged = text.replace(record.file.sha256, "0".repeat(64));
  await assert.rejects(parseBackup(new TextEncoder().encode(damaged)), BackupError);
  await assert.rejects(parseBackup(new TextEncoder().encode("{}")), BackupError);
});

test("every fixture says it is a mock (invariant 10: no real user document in the repository)", () => {
  for (const name of fs.readdirSync(DIR).filter((f) => f.endsWith(".txt"))) {
    assert.ok(fs.readFileSync(path.join(DIR, name), "utf8").startsWith("DOKUMEN TIRUAN UNTUK PENGUJIAN"), name);
  }
});
