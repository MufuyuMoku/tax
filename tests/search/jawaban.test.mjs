// A valid answer must not be a revoked rule (K-077): rejected only when every source says it is
// revoked or no longer in force. "Berlaku" or "diubah" from one source is enough, and an uncertain
// status (sources wording it differently) does not reject it. A question plainly about an old rule
// may say so (`aturan_lama: true`). Checked for every answer of the case set and the holdout set.
import test from "node:test";
import assert from "node:assert/strict";
import { loadDocument } from "../../src/lib/corpus.js";
import { loadCases } from "./evaluate.mjs";

function inForce(id) {
  const claims = loadDocument(id).status_claims;
  return !claims.length || claims.some((c) => c.value_normalized !== "tidak_berlaku");
}

for (const file of ["kasus.json", "kasus-tahan.json"]) {
  test(`every answer in ${file} is in force, or the question is about an old rule`, () => {
    const problems = [];
    for (const c of loadCases(file)) {
      if (c.aturan_lama) continue;
      for (const answer of c.jawaban || []) {
        if (!inForce(answer.dokumen)) {
          const doc = loadDocument(answer.dokumen);
          problems.push(`${c.id}: ${answer.dokumen} dinyatakan tidak berlaku oleh semua sumber (${doc.status_claims.map((x) => x.source).join(", ")})`);
        }
      }
    }
    assert.deepEqual(problems, []);
  });

  test(`a question in ${file} without a valid answer says why`, () => {
    for (const c of loadCases(file)) {
      if (c.golongan && c.golongan !== "a") continue;
      if (!(c.jawaban || []).length) assert.ok(c.tanpa_jawaban_sah && c.tanpa_jawaban_sah.length > 40, c.id);
    }
  });
}
