// Build time only (Node). What the document and pasal pages need from the corpus (K-082): the
// document itself, plus the facts that need other documents, worked out here once so the page
// renderer stays a pure function that the service worker can run with one data file in hand.
import { listPasalIds, loadDocument, loadIndex, loadPasal } from "../corpus.js";
import { regulationLabel } from "../labels.js";

let cache = null;

function corpus() {
  if (cache) return cache;
  const index = loadIndex();
  const documents = new Map(index.map((entry) => [entry.id, loadDocument(entry.id)]));
  cache = { documents, units: new Map() };
  return cache;
}

const UNIT_FIELDS = ["id", "label", "structure", "section", "chars", "text", "amendment_items", "text_source", "document_number"];

export function unitView(id) {
  const { units } = corpus();
  if (!units.has(id)) {
    const unit = loadPasal(id);
    units.set(id, Object.fromEntries(UNIT_FIELDS.map((key) => [key, unit[key] ?? null])));
  }
  return units.get(id);
}

export function documentView(id) {
  const { documents } = corpus();
  const doc = documents.get(id);
  const targets = ["revokes", "amends", "revoked_by", "amended_by"].flatMap((kind) =>
    doc.relations[kind].map((item) => item.target_id || item.id)
  );
  // 27% of the regulations named in relation sentences sit outside the corpus; those get no link.
  const known_targets = [...new Set(targets.filter((target) => documents.has(target)))];
  // Documents the sources record under different types stay separate (K-014). When this record has
  // no text but a twin does, the text section says where to read it.
  const twins_with_text = doc.identity_conflicts
    .map((c) => documents.get(c.id) || loadDocument(c.id))
    .filter((twin) => twin.text.available)
    .map((twin) => ({
      id: twin.id,
      label: regulationLabel(twin.identity),
      sources: twin.source_records.map((r) => r.source),
      body_count: twin.pasal_ids.filter((p) => p.includes("--b")).length,
    }));
  return { ...doc, known_targets, twins_with_text };
}

export function documentIds() {
  return [...corpus().documents.keys()];
}

export { listPasalIds };
