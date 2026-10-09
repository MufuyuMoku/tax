// Tries candidate padanan groups one at a time against the case set (K-030, K-073). The holdout set
// is never loaded here: padanan are chosen without looking at it.
//
//   node scripts/search-padanan.mjs kandidat.json
//
// kandidat.json: [{ "bentuk": ["dicicil", "angsuran", "mengangsur"] }, ...]. For each group: how
// often each form occurs in the pasal text (whole tokens, normalised), and every case question
// whose rank changes compared with the current padanan.json.
import fs from "node:fs";
import { buildSearchPayload } from "../src/lib/search/payload.js";
import { SearchEngine } from "../src/lib/search/engine.js";
import { normalizeText } from "../src/lib/search/normalize.js";
import { evaluate, loadCases } from "../tests/search/evaluate.mjs";

const candidates = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const { payload } = buildSearchPayload();
const cases = loadCases();
const base = evaluate(cases, new SearchEngine(payload));

// Occurrences of a form as whole tokens in the pasal text, and in how many documents.
const engine = new SearchEngine(payload);
const body = engine.body;
function occurrences(form) {
  const want = normalizeText(form, payload.ocr).text.split(" ").map((t) => body.idOf.get(t));
  if (want.some((v) => v === undefined)) return { count: 0, docs: 0 };
  let count = 0;
  const docs = new Set();
  for (let p = body.postingStart[want[0]]; p < body.postingStart[want[0] + 1]; p++) {
    const k = body.postings[p];
    let ok = true;
    for (let m = 1; m < want.length && ok; m++) ok = body.ids[k + m] === want[m];
    if (!ok) continue;
    count++;
    let lo = 0, hi = body.tokenStart.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (body.tokenStart[mid] <= k) lo = mid;
      else hi = mid - 1;
    }
    docs.add(payload.units[lo].doc);
  }
  return { count, docs: docs.size };
}

for (const group of candidates) {
  const evidence = group.bentuk.map((f) => {
    const o = occurrences(f);
    return `${f} ${o.count} kali (${o.docs} dokumen)`;
  });
  const trial = {
    ...payload,
    synonyms: {
      ...payload.synonyms,
      groups: [...payload.synonyms.groups, group.bentuk],
      scopes: [...payload.synonyms.scopes, group.lingkup || null],
    },
  };
  const after = evaluate(cases, new SearchEngine(trial));
  const changes = cases
    .filter((c) => base[c.id].rank !== after[c.id].rank)
    .map((c) => {
      const b = base[c.id].rank ?? Infinity;
      const a = after[c.id].rank ?? Infinity;
      return `${a < b ? "+" : "-"} ${c.id} ${base[c.id].rank} -> ${after[c.id].rank}`;
    });
  const worse = changes.filter((c) => c.startsWith("-")).length;
  console.log(`\n[${group.bentuk.join(" ~ ")}] ${worse ? `MEMBURUKKAN ${worse}` : "tidak ada yang memburuk"}`);
  console.log(`  bukti: ${evidence.join("; ")}`);
  for (const c of changes) console.log(`  ${c}`);
}
