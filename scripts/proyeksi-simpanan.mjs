// Projects what the phone would store with every category of the DJP catalogue (M7, K-085). No
// network: reads the current build (dist/), the corpus, and the lists and details fetched so far.
//
//   npm run build && node scripts/proyeksi-simpanan.mjs
//
// Model, fitted on the current build: stored bytes = a × text characters + b × documents + fixed.
// a: search data and offline page data per character of text; b: the two list pages per document;
// fixed: scripts, styles, icons and the other pages. New documents are the M7 list rows that are not
// in the corpus and not weekly exchange-rate or interest-rate decrees. Their text is the detail text
// where it has been fetched; for the rest, the share with text and the average length of the ones
// fetched in the same category (or, before any, of the current corpus).
import fs from "node:fs";
import path from "node:path";

const OUT_OF_SCOPE = /nilai\s+kurs\s+sebagai\s+dasar|tarif\s+bunga\s+sebagai\s+dasar|nilai\s+dasar\s+perhitungan\s+bea\s+masuk/i;
const M7 = ["BM", "BPHTB", "PBB", "Lainnya", "BPHTB Lainnya"];
const LIMIT = 100e6;

const jsonl = (file) =>
  fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
const size = (file) => fs.statSync(file).size;
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

// ---------- the current build ----------
const index = JSON.parse(fs.readFileSync("corpus/index.json", "utf8"));
const chars = index.reduce((sum, e) => sum + (e.text_chars || 0), 0);
const withText = index.filter((e) => e.text_available);
const shards = walk("dist/luring/data").reduce((sum, f) => sum + size(f), 0);
const perChar = (size("dist/cari/data.json") + shards) / chars;
const perDoc = (size("dist/index.html") + size("dist/semua/index.html")) / index.length;
// Everything the service worker keeps: the sum of the "bytes" of its file list (see integration.js).
const total = [...fs.readFileSync("dist/sw.js", "utf8").matchAll(/bytes:\s*(\d+)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
const fixed = total - perChar * chars - perDoc * index.length;

// ---------- what M7 adds ----------
const inCorpus = new Set();
for (const entry of index) {
  const doc = JSON.parse(fs.readFileSync(`corpus/documents/${entry.id}.json`, "utf8"));
  for (const r of doc.source_records) if (r.source === "DJP") inCorpus.add(r.url.replace("https://www.pajak.go.id", ""));
}
for (const r of jsonl("poc/data/djp_pph_list.jsonl")) if (r.path) inCorpus.add(r.path);
for (const r of jsonl("harvest/djp_list.jsonl")) if (r.path && ["KUP", "PPN"].includes(r._kategori_daftar)) inCorpus.add(r.path);

const details = new Map(jsonl("harvest/djp_detail.jsonl").map((d) => [d.path, d]));
const state = JSON.parse(fs.readFileSync("harvest/state.json", "utf8"));
const rows = jsonl("harvest/djp_list.jsonl").filter((r) => M7.includes(r._kategori_daftar));
const seen = new Set();
const report = [];
let newDocs = 0;
let newChars = 0;
for (const name of M7) {
  const c = state.categories[name];
  const listed = rows.filter((r) => r._kategori_daftar === name && r.path);
  const unique = [...new Set(listed.map((r) => r.path))];
  const overlap = unique.filter((p) => inCorpus.has(p) || seen.has(p));
  const outOfScope = unique.filter((p) => !overlap.includes(p) && OUT_OF_SCOPE.test(listed.find((r) => r.path === p).judul || ""));
  const fresh = unique.filter((p) => !overlap.includes(p) && !outOfScope.includes(p));
  fresh.forEach((p) => seen.add(p));
  const fetched = fresh.map((p) => details.get(p)).filter((d) => d && !d.error);
  const texts = fetched.map((d) => (d.body_text || "").length).filter((n) => n > 0);
  const share = fetched.length ? texts.length / fetched.length : withText.length / index.length;
  const average = texts.length ? texts.reduce((a, b) => a + b, 0) / texts.length : chars / withText.length;
  const missing = fresh.length - fetched.length;
  const projectedChars = texts.reduce((a, b) => a + b, 0) + missing * share * average;
  const pages = c && c.last_page !== null ? `${c.pages_done.length}/${c.last_page + 1}` : "-";
  report.push({ name, pages, rows: listed.length, unique: unique.length, overlap: overlap.length, outOfScope: outOfScope.length, fresh: fresh.length, fetched: fetched.length, share, average, projectedChars });
  newDocs += fresh.length;
  newChars += projectedChars;
}

const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
const projected = total + perChar * newChars + perDoc * newDocs;
console.log(`Sekarang: ${index.length} dokumen, ${(chars / 1e6).toFixed(1)} juta karakter teks, tersimpan ${mb(total)}`);
console.log(`Model: ${perChar.toFixed(2)} byte per karakter + ${(perDoc / 1e3).toFixed(2)} KB per dokumen + ${mb(fixed)} tetap\n`);
console.log("Kategori        Daftar   Baris  Unik  Sudah ada  Kurs/bunga  Baru  Detail diambil  Berteks  Rata-rata  Proyeksi teks");
for (const r of report) {
  console.log(
    `${r.name.padEnd(14)} ${r.pages.padStart(7)} ${String(r.rows).padStart(7)} ${String(r.unique).padStart(5)} ${String(r.overlap).padStart(10)} ${String(r.outOfScope).padStart(11)} ${String(r.fresh).padStart(5)} ${String(r.fetched).padStart(15)} ${`${Math.round(100 * r.share)}%`.padStart(8)} ${String(Math.round(r.average)).padStart(10)} ${`${(r.projectedChars / 1e6).toFixed(1)} jt`.padStart(14)}`
  );
}
console.log(`\nDokumen baru: ${newDocs}; teks baru diperkirakan ${(newChars / 1e6).toFixed(1)} juta karakter`);
console.log(`Proyeksi simpanan dengan semua kategori: ${mb(projected)} (batas ${mb(LIMIT)})${projected > LIMIT ? " — MELEWATI BATAS" : ""}`);
