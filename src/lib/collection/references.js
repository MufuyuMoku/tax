// Public regulations named in an imported document. Like the relations between regulations
// (invariant 5) these are pointers, not facts: each carries the sentence it was read from, and a
// number that matches nothing in the corpus is kept as text rather than linked to a guess.
import { numberMatches, parseNumber } from "../search/query.js";

// Places that look like a regulation number: "168/PMK.03/2023", "Nomor 55 Tahun 2022", "PP 55/2022".
const CANDIDATE =
  /(?<![\w/])\d{1,4}[A-Z]?\s*\/\s*[A-Z][A-Z.\d]*(?:\s*\/\s*[A-Z][A-Z.\d]*)*\s*\/\s*(?:19|20)\d\d\b|(?<![\w/])\d{1,4}[A-Z]?\s+Tahun\s+(?:19|20)\d\d\b|(?<![\w/])\d{1,4}[A-Z]?\s*\/\s*(?:19|20)\d\d\b/gi;

// Where the name of the regulation starts, for showing the reference as it was written.
const TYPE_START =
  /\b(?:Peraturan|Keputusan|Instruksi|Surat Edaran|Undang-Undang|PMK|KMK|PP|UU|PERPU|PER|KEP|SE|ND|Perpres|Keppres)\b/gi;

const SENTENCE_END = /[.?!](?=\s|$)|\n\s*\n/g;

/** The sentence around start..end: from the previous sentence end or blank line to the next. */
function sentenceAround(text, start, end) {
  let from = 0;
  for (const m of text.slice(0, start).matchAll(SENTENCE_END)) from = m.index + m[0].length;
  SENTENCE_END.lastIndex = 0;
  const rest = text.slice(end).match(/[.?!](?=\s|$)|\n\s*\n/);
  const to = rest ? end + rest.index + (rest[0].startsWith("\n") ? 0 : 1) : text.length;
  return text.slice(from, to).replace(/\s+/g, " ").trim();
}

function keyOf(number) {
  return `${number.serial}|${number.year}`;
}

/**
 * Every regulation number in `text`, read with the same parser as the search box.
 * Returns [{ written, sentence, number: {serial, year, codes}, matches: [{id, label}] }].
 * `docs` is the public document list of the search payload. `ownNumber`, the number the user gave
 * the imported document itself, is skipped: a document does not refer to itself.
 */
export function findReferences(text, docs, ownNumber = "") {
  const found = [];
  const seen = new Set();
  const own = ownNumber ? parseNumber(ownNumber) : null;
  if (own) seen.add(keyOf(own));
  const source = String(text || "");
  let previousEnd = 0;
  for (const match of source.matchAll(CANDIDATE)) {
    // The type is written just before the number: "Peraturan Menteri Keuangan Nomor 168 Tahun 2023",
    // "PMK-168/PMK.03/2023", "PER-11/PJ/2025", sometimes across a line break. The context starts
    // after the previous number, so one regulation's type never leaks into the next.
    const end = match.index + match[0].length;
    const contextStart = Math.max(previousEnd, match.index - 80);
    previousEnd = end;
    const context = source.slice(contextStart, end).replace(/\s+/g, " ").trim();
    const number = parseNumber(context);
    if (!number) continue;
    const key = keyOf(number);
    if (seen.has(key)) continue;
    seen.add(key);
    // The last type word before the number is where the written reference starts. Only words
    // before the number count: in "141/PMK.03/2015" the "PMK" belongs to the number itself.
    const before = source.slice(contextStart, match.index);
    let typeAt = -1;
    for (const m of before.matchAll(TYPE_START)) typeAt = m.index;
    const written = ((typeAt === -1 ? "" : before.slice(typeAt)) + match[0]).replace(/\s+/g, " ").trim();
    found.push({
      written,
      sentence: sentenceAround(source, match.index, end),
      number: { serial: number.serial, year: number.year, codes: number.codes },
      matches: docs.filter((doc) => numberMatches(number, doc)).map((doc) => ({ id: doc.id, label: doc.label })),
    });
  }
  return found;
}
