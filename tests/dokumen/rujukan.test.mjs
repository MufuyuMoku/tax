// Decision numbers must be real (K-071): in October 2026 a report and PROGRESS cited K-066 and
// K-067 while DECISIONS.md did not contain them, because the command that wrote them had failed.
import test from "node:test";
import assert from "node:assert/strict";
import { check, decisions, missingIn, repositoryFiles } from "../../scripts/cek-rujukan.mjs";

test("every K-xxx cited in the repository is a heading in docs/DECISIONS.md", () => {
  assert.deepEqual(check(repositoryFiles()), []);
});

test("the checker catches a missing number, as with K-066 and K-067", () => {
  const { numbers } = decisions();
  const next = `K-${String(Math.max(...numbers) + 1).padStart(3, "0")}`;
  assert.equal(missingIn(`lihat ${next}`, numbers, "laporan").length, 1);
  assert.equal(missingIn("lihat K-001 dan K-030", numbers, "laporan").length, 0);
});
