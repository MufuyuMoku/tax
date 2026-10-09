// Runs the case set in tests/search/kasus.json against the search engine.
//
//   node scripts/search-eval.mjs              print ranks
//   node scripts/search-eval.mjs --compare    print baseline vs now, per question
//
// The rank of a question is the best rank among its answer documents (null when none is found).
// "Dalam kategori" is the answer's place among results of its own category (K-079), information
// only. Questions without a valid answer in force (K-077) are listed with their reason.
import fs from "node:fs";
import path from "node:path";
import { evaluate, loadCases, verifyQuotes } from "../tests/search/evaluate.mjs";

const BASELINE = path.join("tests", "search", "garis-dasar.json");
if (process.argv.includes("--baseline")) {
  // tests/search/garis-dasar.json holds owner approvals and tolerances; it is edited by hand (K-063).
  console.error("--baseline tidak dipakai lagi: garis dasar dan persetujuan pemilik disunting langsung (K-063).");
  process.exit(1);
}
const unanswerable = loadCases().filter((c) => c.tanpa_jawaban_sah);
const cases = loadCases().filter((c) => !c.tanpa_jawaban_sah);
const problems = verifyQuotes(cases);
if (problems.length) {
  console.error("Kutipan tidak cocok dengan korpus:\n" + problems.join("\n"));
  process.exit(1);
}

const now = evaluate(cases);
const show = (rank) => (rank === null ? "-" : String(rank));
const median = (ranks) => {
  const sorted = ranks.map((r) => (r === null ? Infinity : r)).sort((a, b) => a - b);
  const mid = sorted.length / 2;
  const value = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
  return value === Infinity ? "-" : value;
};
const top10 = (ranks) => ranks.filter((r) => r !== null && r <= 10).length;

if (process.argv.includes("--compare")) {
  const base = JSON.parse(fs.readFileSync(BASELINE, "utf8")).peringkat;
  console.log("| Pertanyaan | Sebelum | Sesudah | |");
  console.log("|---|---|---|---|");
  for (const c of cases) {
    const before = base[c.id];
    const after = now[c.id].rank;
    const worse = after === null ? before !== null : before !== null && after > before;
    console.log(`| ${c.pertanyaan} | ${show(before)} | ${show(after)} | ${worse ? "MEMBURUK" : ""} |`);
  }
  const b = cases.map((c) => base[c.id]);
  const a = cases.map((c) => now[c.id].rank);
  console.log(`\nMedian: ${median(b)} → ${median(a)} · 10 besar: ${top10(b)} → ${top10(a)} dari ${cases.length}`);
} else {
  for (const c of cases) {
    const r = now[c.id];
    const inCategory = r.rankInCategory === null ? "-" : `${r.rankInCategory} di ${r.category}`;
    console.log(`${show(r.rank).padStart(4)}  ${inCategory.padStart(9)}  ${c.pertanyaan}  [${r.best || "tidak ditemukan"}]${r.pasalShown ? " pasal tepat tampil" : ""}`);
  }
  const ranks = cases.map((c) => now[c.id].rank);
  const inCategory = cases.map((c) => now[c.id].rankInCategory);
  console.log(`\nMedian ${median(ranks)} · 10 besar ${top10(ranks)} dari ${cases.length}`);
  console.log(`Dalam kategori: median ${median(inCategory)} · 10 besar ${top10(inCategory)} dari ${cases.length}`);
  for (const c of unanswerable) console.log(`   -  tanpa jawaban sah: ${c.pertanyaan}`);
}
