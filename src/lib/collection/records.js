// Documents in the personal collection, and how they are searched. A record never leaves the
// device (SPEC invariant 7): it lives in IndexedDB, is searched in the page's own worker, and only
// ever reaches a file when the user exports a backup.
import { parseNumber } from "../search/query.js";

export const KINDS = {
  SE: "Surat Edaran",
  ND: "Nota Dinas",
  penegasan: "Surat Penegasan",
  putusan: "Putusan Pengadilan Pajak",
  lainnya: "Dokumen lain",
};

// Every imported document carries this, wherever it is shown.
export const UNVERIFIED = "Belum terverifikasi";

export function kindLabel(kind) {
  return KINDS[kind] || KINDS.lainnya;
}

/** A random id. It says nothing about the document and never appears in a request. */
export function newId(random = crypto.getRandomValues.bind(crypto)) {
  const bytes = random(new Uint8Array(12));
  return "k" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A collection record. `file` is { name, type, bytes: ArrayBuffer } for an imported file, or null
 * for pasted text. `extracted` is the result of extract.js. Metadata come from the user.
 */
export async function makeRecord({ id, meta, source, file, extracted, references, importedAt }) {
  return {
    id,
    kind: KINDS[meta.kind] ? meta.kind : "lainnya",
    number: (meta.number || "").trim(),
    date: (meta.date || "").trim(),
    subject: (meta.subject || "").trim(),
    note: (meta.note || "").trim(),
    source, // "pdf" | "txt" | "tempel"
    file: file
      ? { name: file.name, type: file.type, size: file.bytes.byteLength, sha256: await sha256(file.bytes), bytes: file.bytes }
      : null,
    text: extracted.hasTextLayer ? extracted.text : null,
    hasText: extracted.hasTextLayer,
    pages: extracted.pages,
    references: references || [],
    importedAt,
    verified: false,
  };
}

/** What a scanned document can be found by: only what the user typed about it. */
export function metadataText(record) {
  return [kindLabel(record.kind), record.number, record.date, record.subject, record.note].filter(Boolean).join(" ");
}

const SEARCH_CODES = { SE: "SE", ND: "ND-DJP" };

/**
 * A search payload for the collection, in the same shape as the public one, so the same engine
 * searches both. Documents without text have no pasal: they are found by their metadata alone.
 */
export function collectionPayload(records, publicPayload) {
  const docs = [];
  const units = [];
  const texts = [];
  for (const record of records) {
    const number = record.number ? parseNumber(record.number) : null;
    const index = docs.length;
    docs.push({
      id: record.id,
      label: [kindLabel(record.kind), record.number].filter(Boolean).join(" "),
      written: record.number,
      title: metadataText(record),
      code: SEARCH_CODES[record.kind] || record.kind,
      number: number ? number.serial : "",
      // The year in the document's own number when there is one, otherwise the year of its date.
      year: number ? number.year : (record.date.match(/(19|20)\d\d/) || [""])[0],
      status: "pribadi",
      hasText: record.hasText,
      pasal: record.hasText ? 1 : 0,
      noTextReason: "PDF tanpa lapisan teks; isi dokumen tidak tercari, hanya isian jenis, nomor, tanggal, perihal, dan catatan",
      sources: [],
      twins: [],
      private: true,
      kind: record.kind,
    });
    if (record.hasText) {
      units.push({ id: `${record.id}--isi`, doc: index, label: "Isi dokumen", section: "b" });
      texts.push(record.text);
    }
  }
  return {
    docs,
    units,
    texts,
    ocr: publicPayload.ocr,
    terms: publicPayload.terms,
    synonyms: publicPayload.synonyms,
    stopwords: publicPayload.stopwords,
  };
}
