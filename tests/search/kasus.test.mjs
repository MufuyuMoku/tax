// The case set: every quote is in the corpus, and no question ranks worse than the baseline that
// was recorded before padanan were added (K-030). Improving a rank is fine; losing one fails.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluate, loadCases, verifyQuotes } from "./evaluate.mjs";

const cases = loadCases();

test("the case set has 20 to 25 questions, each with an answer", () => {
  assert.ok(cases.length >= 20 && cases.length <= 25, `${cases.length} pertanyaan`);
  for (const c of cases) assert.ok(c.jawaban.length > 0, c.id);
});

test("every quote in the case set is found word for word in the corpus", () => {
  assert.deepEqual(verifyQuotes(cases), []);
});

test("no case question ranks worse than the baseline", () => {
  const baseline = JSON.parse(fs.readFileSync(path.join("tests", "search", "garis-dasar.json"), "utf8")).peringkat;
  const now = evaluate(cases);
  const worse = [];
  for (const c of cases) {
    const before = baseline[c.id];
    const after = now[c.id].rank;
    if (before === undefined) worse.push(`${c.id}: tidak ada di garis dasar`);
    else if (before !== null && (after === null || after > before)) worse.push(`${c.id}: ${before} -> ${after}`);
  }
  assert.deepEqual(worse, []);
});

test("the holdout set has its 10 questions and every quote is in the corpus", () => {
  // Ranks on this set are reported by scripts/search-tahan.mjs, never gated: padanan and the
  // engine are frozen against it, so a test that pushes them to fit it would defeat its purpose.
  const holdout = loadCases("kasus-tahan.json");
  assert.equal(holdout.length, 10);
  for (const c of holdout) assert.ok(["a", "b", "c"].includes(c.golongan), c.id);
  assert.deepEqual(verifyQuotes(holdout), []);
});
