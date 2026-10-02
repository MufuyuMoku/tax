// Build time only (Node). Assembles everything the browser needs to search, in one file: the
// document list, every pasal's text, the OCR correction map, and the editable term lists.
import fs from "node:fs";
import path from "node:path";
import { listPasalIds, loadDocument, loadIndex, loadPasal, loadMeta } from "../corpus.js";
import { regulationLabel } from "../labels.js";
import { buildOcrMap, tokenFrequencies } from "./normalize.js";

const DATA = path.join(process.cwd(), "src", "data", "search");

function readData(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
}

function unitLabel(unit) {
  const base = unit.structure === "diktum" ? unit.label : `Pasal ${unit.label}`;
  return unit.section === "penjelasan" ? `Penjelasan ${base}` : base;
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
      sources: doc.source_records.map((r) => ({ source: r.source, url: r.url })),
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
      format: 1,
      corpus: { documents: meta.documents, units: units.length },
      docs,
      units,
      texts,
      ocr: ocr.map,
      terms: readData("istilah.json").kelompok,
      stopwords: readData("kata-umum.json").kata,
    },
    ocrGenerated: ocr.generated,
  };
}
