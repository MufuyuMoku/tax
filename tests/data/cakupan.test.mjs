// src/data/cakupan-lainnya.json is edited by people (K-088): its shape is checked so a slip in an
// edit fails npm test instead of silently changing what is fetched.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const IN = ["KUP dan administrasi pajak", "P3B", "PBB dan BPHTB", "PPN dan PPh", "tempat terdaftar wajib pajak", "pajak daerah dan retribusi"];
const OUT = ["bea masuk, bea keluar, cukai, kepabeanan", "Permendag", "PNBP", "anggaran dan perbendaharaan", "organisasi dan kepegawaian", "lain-lain bukan pajak DJP"];

const data = JSON.parse(fs.readFileSync("src/data/cakupan-lainnya.json", "utf8"));

test("every entry of the Lainnya scope file is well formed", () => {
  const seen = new Set();
  for (const e of data.peraturan) {
    const where = e.nomor || e.path;
    assert.ok(e.path && !seen.has(e.path), `path kosong atau ganda: ${where}`);
    seen.add(e.path);
    assert.ok([true, false, null].includes(e.masuk), `masuk harus true, false, atau null: ${where}`);
    assert.ok(typeof e.alasan === "string" && e.alasan.trim().length > 5, `alasan kosong: ${where}`);
    assert.ok(["usulan judul", "pemilik"].includes(e.diputuskan), `diputuskan tidak dikenal: ${where}`);
    if (e.masuk === true) assert.ok(IN.includes(e.kelompok), `kelompok masuk tidak dikenal: ${where} (${e.kelompok})`);
    if (e.masuk === false) assert.ok(OUT.includes(e.kelompok), `kelompok tidak masuk tidak dikenal: ${where} (${e.kelompok})`);
    if (e.masuk === null) assert.equal(e.kelompok, "meragukan", `yang belum diputuskan berkelompok "meragukan": ${where}`);
  }
});
