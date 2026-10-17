// The definition box (K-081, K-096): for "apa itu PKP", "pengertian NPWP", "BPHTB adalah" or a
// query that is one known term, the pasal that defines the term are shown above the results. The
// ranking below is not touched; the box is looked up beside it.
//
// Build time: every "<term> adalah ..." item of a definition pasal ("Dalam Peraturan ini yang
// dimaksud dengan: 1. ... adalah ...") and every "... adalah <term>, yaitu ..." sentence is
// recorded as an offset into the pasal text that the search data already carries, so the box adds
// no text of its own and always quotes the source as written.
//
// Query time: which definitions to show is decided from the status the sources give, never a
// status of our own (invariant 1): documents that every source records as in force (wholly or with
// changes) first; documents the sources disagree about only when there is nothing else, and then
// with their "Perlu dicek" chips; documents every source records as no longer in force never.
// This file runs in Node and in the search worker, so it has no dependencies of its own.
import { baseToken } from "./normalize.js";

const TOKEN = /[\p{L}\p{N}]+/gu;
const MAX_TERM_WORDS = 12;
const MAX_SHOWN = 3;
const IN_FORCE = new Set(["berlaku", "diubah_atau_dicabut_sebagian"]);
const DISPUTED = new Set(["tidak_pasti"]);
// Higher first: a law's definition before a regulation's restatement of it.
const RANK = { UU: 0, PERPU: 0, PP: 1, PMK: 2, "PER-DJP": 3 };

/** A term or a query as a run of base tokens: "Pengusaha Kena Pajak" -> "pengusaha kena pajak". */
export function termKey(text) {
  return (String(text).match(TOKEN) || []).map(baseToken).join(" ");
}

const ENUMERATOR = /^(?:(\d+[a-z]?|[a-z])\.|\((\d+[a-z]?)\))$/;
const QUOTED_PASAL = /^Pasal\s+(\d+[A-Z]?)$/;
const DEFINES = /^(.{2,200}?)\s+adalah\s+\S/;
const ALIAS = /^(.*?),?\s+yang\s+selanjutnya\s+(?:dalam\s+[^,]+?\s+)?(?:disingkat|disebut)(?:\s+dengan)?\s+(.+?),?$/i;
const OBJECT = /^Yang\s+(?:menjadi|dimaksud\s+dengan)\s+.{0,60}?\s+adalah\s+([^,]{2,80}),\s+yaitu\s+\S/i;

/**
 * Definition items of one pasal text: [{ terms, start, end, place }]. `start`/`end` are offsets of
 * the defining line in `text`; `place` says where in the pasal it stands ("angka 5", "ayat (1)").
 * Only pasal that say "yang dimaksud dengan" (the usual opening of a definition pasal) are read
 * for "<term> adalah"; the "adalah X, yaitu" form is read everywhere.
 */
export function extractDefinitions(text) {
  const found = [];
  const definitionPasal = /yang\s+dimaksud\s+dengan/i.test(text);
  let offset = 0;
  let enumerator = null;
  let quoted = null; // an amending law quotes the new pasal: "Pasal 1" inside its Pasal I
  for (const [i, line] of text.split("\n").entries()) {
    const start = offset;
    offset += line.length + 1;
    const trimmed = line.trim();
    const isEnumerator = trimmed.match(ENUMERATOR);
    if (isEnumerator) {
      enumerator = isEnumerator[1] ? (/^\d/.test(isEnumerator[1]) ? `angka ${isEnumerator[1]}` : `huruf ${isEnumerator[1]}`) : `ayat (${isEnumerator[2]})`;
      continue;
    }
    const heading = trimmed.match(QUOTED_PASAL);
    if (heading) {
      if (i > 0) quoted = heading[1];
      enumerator = null;
      continue;
    }
    const place = [quoted ? `bunyi Pasal ${quoted}` : null, enumerator].filter(Boolean).join(" ");
    enumerator = null;
    const object = trimmed.match(OBJECT);
    if (object) {
      found.push({ terms: [object[1]], start, end: start + line.length, place });
      continue;
    }
    if (!definitionPasal) continue;
    const defines = trimmed.match(DEFINES);
    if (!defines) continue;
    const subject = defines[1].replace(/,$/, "");
    const alias = subject.match(ALIAS);
    const terms = alias ? [alias[1], ...alias[2].split(/\s+atau\s+/)] : [subject];
    if (terms.some((t) => !t.trim() || t.trim().split(/\s+/).length > MAX_TERM_WORDS)) continue;
    // A term starts as a name does; "dan", "yang", "dalam" ... open a sentence, not a term.
    if (!/^[\p{Lu}\d]/u.test(subject)) continue;
    found.push({ terms, start, end: start + line.length, place });
  }
  return found;
}

/** What the definition says, without its term: two wordings are the same when this is. */
function bodyKey(sentence) {
  const at = sentence.search(/\s(?:adalah|yaitu)\s/i);
  return termKey(at === -1 ? sentence : sentence.slice(at));
}

/**
 * The definitions part of the search data. `units[i]` is { section } and `texts[i]` its text, as
 * in the search payload. Returns { terms: { key: [item index, ...] }, items: [[unit, start, end,
 * place, body]] }, `body` numbering identical wordings.
 */
export function buildDefinitions(units, texts) {
  const terms = {};
  const items = [];
  const bodies = new Map();
  units.forEach((unit, u) => {
    if (unit.section === "p") return; // penjelasan explains; the batang tubuh defines
    for (const item of extractDefinitions(texts[u])) {
      const sentence = texts[u].slice(item.start, item.end);
      const key = bodyKey(sentence);
      if (!bodies.has(key)) bodies.set(key, bodies.size);
      const index = items.length;
      items.push([u, item.start, item.end, item.place, bodies.get(key)]);
      for (const term of new Set(item.terms.map(termKey))) {
        if (!term) continue;
        (terms[term] ||= []).push(index);
      }
    }
  });
  return { terms, items };
}

const OPENERS = [
  /^apa(?:kah)?\s+(?:itu\s+|yang\s+dimaksud\s+(?:dengan\s+)?|arti\s+|pengertian\s+|definisi\s+|maksud\s+)?(.+)$/,
  /^(?:pengertian|definisi|arti|maksud|makna)\s+(?:dari\s+)?(.+)$/,
  /^yang\s+dimaksud\s+(?:dengan\s+)?(.+)$/,
  /^(.+?)\s+(?:adalah|itu\s+apa|artinya|ialah|yaitu)(?:\s+apa)?$/,
];

/**
 * The term a query asks to define, as a key, or null. A definition question ("apa itu X",
 * "pengertian X", "X adalah") names its term; any other query counts only when it is, as a whole,
 * a term some pasal defines (`known(key)`).
 */
export function definitionTerm(query, known) {
  const key = termKey(query);
  if (!key) return null;
  for (const opener of OPENERS) {
    const match = key.match(opener);
    if (match && known(match[1])) return match[1];
  }
  return known(key) ? key : null;
}

/** Keys that mean the same as `key` by the term list (PTKP = Penghasilan Tidak Kena Pajak). */
export function sameTerms(key, groups) {
  const keys = new Set([key]);
  for (const group of groups || []) {
    const forms = (Array.isArray(group) ? group : group.bentuk).filter((f) => !/\{/.test(f)).map(termKey);
    if (forms.includes(key)) for (const form of forms) keys.add(form);
  }
  return [...keys];
}

/**
 * Up to three different definitions of `keys`, best source first, each with how many other
 * documents word it the same way. `docs[i]` carries { code, year, status }, `units[i]` { doc }.
 * Returns [{ unit, start, end, place, doc, alsoIn }] and whether the in-force set was empty.
 */
export function pickDefinitions(definitions, keys, units, docs) {
  const seen = new Set();
  const candidates = [];
  for (const key of keys) {
    for (const index of definitions.terms[key] || []) {
      if (seen.has(index)) continue;
      seen.add(index);
      const [unit, start, end, place, body] = definitions.items[index];
      const doc = units[unit].doc;
      candidates.push({ unit, start, end, place, body, doc });
    }
  }
  const inForce = candidates.filter((c) => IN_FORCE.has(docs[c.doc].status));
  const disputedOnly = !inForce.length;
  const pool = disputedOnly ? candidates.filter((c) => DISPUTED.has(docs[c.doc].status)) : inForce;
  const rank = (c) => (RANK[docs[c.doc].code] ?? 4) * 10000 - (Number(docs[c.doc].year) || 0);
  pool.sort((a, b) => rank(a) - rank(b) || a.unit - b.unit || a.start - b.start);
  const byBody = new Map();
  for (const c of pool) {
    if (!byBody.has(c.body)) byBody.set(c.body, { ...c, documents: new Set() });
    byBody.get(c.body).documents.add(c.doc);
  }
  // Different wordings: the one from the highest-ranking source first, then the most widely used.
  const shown = [...byBody.values()]
    .sort((a, b) => rank(a) - rank(b) || b.documents.size - a.documents.size)
    .slice(0, MAX_SHOWN)
    .map(({ unit, start, end, place, doc, documents }) => ({ unit, start, end, place, doc, alsoIn: documents.size - 1 }));
  return { shown, disputedOnly: disputedOnly && shown.length > 0 };
}
