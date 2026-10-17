// The definition box (K-081, K-096): which queries ask for a definition, what is read from a pasal,
// and, on the real corpus, the six terms the owner asked to check. The ranking is not touched: the
// box is looked up beside it (tests/search/setara.test.mjs still compares every ranked list).
import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchPayload } from "../../src/lib/search/payload.js";
import { definitionTerm, extractDefinitions, pickDefinitions, sameTerms, termKey } from "../../src/lib/search/definitions.js";

test("definition questions and lone terms are recognised; other queries are not", () => {
  const known = (key) => ["pkp", "npwp", "pajak masukan"].includes(key);
  assert.equal(definitionTerm("apa itu PKP", known), "pkp");
  assert.equal(definitionTerm("Apa yang dimaksud dengan Pajak Masukan?", known), "pajak masukan");
  assert.equal(definitionTerm("pengertian NPWP", known), "npwp");
  assert.equal(definitionTerm("PKP adalah", known), "pkp");
  assert.equal(definitionTerm("NPWP", known), "npwp");
  assert.equal(definitionTerm("tarif PPh pesangon", known), null);
  assert.equal(definitionTerm("apa itu kurs", known), null);
});

test("items of a definition pasal: term, alias, and where they stand", () => {
  const text = [
    "Pasal 1",
    "Dalam Peraturan Menteri ini yang dimaksud dengan:",
    "1.",
    "Nomor Pokok Wajib Pajak yang selanjutnya disingkat NPWP adalah nomor yang diberikan kepada Wajib Pajak.",
    "2.",
    "dan seterusnya adalah bukan definisi.",
  ].join("\n");
  const found = extractDefinitions(text);
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].terms.map(termKey), ["nomor pokok wajib pajak", "npwp"]);
  assert.equal(found[0].place, "angka 1");
  assert.ok(text.slice(found[0].start, found[0].end).startsWith("Nomor Pokok Wajib Pajak"));
  // Without "yang dimaksud dengan" a sentence with "adalah" is not read as a definition.
  assert.equal(extractDefinitions("Pasal 5\nTarif adalah 5%.").length, 0);
});

test("the six terms: in-force sources first, at most three wordings, quoted as written", () => {
  const { payload } = buildSearchPayload();
  const known = (key) => sameTerms(key, payload.terms).some((k) => payload.definitions.terms[k]);
  const expected = {
    PKP: /^Pengusaha Kena Pajak adalah/,
    PTKP: /^Penghasilan Tidak Kena Pajak adalah/,
    NPWP: /^Nomor Pokok Wajib Pajak adalah/,
    Penghasilan: /objek pajak adalah penghasilan, yaitu/,
    "Pajak Masukan": /^Pajak Masukan adalah/,
    BPHTB: /^Bea [Pp]erolehan Hak atas Tanah dan Bangunan/,
  };
  for (const [query, first] of Object.entries(expected)) {
    const term = definitionTerm(query, known);
    assert.ok(term, query);
    const { shown, disputedOnly } = pickDefinitions(payload.definitions, sameTerms(term, payload.terms), payload.units, payload.docs);
    assert.ok(shown.length >= 1 && shown.length <= 3, query);
    assert.equal(disputedOnly, false, query);
    assert.match(payload.texts[shown[0].unit].slice(shown[0].start, shown[0].end), first, query);
    for (const d of shown) assert.ok(["berlaku", "diubah_atau_dicabut_sebagian"].includes(payload.docs[d.doc].status), query);
  }
});
