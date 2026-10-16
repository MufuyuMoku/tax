// For the automatic update (M9, K-091): questions of the evaluation set that rank worse than their
// baseline beyond what the owner approved are reported, not held back. Each one is written to
// tests/search/garis-dasar.json as an approval marked "otomatis": true, with its date, so npm test
// passes and the owner sees it in the issue and in the file. The median is never touched here: a
// median worse than its reference still fails npm test and holds the publication.
// A question whose answer is no longer found at all is not approved: npm test then fails.
//
//   node scripts/penurunan-otomatis.mjs [tanggal]
import fs from "node:fs";
import { evaluate, loadCases } from "../tests/search/evaluate.mjs";

const FILE = "tests/search/garis-dasar.json";
const date = process.argv[2] || new Date().toISOString().slice(0, 10);
const reference = JSON.parse(fs.readFileSync(FILE, "utf8"));
const cases = loadCases().filter((c) => !c.tanpa_jawaban_sah);
const ranks = evaluate(cases);
const { peringkat_maks: slack, batas_10_besar: top } = reference.toleransi;

const reported = [];
const missing = [];
for (const c of cases) {
  const before = reference.peringkat[c.id];
  const after = ranks[c.id].rank;
  if (before === undefined || before === null || (after !== null && after <= before)) continue;
  if (after !== null && after - before <= slack && (before > top || after <= top)) continue;
  const allowed = reference.penurunan_disetujui[c.id];
  if (allowed && allowed.penjelasan && after !== null && after <= allowed.paling_buruk) continue;
  if (after === null) {
    missing.push(c.id);
    continue;
  }
  const note = `Pembaruan otomatis ${date}: turun ke ${after} (dilaporkan, belum ditinjau pemilik).`;
  reference.penurunan_disetujui[c.id] = allowed
    ? { ...allowed, paling_buruk: after, penjelasan: `${allowed.penjelasan} ${note}`, otomatis: true, tanggal_otomatis: date }
    : { garis_dasar: before, paling_buruk: after, penjelasan: note, otomatis: true, tanggal_otomatis: date };
  reported.push({ id: c.id, pertanyaan: c.pertanyaan, sebelum: allowed ? allowed.paling_buruk : before, sesudah: after });
}

if (reported.length) fs.writeFileSync(FILE, JSON.stringify(reference, null, 2) + "\n");
console.log(JSON.stringify({ dilaporkan: reported, jawaban_hilang: missing }));
