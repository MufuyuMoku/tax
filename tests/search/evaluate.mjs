// Shared by the case-set test and scripts/search-eval.mjs.
import fs from "node:fs";
import path from "node:path";
import { buildSearchPayload } from "../../src/lib/search/payload.js";
import { SearchEngine } from "../../src/lib/search/engine.js";
import { loadDocument, loadPasal } from "../../src/lib/corpus.js";

const flat = (s) => String(s).replace(/\s+/g, " ").trim();

export function loadCases() {
  return JSON.parse(fs.readFileSync(path.join("tests", "search", "kasus.json"), "utf8")).kasus;
}

/** Every quote must be found, word for word, in the pasal or title it names. */
export function verifyQuotes(cases) {
  const problems = [];
  for (const c of cases) {
    for (const answer of c.jawaban) {
      const quote = flat(answer.kutipan);
      if (answer.pasal) {
        const text = flat(loadPasal(answer.pasal).text);
        if (!text.includes(quote)) problems.push(`${c.id}: kutipan tidak ada di ${answer.pasal}`);
      } else {
        const doc = loadDocument(answer.dokumen);
        const ok = quote.startsWith("Judul: ")
          ? flat(doc.title) === quote.slice(7)
          : doc.pasal_ids.some((id) => flat(loadPasal(id).text).includes(quote.replace(/^Pasal \d+: /, "")));
        if (!ok) problems.push(`${c.id}: kutipan tidak ada di ${answer.dokumen}`);
      }
    }
  }
  return problems;
}

let engine = null;
export function engineFor(payload = null) {
  if (payload) return new SearchEngine(payload);
  if (!engine) engine = new SearchEngine(buildSearchPayload().payload);
  return engine;
}

/** { id: { rank, best, pasalShown } } — rank is 1-based, null when no answer document is found. */
export function evaluate(cases, searchEngine = engineFor()) {
  const result = {};
  for (const c of cases) {
    const summary = searchEngine.search(c.pertanyaan);
    const all = searchEngine.page(0, summary.total);
    const wanted = new Set(c.jawaban.map((a) => a.dokumen));
    const index = all.findIndex((r) => wanted.has(r.id));
    const hit = index === -1 ? null : all[index];
    const pasal = hit && c.jawaban.find((a) => a.dokumen === hit.id).pasal;
    result[c.id] = {
      rank: index === -1 ? null : index + 1,
      best: hit ? hit.id : null,
      pasalShown: Boolean(pasal && hit.units.some((u) => u.id === pasal)),
    };
  }
  return result;
}
