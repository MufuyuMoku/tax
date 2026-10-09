// Text of the full-text files downloaded from JDIH (harvest/jdih/files/), judged by the same text
// quality rule as the personal collection (K-043, K-055): same code, same thresholds, same corpus
// vocabulary. One rule for both places, so it cannot drift.
//
//   node scripts/jdih-pdf-text.mjs
//
// Writes harvest/jdih/teks_berkas.jsonl, one line per file: the text, whether it is usable, and the
// measurements. The corpus build takes the text only when it is usable; otherwise the document is
// shown without text, with a link to the original PDF (invariants 3 and 4). Sends nothing.
import fs from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { assessText, extractPdf } from "../src/lib/collection/extract.js";
import { buildSearchPayload } from "../src/lib/search/payload.js";
import { SearchEngine } from "../src/lib/search/engine.js";
import { normToken } from "../src/lib/search/normalize.js";

const DIR = process.argv[2] || path.join("harvest", "jdih", "files");
const OUT = process.argv[3] || path.join("harvest", "jdih", "teks_berkas.jsonl");

const { payload } = buildSearchPayload();
const vocabulary = new SearchEngine(payload).vocabularySet();
const isKnown = (word) => vocabulary.has(normToken(word, payload.ocr));

/** Text of a full-text HTML file, as poc/jdih_docs.py did: scripts and styles dropped. */
function htmlText(bytes) {
  let raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (raw.includes("�")) raw = new TextDecoder("windows-1252").decode(bytes);
  return raw
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).sort() : [];
const lines = [];
const tally = { pdf: 0, pdfUsable: 0, pdfNoLayer: 0, pdfUnreadable: 0, html: 0, htmlUsable: 0 };
for (const name of files) {
  const bytes = fs.readFileSync(path.join(DIR, name));
  const slug = name.replace(/\.[^.]+$/, "");
  const type = path.extname(name).slice(1).toLowerCase();
  let text = "";
  let hasTextLayer = true;
  if (type === "pdf") {
    const extracted = await extractPdf(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), pdfjs);
    text = extracted.text;
    hasTextLayer = extracted.hasTextLayer;
  } else {
    text = htmlText(bytes);
  }
  const quality = assessText(text, isKnown);
  const usable = hasTextLayer && quality.readable;
  if (type === "pdf") {
    tally.pdf++;
    if (usable) tally.pdfUsable++;
    else if (!hasTextLayer) tally.pdfNoLayer++;
    else tally.pdfUnreadable++;
  } else {
    tally.html++;
    if (usable) tally.htmlUsable++;
  }
  lines.push(JSON.stringify({ slug, type, hasTextLayer, usable, quality, text: usable ? text : "" }));
}
fs.writeFileSync(OUT, lines.join("\n") + (lines.length ? "\n" : ""));
console.log(
  `${files.length} berkas. PDF ${tally.pdf}: ${tally.pdfUsable} terbaca, ${tally.pdfNoLayer} tanpa lapisan teks, ` +
    `${tally.pdfUnreadable} berlapis teks tetapi tidak terbaca. HTML ${tally.html}: ${tally.htmlUsable} terbaca.`,
);
