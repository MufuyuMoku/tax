// Runs the search engine off the main thread: normalising ten megabytes of text takes long enough
// on a phone to freeze the page otherwise. The worker fetches the search data once, from the same
// site, and never makes another request.
import { SearchEngine } from "./engine.js";

let engine = null;
let ready = null;

function load(url) {
  if (!ready) {
    ready = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`data pencarian tidak bisa dimuat (HTTP ${response.status})`);
        return response.json();
      })
      .then((payload) => {
        const started = Date.now();
        engine = new SearchEngine(payload);
        return { ms: Date.now() - started, documents: payload.docs.length, units: payload.units.length };
      });
  }
  return ready;
}

self.onmessage = async (event) => {
  const { id, type } = event.data;
  try {
    if (type === "load") {
      const info = await load(event.data.url);
      self.postMessage({ id, type: "loaded", info });
    } else if (type === "search") {
      await ready;
      const summary = engine.search(event.data.query, event.data.filters);
      const results = engine.page(0, event.data.limit);
      self.postMessage({ id, type: "results", summary, results, offset: 0 });
    } else if (type === "more") {
      await ready;
      const results = engine.page(event.data.offset, event.data.limit);
      self.postMessage({ id, type: "results", results, offset: event.data.offset });
    } else {
      throw new Error(`jenis pesan tidak dikenal: ${type}`);
    }
  } catch (error) {
    self.postMessage({ id, type: "error", message: String(error && error.message ? error.message : error) });
  }
};
