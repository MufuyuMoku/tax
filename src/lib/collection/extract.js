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

/** Pasted text or a .txt file: kept as written, line endings normalised. */
export function extractPlain(text) {
  const clean = String(text).replace(/\r\n?/g, "\n").trim();
  return { text: clean, pages: null, hasTextLayer: clean.replace(/\s+/g, "").length > 0 };
}

/** Bytes of a .txt file as text. UTF-8, with a leading byte-order mark dropped. */
export function decodeTextFile(bytes) {
  return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
}
