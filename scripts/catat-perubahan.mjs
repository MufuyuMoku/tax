// What changed between two corpora, for "Peraturan baru dan yang berubah" (M9, K-091).
//
//   node scripts/catat-perubahan.mjs <old corpus> <new corpus> [tanggal]
//
// Appends one entry to src/data/perubahan.json when anything changed: regulations that are new, and
// status claims that changed, per source and in the source's own words with their retrieval date
// (SPEC invariant 1: never one status for a document). Prints a short summary; exits 0 either way.
import fs from "node:fs";
import path from "node:path";
import { regulationLabel } from "../src/lib/labels.js";

const [oldDir, newDir, date = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
if (!oldDir || !newDir) throw new Error("Pakai: node scripts/catat-perubahan.mjs <korpus lama> <korpus baru> [tanggal]");
const FILE = process.env.TAX_PERUBAHAN || "src/data/perubahan.json";

const load = (dir) => new Map(JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")).map((e) => [e.id, e]));
const doc = (dir, id) => JSON.parse(fs.readFileSync(path.join(dir, "documents", `${id}.json`), "utf8"));
const label = (d) => regulationLabel(d.identity, d.source_records.find((r) => r.number_as_written)?.number_as_written);
const claimsBySource = (d) => {
  const out = new Map();
  for (const c of d.status_claims) {
    if (!out.has(c.source)) out.set(c.source, []);
    out.get(c.source).push(c);
  }
  return out;
};
const words = (claims) => [...new Set(claims.map((c) => c.value_verbatim || "(kosong)"))].sort().join(" / ");

const before = load(oldDir);
const after = load(newDir);
const added = [];
const changed = [];
for (const [id, entry] of after) {
  const now = doc(newDir, id);
  if (!before.has(id)) {
    added.push({ id, label: label(now), judul: now.title, kategori: entry.categories });
    continue;
  }
  const was = claimsBySource(doc(oldDir, id));
  for (const [source, claims] of claimsBySource(now)) {
    const old = was.get(source) || [];
    if (words(old) !== words(claims)) {
      const newest = claims.map((c) => c.retrieved_at).sort().at(-1);
      changed.push({ id, label: label(now), judul: now.title, sumber: source, sebelum: old.length ? words(old) : null, sesudah: words(claims), diambil: newest });
    }
  }
}
const removed = [...before.keys()].filter((id) => !after.has(id));

console.log(`baru ${added.length}, status berubah ${changed.length}, tidak ada lagi ${removed.length}`);
if (!added.length && !changed.length && !removed.length) process.exit(0);

const log = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { keterangan: "", pembaruan: [] };
log.keterangan =
  "Catatan per pembaruan data (K-091), ditulis scripts/catat-perubahan.mjs dengan membandingkan korpus sebelum dan sesudah. Status per sumber, apa adanya.";
log.pembaruan.unshift({ tanggal: date, baru: added, status_berubah: changed, tidak_ada_lagi: removed });
fs.writeFileSync(FILE, JSON.stringify(log, null, 1) + "\n");
console.log(`ditulis: ${FILE}`);
