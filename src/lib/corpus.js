// Reads the corpus written by the data pipeline. Build time only: nothing here runs in the browser.
import fs from "node:fs";
import path from "node:path";

const CORPUS = path.join(process.cwd(), "corpus");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function loadIndex() {
  return readJson(path.join(CORPUS, "index.json"));
}

export function loadMeta() {
  return readJson(path.join(CORPUS, "meta.json"));
}

export function loadDocument(id) {
  return readJson(path.join(CORPUS, "documents", `${id}.json`));
}

export function loadPasal(id) {
  return readJson(path.join(CORPUS, "pasal", `${id}.json`));
}

export function listPasalIds() {
  return fs
    .readdirSync(path.join(CORPUS, "pasal"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -5))
    .sort();
}

// Documents that the two sources record under different types stay separate in the data (K-014).
// The list keeps them next to each other so a reader sees one regulation recorded twice, rather
// than what looks like a bug in this site. The group key is shared by every member of the group.
export function groupKeyOf(entry, conflictsById) {
  const partners = conflictsById.get(entry.id) || [];
  if (partners.length === 0) return entry.id;
  return [entry.id, ...partners].sort()[0];
}

export function conflictMap(documents) {
  const map = new Map();
  for (const doc of documents) {
    const partners = (doc.identity_conflicts || []).map((c) => c.id);
    if (partners.length) map.set(doc.id, partners);
  }
  return map;
}

/** The list view: index entries enriched with what the list needs, sorted newest first. */
export function buildListing() {
  const index = loadIndex();
  const documents = index.map((entry) => loadDocument(entry.id));
  const conflicts = conflictMap(documents);
  const byId = new Map(documents.map((doc) => [doc.id, doc]));

  const rows = index.map((entry) => {
    const doc = byId.get(entry.id);
    return {
      ...entry,
      group_key: groupKeyOf(entry, conflicts),
      conflicts: (doc.identity_conflicts || []).map((c) => ({ id: c.id, code: c.code })),
      source_urls: doc.source_records.map((r) => ({ source: r.source, url: r.url })),
      text_unavailable_reason: doc.text.unavailable_reason,
    };
  });

  rows.sort(
    (a, b) =>
      (Number(b.year) || -1) - (Number(a.year) || -1) ||
      a.group_key.localeCompare(b.group_key) ||
      a.id.localeCompare(b.id)
  );
  return rows;
}
