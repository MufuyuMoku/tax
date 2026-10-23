// Full-text search over the whole corpus, in memory. No network: the engine gets the payload once
// and every query after that is answered from it.
//
// How it matches:
// - Every pasal (and penjelasan) is normalised at build time into a token index: a vocabulary,
//   token ids, and per token the character offset it would have in one long normalised string
//   (K-069). Titles are normalised here into one string. A long word also matches as prefix or
//   inside a word ("potong" finds "pemotongan" and "dipotong"), weighted lower than whole words;
//   for pasal text that is found in the vocabulary, not by scanning all text. Results are identical
//   to scanning the long string with indexOf, which is how titles are still searched
//   (tests/search/setara.test.mjs).
// - Ranking is BM25 per pasal. A document is ranked first by which of the query's concepts occur
//   close together in one of its pasal (or its title), each concept weighted by its rarity, then
//   by score. Long documents and long pasal therefore do not win just by mentioning every word
//   somewhere.
// - Regulation numbers are matched on the document identity, so documents without text are found
//   by number as well as by title (SPEC invariant 3).
import { normToken, normalizeText, tokensWithOffsets } from "./normalize.js";
import { citationPattern, compileTerms, detectLocalTax, numberMatches, parseNumber, parseQuery } from "./query.js";
import { buildTextIndex, decodeVarints } from "./textindex.js";
import { buildRegister, citedLaw, compileLaws, parseArticleRef } from "./articles.js";

const K1 = 1.2;
const B = 0.75;
const TITLE_WEIGHT = 2.5;
const EXPLANATION_WEIGHT = 0.5;
const SEPARATOR = " \u0001 ";
const MIN_INFIX = 4;
const SNIPPET_TOKENS = 36;
const UNITS_PER_RESULT = 3;
// Concepts count as occurring together in a pasal only within this many characters of normalised
// text, about one long sentence. Otherwise a long pasal "contains" every word of a case question.
const NEAR = 300;

function isNumeric(token) {
  return /^\d/.test(token);
}

function popcount(mask) {
  let count = 0;
  for (let m = mask; m; m &= m - 1) count++;
  return count;
}

/** Normalise `texts` into one string; `starts[i]` is where text i begins. */
function concatenate(texts, ocr) {
  const parts = [];
  const starts = new Int32Array(texts.length + 1);
  const lengths = new Float32Array(texts.length);
  let position = 1;
  for (let i = 0; i < texts.length; i++) {
    const norm = normalizeText(texts[i], ocr);
    starts[i] = position;
    lengths[i] = Math.max(norm.count, 1);
    parts.push(norm.text);
    position += norm.text.length + SEPARATOR.length;
  }
  starts[texts.length] = position;
  const average = lengths.reduce((a, b) => a + b, 0) / Math.max(texts.length, 1);
  return { text: " " + parts.join(SEPARATOR) + " ", starts, lengths, average };
}

/**
 * Weighted term frequency of one alternative in every segment of `field`. Single long words also
 * match as prefix (0.7) or inside a word (0.5); everything else must match whole tokens.
 */
function countInto(field, alternative, tf, positions = null, factor = 1, typedHits = null, allow = null) {
  const single = alternative.length === 1 && alternative[0].length >= MIN_INFIX && !isNumeric(alternative[0]);
  const needle = single ? alternative[0] : " " + alternative.join(" ") + " ";
  const text = field.text;
  const starts = field.starts;
  let segment = 0;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
    while (starts[segment + 1] <= at) segment++;
    if (allow && !allow[segment]) continue;
    let weight = 1;
    if (single) {
      const before = text.charCodeAt(at - 1) === 32;
      const after = text.charCodeAt(at + needle.length) === 32;
      weight = before && after ? 1 : before ? 0.7 : 0.5;
    }
    tf[segment] += weight * factor;
    // A position remembers whether it came from the typed form (1) or a padanan (0).
    if (positions) positions.push(at * 2 + (factor === 1 ? 1 : 0));
    if (typedHits && factor === 1) typedHits[segment] = 1;
  }
}

/**
 * The pasal text as a token index instead of one long string. Positions are the character offsets
 * the long string would have had, so everything downstream is unchanged.
 */
function bodyIndex(index, nTexts) {
  const vocab = index.vocab;
  // Already decoded when the public data was put together from its parts (K-099).
  const ids = typeof index.ids === "string" ? decodeVarints(index.ids, index.total) : index.ids;
  const counts = typeof index.counts === "string" ? decodeVarints(index.counts, nTexts) : index.counts;
  const vocabLength = Int32Array.from(vocab, (t) => t.length);
  const tokenStart = new Int32Array(nTexts + 1);
  const starts = new Int32Array(nTexts + 1);
  const lengths = new Float32Array(nTexts);
  const charPos = new Int32Array(ids.length);
  let position = 1;
  let k = 0;
  for (let i = 0; i < nTexts; i++) {
    tokenStart[i] = k;
    starts[i] = position;
    lengths[i] = Math.max(counts[i], 1);
    let p = position;
    for (let n = 0; n < counts[i]; n++, k++) {
      charPos[k] = p;
      p += vocabLength[ids[k]] + 1;
    }
    position += (counts[i] ? p - position - 1 : 0) + SEPARATOR.length;
  }
  tokenStart[nTexts] = k;
  starts[nTexts] = position;
  const average = lengths.reduce((a, b) => a + b, 0) / Math.max(nTexts, 1);
  // Postings: for every vocabulary entry, its token indexes in increasing order.
  const postingStart = new Int32Array(vocab.length + 1);
  for (let i = 0; i < ids.length; i++) postingStart[ids[i] + 1]++;
  for (let v = 0; v < vocab.length; v++) postingStart[v + 1] += postingStart[v];
  const fill = postingStart.slice(0, vocab.length);
  const postings = new Int32Array(ids.length);
  for (let i = 0; i < ids.length; i++) postings[fill[ids[i]]++] = i;
  // The vocabulary as one string, to find every entry a long word occurs in.
  const vocabStart = new Int32Array(vocab.length + 1);
  for (let v = 0; v < vocab.length; v++) vocabStart[v + 1] = vocabStart[v] + vocabLength[v] + 1;
  return {
    vocab, ids, vocabLength, tokenStart, starts, lengths, average, charPos, postingStart, postings,
    vocabText: vocab.join(String.fromCharCode(10)), vocabStart, idOf: new Map(vocab.map((t, i) => [t, i])),
  };
}

function upperBound(sorted, value) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** countInto() for the token index: same matches, same weights, same order of addition. */
function countIndexed(field, alternative, tf, positions = null, factor = 1, typedHits = null, allow = null) {
  const single = alternative.length === 1 && alternative[0].length >= MIN_INFIX && !isNumeric(alternative[0]);
  let keys;
  if (single) {
    // Every place the word occurs inside a token, as the long string's indexOf would find it.
    const needle = alternative[0];
    const found = [];
    for (let q = field.vocabText.indexOf(needle); q !== -1; q = field.vocabText.indexOf(needle, q + 1)) {
      const v = upperBound(field.vocabStart, q) - 1;
      const j = q - field.vocabStart[v];
      const code = j === 0 ? (j + needle.length === field.vocabLength[v] ? 0 : 1) : 2;
      for (let p = field.postingStart[v]; p < field.postingStart[v + 1]; p++) {
        found.push((field.charPos[field.postings[p]] + j) * 4 + code);
      }
    }
    keys = Float64Array.from(found).sort();
  } else {
    // Whole tokens in a row, inside one pasal; the long string's match starts at the space before.
    const want = alternative.map((t) => field.idOf.get(t));
    if (want.some((v) => v === undefined)) return;
    const found = [];
    const first = want[0];
    for (let p = field.postingStart[first]; p < field.postingStart[first + 1]; p++) {
      const k = field.postings[p];
      const unit = upperBound(field.tokenStart, k) - 1;
      if (k + want.length > field.tokenStart[unit + 1]) continue;
      let ok = true;
      for (let m = 1; m < want.length && ok; m++) ok = field.ids[k + m] === want[m];
      if (ok) found.push((field.charPos[k] - 1) * 4);
    }
    keys = found;
  }
  const WEIGHT = [1, 0.7, 0.5];
  const starts = field.starts;
  let segment = 0;
  for (let i = 0; i < keys.length; i++) {
    const at = Math.floor(keys[i] / 4);
    while (starts[segment + 1] <= at) segment++;
    if (allow && !allow[segment]) continue;
    const weight = single ? WEIGHT[keys[i] % 4] : 1;
    tf[segment] += weight * factor;
    if (positions) positions.push(at * 2 + (factor === 1 ? 1 : 0));
    if (typedHits && factor === 1) typedHits[segment] = 1;
  }
}

// A category is named in a query by its abbreviation or its long form (K-079).
const CATEGORY_NAMES = {
  PPh: [["pph"], ["pajak", "penghasilan"]],
  KUP: [["kup"], ["ketentuan", "umum", "dan", "tata", "cara", "perpajakan"]],
  PPN: [["ppn"], ["pajak", "pertambahan", "nilai"]],
  "Bea Meterai": [["bea", "meterai"], ["meterai"]],
  PBB: [["pbb"], ["pajak", "bumi", "dan", "bangunan"]],
  BPHTB: [["bphtb"], ["bea", "perolehan", "hak", "atas", "tanah", "dan", "bangunan"]],
};

function mentionedCategories(query, ocr) {
  const tokens = normalizeText(query, ocr).text.split(" ");
  const found = new Set();
  for (const [category, forms] of Object.entries(CATEGORY_NAMES)) {
    for (const form of forms) {
      for (let i = 0; i + form.length <= tokens.length; i++) {
        if (form.every((t, k) => tokens[i + k] === t)) found.add(category);
      }
    }
  }
  return found;
}

function lowerBound(sorted, value) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function bm25(tf, length, average, idf) {
  return (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * length) / average));
}

function idfOf(df, total) {
  return Math.log(1 + (total - df + 0.5) / (df + 0.5));
}

export class SearchEngine {
  constructor(payload) {
    this.docs = payload.docs;
    this.units = payload.units;
    this.texts = payload.texts;
    this.ocr = payload.ocr;
    this.stopwords = payload.stopwords;
    this.localTax = payload.localTax || [];
    this.terms = compileTerms(payload.terms, this.ocr);
    // Padanan (K-030): forms that count as the typed word, at a lower weight.
    this.synonyms = compileTerms(
      payload.synonyms ? payload.synonyms.groups : [],
      this.ocr,
      payload.synonyms ? payload.synonyms.scopes || null : null
    );
    this.withoutText = Uint8Array.from(this.docs, (d) => (d.hasText ? 0 : 1));
    this.synonymWeight = payload.synonyms ? payload.synonyms.weight : 1;
    // The public data brings its index from the build; the personal collection is small and is
    // indexed here, with the same code (K-069).
    this.body = bodyIndex(payload.index || buildTextIndex(this.texts, this.ocr), this.texts.length);
    this.titles = concatenate(
      this.docs.map((d) => d.title || ""),
      this.ocr
    );
    this.unitWeight = Float32Array.from(this.units, (u) => (u.section === "p" ? EXPLANATION_WEIGHT : 1));
    // Article references (K-101): only the public data names the tax laws; the personal
    // collection is searched as before.
    this.laws = payload.laws ? compileLaws(payload.laws, this.docs, this.ocr) : null;
    this.register = null;
    this.last = null;
  }

  /** Where each article of the tax laws is written, built on the first reference query. */
  articleRegister() {
    if (!this.register) {
      const register = buildRegister(this.laws, this.docs, this.units, this.texts);
      register.has = new Set(register.entries.map((e) => `${e.law}/${e.article}`));
      this.register = register;
    }
    return this.register;
  }

  /**
   * The article reference in a query, or null. "pasal 5" next to a regulation number that is not
   * one of the tax laws ("PMK 168/2023 pasal 5") is that regulation's pasal, not a reference.
   */
  articleRef(query, number) {
    if (!this.laws) return null;
    const register = this.articleRegister();
    const has = (article, laws) => (laws || this.laws.laws.map((_, l) => l)).some((l) => register.has.has(`${l}/${article}`));
    const outside = query.replace(/"[^"]+"/g, " ");
    const ref = parseArticleRef(outside, this.laws, has);
    if (!ref || !number) return ref;
    const ours = this.docs.some((doc, d) => this.laws.familyOf[d] !== -1 && numberMatches(number, doc));
    return ours ? ref : null;
  }

  /**
   * Documents that cite the reference in so many words, as doc index -> Set of law indexes: the
   * laws' own pasal holding the article, every pasal where "Pasal 16D" is followed by its law's
   * name (or stands alone inside a pasal of that law), and titles such as "Pajak Penghasilan Pasal
   * 21". Found from the article's token, so only pasal holding it are read. `units` keeps, per
   * document, the pasal that cite it, in order.
   */
  articleCitations(ref) {
    const register = this.articleRegister();
    const wanted = (l) => !ref.laws || ref.laws.includes(l);
    const cited = new Map();
    const units = new Map();
    const add = (d, l, u = -1) => {
      if (!wanted(l)) return;
      if (!cited.has(d)) cited.set(d, new Set());
      cited.get(d).add(l);
      if (u === -1) return;
      if (!units.has(d)) units.set(d, []);
      if (!units.get(d).includes(u)) units.get(d).push(u);
    };
    for (const e of register.entries) if (e.article === ref.article) add(e.doc, e.law, e.unit);
    const token = normToken(ref.article, this.ocr);
    const body = this.body;
    const v = body.idOf.get(token);
    if (v !== undefined) {
      for (let p = body.postingStart[v]; p < body.postingStart[v + 1]; p++) {
        const k = body.postings[p];
        const u = upperBound(body.tokenStart, k) - 1;
        const lo = body.tokenStart[u];
        const hi = body.tokenStart[u + 1];
        const get = (i) => (i >= lo && i < hi ? body.vocab[body.ids[i]] : undefined);
        const law = citedLaw(this.laws, get, k, ref, register.unitLaw.get(u));
        if (law !== -1) add(this.units[u].doc, law, u);
      }
    }
    if (!this.titleTokens) this.titleTokens = this.docs.map((d) => normalizeText(d.title || "", this.ocr).text.split(" "));
    this.titleTokens.forEach((tokens, d) => {
      for (let k = tokens.indexOf(token); k !== -1; k = tokens.indexOf(token, k + 1)) {
        const law = citedLaw(this.laws, (i) => tokens[i], k, ref, undefined);
        if (law !== -1) add(d, law);
      }
    });
    for (const list of units.values()) list.sort((a, b) => a - b);
    return { cited, units };
  }

  /** Concepts and number the query parses into, without searching. */
  parse(query) {
    // A quoted phrase is searched as written, even when it contains a regulation number.
    const quoted = query.match(/"[^"]+"/g) || [];
    const outside = query.replace(/"[^"]+"/g, " ");
    const number = parseNumber(outside);
    const text = `${number ? number.rest : outside} ${quoted.join(" ")}`.trim();
    const concepts = text ? parseQuery(text, {
          terms: this.terms,
          synonyms: this.synonyms,
          synonymWeight: this.synonymWeight,
          stopwords: this.stopwords,
          ocr: this.ocr,
        }) : [];
    return { number, concepts };
  }

  passesFilters(doc, filters) {
    if (!filters) return true;
    if (filters.codes && filters.codes.length && !filters.codes.includes(doc.code)) return false;
    if (filters.category && !(doc.categories || []).includes(filters.category)) return false;
    if (filters.statuses && filters.statuses.length && !filters.statuses.includes(doc.status)) return false;
    const year = Number(doc.year);
    if (filters.from && !(year >= filters.from)) return false;
    if (filters.to && !(year <= filters.to)) return false;
    return true;
  }

  search(query, filters = null) {
    const started = Date.now();
    const { number, concepts } = this.parse(query.trim());
    // Common words are dropped unless they are all there is.
    const active = concepts.filter((c) => !c.stop).length ? concepts.filter((c) => !c.stop) : concepts;
    const ignored = concepts.filter((c) => !active.includes(c)).map((c) => c.label);
    const nUnits = this.units.length;
    const nDocs = this.docs.length;

    // Per concept: weighted tf per pasal and per title.
    const unitScore = new Float32Array(nUnits);
    const unitMask = new Uint32Array(nUnits);
    const titleScore = new Float32Array(nDocs);
    const titleMask = new Uint32Array(nDocs);
    // Concepts matched through the form the user typed, as opposed to only through a padanan.
    const unitTyped = new Uint32Array(nUnits);
    const titleTyped = new Uint32Array(nDocs);
    const idfs = [];
    const positions = [];
    active.slice(0, 31).forEach((concept, index) => {
      const bit = 1 << index;
      const tf = new Float32Array(nUnits);
      const titleTf = new Float32Array(nDocs);
      const found = [];
      const typed = new Uint8Array(nUnits);
      const titleTypedHits = new Uint8Array(nDocs);
      concept.alternatives.forEach((alternative, k) => {
        const factor = concept.weights ? concept.weights[k] : 1;
        if (concept.scopes && concept.scopes[k] === "judul_tanpa_teks") {
          countInto(this.titles, alternative, titleTf, null, factor, titleTypedHits, this.withoutText);
          return;
        }
        countIndexed(this.body, alternative, tf, found, factor, typed);
        countInto(this.titles, alternative, titleTf, null, factor, titleTypedHits);
      });
      let df = 0;
      for (let u = 0; u < nUnits; u++) if (tf[u] > 0) df++;
      let titleDf = 0;
      for (let d = 0; d < nDocs; d++) if (titleTf[d] > 0) titleDf++;
      const idf = idfOf(df, nUnits);
      const titleIdf = idfOf(titleDf, nDocs);
      idfs[index] = idf;
      positions[index] = found.sort((a, b) => a - b);
      for (let u = 0; u < nUnits; u++) {
        if (tf[u] > 0) {
          unitScore[u] += bm25(tf[u], this.body.lengths[u], this.body.average, idf) * this.unitWeight[u];
          unitMask[u] |= bit;
          if (typed[u]) unitTyped[u] |= bit;
        }
      }
      for (let d = 0; d < nDocs; d++) {
        if (titleTf[d] > 0) {
          titleScore[d] += bm25(titleTf[d], this.titles.lengths[d], this.titles.average, titleIdf);
          titleMask[d] |= bit;
          if (titleTypedHits[d]) titleTyped[d] |= bit;
        }
      }
    });

    // Matching a rare concept counts for more than matching a common one: "bonus" says more about
    // a pasal than "dapat". A concept's weight is its idf over all pasal, scaled down when it was
    // found only through a padanan rather than the word the user typed (K-030).
    const weightOf = (mask, typedMask = mask) => {
      let total = 0;
      for (let i = 0; i < idfs.length; i++) {
        if (typedMask & (1 << i)) total += idfs[i];
        else if (mask & (1 << i)) total += idfs[i] * this.synonymWeight;
      }
      return total;
    };

    // Which concepts occur near each other somewhere in each pasal (see NEAR).
    const nearMask = new Uint32Array(nUnits);
    const nearTyped = new Uint32Array(nUnits);
    for (let u = 0; u < nUnits; u++) {
      const mask = unitMask[u];
      if (!mask || (mask & (mask - 1)) === 0) {
        nearMask[u] = mask;
        nearTyped[u] = unitTyped[u];
        continue;
      }
      const lo = this.body.starts[u] * 2;
      const hi = this.body.starts[u + 1] * 2;
      const events = [];
      for (let i = 0; i < positions.length; i++) {
        if (!(mask & (1 << i))) continue;
        const list = positions[i];
        for (let k = lowerBound(list, lo); k < list.length && list[k] < hi; k++) events.push(list[k] * 32 + i);
      }
      events.sort((a, b) => a - b);
      const at = (e) => Math.floor(e / 64);
      const anyCount = new Int32Array(32);
      const typedCount = new Int32Array(32);
      let anyMask = 0;
      let typedMask = 0;
      let best = 0;
      let bestTyped = 0;
      let bestWeight = -1;
      for (let right = 0, left = 0; right < events.length; right++) {
        const bit = events[right] % 32;
        const isTyped = Math.floor(events[right] / 32) % 2;
        if (anyCount[bit]++ === 0) anyMask |= 1 << bit;
        if (isTyped && typedCount[bit]++ === 0) typedMask |= 1 << bit;
        while (at(events[right]) - at(events[left]) > NEAR) {
          const gone = events[left] % 32;
          const goneTyped = Math.floor(events[left] / 32) % 2;
          left++;
          if (--anyCount[gone] === 0) anyMask &= ~(1 << gone);
          if (goneTyped && --typedCount[gone] === 0) typedMask &= ~(1 << gone);
        }
        const weight = weightOf(anyMask, typedMask);
        if (weight > bestWeight) {
          bestWeight = weight;
          best = anyMask;
          bestTyped = typedMask;
        }
      }
      nearMask[u] = best;
      nearTyped[u] = bestTyped;
    }

    // Aggregate per document.
    const perDoc = new Map();
    const docEntry = (d) => {
      let entry = perDoc.get(d);
      if (!entry) {
        entry = { d, units: [], number: false, cites: 0, coverage: 0, score: 0, mask: titleMask[d] };
        perDoc.set(d, entry);
      }
      return entry;
    };
    for (let d = 0; d < nDocs; d++) if (titleMask[d]) docEntry(d);
    for (let u = 0; u < nUnits; u++) if (unitMask[u]) docEntry(this.units[u].doc).units.push(u);

    if (number) {
      for (let d = 0; d < nDocs; d++) if (numberMatches(number, this.docs[d])) docEntry(d).number = true;
      // Places in other documents that cite this number. Only used when the query is a number
      // alone; otherwise the words decide.
      if (!active.length) {
        const pattern = citationPattern(number);
        for (const segment of this.citingSegments(pattern, number)) {
          const entry = docEntry(this.units[segment].doc);
          if (!entry.number) {
            entry.cites++;
            if (!entry.units.includes(segment)) entry.units.push(segment);
          }
        }
      }
    }

    const results = [];
    for (const entry of perDoc.values()) {
      const doc = this.docs[entry.d];
      if (!this.passesFilters(doc, filters)) continue;
      // The pasal shown first is the one where the most (and rarest) concepts occur together.
      const title = titleMask[entry.d];
      const titleT = titleTyped[entry.d];
      entry.units.sort(
        (a, b) =>
          weightOf(nearMask[b] | title, nearTyped[b] | titleT) - weightOf(nearMask[a] | title, nearTyped[a] | titleT) ||
          unitScore[b] - unitScore[a] ||
          a - b
      );
      let any = title;
      for (const u of entry.units) any |= unitMask[u];
      const first = entry.units.length ? entry.units[0] : -1;
      const bestMask = first === -1 ? title : nearMask[first] | title;
      const bestTyped = first === -1 ? titleT : nearTyped[first] | titleT;
      entry.coverage = popcount(bestMask);
      entry.weight = weightOf(bestMask, bestTyped);
      entry.mask = any;
      const top = entry.units.slice(0, 5).map((u) => unitScore[u]);
      entry.score =
        TITLE_WEIGHT * titleScore[entry.d] + (top[0] || 0) + 0.1 * top.slice(1).reduce((a, b) => a + b, 0);
      if (entry.number || entry.coverage > 0 || entry.cites > 0) results.push(entry);
    }

    results.sort(
      (a, b) =>
        Number(b.number) - Number(a.number) ||
        b.weight - a.weight ||
        b.score - a.score ||
        b.cites - a.cites ||
        (Number(this.docs[b.d].year) || 0) - (Number(this.docs[a.d].year) || 0) ||
        this.docs[a.d].id.localeCompare(this.docs[b.d].id)
    );

    // An article reference filters, the other words rank (K-101): documents that cite it in so many
    // words come first, in the order above; the rest stay behind "Tampilkan juga hasil lain".
    let article = null;
    const ref = this.articleRef(query.trim(), number);
    if (ref) {
      const { cited, units } = ref.found ? this.articleCitations(ref) : { cited: new Map(), units: new Map() };
      const exact = cited.size ? results.filter((r) => cited.has(r.d)) : [];
      // A document that cites the article but holds none of the query's words ("Pasal 23
      // Undang-Undang PPh" for "PPh 23") still belongs here: after the ranked ones, newest first.
      const ranked = new Set(results.map((r) => r.d));
      const unranked = [...cited.keys()]
        .filter((d) => !ranked.has(d) && this.passesFilters(this.docs[d], filters))
        .sort((a, b) => (Number(this.docs[b].year) || 0) - (Number(this.docs[a].year) || 0) || this.docs[a].id.localeCompare(this.docs[b].id))
        .map((d) => ({ d, units: units.get(d) || [], number: false, cites: 0, coverage: 0, weight: 0, score: 0, mask: 0, citesOnly: true }));
      exact.push(...unranked);
      if (exact.length) {
        const rest = results.filter((r) => !cited.has(r.d));
        results.length = 0;
        results.push(...exact, ...rest);
      }
      article = { ref, cited, exact: exact.length };
    }

    this.last = { query, results, active, number, article, unitScore, unitMask, titleMask, idfs, unseenIdf: idfOf(0, nUnits) };
    return {
      ...(article ? { article: this.articleSummary(article) } : {}),
      total: results.length,
      took: Date.now() - started,
      number: number ? { serial: number.serial, year: number.year, codes: number.codes, text: number.text } : null,
      concepts: active.map((c) => ({ label: c.label, kind: c.kind, forms: c.forms || null })),
      ignored,
      // Regional taxes are not on this site; say so instead of letting near-miss results look like
      // answers (pajak-daerah.json).
      localTax: detectLocalTax(query, this.localTax, this.ocr),
    };
  }

  articleSummary({ ref, exact }) {
    const place = `Pasal ${ref.article}${ref.ayat ? ` ayat (${ref.ayat})` : ""}`;
    const named = ref.laws ? ref.laws.map((l) => this.laws.laws[l].name) : [];
    return {
      label: [place, ...(named.length ? [named.join(" atau ")] : [])].join(" "),
      place,
      laws: named.length ? named : null,
      found: ref.found,
      exact,
      other: this.last ? this.last.results.length - exact : 0,
    };
  }

  /**
   * The article box (K-101) for the last search: per law, the documents that write the article
   * out, those the sources record as in force first, then newest first. A law the query did not
   * name comes in the order of the first result citing it, so the other words decide which law
   * leads. Each part is the source's own text of one place, from after its heading; nothing is put
   * together from several places, and an amending law with several items on one article keeps them
   * apart.
   */
  articleBox() {
    if (!this.last) throw new Error("articleBox() dipanggil sebelum search()");
    const article = this.last.article;
    if (!article || !article.ref.found) return null;
    const { ref, cited } = article;
    const register = this.articleRegister();
    const first = new Map();
    this.last.results.slice(0, article.exact).forEach((r, position) => {
      for (const l of cited.get(r.d) || []) if (!first.has(l)) first.set(l, position);
    });
    const groups = new Map();
    for (const e of register.entries) {
      if (e.article !== ref.article || (ref.laws && !ref.laws.includes(e.law))) continue;
      if (!groups.has(e.law)) groups.set(e.law, new Map());
      const byDoc = groups.get(e.law);
      if (!byDoc.has(e.doc)) byDoc.set(e.doc, []);
      byDoc.get(e.doc).push(e);
    }
    const inForce = (d) => (this.docs[d].status === "berlaku" ? 0 : 1);
    const at = (l) => (first.has(l) ? first.get(l) : Infinity);
    return [...groups.entries()]
      .sort(([a], [b]) => at(a) - at(b) || a - b)
      .map(([l, byDoc]) => ({
        law: this.laws.laws[l].name,
        label: `Pasal ${ref.article} ${this.laws.laws[l].name}`,
        cited: [...cited.values()].filter((set) => set.has(l)).length,
        places: [...byDoc.entries()]
          .sort(([a], [b]) => inForce(a) - inForce(b) || Number(this.docs[b].year) - Number(this.docs[a].year) || a - b)
          .map(([d, list]) => this.articlePlace(d, l, ref.article, list.sort((a, b) => a.unit - b.unit || a.start - b.start))),
      }));
  }

  articlePlace(d, law, articleLabel, entries) {
    const doc = this.docs[d];
    const explanation = (this.register.explanations.get(`${law}/${articleLabel}`) || []).find((x) => x.doc === d);
    return {
      docId: doc.id,
      docLabel: doc.label,
      title: doc.title,
      year: doc.year,
      claims: doc.claims,
      status: doc.status,
      statusReasons: doc.statusReasons,
      kind: entries[0].kind,
      explanationId: explanation ? this.units[explanation.unit].id : null,
      parts: entries.map((e) => {
        const unit = this.units[e.unit];
        // The heading the box already shows ("Pasal 16D"). A deleting item is its sentence alone.
        const text = e.action === "dihapus" ? "" : this.texts[e.unit].slice(e.start, e.end).replace(/^\s*["“]?Pasal[ \t]+\d{1,3}[ \t]?[A-Z]?[ \t]*\n/, "");
        return {
          action: e.action,
          instruction: e.instruction,
          unitId: unit.id,
          unitLabel: unit.label,
          text: text.split("\n").map((line) => line.trim()).filter(Boolean).join("\n"),
        };
      }),
    };
  }

  /** Every normalised token of the pasal text, for judging imported text (K-043). */
  vocabularySet() {
    // The vocabulary only grows (K-099); a word counts as known while some pasal still holds it.
    const { vocab, postingStart } = this.body;
    return new Set(vocab.filter((_, v) => postingStart[v + 1] > postingStart[v]));
  }

  /**
   * The segment of every citation match, in text order, as the long string's matchAll gave them.
   * Only pasal holding both the serial and the year are rebuilt as text. A match at the very start
   * of a pasal began, in the long string, at the space before it, which belonged to the pasal
   * before: kept as it was.
   */
  citingSegments(pattern, number) {
    const body = this.body;
    const serial = body.idOf.get(number.serial.toLowerCase());
    const year = body.idOf.get(number.year);
    if (serial === undefined || year === undefined) return [];
    const unitsOf = (v) => {
      const set = new Set();
      for (let p = body.postingStart[v]; p < body.postingStart[v + 1]; p++) set.add(upperBound(body.tokenStart, body.postings[p]) - 1);
      return set;
    };
    const withYear = unitsOf(year);
    const candidates = [...unitsOf(serial)].filter((u) => withYear.has(u)).sort((a, b) => a - b);
    const out = [];
    for (const u of candidates) {
      const words = [];
      for (let k = body.tokenStart[u]; k < body.tokenStart[u + 1]; k++) words.push(body.vocab[body.ids[k]]);
      for (const match of words.join(" ").matchAll(pattern)) out.push(match.index === 0 && u > 0 ? u - 1 : u);
    }
    return out;
  }

  /** One page of the last search, with snippets. */
  page(offset, limit) {
    if (!this.last) throw new Error("page() dipanggil sebelum search()");
    return this.last.results.slice(offset, offset + limit).map((entry) => this.item(entry));
  }

  /**
   * "Teratas per kategori" (K-079): the best `limit` results of each category from the last search,
   * taken from the ranked list as it is, so no rank changes. A category named in the query comes
   * first; the others follow the position of their best result. Display only.
   */
  byCategory(limit = 3) {
    if (!this.last) throw new Error("byCategory() dipanggil sebelum search()");
    const groups = new Map();
    // For an article reference, only the results shown before "Tampilkan juga hasil lain" (K-101).
    const article = this.last.article;
    const shown = article && article.exact ? this.last.results.slice(0, article.exact) : this.last.results;
    shown.forEach((entry, position) => {
      for (const category of this.docs[entry.d].categories || []) {
        if (!groups.has(category)) groups.set(category, { category, first: position + 1, entries: [] });
        const group = groups.get(category);
        if (group.entries.length < limit) group.entries.push([position + 1, entry]);
      }
    });
    const named = mentionedCategories(this.last.query || "", this.ocr);
    return [...groups.values()]
      .sort((a, b) => Number(named.has(b.category)) - Number(named.has(a.category)) || a.first - b.first)
      .map((g) => ({
        category: g.category,
        named: named.has(g.category),
        first: g.first,
        items: g.entries.map(([rank, entry]) => ({ ...this.item(entry), rank })),
      }));
  }

  /** One ranked entry as a result card, with snippets. */
  item(entry) {
    const { active, unitMask } = this.last;
    {
      const doc = this.docs[entry.d];
      const matched = active.filter((_, i) => entry.mask & (1 << i)).map((c) => c.label);
      const missingIndexes = active.map((_, i) => i).filter((i) => !(entry.mask & (1 << i)));
      const missing = missingIndexes.map((i) => active[i].label);
      const missingIdf = missingIndexes.map((i) => Math.round(this.last.idfs[i] * 100) / 100);
      const reasons = [];
      if (entry.number) reasons.push("nomor");
      if (entry.cites) reasons.push("menyebut");
      if (this.last.titleMask[entry.d]) reasons.push("judul");
      if (entry.units.length && !entry.cites) reasons.push("teks");
      const article = this.last.article;
      const cites = article && article.cited.get(entry.d);
      return {
        ...doc,
        ...(article ? { citesArticle: cites ? [...cites].map((l) => `${article.ref.ayat ? `Pasal ${article.ref.article} ayat (${article.ref.ayat})` : `Pasal ${article.ref.article}`} ${this.laws.laws[l].name}`) : null } : {}),
        reasons,
        coverage: entry.coverage,
        conceptCount: active.length,
        matched,
        missing,
        missingIdf,
        cites: entry.cites,
        unitCount: entry.units.length,
        units: entry.units.slice(0, UNITS_PER_RESULT).map((u) => ({
          ...this.units[u],
          // A pasal found only by citing the article shows where it does.
          ...this.snippet(u, entry.citesOnly ? [{ alternatives: [["pasal", normToken(article.ref.article, this.ocr)]] }] : entry.cites && !unitMask[u] ? null : active),
        })),
      };
    }
  }

  /**
   * A window of the original pasal text around the matches. Returned as segments so the page can
   * mark matches without building HTML from source text. The words are the source's own, OCR
   * errors included; only whitespace is collapsed.
   */
  snippet(unitIndex, concepts) {
    const raw = this.texts[unitIndex];
    const tokens = tokensWithOffsets(raw);
    const norms = tokens.map((t) => normToken(t.raw, this.ocr));
    // Each marked token remembers which concept it belongs to (one bit per concept).
    const marked = new Uint32Array(tokens.length);

    const number = this.last && this.last.number;
    if (concepts && concepts.length) {
      concepts.slice(0, 31).forEach((concept, index) => {
        const bit = 1 << index;
        for (const alt of concept.alternatives) {
          const single = alt.length === 1 && alt[0].length >= MIN_INFIX && !isNumeric(alt[0]);
          for (let i = 0; i < norms.length; i++) {
            if (single) {
              if (norms[i].includes(alt[0])) marked[i] |= bit;
            } else if (alt.every((t, k) => norms[i + k] === t)) {
              for (let k = 0; k < alt.length; k++) marked[i + k] |= bit;
            }
          }
        }
      });
    } else if (number) {
      const serial = number.serial.toLowerCase();
      for (let i = 0; i < norms.length; i++) {
        if (norms[i] !== serial) continue;
        for (let k = i + 1; k < Math.min(norms.length, i + 6); k++) {
          if (norms[k] === number.year) {
            for (let j = i; j <= k; j++) marked[j] = 1;
            break;
          }
        }
      }
    }

    // The pasal text opens with its own heading ("Pasal 24"), which the result already shows.
    const heading = (this.units[unitIndex].label.replace(/^Penjelasan /, "").match(/[\p{L}\p{N}]+/gu) || []).map((t) =>
      t.toLowerCase()
    );
    let skip = 0;
    while (skip < heading.length && tokens[skip] && tokens[skip].raw.toLowerCase() === heading[skip]) skip++;
    if (skip < heading.length || skip >= tokens.length) skip = 0;

    // The window that shows the most different concepts, then the most matches; earliest wins.
    let bestStart = skip;
    let bestScore = -1;
    for (let start = skip; start < Math.max(skip + 1, tokens.length); start++) {
      if (start > skip && !marked[start]) continue; // only windows that open on a match
      let mask = 0;
      let count = 0;
      for (let i = start; i < Math.min(tokens.length, start + SNIPPET_TOKENS); i++) {
        if (marked[i]) {
          mask |= marked[i];
          count++;
        }
      }
      const score = popcount(mask) * 1000 + count;
      if (score > bestScore) {
        bestScore = score;
        bestStart = start;
      }
    }
    // Start a little before the first match so the reader sees its context.
    let first = bestStart;
    while (first < tokens.length && !marked[first]) first++;
    if (first < tokens.length) bestStart = Math.max(skip, Math.min(bestStart, first - 6));
    const end = Math.min(tokens.length, bestStart + SNIPPET_TOKENS);

    const segments = [];
    const clean = (s) => s.replace(/\s+/g, " ");
    // Right after the skipped heading, start at the heading's end so "(1)" keeps its bracket.
    let cursor = !tokens.length ? 0 : bestStart === skip && skip > 0 ? tokens[skip - 1].end : tokens[bestStart].start;
    let fragment = null;
    for (let i = bestStart; i < end; i++) {
      if (!marked[i]) continue;
      let j = i;
      while (j + 1 < end && marked[j + 1]) j++;
      if (tokens[i].start > cursor) {
        const gap = clean(raw.slice(cursor, tokens[i].start));
        segments.push({ text: segments.length ? gap : gap.trimStart(), mark: false });
      }
      const hit = raw.slice(tokens[i].start, tokens[j].end);
      segments.push({ text: clean(hit), mark: true });
      if (!fragment) fragment = clean(hit);
      cursor = tokens[j].end;
      i = j;
    }
    const stop = tokens.length ? tokens[end - 1].end : raw.length;
    if (stop > cursor) {
      const tail = clean(raw.slice(cursor, stop));
      segments.push({ text: segments.length ? tail : tail.trimStart(), mark: false });
    }
    return { segments, before: bestStart > skip, after: end < tokens.length, fragment };
  }
}
