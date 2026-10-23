// Article references (K-101): "16D", "pasal 4 ayat (2)", "PPh 23", "PPN 16C", "Pasal 32A UU PPh".
// To an officer "16D" is one thing, Pasal 16D of the VAT law, not every text holding the token
// "16d". This file knows the tax laws of src/data/search/undang-undang.json, finds where each of
// their articles is written in the corpus (in the original law and in every law that amends it),
// reads an article reference out of a query, and tells whether a pasal cites that article of that
// law in so many words. It never assembles a consolidated text: every place is a unit, or a stretch
// of a unit, of the source as it was retrieved. Shared by the engine in the browser and in Node.
import { normToken } from "./normalize.js";

const words = (text, ocr) => (text.match(/[\p{L}\p{N}]+/gu) || []).map((t) => normToken(t, ocr));

// Between "Pasal 16D" and the name of its law: "ayat (1) huruf a dan/atau Pasal 16E".
const BETWEEN = new Set(["ayat", "huruf", "angka", "dan", "atau", "serta", "pasal", "juncto", "jo", "sampai", "dengan", "hingga", "s", "d"]);
const BETWEEN_MAX = 20;
const PLACE = /^\d+[a-z]?$/;

/**
 * The laws, compiled against the document list: which documents are each law's original and its
 * amendments ("Perubahan ... atas Undang-Undang Nomor 8 Tahun 1983"), and every way the law is
 * named, as token arrays. Omnibus laws (HPP, Cipta Kerja) are found per pasal by the register.
 */
export function compileLaws(groups, docs, ocr) {
  const laws = groups.map((g) => ({
    key: g.kode,
    name: g.nama,
    names: g.sebutan.map((s) => words(s, ocr)),
    prefixes: (g.awalan || []).map((s) => words(s, ocr)),
    prefixInText: Boolean(g.awalan_di_teks),
    bases: [],
    amenders: [],
  }));
  const byNumber = new Map();
  groups.forEach((g, i) => {
    for (const written of g.induk) {
      const [, number, year] = written.match(/^UU (\d+)\/(\d{4})$/);
      byNumber.set(`${number}/${year}`, i);
    }
  });
  const familyOf = new Int16Array(docs.length).fill(-1);
  docs.forEach((doc, d) => {
    if (doc.code !== "UU" && doc.code !== "PERPU") return;
    const own = byNumber.get(`${doc.number}/${doc.year}`);
    if (doc.code === "UU" && own !== undefined) {
      laws[own].bases.push(d);
      familyOf[d] = own;
      return;
    }
    const target = (doc.title || "").match(/\bPERUBAHAN\b.*?\bATAS\s+UNDANG-UNDANG\s+(?:REPUBLIK\s+INDONESIA\s+)?(?:NOMOR|NO\.?)\s*(\d+)\s+TAHUN\s+(\d{4})/i);
    const law = target ? byNumber.get(`${target[1]}/${target[2]}`) : undefined;
    if (law !== undefined) {
      laws[law].amenders.push(d);
      familyOf[d] = law;
    }
  });
  // "Undang-Undang Nomor 36 Tahun 2008" names the income tax law as surely as "UU PPh" does.
  laws.forEach((law) => {
    for (const d of [...law.bases, ...law.amenders]) {
      const { number: n, year: y, code } = docs[d];
      const lead = code === "PERPU" ? [["peraturan", "pemerintah", "pengganti", "undang", "undang"], ["perpu"], ["perppu"]] : [["undang", "undang"], ["uu"]];
      for (const head of lead) {
        for (const middle of [["nomor"], ["no"], ["republik", "indonesia", "nomor"], []]) {
          law.names.push([...head, ...middle, n, "tahun", y]);
        }
        law.names.push([...head, n, y]);
      }
    }
    law.names.sort((a, b) => b.length - a.length);
  });
  return { laws, familyOf };
}

/** The law named at token `at` of `get` (a token accessor), as its index, or -1. */
function lawNamedAt(compiled, get, at) {
  for (let l = 0; l < compiled.laws.length; l++) {
    for (const name of compiled.laws[l].names) {
      if (name.every((t, k) => get(at + k) === t)) return l;
    }
  }
  return -1;
}

/**
 * "PPh" or "Pajak Penghasilan" (and "final") right before token `end`, for laws named that way in
 * text. `short`: the abbreviation only, for a number without "Pasal" ("PPh 21"); "Pajak
 * Penghasilan. 23. Pajak ..." is a numbered list, not Pasal 23.
 */
function prefixBefore(compiled, get, end, short = false) {
  for (const skip of [0, 1]) {
    if (skip && get(end - 1) !== "final") continue;
    const stop = end - skip;
    for (let l = 0; l < compiled.laws.length; l++) {
      const law = compiled.laws[l];
      if (!law.prefixInText) continue;
      for (const prefix of law.prefixes) {
        if (short && prefix.length > 1) continue;
        if (prefix.every((t, k) => get(stop - prefix.length + k) === t)) return l;
      }
    }
  }
  return -1;
}

/**
 * Where every article of these laws is written in the corpus. Returns
 * { entries: [{ law, article, doc, unit, start, end, kind, action, instruction }], explanations,
 *   unitLaw }:
 * - kind "induk": a pasal of the original law, the whole unit;
 * - kind "pengubah": the new wording in an amending law, either a stretch of its "Pasal I" between
 *   the article's heading and the next amendment item, or a whole unit of an omnibus law that the
 *   amendment sentence before it names ("Ketentuan Pasal 16D diubah sehingga berbunyi ...");
 *   `instruction` is that sentence as written, `action` is diubah, disisipkan or dihapus;
 * - explanations: "law/article" -> [{ doc, unit }] for the Penjelasan of that article;
 * - unitLaw: unit index -> law index, for the pasal that belong to one law, where "Pasal 16D"
 *   without the law's name means that law's article.
 */
export function buildRegister(compiled, docs, units, texts) {
  const entries = [];
  const explanations = new Map();
  const unitLaw = new Map();
  const byDoc = new Map();
  units.forEach((unit, u) => {
    if (compiled.familyOf[unit.doc] !== -1 || docs[unit.doc].code === "UU" || docs[unit.doc].code === "PERPU") {
      if (!byDoc.has(unit.doc)) byDoc.set(unit.doc, []);
      byDoc.get(unit.doc).push(u);
    }
  });
  const explain = (law, article, doc, unit) => {
    const key = `${law}/${article}`;
    if (!explanations.has(key)) explanations.set(key, []);
    explanations.get(key).push({ doc, unit });
  };

  for (const [d, list] of byDoc) {
    const law = compiled.familyOf[d];
    const isBase = law !== -1 && compiled.laws[law].bases.includes(d);
    if (law !== -1) {
      for (const u of list) {
        unitLaw.set(u, law);
        const article = articleOf(units[u].label);
        if (units[u].section === "p") {
          if (article) explain(law, article, d, u);
        } else if (isBase && article) {
          entries.push({ law, article, doc: d, unit: u, start: 0, end: texts[u].length, kind: "induk", action: null, instruction: null });
        } else if (/^Pasal [IVXL]+$/.test(units[u].label)) {
          for (const item of amendmentItems(texts[u])) entries.push({ law, doc: d, unit: u, kind: "pengubah", ...item });
        }
      }
      continue;
    }
    // An omnibus law: "Beberapa ketentuan dalam Undang-Undang Nomor 8 Tahun 1983 ... diubah" opens a
    // run of pasal of that law, each announced by the sentence that ends the pasal before it.
    let current = -1;
    let previous = -1;
    for (const u of list) {
      if (units[u].section === "p") continue;
      const text = texts[u];
      const opening = text.match(/^\s*Pasal\s+\S+\s+Beberapa\s+ketentuan\s+dalam\s+Undang-Undang\s+(?:Nomor|No\.?)\s*(\d+)\s+Tahun\s+(\d{4})/);
      if (opening) {
        current = lawByNumber(compiled, docs, opening[1], opening[2]);
        if (current !== -1) unitLaw.set(u, current);
      } else if (current !== -1 && previous !== -1) {
        const article = articleOf(units[u].label);
        const instruction = article && announces(texts[previous], article);
        if (instruction) {
          unitLaw.set(u, current);
          entries.push({ law: current, article, doc: d, unit: u, start: 0, end: text.length, kind: "pengubah", action: actionOf(instruction, article), instruction });
        } else {
          current = -1;
        }
      }
      previous = u;
    }
  }
  return { entries, explanations, unitLaw };
}

function lawByNumber(compiled, docs, number, year) {
  for (let l = 0; l < compiled.laws.length; l++) {
    for (const d of [...compiled.laws[l].bases, ...compiled.laws[l].amenders]) {
      if (docs[d].number === number && docs[d].year === year) return l;
    }
  }
  return -1;
}

/** "Pasal 16D" -> "16D"; "Penjelasan Pasal 16 D" -> "16D"; anything else -> null. */
function articleOf(label) {
  const match = label.match(/^(?:Penjelasan )?Pasal (\d{1,3}) ?([A-Z])?$/);
  return match ? match[1] + (match[2] || "") : null;
}

const mentions = (sentence, article) => {
  const [, number, letter] = article.match(/^(\d+)([A-Z]?)$/);
  return new RegExp(`\\bPasal\\s+${number}${letter ? `\\s?${letter}` : ""}(?![A-Za-z0-9])`).test(sentence);
};

/** The amendment sentence at the end of `text` when it announces `article`, else null. */
function announces(text, article) {
  const tail = text.trimEnd();
  if (!/berbunyi\s+sebagai\s+berikut\s*:?$/.test(tail)) return null;
  const lines = tail.split("\n");
  const sentence = lines[lines.length - 1].trim();
  return mentions(sentence, article) ? sentence : null;
}

/** Inserted when the article is named after the inserting verb and before "sehingga". */
function actionOf(instruction, article) {
  if (/\bdihapus\.?$/.test(instruction) && !/berbunyi/.test(instruction)) return "dihapus";
  const inserted = instruction.match(/\b(?:disisipkan|ditambahkan|dimasukkan|menambah\w*|menyisipkan)\b(.*?)(?:\bsehingga\b|$)/i);
  if (!inserted) return "diubah";
  // UU 11/1994 inserts "4 (empat) ketentuan baru ... Pasal 16A, Pasal 16B, dan Pasal 16C" and
  // then writes out 16D too: an article the inserting sentence leaves out was inserted as well.
  if (mentions(inserted[1], article)) return "disisipkan";
  return !mentions(instruction, article) && !/^Ketentuan\b/.test(instruction) ? "disisipkan" : "diubah";
}

// An amendment item: its number on a line of its own when the source numbers them, then the
// sentence that says what changes ("Ketentuan Pasal 16C diubah, sehingga ... berbunyi sebagai
// berikut :", "Pasal 31D dihapus.").
const ITEM = /^[ \t]*(?:\d{1,3}\.[ \t]*\n[ \t]*)?((?:Ketentuan|Di ?antara|Diantara|Setelah|Sebelum|Menambah|Menyisipkan|Mengubah|Menghapus|Penjelasan|Judul|BAB|Bab|Pasal|diubah)\b[^\n]*?(?:(?:berikut|berbunyi)\s*:?|dihapus\.?))[ \t]*$/gm;
const CHANGES = /\b(?:diubah|disisipkan|dihapus|ditambah\w*|dimasukkan|menambah\w*|menyisipkan|diganti)\b/i;
// Older amending laws quote the new wording: '"Pasal 16D'.
const HEADING = /^[ \t]*["“]?Pasal[ \t]+(\d{1,3})[ \t]?([A-Z])?[ \t]*$/gm;

/**
 * The articles an amending law's "Pasal I" writes out: { article, start, end, action, instruction }
 * per article heading, from the heading to the next heading or amendment item. An item that only
 * deletes ("Ketentuan Pasal 31D dihapus.") gives one entry per article it names, holding just
 * that sentence.
 */
export function amendmentItems(text) {
  const items = [...text.matchAll(ITEM)]
    // "diubah, sehingga berbunyi sebagai berikut :" ends a sentence that began lines earlier.
    .filter((m) => (/\bPasal\b/.test(m[1]) || /^diubah\b/.test(m[1])) && CHANGES.test(m[1]) && (/berbunyi/.test(m[1]) || /dihapus\.?$/.test(m[1])))
    .map((m) => ({ at: m.index, sentence: m[1].trim(), end: m.index + m[0].length }));
  const headings = [...text.matchAll(HEADING)].map((m) => ({ at: m.index, article: m[1] + (m[2] || "") }));
  const out = [];
  items.forEach((item, i) => {
    const stop = i + 1 < items.length ? items[i + 1].at : text.length;
    const inside = headings.filter((h) => h.at > item.at && h.at < stop);
    if (!inside.length && /\bdihapus\.?$/.test(item.sentence) && !/berbunyi/.test(item.sentence)) {
      for (const m of item.sentence.matchAll(/\bPasal\s+(\d{1,3})\s?([A-Z])?(?![A-Za-z0-9])/g)) {
        out.push({ article: m[1] + (m[2] || ""), start: item.at, end: item.end, action: "dihapus", instruction: item.sentence });
      }
    }
    // "Ketentuan Pasal 4 ayat (1) huruf a dan huruf b diubah sehingga berbunyi": only the changed
    // part is written out, without the article's heading.
    const named = !inside.length && /berbunyi/.test(item.sentence) && item.sentence.match(/\bPasal\s+(\d{1,3})\s?([A-Z])?(?![A-Za-z0-9])/);
    if (named) out.push({ article: named[1] + (named[2] || ""), start: item.end, end: stop, action: "diubah", instruction: item.sentence });
    inside.forEach((h, k) => {
      const end = k + 1 < inside.length ? inside[k + 1].at : stop;
      out.push({ article: h.article, start: h.at, end, action: actionOf(item.sentence, h.article), instruction: item.sentence });
    });
  });
  return out;
}

const ART = String.raw`(\d{1,3})(?:\s?([A-Z])(?![A-Z0-9]))?`;
const AYAT = String.raw`(?:\s*AYAT\s*\(?\s*(\d{1,2}[A-Z]?)\s*\)?|\s*\(\s*(\d{1,2}[A-Z]?)\s*\))?`;
const NOT_A_PLACE = /^\s*(?:PERSEN\b|%|[,.]\d)/;

/**
 * Read an article reference from a query. Returns null, or
 * { article, ayat, laws: [law index] | null (any law), explicit, found, text }.
 * - "pasal 16D", "Ps. 16D", "pasal 4 ayat (2)": always a reference (explicit), found or not;
 * - "PPh 23", "PPh 4(2)", "PPN 16C": a law's abbreviation right before the number, when the
 *   number has a letter or an ayat, or for PPh, whose articles name taxes; "PPN 12 persen" is not;
 * - "16D", "31E", "4(2)": only when that article exists in one of the laws.
 * `has(article, laws)` says whether the register holds it. `found` is false for a reference to an
 * article no law here has, so the page can say so and search as usual.
 */
export function parseArticleRef(query, compiled, has) {
  const upper = ` ${query.toUpperCase().replace(/\s+/g, " ")} `;
  const prefixes = compiled.laws
    .flatMap((law, l) => law.prefixes.map((p) => [p.join("\\s+").toUpperCase(), l]))
    .sort((a, b) => b[0].length - a[0].length);
  const forms = [
    { re: new RegExp(`(?<![A-Z0-9])(?:PASAL|PSL\\.?|PS\\.?)\\s*${ART}${AYAT}`), explicit: true },
    { re: new RegExp(`(?<![A-Z0-9])(${prefixes.map((p) => p[0]).join("|")})\\s*(PASAL\\s*)?${ART}${AYAT}`), prefix: true },
    { re: new RegExp(`(?<![A-Z0-9/.\\-])(\\d{1,3}[A-Z]?)\\s*\\(\\s*(\\d{1,2}[A-Z]?)\\s*\\)`), bare: true },
    { re: /(?<![A-Z0-9/.\-])(\d{1,3}[A-Z])(?![A-Z0-9/])/, bare: true, letter: true },
  ];
  for (const form of forms) {
    const m = upper.match(form.re);
    if (!m) continue;
    let article;
    let ayat;
    let named = null;
    if (form.prefix) {
      named = prefixes.find((p) => new RegExp(`^${p[0]}$`).test(m[1]))[1];
      article = m[3] + (m[4] || "");
      ayat = m[5] || m[6] || null;
      if (NOT_A_PLACE.test(upper.slice(m.index + m[0].length))) continue;
      const keyword = Boolean(m[2]);
      if (!keyword && !m[4] && !ayat && !compiled.laws[named].prefixInText) continue;
      if (!keyword && !has(article, [named])) continue;
    } else if (form.explicit) {
      article = m[1] + (m[2] || "");
      ayat = m[3] || m[4] || null;
    } else {
      article = m[1];
      ayat = form.letter ? null : m[2];
    }
    const laws = named !== null ? [named] : lawsNamedIn(compiled, upper.slice(0, m.index) + " " + upper.slice(m.index + m[0].length));
    const found = has(article, laws);
    if (form.bare && !has(article, null)) {
      // "14D" is no article of any law here: say so, then search as usual.
      return form.letter ? { article, ayat: null, laws, explicit: false, found: false, text: m[0].trim() } : null;
    }
    return { article, ayat, laws, explicit: !form.bare, found, text: m[0].trim() };
  }
  return null;
}

/** Laws named anywhere in `text` by name, number, or abbreviation; null when none. */
function lawsNamedIn(compiled, text) {
  const tokens = words(text, null);
  const get = (k) => tokens[k];
  const found = new Set();
  for (let at = 0; at < tokens.length; at++) {
    const l = lawNamedAt(compiled, get, at);
    if (l !== -1) found.add(l);
    compiled.laws.forEach((law, i) => {
      if (law.prefixes.some((p) => p.every((t, k) => tokens[at + k] === t))) found.add(i);
    });
  }
  return found.size ? [...found].sort((a, b) => a - b) : null;
}

/**
 * Does the article token at `at` cite the reference in so many words? `get(k)` is the token at k
 * (undefined outside the pasal). Returns the law index cited, or -1:
 * "Pasal 16D Undang-Undang PPN", "Pasal 4 ayat (1) huruf a dan/atau Pasal 16D Undang-Undang
 * Nomor 8 Tahun 1983", "Pajak Penghasilan Pasal 21", "PPh Final Pasal 4 ayat (2)"; inside a pasal
 * of the law itself (`own`), "Pasal 16D" alone.
 */
export function citedLaw(compiled, get, at, ref, own) {
  const ayat = ref.ayat ? ref.ayat.toLowerCase() : null;
  let next = at + 1;
  let law = -1;
  const keyword = get(at - 1) === "pasal";
  if (keyword) law = prefixBefore(compiled, get, at - 1);
  // "... Undang-Undang PPh.\n23." is a law's name followed by a list number.
  else if (get(at - 2) !== "uu" && get(at - 2) !== "undang") law = prefixBefore(compiled, get, at, true);
  if (!keyword && law === -1) return -1;
  if (ayat) {
    if (get(next) === "ayat" && get(next + 1) === ayat) next += 2;
    else if (!keyword && get(next) === ayat) next += 1;
    else return -1;
  }
  if (law !== -1) return law;
  for (let k = next; k < next + BETWEEN_MAX; k++) {
    const token = get(k);
    if (token === undefined) break;
    const named = lawNamedAt(compiled, get, k);
    if (named !== -1) return named;
    if (!BETWEEN.has(token) && !PLACE.test(token) && token.length > 1) break;
  }
  return own === undefined ? -1 : own;
}
