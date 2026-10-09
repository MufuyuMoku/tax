// The token index (K-069) must not change a single result. The engine is compared with a frozen
// copy of the engine that scanned one long normalised string (mesin-rujukan.mjs): for every
// question of the case set and the holdout set, and for number, phrase and filter queries, the
// whole ranked list must be identical, with the same weights, scores, coverage, citations and
// matching pasal, and the first page must show the same snippets.
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
];
const FILTERED = [
  ["bonus", { codes: ["PMK"] }],
  ["natura", { statuses: ["tidak_pasti"] }],
  ["keberatan", { category: "KUP" }],
  ["pajak", { from: 2020, to: 2024 }],
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
  const run = (e, q, filters) => {
    const summary = { ...e.search(q, filters), took: 0 };
    const ranked = e.last.results.map((r) => [r.d, r.weight, r.score, r.coverage, r.cites, r.number, r.units]);
    return JSON.stringify([summary, ranked, e.page(0, 50)]);
  };
  const differ = [];
  let compared = 0;
  for (const [q, filters] of queries) {
    const mine = run(engine, q, filters);
    if (mine !== run(reference, q, filters)) differ.push(q);
    compared += engine.last.results.length;
  }
  assert.deepEqual(differ, []);
  assert.ok(queries.length >= 60 && compared > 50000, `${queries.length} kueri, ${compared} hasil`);
  // isKnown() for imported text (K-043) uses the same vocabulary as before.
  const before = new Set(reference.body.text.split(" ").filter((t) => t && t !== "\u0001"));
  assert.deepEqual([...engine.vocabularySet()].sort(), [...before].sort());
});
