// The engine on a tiny hand-written corpus: number matches, documents without text, filters,
// OCR tolerance, and snippets that keep the source text as it is.
import test from "node:test";
import assert from "node:assert/strict";
import { SearchEngine } from "../../src/lib/search/engine.js";

function doc(id, fields) {
  return { id, label: id, written: null, title: "", code: "PMK", number: "1", year: "2020", status: "berlaku",
    hasText: true, pasal: 1, noTextReason: null, sources: [{ source: "DJP", url: `https://example.test/${id}` }],
    twins: [], ...fields };
}

const payload = {
  docs: [
    doc("pmk-168-2023", { title: "Petunjuk Pelaksanaan Pemotongan Pajak", number: "168", year: "2023" }),
    doc("kmk-5-1990", { title: "Faktor Penyesuaian Penghasilan Tidak Kena Pajak", code: "KMK", number: "5/KMK.04",
      year: "1990", status: "tidak_pasti", hasText: false, pasal: 0, noTextReason: "hanya metadata" }),
    doc("per-djp-2-2024", { title: "Bukti Pemotongan", code: "PER-DJP", number: "2", year: "2024", status: "tidak_pasti" }),
  ],
  units: [
    { id: "pmk-168-2023--b000-1", doc: 0, label: "Pasal 1", section: "b" },
    { id: "per-djp-2-2024--b000-1", doc: 2, label: "Pasal 1", section: "b" },
    { id: "per-djp-2-2024--b001-2", doc: 2, label: "Pasal 2", section: "b" },
  ],
  texts: [
    "Pasal 1\nPemotongan Pajak Penghasilan Pasal 21 atas bonus yang diterima pegawai tetap.",
    "Pasal 1\nBukti pemotongan PPh Pasal 21 dibuat oleh pemotong.",
    "Pasal 2\nKetentuan ini ditetapkan oleh Rnenteri Keuangan sebagaimana Peraturan Menteri Keuangan Nomor 168 Tahun 2023.",
  ],
  ocr: { rnenteri: "menteri" },
  terms: [["PPh {n}", "PPh Pasal {n}", "Pajak Penghasilan Pasal {n}"], ["PTKP", "Penghasilan Tidak Kena Pajak"]],
  stopwords: ["yang"],
};
const engine = new SearchEngine(payload);

function ids(query, filters) {
  engine.search(query, filters);
  return engine.page(0, 10).map((r) => r.id);
}

test("a number finds the document, then the documents that cite it", () => {
  assert.deepEqual(ids("168/PMK.03/2023"), ["pmk-168-2023", "per-djp-2-2024"]);
  const [first, second] = engine.page(0, 2);
  assert.deepEqual(first.reasons, ["nomor"]);
  assert.ok(second.reasons.includes("menyebut"));
});

test("a document without text is found by its title, through an abbreviation", () => {
  const results = (engine.search("PTKP"), engine.page(0, 10));
  assert.deepEqual(results.map((r) => r.id), ["kmk-5-1990"]);
  assert.equal(results[0].hasText, false);
  assert.deepEqual(results[0].reasons, ["judul"]);
});

test("a document without text is found by its number", () => {
  assert.deepEqual(ids("KMK 5 1990"), ["kmk-5-1990"]);
});

test("PPh 21 finds both the long and the short form", () => {
  assert.deepEqual(ids("PPh 21").sort(), ["per-djp-2-2024", "pmk-168-2023"]);
});

test("the uncertain status is a filter of its own", () => {
  assert.deepEqual(ids("pemotongan", { statuses: ["tidak_pasti"] }), ["per-djp-2-2024"]);
  assert.deepEqual(ids("pemotongan", { statuses: ["berlaku"] }), ["pmk-168-2023"]);
  assert.deepEqual(ids("pemotongan", { codes: ["PMK"], from: 2021, to: 2023 }), ["pmk-168-2023"]);
});

test("an OCR misreading in the text is found, and shown as the source wrote it", () => {
  assert.deepEqual(ids("menteri keuangan"), ["per-djp-2-2024"]);
  const [result] = engine.page(0, 1);
  const marked = result.units[0].segments.filter((s) => s.mark).map((s) => s.text);
  assert.ok(marked.includes("Rnenteri Keuangan"), JSON.stringify(marked));
});

test("results lead to the matching pasal, and the snippet skips the pasal heading", () => {
  engine.search("bonus");
  const [result] = engine.page(0, 1);
  assert.equal(result.units[0].id, "pmk-168-2023--b000-1");
  assert.ok(result.units[0].segments[0].text.startsWith("Pemotongan"));
  assert.equal(result.units[0].fragment, "bonus");
});

test("a word found as typed outranks the same word found only through a padanan", () => {
  const synonymPayload = {
    ...payload,
    docs: [doc("typed", { title: "Satu" }), doc("padanan", { title: "Dua" })],
    units: [
      { id: "typed--b000-1", doc: 0, label: "Pasal 1", section: "b" },
      { id: "padanan--b000-1", doc: 1, label: "Pasal 1", section: "b" },
    ],
    texts: ["Pasal 1\nBonus bagi karyawan dibayar setahun sekali.", "Pasal 1\nBonus bagi pegawai dibayar setahun sekali."],
    synonyms: { weight: 0.6, groups: [["karyawan", "pegawai"]] },
  };
  const synonymEngine = new SearchEngine(synonymPayload);
  const summary = synonymEngine.search("karyawan bonus");
  assert.equal(summary.total, 2, "padanan tetap menemukan dokumen kedua");
  assert.deepEqual(synonymEngine.page(0, 2).map((r) => r.id), ["typed", "padanan"]);
  assert.deepEqual(synonymEngine.search("pegawai bonus") && synonymEngine.page(0, 2).map((r) => r.id), ["padanan", "typed"]);
});
