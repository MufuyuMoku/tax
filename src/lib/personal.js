// Saved pasal and documents, and the last searches (K-096). Kept in this browser's localStorage
// only: never sent anywhere, and written into the personal collection backup next to the
// collection (src/lib/collection/backup.js). public/keadaan.js writes the same "tax-tersimpan"
// entries for the "Simpan" button on document and pasal pages; the shape is { kind: "pasal" |
// "dokumen", id, label, title, savedAt }.
export const SAVED_KEY = "tax-tersimpan";
export const HISTORY_KEY = "tax-riwayat";
export const HISTORY_MAX = 10;

function read(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function write(key, value) {
  try {
    if (value.length) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
    return true;
  } catch {
    return false; // storage blocked or full: nothing is kept, and the page says so where it matters
  }
}

export const savedItems = () => read(SAVED_KEY).filter((s) => s && (s.kind === "pasal" || s.kind === "dokumen") && s.id);
export const setSavedItems = (items) => write(SAVED_KEY, items);
export const removeSaved = (kind, id) => write(SAVED_KEY, savedItems().filter((s) => !(s.kind === kind && s.id === id)));

export const searchHistory = () => read(HISTORY_KEY).filter((q) => typeof q === "string" && q.trim());
export const setSearchHistory = (items) => write(HISTORY_KEY, items.slice(0, HISTORY_MAX));
export const clearSearchHistory = () => write(HISTORY_KEY, []);

/** Put `query` first, once; the oldest falls off after ten. */
export function addSearch(query) {
  const q = query.trim().replace(/\s+/g, " ");
  if (!q) return searchHistory();
  const next = [q, ...searchHistory().filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(0, HISTORY_MAX);
  write(HISTORY_KEY, next);
  return next;
}

/** Saved items of a restored backup combined with this device's: one entry per page. */
export function mergeSaved(existing, incoming, mode) {
  if (mode === "ganti") return incoming.slice();
  const seen = new Set(existing.map((s) => `${s.kind}/${s.id}`));
  return existing.concat(incoming.filter((s) => !seen.has(`${s.kind}/${s.id}`)));
}

export function mergeHistory(existing, incoming, mode) {
  if (mode === "ganti") return incoming.slice(0, HISTORY_MAX);
  const seen = new Set(existing.map((q) => q.toLowerCase()));
  return existing.concat(incoming.filter((q) => !seen.has(q.toLowerCase()))).slice(0, HISTORY_MAX);
}
