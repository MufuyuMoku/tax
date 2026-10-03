// Text out of an imported file. Runs in the browser at import time and in Node for tests; the
// pdf.js module is passed in, so the browser can load it only when a PDF is imported.
//
// A PDF without a text layer (a scan) yields no text. That is reported, not repaired: there is no
// OCR in this project (SPEC section 10), and an OCR confidence score would not be trusted anyway
// (invariant 8).

// Fewer readable characters than this across the whole file means there is no usable text layer.
export const MIN_TEXT_CHARS = 20;

/** { text, pages, hasTextLayer } from PDF bytes. */
export async function extractPdf(bytes, pdfjs, { worker = null } = {}) {
  const task = pdfjs.getDocument({
    ...(worker ? { worker } : {}),
    // pdf.js may detach the buffer it is given; keep the caller's bytes intact for storage.
    data: new Uint8Array(bytes).slice(),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const doc = await task.promise;
  const pages = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (typeof item.str !== "string") continue;
        text += item.str + (item.hasEOL ? "\n" : "");
      }
      pages.push(text.replace(/[ \t]+\n/g, "\n").trim());
    }
  } finally {
    await task.destroy();
  }
  const text = pages.join("\n\n").trim();
  return { text, pages: pages.length, hasTextLayer: text.replace(/\s+/g, "").length >= MIN_TEXT_CHARS };
}

// Text quality (K-043). A PDF can have a text layer that is noise: fonts without a Unicode map give
// replacement characters, scrambled letters, or symbol soup. Such text is kept but not shown as the
// document's content and not searched, unless the user says it is readable.
export const MAX_ODD_RATIO = 0.1; // share of non-space characters that are not letters, digits, or ordinary punctuation
export const MIN_KNOWN_RATIO = 0.5; // share of words (3+ letters) that occur in the corpus
export const MIN_WORDS = 15; // below this, too few words to judge by vocabulary

const ODD = /[�\u0000-\u0008\u000B\u000C\u000E-\u001F-]/u;
const ORDINARY = /[\p{L}\p{N}.,;:()/\-'"?!%&@*+=§°“”‘’–—…•\[\]]/u;

/**
 * { chars, oddRatio, words, knownRatio, readable }. `isKnown(word)` says whether a word occurs in
 * the corpus; in the browser it is backed by the search worker's vocabulary.
 */
export function assessText(text, isKnown) {
  const chars = [...String(text || "")].filter((c) => !/\s/u.test(c));
  const odd = chars.filter((c) => ODD.test(c) || !ORDINARY.test(c)).length;
  const words = String(text || "").match(/\p{L}{3,}/gu) || [];
  const known = words.filter((w) => isKnown(w)).length;
  const oddRatio = chars.length ? odd / chars.length : 1;
  const knownRatio = words.length ? known / words.length : 0;
  const readable =
    chars.length > 0 && oddRatio <= MAX_ODD_RATIO && (words.length < MIN_WORDS ? words.length > 0 : knownRatio >= MIN_KNOWN_RATIO);
  return {
    chars: chars.length,
    oddRatio: Math.round(oddRatio * 1000) / 1000,
    words: words.length,
    knownRatio: Math.round(knownRatio * 1000) / 1000,
    readable,
  };
}

/** Pasted text or a .txt file: kept as written, line endings normalised. */
export function extractPlain(text) {
  const clean = String(text).replace(/\r\n?/g, "\n").trim();
  return { text: clean, pages: null, hasTextLayer: clean.replace(/\s+/g, "").length > 0 };
}

/** Bytes of a .txt file as text. UTF-8, with a leading byte-order mark dropped. */
export function decodeTextFile(bytes) {
  return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
}
