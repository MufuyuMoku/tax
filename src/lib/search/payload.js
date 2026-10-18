// Build time only (Node). Assembles everything the browser needs to search: the document list,
// every pasal's text, the OCR correction map, and the editable term lists. Written as a head
// (cari/data.json) and 64 parts (cari/teks/NN.json), see assemble.js (K-099).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { listPasalIds, loadDocument, loadIndex, loadPasal, loadMeta } from "../corpus.js";
import { categoryNote, regulationLabel } from "../labels.js";
import { buildOcrMap, tokenFrequencies } from "./normalize.js";
import { encodeIndex, tokenize, vocabularyFor } from "./textindex.js";
import { assemblePayload, FORMAT, partMembers } from "./assemble.js";
import { buildDefinitions } from "./definitions.js";
import { compactClaims } from "../render/chips.js";

const DATA = path.join(process.cwd(), "src", "data", "search");
const VOCABULARY = path.join(DATA, "kosakata.json");

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

function buildFresh() {
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
      localTaxNote: entry.pajak_daerah || null,
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

  // The texts, normalised here instead of in every browser (K-069), with token ids that never
  // change (K-099): the vocabulary of the last build first, new words after it. The extended list
  // is written back, so the next build, and the automatic update's commit, keep the same ids.
  const tokenLists = tokenize(texts, ocr.map);
  const base = fs.existsSync(VOCABULARY) ? readData("kosakata.json").kata : [];
  const vocab = vocabularyFor(tokenLists, base);
  if (vocab.length !== base.length) writeVocabulary(vocab);

  const parts = partMembers(docs, units).map((own) =>
    JSON.stringify({ units: own.length, texts: own.map((i) => texts[i]), ...encodeIndex(own.map((i) => tokenLists[i]), vocab) })
  );
  const head = {
    format: FORMAT,
    // Changes whenever a document is added or its identity changes; references in the personal
    // collection are recomputed when it does (K-042).
    corpus: { documents: meta.documents, units: units.length, fingerprint: corpusFingerprint(docs) },
    docs,
    units,
    vocab,
    // The hash of every part: the browser asks for each part under its hash (K-099).
    parts: parts.map((text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 16)),
    ocr: ocr.map,
    terms: readData("istilah.json").kelompok,
    synonyms: synonymsFrom(readData("padanan.json")),
    stopwords: readData("kata-umum.json").kata,
    localTax: readData("pajak-daerah.json").kelompok,
    // The definition box (K-096): offsets of defining sentences in the pasal texts, by term.
    definitions: buildDefinitions(units, texts),
  };
  return { head, parts, ocrGenerated: ocr.generated };
}

function writeVocabulary(vocab) {
  const text =
    "{\n" +
    '  "keterangan": "Kosakata pencarian (K-099), dibuat dan ditambah otomatis oleh build; jangan disunting. Kata tidak pernah dihapus atau digeser, supaya nomor kata tetap dan berkas cari/teks/NN.json dokumen yang tidak berubah tetap sama.",\n' +
    '  "kata": [\n' +
    vocab.map((t) => `    ${JSON.stringify(t)}`).join(",\n") +
    "\n  ]\n}\n";
  fs.writeFileSync(VOCABULARY, text);
}

const cache = new Map();

/** { head, parts: [JSON text], ocrGenerated }, built once per corpus and settings in a process. */
export function buildSearchData() {
  const key = `${process.env.TAX_CORPUS || ""}|${process.env.SEARCH_PADANAN || ""}`;
  if (!cache.has(key)) cache.set(key, buildFresh());
  return cache.get(key);
}

/** The payload the engine takes, put together from head and parts exactly as the browser does. */
export function buildSearchPayload() {
  const { head, parts, ocrGenerated } = buildSearchData();
  return { payload: assemblePayload(head, parts.map((text) => JSON.parse(text))), ocrGenerated };
}
