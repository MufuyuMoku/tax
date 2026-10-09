// HTML building blocks for pages that are written both at build time and, offline, by the service
// worker on the phone (K-082). Plain strings, no DOM: the same code runs in Node and in a worker.

const TEXT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };

/** Escape text for element content and attribute values. */
export function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => TEXT[c]);
}

/** Join parts, dropping false, null and undefined, so conditions read like the templates did. */
export function h(...parts) {
  return parts.flat(Infinity).filter((p) => p !== false && p !== null && p !== undefined).join("");
}

/** 12345 -> "12.345", the Indonesian thousands separator, without depending on Intl data. */
export function thousands(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// The page title and description go through the Astro layout, which escapes them its own way:
// text with html-escaper, attribute values with &#38; and &#34;. The offline page shell is filled
// with the same escaping so both routes give byte-identical pages.
export function escTitle(value) {
  return esc(value);
}

export function escAttribute(value) {
  return String(value).replace(/&/g, "&#38;").replace(/"/g, "&#34;");
}

export const SHELL_TITLE = "%%JUDUL%%";
export const SHELL_DESCRIPTION = "%%DESKRIPSI%%";
export const SHELL_BODY = "<!--%%ISI%%-->";

/** Fill the offline shell (a page built from the same layout) with one page's title and body. */
export function fillShell(shell, { title, description, body }) {
  return shell
    .replace(SHELL_TITLE, () => escTitle(title))
    .replace(SHELL_DESCRIPTION, () => escAttribute(description))
    .replace(SHELL_BODY, () => body);
}
