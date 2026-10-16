// The failing path of the automatic update (M9, K-091) is tested by making one test fail on purpose:
// the workflow's "uji: gagal" sets TAX_UJI_GAGAL=1. Without that variable this test passes.
import assert from "node:assert/strict";
import test from "node:test";

test("an intentional failure, only when TAX_UJI_GAGAL=1 (end-to-end test of a held publication)", () => {
  assert.notEqual(process.env.TAX_UJI_GAGAL, "1", "kegagalan disengaja untuk menguji bahwa terbit ditahan dan issue dibuka");
});
