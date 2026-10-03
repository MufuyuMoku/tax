// Regional tax notes (pajak-daerah.json): shown for regional taxes, never for taxes DJP administers.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { detectLocalTax } from "../../src/lib/search/query.js";

const groups = JSON.parse(fs.readFileSync("src/data/search/pajak-daerah.json", "utf8")).kelompok;
const terms = (query) => detectLocalTax(query, groups, {}).map((n) => n.term);

test("regional taxes get a note", () => {
  assert.deepEqual(terms("Cara cek dan bayar pajak kendaraan bermotor (motor/mobil) secara online"), ["pajak kendaraan bermotor"]);
  assert.deepEqual(terms("bayar PBB lewat m-banking"), ["pbb"]);
  assert.deepEqual(terms("tagihan PBB-P2 rumah"), ["pbb p2"], "the specific PBB note, not both");
  assert.deepEqual(terms("BPHTB jual beli rumah"), ["bphtb"]);
  assert.deepEqual(terms("pajak restoran"), ["pajak restoran"]);
});

test("PBB for plantations, forestry and mining stays with DJP: no note", () => {
  assert.deepEqual(terms("PBB sektor perkebunan"), []);
  assert.deepEqual(terms("PBB P5L pertambangan"), []);
  assert.deepEqual(terms("pajak bumi dan bangunan migas"), []);
});

test("central taxes on vehicles are not mistaken for the regional vehicle tax", () => {
  assert.deepEqual(terms("PPnBM kendaraan bermotor"), []);
  assert.deepEqual(terms("PPh 22 importir kendaraan bermotor"), []);
});
