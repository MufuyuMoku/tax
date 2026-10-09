// The case set: every quote is in the corpus, the median rank does not get worse, and no question
// ranks worse than its baseline unless the owner approved that drop, up to the approved rank (K-063),
// or it is a drop of at most two ranks that does not leave the top 10 (K-068). Improving is fine.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluate, loadCases, verifyQuotes } from "./evaluate.mjs";

const cases = loadCases();
const reference = JSON.parse(fs.readFileSync(path.join("tests", "search", "garis-dasar.json"), "utf8"));

function median(ranks) {
  const sorted = ranks.map((r) => (r === null ? Infinity : r)).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

let now = null;
const ranks = () => (now ||= evaluate(cases));

test("the case set has 20 to 60 questions, each with an answer", () => {
  assert.ok(cases.length >= 20 && cases.length <= 60, `${cases.length} pertanyaan`);
  for (const c of cases) assert.ok(c.jawaban.length > 0, c.id);
});

test("every quote in the case set is found word for word in the corpus", () => {
  assert.deepEqual(verifyQuotes(cases), []);
});

test("the median rank is not worse than the reference", () => {
  // Each reference holds for the questions it was measured on, so adding questions of a new
  // category does not count as getting worse (K-072).
  const groups = {
    pph: cases.filter((c) => !c.kategori),
    pph_kup: cases.filter((c) => !c.kategori || c.kategori === "KUP"),
    semua: cases,
  };
  for (const [name, group] of Object.entries(groups)) {
    const value = median(group.map((c) => ranks()[c.id].rank));
    assert.ok(value <= reference.median_acuan[name], `median ${name} ${value} > ${reference.median_acuan[name]}`);
  }
});

test("no question ranks worse than its baseline, except drops the owner approved", () => {
  const approved = reference.penurunan_disetujui;
  const worse = [];
  for (const c of cases) {
    const before = reference.peringkat[c.id];
    const after = ranks()[c.id].rank;
    if (before === undefined) {
      worse.push(`${c.id}: tidak ada di garis dasar`);
      continue;
    }
    if (before === null || (after !== null && after <= before)) continue;
    // Tolerance (K-068): a drop of up to two ranks needs no approval, unless it leaves the top 10.
    const { peringkat_maks: slack, batas_10_besar: top } = reference.toleransi;
    if (after !== null && after - before <= slack && (before > top || after <= top)) continue;
    const allowed = approved[c.id];
    if (allowed && allowed.penjelasan && after !== null && after <= allowed.paling_buruk) continue;
    worse.push(`${c.id}: ${before} -> ${after}${allowed ? ` (disetujui paling buruk ${allowed.paling_buruk})` : ""}`);
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
