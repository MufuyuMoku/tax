// Text normalisation shared by the build (Node) and the browser. Both sides must turn text into
// the same tokens, otherwise a query would not find what the index holds, so this file has no
// dependencies and runs unchanged in either place.
//
// Normalising only ever happens on a copy used for matching. The text shown to readers is the
// source text as it was retrieved, OCR errors included (SPEC section 5).

const TOKEN = /[\p{L}\p{N}]+/gu;
const MARKS = /\p{M}/gu;

/** Lowercase, strip diacritics, drop leading zeros of numbers ("03" -> "3"). No OCR correction. */
export function baseToken(raw) {
  let token = raw.toLowerCase();
  if (/[^\x00-\x7f]/.test(token)) token = token.normalize("NFD").replace(MARKS, "");
  if (/^\d+$/.test(token)) token = token.replace(/^0+(?=\d)/, "");
  return token;
}

/** One search token: the base form, then the OCR correction if this token has one. */
export function normToken(raw, ocr) {
  const token = baseToken(raw);
  return (ocr && ocr[token]) || token;
}

/** Tokens of `text` with their offsets in the original string, for highlighting. */
export function tokensWithOffsets(text) {
  const result = [];
  for (const match of text.matchAll(TOKEN)) {
    result.push({ raw: match[0], start: match.index, end: match.index + match[0].length });
  }
  return result;
}

/** `text` as a run of normalised tokens separated by single spaces, plus the token count. */
export function normalizeText(text, ocr) {
  const out = [];
  for (const match of text.matchAll(TOKEN)) out.push(normToken(match[0], ocr));
  return { text: out.join(" "), count: out.length };
}

/** Token frequencies over a list of texts, before any OCR correction. */
export function tokenFrequencies(texts) {
  const freq = new Map();
  for (const text of texts) {
    for (const match of text.matchAll(TOKEN)) {
      const token = baseToken(match[0]);
      freq.set(token, (freq.get(token) || 0) + 1);
    }
  }
  return freq;
}

/**
 * Build the OCR correction map from corpus statistics and the editable settings in
 * src/data/search/ocr.json.
 *
 * There is no Indonesian dictionary in this project, so the corpus stands in for one: a token is
 * treated as an OCR misreading when it is uncommon, and one typical OCR substitution ("rn" for
 * "m", "cl" for "d", ...) turns it into a token that is many times more common. "rnenteri" (rare)
 * becomes "menteri" (common); "internasional" stays, because "intemasional" does not exist. Tokens
 * listed under `jangan_dikoreksi` are never touched, and `pasangan` adds pairs by hand.
 *
 * Returns { map: {wrong: right}, generated: [[wrong, right, rule, countWrong, countRight]] }.
 */
export function buildOcrMap(freq, settings) {
  const keep = new Set((settings.jangan_dikoreksi || []).map(baseToken));
  const { frekuensi_maks: maxCount, kelipatan_min: minRatio, frekuensi_benar_min: minRight, panjang_min: minLength } =
    settings.ambang;
  const map = {};
  const generated = [];

  for (const [token, count] of [...freq.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    if (count > maxCount || token.length < minLength || keep.has(token) || /^\d+$/.test(token)) continue;
    let best = null;
    for (const [from, to] of settings.aturan) {
      for (let at = token.indexOf(from); at !== -1; at = token.indexOf(from, at + 1)) {
        const candidate = token.slice(0, at) + to + token.slice(at + from.length);
        const right = freq.get(candidate) || 0;
        if (right >= minRight && right >= minRatio * count && (!best || right > best[4])) {
          best = [token, candidate, `${from}>${to}`, count, right];
        }
      }
    }
    if (best) {
      map[token] = best[1];
      generated.push(best);
    }
  }

  for (const [wrong, right] of Object.entries(settings.pasangan || {})) {
    const key = baseToken(wrong);
    if (!keep.has(key)) map[key] = baseToken(right);
  }
  // A correction may land on another misreading ("cian" -> "clan" -> "dan"); follow the chain.
  for (const key of Object.keys(map)) {
    const seen = new Set([key]);
    while (map[map[key]] && !seen.has(map[key])) {
      seen.add(map[key]);
      map[key] = map[map[key]];
    }
  }
  return { map, generated };
}
