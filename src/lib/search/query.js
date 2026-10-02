// Turns what an officer types into something the engine can match: regulation numbers written any
// common way, and words or terms, each term carrying every equivalent form from istilah.json.
import { baseToken, normToken } from "./normalize.js";

// Type hints. Each maps to the identity codes it may mean; "PER" without "/PJ" could still be a
// DJP regulation recorded by JDIH as "Peraturan Unit Eselon I".
const TYPE_HINTS = [
  [/\bPERATURAN\s+PEMERINTAH\s+PENGGANTI\b|\bPERP?PU\b/, ["PERPU"]],
  [/\bPERATURAN\s+MENTERI\s+KEUANGAN\b|\bPMK\b/, ["PMK"]],
  [/\bKEPUTUSAN\s+MENTERI\s+KEUANGAN\b|\bKMK\b|\/\s*KMK\b|\/\s*KM\b/, ["KMK"]],
  [/\bPERATURAN\s+PEMERINTAH\b|\bPP\b/, ["PP"]],
  [/\bUNDANG[\s-]+UNDANG\b|\bUU\b/, ["UU"]],
  [/\bPERATURAN\s+PRESIDEN\b|\bPERPRES\b/, ["PERPRES"]],
  [/\bKEPUTUSAN\s+PRESIDEN\b|\bKEPPRES\b/, ["KEPPRES"]],
  [/\bINSTRUKSI\s+PRESIDEN\b|\bINPRES\b/, ["INPRES"]],
  [/\bPERATURAN\s+DIREKTUR\s+JENDERAL\b|\bPERDIRJEN\b|\bPER\b/, ["PER-DJP", "PER-ESELON1"]],
  [/\bKEPUTUSAN\s+DIREKTUR\s+JENDERAL\b|\bKEPDIRJEN\b|\bKEP\b/, ["KEP-DJP", "KEP-ESELON1", "KMK"]],
  [/\bSURAT\s+EDARAN\b|\bSE\b/, ["SE"]],
  [/\bINS\b/, ["INS-DJP"]],
];

const DJP_CODES = new Set(["PER-DJP", "KEP-DJP", "INS-DJP", "SE", "ND-DJP", "PER-ESELON1", "KEP-ESELON1"]);

const NUMBER_FORMS = [
  // "168/PMK.03/2023", "PMK-168/PMK.03/2023", "PER-11/PJ/2025", "44/KMK.04/1998"
  /(?<![\w/])(\d{1,4}[A-Z]?)\s*\/\s*([A-Z][A-Z.\d]*(?:\s*\/\s*[A-Z][A-Z.\d]*)*)\s*\/\s*((?:19|20)\d\d)\b/,
  // "55 TAHUN 2022", "Nomor 55 Tahun 2022"
  /(?<![\w/])(\d{1,4}[A-Z]?)\s+TAHUN\s+((?:19|20)\d\d)\b/,
  // "55/2022"
  /(?<![\w/])(\d{1,4}[A-Z]?)\s*\/\s*((?:19|20)\d\d)\b/,
  // "PER 11 2025", "PER-11-2025", "168 2023"
  /(?<![\w/])(\d{1,4}[A-Z]?)[\s-]+((?:19|20)\d\d)\b/,
];

/**
 * Find a regulation number in the query. Returns null, or
 * { serial, series, year, codes, text } where `codes` is null when no type was written, and `text`
 * is the part of the query that made up the number, so the rest can still be searched as words.
 *
 * A bare "<number> <year>" only counts when nothing else in the query is a word: in "PPh 21 2024"
 * the 21 is a pasal, not a regulation number.
 */
export function parseNumber(query) {
  const upper = query.toUpperCase().replace(/\s+/g, " ").trim();
  for (let form = 0; form < NUMBER_FORMS.length; form++) {
    const match = upper.match(NUMBER_FORMS[form]);
    if (!match) continue;
    const serial = match[1].replace(/^0+(?=\d)/, "");
    const series = form === 0 ? match[2].replace(/\s+/g, "") : null;
    const year = form === 0 ? match[3] : match[2];

    let codes = null;
    for (const [pattern, hinted] of TYPE_HINTS) {
      if (pattern.test(upper)) {
        codes = hinted;
        break;
      }
    }
    if (series && /(^|\/)PJ\b/.test(series)) {
      const djp = (codes || [...DJP_CODES]).filter((c) => DJP_CODES.has(c));
      codes = djp.length ? djp : [...DJP_CODES];
    }
    if (series && /(^|\/)PMK\b/.test(series)) codes = ["PMK"];
    if (series && /(^|\/)KMK?\b/.test(series)) codes = ["KMK"];

    // Strip the number and the type words; whatever is left is ordinary words.
    let rest = upper.replace(match[0], " ");
    for (const [pattern] of TYPE_HINTS) rest = rest.replace(new RegExp(pattern.source, "g"), " ");
    rest = rest.replace(/\bNOMOR\b|\bNO\b\.?/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

    if (form === 3 && !codes && rest) return null;
    return { serial, series, year, codes, rest, text: match[0] };
  }
  return null;
}

/** Does document identity `doc` match a parsed number? */
export function numberMatches(number, doc) {
  if (!number || doc.year !== number.year) return false;
  const docSerial = String(doc.number).split("/")[0];
  if (docSerial.toUpperCase() !== number.serial) return false;
  return !number.codes || number.codes.includes(doc.code);
}

/**
 * A regex over normalised text for places where a regulation cites this number:
 * "nomor 168 tahun 2023", "168 pmk 3 2023", "per 11 pj 2025".
 */
const CITED_AS = {
  UU: ["undang undang"],
  PERPU: ["peraturan pemerintah pengganti undang undang"],
  PP: ["peraturan pemerintah"],
  PERPRES: ["peraturan presiden"],
  KEPPRES: ["keputusan presiden"],
  INPRES: ["instruksi presiden"],
  PMK: ["peraturan menteri keuangan"],
  KMK: ["keputusan menteri keuangan"],
  "PER-DJP": ["peraturan direktur jenderal pajak"],
  "KEP-DJP": ["keputusan direktur jenderal pajak"],
};
const SERIES_TOKEN = { PMK: "pmk", KMK: "kmk?", "PER-DJP": "pj", "KEP-DJP": "pj", SE: "pj", "INS-DJP": "pj" };

export function citationPattern(number) {
  const serial = number.serial.toLowerCase();
  const year = number.year;
  const forms = [];
  const codes = number.codes || Object.keys(CITED_AS);
  for (const code of codes) {
    // "Peraturan Menteri Keuangan Nomor 168 Tahun 2023"
    for (const name of CITED_AS[code] || []) {
      forms.push(`${name} (?:republik indonesia )?nomor ${serial} tahun ${year}`);
    }
    // "168/PMK.03/2023", "PER-11/PJ/2025", "44/KMK.04/1998"
    if (SERIES_TOKEN[code]) forms.push(`${serial} ${SERIES_TOKEN[code]}(?: \\d+)? ${year}`);
  }
  return new RegExp(`(?:^| )(?:${[...new Set(forms)].join("|")})(?= |$)`, "g");
}

/** Normalised tokens of a phrase, with OCR corrections, as an array. */
function phraseTokens(text, ocr) {
  return (text.match(/[\p{L}\p{N}]+/gu) || []).map((t) => normToken(t, ocr));
}

/**
 * Compile istilah.json into patterns: each form becomes a token array where "{n}"/"{m}" are slots
 * for a number. Longer forms are tried first so "PPh 21" wins over "PPh".
 */
export function compileTerms(groups, ocr) {
  const patterns = [];
  groups.forEach((forms, group) => {
    for (const form of forms) {
      const tokens = (form.match(/\{[nm]\}|[\p{L}\p{N}]+/gu) || []).map((t) =>
        t === "{n}" || t === "{m}" ? t : normToken(t, ocr)
      );
      patterns.push({ group, tokens });
    }
  });
  patterns.sort((a, b) => b.tokens.length - a.tokens.length);
  return { patterns, groups: groups.map((forms) => forms.slice()) };
}

const SLOT_VALUE = /^\d+[a-z]?$/;

function matchPattern(pattern, tokens, at) {
  const slots = {};
  for (let i = 0; i < pattern.tokens.length; i++) {
    const want = pattern.tokens[i];
    const have = tokens[at + i];
    if (have === undefined) return null;
    if (want === "{n}" || want === "{m}") {
      if (!SLOT_VALUE.test(have)) return null;
      slots[want] = have;
    } else if (want !== have) {
      return null;
    }
  }
  return slots;
}

/**
 * Parse a query into concepts. A concept is one thing the user asked for, with every form that
 * counts as that thing: { label, alternatives: [token arrays], kind: "term" | "word" | "phrase",
 * stop: bool }. Text in double quotes is one exact phrase.
 */
export function parseQuery(query, { terms, stopwords, ocr }) {
  const concepts = [];
  const stop = new Set(stopwords.map(baseToken));

  const quoted = [];
  const unquoted = query.replace(/"([^"]+)"/g, (_, phrase) => {
    quoted.push(phrase);
    return " ";
  });
  for (const phrase of quoted) {
    const tokens = phraseTokens(phrase, ocr);
    if (tokens.length) concepts.push({ label: `"${phrase.trim()}"`, alternatives: [tokens], kind: "phrase", stop: false });
  }

  const tokens = phraseTokens(unquoted, ocr);
  for (let at = 0; at < tokens.length; ) {
    let found = null;
    for (const pattern of terms.patterns) {
      const slots = matchPattern(pattern, tokens, at);
      if (slots) {
        found = { pattern, slots };
        break;
      }
    }
    if (found) {
      const forms = terms.groups[found.pattern.group];
      const fill = (form) =>
        form.replace(/\{n\}/g, found.slots["{n}"] || "").replace(/\{m\}/g, found.slots["{m}"] || "");
      const alternatives = [];
      const seen = new Set();
      for (const form of forms) {
        const alt = phraseTokens(fill(form), ocr);
        const key = alt.join(" ");
        if (alt.length && !seen.has(key)) {
          seen.add(key);
          alternatives.push(alt);
        }
      }
      concepts.push({
        label: tokens.slice(at, at + found.pattern.tokens.length).join(" "),
        alternatives,
        kind: "term",
        stop: false,
        forms: forms.map(fill),
      });
      at += found.pattern.tokens.length;
    } else {
      concepts.push({ label: tokens[at], alternatives: [[tokens[at]]], kind: "word", stop: stop.has(tokens[at]) });
      at += 1;
    }
  }

  // The same word typed twice counts once.
  const unique = [];
  const keys = new Set();
  for (const concept of concepts) {
    const key = concept.alternatives.map((a) => a.join(" ")).join("|");
    if (!keys.has(key)) {
      keys.add(key);
      unique.push(concept);
    }
  }
  return unique;
}
