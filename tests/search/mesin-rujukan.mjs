// Frozen copy of src/lib/search/engine.js as it was before the token index (K-069): it scans one
// long normalised string with indexOf. tests/search/setara.test.mjs proves that the engine gives
// identical results to it. Do not change this file to make that test pass.
// Full-text search over the whole corpus, in memory. No network: the engine gets the payload once
// and every query after that is answered from it.
//
// How it matches:
// - Every pasal (and penjelasan) is normalised into one long string of tokens, and titles into
//   another. A query concept is found with indexOf, which also gives prefix and in-word matches
//   for longer words ("potong" finds "pemotongan" and "dipotong"), weighted lower than whole words.
// - Ranking is BM25 per pasal. A document is ranked first by which of the query's concepts occur
//   close together in one of its pasal (or its title), each concept weighted by its rarity, then
//   by score. Long documents and long pasal therefore do not win just by mentioning every word
//   somewhere.
// - Regulation numbers are matched on the document identity, so documents without text are found
//   by number as well as by title (SPEC invariant 3).
import { normToken, normalizeText, tokensWithOffsets } from "../../src/lib/search/normalize.js";
import { citationPattern, compileTerms, detectLocalTax, numberMatches, parseNumber, parseQuery } from "../../src/lib/search/query.js";

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
    this.body = concatenate(this.texts, this.ocr);
    this.titles = concatenate(
      this.docs.map((d) => d.title || ""),
      this.ocr
    );
    this.unitWeight = Float32Array.from(this.units, (u) => (u.section === "p" ? EXPLANATION_WEIGHT : 1));
    this.last = null;
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
        countInto(this.body, alternative, tf, found, factor, typed);
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
        const text = this.body.text;
        const starts = this.body.starts;
        let segment = 0;
        for (const match of text.matchAll(pattern)) {
          while (starts[segment + 1] <= match.index) segment++;
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

    this.last = { results, active, number, unitScore, unitMask, titleMask, idfs, unseenIdf: idfOf(0, nUnits) };
    return {
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

  /** One page of the last search, with snippets. */
  page(offset, limit) {
    if (!this.last) throw new Error("page() dipanggil sebelum search()");
    const { results, active, unitMask } = this.last;
    return results.slice(offset, offset + limit).map((entry) => {
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
      return {
        ...doc,
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
          ...this.snippet(u, entry.cites && !unitMask[u] ? null : active),
        })),
      };
    });
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
