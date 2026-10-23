// The token index (K-069) must not change a single result. The engine is compared with a frozen
// copy of the engine that scanned one long normalised string (mesin-rujukan.mjs): for every
// question of the case set and the holdout set, and for number, phrase and filter queries, the
// whole ranked list must be identical, with the same weights, scores, coverage, citations and
// matching pasal, and the first page must show the same snippets.
//
// Article references (K-101) change results on purpose, and only for queries read as one
// ("16D", "pasal 21", "PPh 23"): documents citing the article in so many words move to the front,
// each part keeping the frozen engine's order, and documents that cite it without any of the
// query's words are added at the end of the front part. Every other query stays identical, and
// the queries read as a reference are listed here, so a query cannot become one unnoticed.
import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchPayload } from "../../src/lib/search/payload.js";
import { SearchEngine } from "../../src/lib/search/engine.js";
import { SearchEngine as ReferenceEngine } from "./mesin-rujukan.mjs";
import { loadCases } from "./evaluate.mjs";

const EXTRA = [
  "PPh 21", "PMK 168/2023", "168/PMK.03/2023", "PER-11/PJ/2025", "PER 11 2025", "PP 55/2022", "UU 7/2021",
  '"rencana penanaman modal baru"', '"surat teguran"', "natura", "PTKP", "potong", "pajak", "NPWP",
  "keberatan banding", "PPN", "faktur pajak", "SE-901/PJ/2026", "1770 SS", "TER",
  // K-101: the queries of the article reference check, and look-alikes that must stay ordinary.
  "14D", "16D", "pasal 16D", "PPN 16D", "16C", "31E", "pasal 4 ayat 2", "PPh 4(2)", "pasal 21", "PPh 23",
  "Pasal 32A UU PPh", "16D aktiva", "tarif PPN 12 persen", "PMK 168/2023 pasal 5", '"Pasal 16D"',
];
const FILTERED = [
  ["bonus", { codes: ["PMK"] }],
  ["natura", { statuses: ["tidak_pasti"] }],
  ["keberatan", { category: "KUP" }],
  ["pajak", { from: 2020, to: 2024 }],
  ["16D", { codes: ["PMK"] }],
];
// Read as article references; every other query must give exactly the frozen engine's results.
const REFERENCES = [
  "Cara menghitung potongan Pajak Penghasilan (PPh 21) karyawan sesuai tarif TER terbaru",
  "16D PPN", "16C membangun sendiri", "PPh 4(2) sewa", "pasal 21 pesangon", "31E UMKM", "32A P3B",
  "PPh 21", "16D", "pasal 16D", "PPN 16D", "16C", "31E", "pasal 4 ayat 2", "PPh 4(2)", "pasal 21", "PPh 23",
  "Pasal 32A UU PPh", "16D aktiva",
];

test("the token index gives exactly the results of scanning the normalised text", () => {
  const { payload } = buildSearchPayload();
  const engine = new SearchEngine(payload);
  const reference = new ReferenceEngine(payload);
  const queries = [
    ...[...loadCases(), ...loadCases("kasus-tahan.json")].map((c) => [c.pertanyaan, null]),
    ...EXTRA.map((q) => [q, null]),
    ...FILTERED,
  ];
  const tuple = (r) => [r.d, r.weight, r.score, r.coverage, r.cites, r.number, r.units];
  const run = (e, q, filters) => {
    const { article, ...summary } = { ...e.search(q, filters), took: 0 };
    const ranked = e.last.results.map(tuple);
    const { total, ...rest } = summary;
    return { article, rest: JSON.stringify(rest), text: JSON.stringify([summary, ranked, e.page(0, 50).map(({ citesArticle, ...item }) => item)]) };
  };
  const differ = [];
  const read = [];
  let compared = 0;
  for (const [q, filters] of queries) {
    const mine = run(engine, q, filters);
    const theirs = run(reference, q, filters);
    compared += engine.last.results.length;
    if (!mine.article || !mine.article.exact) {
      // "14D" is read as a reference to an article no law has: searched as usual.
      if (mine.text !== theirs.text) differ.push(q);
      continue;
    }
    read.push(q);
    // The words are read as before; only the order and the documents added change.
    if (mine.rest !== theirs.rest) differ.push(`${q} (ringkasan)`);
    // The frozen ranking, split into the documents citing the article and the rest, each in order.
    const cited = engine.last.article.cited;
    const before = reference.last.results.map(tuple);
    const ids = new Set(before.map((t) => t[0]));
    const front = engine.last.results.slice(0, mine.article.exact);
    const added = front.filter((r) => !ids.has(r.d));
    const expected = [...before.filter((t) => cited.has(t[0])), ...before.filter((t) => !cited.has(t[0]))];
    const got = engine.last.results.filter((r) => ids.has(r.d)).map(tuple);
    if (JSON.stringify(got) !== JSON.stringify(expected)) differ.push(`${q} (urutan)`);
    if (!added.every((r) => r.citesOnly && cited.has(r.d))) differ.push(`${q} (tambahan)`);
    if (engine.last.results.slice(mine.article.exact).some((r) => cited.has(r.d))) differ.push(`${q} (pemisahan)`);
  }
  assert.deepEqual(differ, []);
  const unique = (list) => list.filter((q, i, all) => all.indexOf(q) === i).sort();
  assert.deepEqual(unique(read), unique(REFERENCES));
  assert.ok(queries.length >= 60 && compared > 50000, `${queries.length} kueri, ${compared} hasil`);
  // isKnown() for imported text (K-043) uses the same vocabulary as before.
  const vocabulary = new Set(reference.body.text.split(" ").filter((t) => t && t !== "\u0001"));
  assert.deepEqual([...engine.vocabularySet()].sort(), [...vocabulary].sort());
});
