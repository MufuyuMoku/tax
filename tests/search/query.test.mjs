// Query parsing, number forms, terms, and the OCR map. Small hand-written inputs only.
import test from "node:test";
import assert from "node:assert/strict";
import { compileTerms, numberMatches, parseNumber, parseQuery } from "../../src/lib/search/query.js";
import { buildOcrMap, normalizeText } from "../../src/lib/search/normalize.js";

const PMK_168 = { code: "PMK", number: "168", year: "2023" };
const PER_11 = { code: "PER-DJP", number: "11", year: "2025" };
const KMK_44 = { code: "KMK", number: "44/KMK.04", year: "1998" };

test("the same PMK written three ways is one number", () => {
  for (const written of ["PMK 168/2023", "168/PMK.03/2023", "PMK-168/PMK.03/2023"]) {
    const number = parseNumber(written);
    assert.ok(number, written);
    assert.ok(numberMatches(number, PMK_168), written);
    assert.ok(!numberMatches(number, PER_11), written);
  }
});

test("the same PER written two ways is one number", () => {
  for (const written of ["PER-11/PJ/2025", "PER 11 2025", "PER-011/PJ/2025"]) {
    const number = parseNumber(written);
    assert.ok(number, written);
    assert.ok(numberMatches(number, PER_11), written);
    assert.ok(!numberMatches(number, { code: "PMK", number: "11", year: "2025" }), written);
  }
});

test("a KMK keeps matching by its serial even though the series is part of its identity", () => {
  assert.ok(numberMatches(parseNumber("44/KMK.04/1998"), KMK_44));
  assert.ok(numberMatches(parseNumber("KMK 44 Tahun 1998"), KMK_44));
});

test("a pasal number next to words is not a regulation number", () => {
  assert.equal(parseNumber("PPh 21 2024"), null);
  assert.equal(parseNumber("PPh 21"), null);
  assert.equal(parseNumber("natura"), null);
});

test("words left over after the number are kept", () => {
  const number = parseNumber("PMK 168/2023 bonus");
  assert.equal(number.rest, "BONUS");
});

const TERMS = [
  ["PPh {n}", "PPh Pasal {n}", "Pajak Penghasilan Pasal {n}"],
  ["PPh", "Pajak Penghasilan"],
  ["PTKP", "Penghasilan Tidak Kena Pajak"],
];

function parse(query, ocr = {}) {
  return parseQuery(query, { terms: compileTerms(TERMS, ocr), stopwords: ["yang", "dan"], ocr });
}

test("PPh 21 means Pajak Penghasilan Pasal 21", () => {
  const [concept] = parse("PPh 21");
  assert.equal(concept.kind, "term");
  assert.deepEqual(
    concept.alternatives.map((a) => a.join(" ")),
    ["pph 21", "pph pasal 21", "pajak penghasilan pasal 21"]
  );
});

test("the long form finds the abbreviation too", () => {
  const [concept] = parse("Penghasilan Tidak Kena Pajak");
  assert.deepEqual(concept.alternatives.map((a) => a.join(" ")), ["ptkp", "penghasilan tidak kena pajak"]);
});

test("common words are marked, not removed, and quoted phrases stay whole", () => {
  const concepts = parse('natura "yang diterima" dan kenikmatan');
  assert.deepEqual(
    concepts.map((c) => [c.label, c.kind, c.stop]),
    [
      ['"yang diterima"', "phrase", false],
      ["natura", "word", false],
      ["dan", "word", true],
      ["kenikmatan", "word", false],
    ]
  );
});

test("OCR corrections are learnt from the corpus and only touch rare tokens", () => {
  const freq = new Map([
    ["menteri", 900], ["rnenteri", 2], ["internasional", 500], ["dan", 5000], ["cian", 1], ["clan", 50],
    ["mengenai", 800], ["mengenal", 2],
  ]);
  const settings = {
    aturan: [["rn", "m"], ["cl", "d"], ["i", "l"], ["l", "i"]],
    ambang: { frekuensi_maks: 200, kelipatan_min: 25, frekuensi_benar_min: 30, panjang_min: 4 },
    pasangan: {},
    jangan_dikoreksi: ["mengenal"],
  };
  const { map } = buildOcrMap(freq, settings);
  assert.equal(map.rnenteri, "menteri");
  assert.equal(map.clan, "dan");
  assert.equal(map.cian, "dan", "a correction that lands on another misreading follows the chain");
  assert.equal(map.internasional, undefined);
  assert.equal(map.mengenal, undefined, "jangan_dikoreksi is respected");
});

test("OCR corrections apply to both the text and the query", () => {
  const ocr = { rnenteri: "menteri", clan: "dan" };
  assert.equal(normalizeText("Rnenteri Keuangan clan Direktur", ocr).text, "menteri keuangan dan direktur");
  const [concept] = parse("rnenteri", ocr);
  assert.deepEqual(concept.alternatives, [["menteri"]]);
});
