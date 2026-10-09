// Offline page data is split into a fixed number of files by document id (K-082), so a change to
// one document re-downloads one small file, and the service worker reads one file per page. The
// split needs no lookup table: the file number comes from the id itself.

export const SHARDS = 64;

/** FNV-1a of the document id, modulo SHARDS. */
export function shardOf(documentId) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < documentId.length; i++) {
    hash ^= documentId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % SHARDS;
}

/** A pasal id is "<document id>--<unit>"; document ids never contain "--". */
export function documentOfPasal(pasalId) {
  const cut = pasalId.indexOf("--");
  return cut > 0 ? pasalId.slice(0, cut) : null;
}

export function shardPath(n) {
  return `luring/data/${String(n).padStart(2, "0")}.json`;
}
