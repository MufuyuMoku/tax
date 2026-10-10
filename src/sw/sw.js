// Service worker: keeps the site usable offline once installed (M6, K-082).
//
// What it stores, in one cache per site version: the list page, the personal collection page, the
// search data, the offline page data (luring/data/NN.json, every document and pasal), the page
// shell, scripts, styles, and icons. Document and pasal pages are not stored as 21,000 HTML files;
// they are rendered here from the page data with the same renderer the build uses, and the build
// fails if the two ever differ.
//
// Updates: the browser fetches sw.js on its own; the build writes into it the hash of every file,
// so a new sw.js appears only when something changed, and while it installs, files whose hash did
// not change are copied from the current cache instead of downloaded again. The new version then
// waits: the reader keeps the current one until they choose "Muat data baru" (or close every tab).
//
// What it never does: touch IndexedDB (the personal collection, invariant 7), send anything
// anywhere, or answer for other origins. Requests it does not know go to the network unchanged.
import { fillShell } from "../lib/render/html.js";
import { renderDocumentPage, renderPasalPage } from "../lib/render/pages.js";
import { documentOfPasal, shardOf, shardPath } from "../lib/render/shards.js";

/* global __TAX__ */
const M = __TAX__; // { version, app, base, shell, data: { version, date }, files: [{ path, url, hash, bytes }] }
const CACHE = `tax-${M.version}`;
const LEDGER = `${M.base}__berkas__`; // what this cache holds: url -> hash; written last
const known = new Set(M.files.map((f) => f.url));

async function sha(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

async function tell(message) {
  for (const client of await self.clients.matchAll({ includeUncontrolled: true })) client.postMessage(message);
}

/** url -> response source among finished caches of earlier versions whose file has the same hash. */
async function reusable() {
  const found = new Map();
  for (const name of await caches.keys()) {
    if (name === CACHE || !name.startsWith("tax-")) continue;
    const cache = await caches.open(name);
    const ledger = await cache.match(LEDGER);
    if (!ledger) continue;
    const hashes = await ledger.json();
    for (const file of M.files) if (!found.has(file.url) && hashes[file.url] === file.hash) found.set(file.url, cache);
  }
  return found;
}

async function store() {
  const cache = await caches.open(CACHE);
  const old = await reusable();
  let done = 0;
  let downloaded = 0;
  const queue = [...M.files];
  async function next() {
    for (let file = queue.shift(); file; file = queue.shift()) {
      // A cache with this version's name holds only files of this version: an install that was
      // cut off resumes where it stopped.
      if (!(await cache.match(file.url))) {
        const copy = old.has(file.url) && (await old.get(file.url).match(file.url));
        if (copy) {
          await cache.put(file.url, copy);
        } else {
          const response = await fetch(file.url, { cache: "no-cache" });
          if (!response.ok) throw new Error(`${file.url}: HTTP ${response.status}`);
          const body = await response.arrayBuffer();
          // The server may already hold a newer build than this sw.js; never mix versions.
          if ((await sha(body)) !== file.hash) throw new Error(`${file.url}: isi tidak cocok dengan versi ${M.version}`);
          // Only the type travels with the copy: the body is already decoded, so the server's
          // Content-Encoding and Content-Length no longer describe it.
          const type = response.headers.get("Content-Type") || "application/octet-stream";
          await cache.put(file.url, new Response(body, { headers: { "Content-Type": type } }));
          downloaded += body.byteLength;
        }
      }
      done += 1;
      tell({ type: "kemajuan", version: M.version, done, total: M.files.length });
    }
  }
  await Promise.all([next(), next(), next(), next()]);
  await cache.put(LEDGER, new Response(JSON.stringify(Object.fromEntries(M.files.map((f) => [f.url, f.hash])))));
  return downloaded;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    store().catch(async (error) => {
      await tell({ type: "gagal", version: M.version, message: String(error.message || error) });
      throw error;
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name.startsWith("tax-") && name !== CACHE) await caches.delete(name);
      // First install: take over the open page so it works offline without a reload. After an
      // update this runs only once the reader chose to load the new version.
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  const { type } = event.data || {};
  if (type === "pakai") self.skipWaiting();
  if (type === "info") {
    const bytes = M.files.reduce((sum, f) => sum + f.bytes, 0);
    event.ports[0]?.postMessage({ version: M.version, app: M.app, data: M.data, files: M.files.length, bytes });
  }
});

const shards = new Map(); // shard number -> parsed data, kept while this worker lives

async function shard(n) {
  if (!shards.has(n)) {
    const response = await caches.open(CACHE).then((cache) => cache.match(`${M.base}${shardPath(n)}`));
    if (!response) return null;
    shards.set(n, await response.json());
    if (shards.size > 8) shards.delete(shards.keys().next().value);
  }
  return shards.get(n);
}

async function page(kind, id, request) {
  const documentId = kind === "dokumen" ? id : documentOfPasal(id);
  const data = documentId && (await shard(shardOf(documentId)));
  const doc = data && data.docs[documentId];
  const unit = kind === "pasal" && data ? data.units[id] : null;
  const shell = await caches.open(CACHE).then((cache) => cache.match(M.shell));
  if (!doc || (kind === "pasal" && !unit) || !shell) return fetch(request);
  const view =
    kind === "dokumen"
      ? renderDocumentPage(doc, doc.pasal_ids.map((p) => data.units[p]), M.base)
      : renderPasalPage(doc, unit, M.base);
  return new Response(fillShell(await shell.text(), view), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(M.base)) return;
  const route = url.pathname.slice(M.base.length).match(/^(dokumen|pasal)\/([^/]+)\/$/);
  if (route) {
    event.respondWith(page(route[1], decodeURIComponent(route[2]), request));
  } else if (known.has(url.pathname)) {
    event.respondWith(
      caches
        .open(CACHE)
        .then((cache) => cache.match(url.pathname))
        .then((hit) => hit || fetch(request))
    );
  }
});
