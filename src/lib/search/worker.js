// Runs the search engine off the main thread: normalising ten megabytes of text takes long enough
// on a phone to freeze the page otherwise. The worker fetches the public search data once, from the
// same site, and never makes another request. The personal collection is read from this device's
// IndexedDB and searched with the same engine; it is never sent anywhere (invariant 7).
import { SearchEngine } from "./engine.js";
import { normToken } from "./normalize.js";
import { assessText } from "../collection/extract.js";
import { collectionPayload } from "../collection/records.js";
import { findReferences, refreshReferences } from "../collection/references.js";
import { allRecords, putRecord } from "../collection/store.js";

let payload = null;
let engine = null;
let privateEngine = null;
let ready = null;
let vocabulary = null;

/** Whether a word occurs in the corpus, for judging imported text (K-043). */
function isKnown(word) {
  if (!vocabulary) vocabulary = engine.vocabularySet();
  return vocabulary.has(normToken(word, payload.ocr));
}

function load(url) {
  if (!ready) {
    ready = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`data pencarian tidak bisa dimuat (HTTP ${response.status})`);
        return response.json();
      })
      .then((data) => {
        const started = Date.now();
        payload = data;
        engine = new SearchEngine(payload);
        return { ms: Date.now() - started, documents: payload.docs.length, units: payload.units.length };
      });
  }
  return ready;
}

async function loadCollection() {
  await ready;
  const records = await allRecords();
  // References were matched against the corpus of the day they were imported. When the corpus
  // has changed since, match them again (K-042). Nothing leaves the device: it is IndexedDB to
  // IndexedDB, inside this worker.
  for (const record of refreshReferences(records, payload.docs, payload.corpus.fingerprint)) await putRecord(record);
  privateEngine = records.length ? new SearchEngine(collectionPayload(records, payload)) : null;
  return records.length;
}

function privateFilters(filters) {
  return filters && filters.collectionKind ? { codes: [filters.collectionKind === "SE" ? "SE" : filters.collectionKind === "ND" ? "ND-DJP" : filters.collectionKind] } : null;
}

self.onmessage = async (event) => {
  const { id, type } = event.data;
  try {
    if (type === "load") {
      const info = await load(event.data.url);
      self.postMessage({ id, type: "loaded", info });
    } else if (type === "koleksi") {
      const count = await loadCollection();
      self.postMessage({ id, type: "koleksi", count });
    } else if (type === "search") {
      await ready;
      const source = event.data.filters && event.data.filters.source;
      const reply = { id, type: "results", offset: 0, summary: null, results: [], privateSummary: null, privateResults: [] };
      if (source !== "pribadi") {
        reply.summary = engine.search(event.data.query, event.data.filters);
        reply.results = engine.page(0, event.data.limit);
        // "Teratas per kategori" (K-079): only when no category is filtered and more than one
        // category has results.
        const groups = event.data.filters && event.data.filters.category ? [] : engine.byCategory(3);
        reply.groups = groups.length > 1 ? groups : [];
      }
      if (source !== "publik" && privateEngine) {
        reply.privateSummary = privateEngine.search(event.data.query, privateFilters(event.data.filters));
        reply.privateResults = privateEngine.page(0, event.data.limit);
      }
      self.postMessage(reply);
    } else if (type === "more") {
      await ready;
      const which = event.data.which === "pribadi" ? privateEngine : engine;
      const results = which ? which.page(event.data.offset, event.data.limit) : [];
      self.postMessage({ id, type: "results", results, offset: event.data.offset });
    } else if (type === "rujukan") {
      await ready;
      self.postMessage({
        id,
        type: "rujukan",
        references: findReferences(event.data.text, payload.docs, event.data.own),
        corpus: payload.corpus.fingerprint,
      });
    } else if (type === "mutu") {
      await ready;
      self.postMessage({ id, type: "mutu", quality: assessText(event.data.text, isKnown) });
    } else {
      throw new Error(`jenis pesan tidak dikenal: ${type}`);
    }
  } catch (error) {
    self.postMessage({ id, type: "error", message: String(error && error.message ? error.message : error) });
  }
};
