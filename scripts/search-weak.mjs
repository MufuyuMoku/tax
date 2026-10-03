// Evidence for K-044: can a "weak match" flag tell wrong results from right ones by the rare query
// words a result lacks? Prints, for every correct answer in both case sets and for the top three of
// the holdout questions without an answer in the corpus, how much query weight is missing.
// "Seen" counts only words that occur somewhere in the corpus.
//
//   node scripts/search-weak.mjs
import { engineFor, loadCases } from "../tests/search/evaluate.mjs";
const engine = engineFor();
const rows = [];
for (const [file, cases] of [["kasus", loadCases()], ["tahan", loadCases("kasus-tahan.json")]]) {
  for (const c of cases) {
    const s = engine.search(c.pertanyaan);
    const { idfs, unseenIdf, active } = engine.last;
    const page = engine.page(0, Math.min(s.total, 400));
    const answers = new Set((c.jawaban || []).map((a) => a.dokumen));
    const feat = (r) => {
      const seen = idfs.filter((x) => x < unseenIdf - 0.01);
      const totalSeen = seen.reduce((a, b) => a + b, 0);
      const missSeen = r.missingIdf.filter((x) => x < unseenIdf - 0.01).reduce((a, b) => a + b, 0);
      const total = idfs.reduce((a, b) => a + b, 0);
      const miss = r.missingIdf.reduce((a, b) => a + b, 0);
      return { missSeen: +missSeen.toFixed(2), shareSeen: +(missSeen / totalSeen).toFixed(2), share: +(miss / total).toFixed(2), maxSeen: Math.max(0, ...r.missingIdf.filter((x) => x < unseenIdf - 0.01)) };
    };
    const ans = page.find((r) => answers.has(r.id));
    if (ans) rows.push({ kind: "benar", q: c.id, ...feat(ans) });
    if (c.golongan === "b" || c.golongan === "c") page.slice(0, 3).forEach((r, i) => rows.push({ kind: "salah-" + c.golongan, q: c.id + "#" + (i + 1), ...feat(r) }));
  }
}
rows.sort((a, b) => b.shareSeen - a.shareSeen);
for (const r of rows) console.log(r.kind.padEnd(8), r.q.padEnd(26), "missSeen", String(r.missSeen).padEnd(6), "shareSeen", String(r.shareSeen).padEnd(5), "share", r.share, "maxSeen", r.maxSeen);
