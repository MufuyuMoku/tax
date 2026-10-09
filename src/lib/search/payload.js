// Build time only (Node). Assembles everything the browser needs to search, in one file: the
// document list, every pasal's text, the OCR correction map, and the editable term lists.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { listPasalIds, loadDocument, loadIndex, loadPasal, loadMeta } from "../corpus.js";
import { categoryNote, regulationLabel } from "../labels.js";
import { buildOcrMap, tokenFrequencies } from "./normalize.js";
import { buildTextIndex } from "./textindex.js";
import { compactClaims } from "../render/chips.js";

const DATA = path.join(process.cwd(), "src", "data", "search");

function readData(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
}

function unitLabel(unit) {
  const base = unit.structure === "diktum" ? unit.label : `Pasal ${unit.label}`;
  return unit.section === "penjelasan" ? `Penjelasan ${base}` : base;
}

/** padanan.json, optionally narrowed for evaluation by SEARCH_PADANAN (JSON list of group indexes). */
function synonymsFrom(data) {
  let kept = data.kelompok;
  if (process.env.SEARCH_PADANAN) {
    const keep = JSON.parse(process.env.SEARCH_PADANAN);
    kept = kept.filter((_, i) => keep.includes(i));
  }
  // `lingkup: "judul_tanpa_teks"` limits a group's other forms to titles of documents without text.
  return { weight: data.bobot, groups: kept.map((g) => g.bentuk), scopes: kept.map((g) => g.lingkup || null) };
}

function corpusFingerprint(docs) {
  const identities = docs.map((d) => [d.id, d.label, d.code, d.number, d.year]);
  return crypto.createHash("sha256").update(JSON.stringify(identities)).digest("hex").slice(0, 16);
}

export function buildSearchPayload() {
  const index = loadIndex();
  const position = new Map(index.map((entry, i) => [entry.id, i]));
  const docs = index.map((entry) => {
    const doc = loadDocument(entry.id);
    return {
      id: entry.id,
      label: regulationLabel(doc.identity, entry.number_as_written),
      written: entry.number_as_written,
      title: entry.title,
      code: entry.code,
      number: entry.number,
      year: entry.year,
      status: entry.status,
      hasText: entry.text_available,
      pasal: entry.pasal_count,
      noTextReason: doc.text.unavailable_reason,
      categories: (doc.categories || []).map((c) => c.kategori).filter((c, i, all) => all.indexOf(c) === i),
      categoryNote: categoryNote(doc.categories || []),
      sources: doc.source_records.map((r) => ({ source: r.source, url: r.url })),
      // Display only: the status chips per source and, when uncertain, why.
      claims: compactClaims(doc.status_claims),
      statusReasons: doc.status.reasons || [],
      twins: (doc.identity_conflicts || []).map((c) => ({
        id: c.id,
        label: regulationLabel([c.code, doc.identity.number, doc.identity.year, doc.identity.variant]),
      })),
    };
  });

  const units = [];
  const texts = [];
  for (const id of listPasalIds()) {
    const unit = loadPasal(id);
    units.push({ id, doc: position.get(unit.document_id), label: unitLabel(unit), section: unit.section[0] });
    texts.push(unit.text);
  }

  const ocrSettings = readData("ocr.json");
  const freq = tokenFrequencies([...texts, ...docs.map((d) => d.title || "")]);
  const ocr = buildOcrMap(freq, ocrSettings);
  const meta = loadMeta();

  return {
    payload: {
      format: 2,
      // Changes whenever a document is added or its identity changes; references in the personal
      // collection are recomputed when it does (K-042).
      corpus: { documents: meta.documents, units: units.length, fingerprint: corpusFingerprint(docs) },
      docs,
      units,
      texts,
      // The same texts, normalised here instead of in every browser (K-069).
      index: buildTextIndex(texts, ocr.map),
      ocr: ocr.map,
      terms: readData("istilah.json").kelompok,
      synonyms: synonymsFrom(readData("padanan.json")),
      stopwords: readData("kata-umum.json").kata,
      localTax: readData("pajak-daerah.json").kelompok,
    },
    ocrGenerated: ocr.generated,
  };
}
