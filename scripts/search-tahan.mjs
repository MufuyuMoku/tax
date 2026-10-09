// The holdout set (tests/search/kasus-tahan.json): rank of the answer for group (a), and the top
// three with matched and missing concepts for every question. Also reruns each question with the
// question words removed, to see whether they disturb the ranking. Report only: padanan and the
// engine are frozen against this set.
//
//   node scripts/search-tahan.mjs
import { engineFor, evaluate, loadCases, verifyQuotes } from "../tests/search/evaluate.mjs";

const cases = loadCases("kasus-tahan.json");
const problems = verifyQuotes(cases);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
const engine = engineFor();
const QUESTION_WORDS = /\b(bagaimana|cara|langkah-langkah|langkah|apa itu|apa|kapan|berapa|rincian|tutorial|melakukan)\b|\?/gi;
const answered = cases.filter((c) => c.golongan === "a" && !c.tanpa_jawaban_sah);
const ranks = evaluate(answered, engine);
const stripped = evaluate(answered.map((c) => ({ ...c, pertanyaan: c.pertanyaan.replace(QUESTION_WORDS, " ") })), engine);

for (const c of cases) {
  const summary = engine.search(c.pertanyaan);
  const top = engine.page(0, 3);
  console.log(`\n[${c.golongan}] ${c.pertanyaan}`);
  if (c.tanpa_jawaban_sah) {
    console.log(`  tanpa jawaban sah: ${c.tanpa_jawaban_sah}`);
  } else if (c.golongan === "a") {
    console.log(`  peringkat jawaban: ${ranks[c.id].rank ?? "-"} (${ranks[c.id].best ?? "tidak ditemukan"})` +
      `${ranks[c.id].pasalShown ? ", pasal tepat tampil" : ""} · tanpa kata tanya: ${stripped[c.id].rank ?? "-"}`);
  } else {
    console.log(`  di luar situs/korpus: ${c.dasar_di_luar_situs}`);
  }
  console.log(`  ${summary.total} dokumen; ${summary.concepts.length} konsep`);
  top.forEach((r, i) =>
    console.log(`  ${i + 1}. ${r.label} [${r.status}] cakupan ${r.coverage}/${r.conceptCount}` +
      ` · tidak ditemukan: ${r.missing.join(", ") || "-"} · ${r.title.slice(0, 70)}`)
  );
}
