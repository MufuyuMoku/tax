// The engine on the real corpus, through the same payload the site ships. These pin the behaviour
// the M3 criteria ask for; if the corpus changes, a failure here says which promise broke.
import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchPayload } from "../../src/lib/search/payload.js";
import { SearchEngine } from "../../src/lib/search/engine.js";

const { payload } = buildSearchPayload();
const engine = new SearchEngine(payload);

function top(query, filters = null, n = 10) {
  const summary = engine.search(query, filters);
  return { summary, results: engine.page(0, n) };
}

test("every way of writing PMK 168/2023 puts it first", () => {
  for (const query of ["PMK 168/2023", "168/PMK.03/2023", "PMK-168/PMK.03/2023"]) {
    const { results } = top(query);
    assert.equal(results[0].id, "pmk-168-2023", query);
    assert.deepEqual(results[0].reasons, ["nomor"], query);
  }
});

test("every way of writing PER-11/PJ/2025 puts it first", () => {
  for (const query of ["PER-11/PJ/2025", "PER 11 2025"]) {
    assert.equal(top(query).results[0].id, "per-djp-11-2025", query);
  }
});

test("documents without text are found by title and by number", () => {
  const byTitle = top("PTKP", null, 50).results.filter((r) => !r.hasText);
  assert.ok(byTitle.length >= 3, `${byTitle.length} dokumen tanpa teks`);
  // PMK 166/PMK.010/2017 is listed only by JDIH, whose full-text file answers 404 (K-066).
  const pmk166 = top("PMK 166/PMK.010/2017").results;
  assert.equal(pmk166[0].id, "pmk-166-2017");
  assert.equal(pmk166[0].hasText, false);
});

test("PPh 21 is read as Pajak Penghasilan Pasal 21", () => {
  const { summary, results } = top("PPh 21");
  assert.deepEqual(summary.concepts[0].forms, ["PPh 21", "PPh Pasal 21", "Pajak Penghasilan Pasal 21"]);
  for (const result of results) assert.ok(/PASAL 21/i.test(result.title) || result.units.length, result.id);
});

test("an OCR misreading is found and shown as written", () => {
  // DJP's text of PER-21/PJ/2019 writes "Dircktur"; searching "direktur" must reach it.
  assert.equal(payload.ocr.dircktur, "direktur");
  const { results } = top('"Peraturan Direktur Jenderal Pajak Nomor PER-18/PJ/2017"', null, 200);
  const hit = results.find((r) => r.id === "per-djp-21-2019");
  assert.ok(hit, "PER-21/PJ/2019 tidak ditemukan");
  const marked = hit.units.flatMap((u) => u.segments.filter((s) => s.mark).map((s) => s.text));
  assert.ok(marked.some((t) => t.includes("Dircktur")), JSON.stringify(marked));
});

test("the status filter has tidak pasti as an option of its own", () => {
  const { summary, results } = top("natura", { statuses: ["tidak_pasti"] }, 500);
  assert.ok(summary.total > 0);
  assert.ok(results.every((r) => r.status === "tidak_pasti"));
});

test("type and year filters narrow the results", () => {
  const { results } = top("natura", { codes: ["PMK"], from: 2022, to: 2024 }, 500);
  assert.ok(results.length > 0);
  for (const r of results) assert.ok(r.code === "PMK" && r.year >= "2022" && r.year <= "2024", r.id);
});
