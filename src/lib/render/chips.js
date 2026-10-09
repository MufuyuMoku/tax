// Status chips: one per source claim, never one status for the document (SPEC invariant 1). Each
// chip carries an icon and words, so colour is never the only signal. Shared by the list cards
// (Astro), the search results (browser) and the document and pasal pages (shared renderer).
import { formatDate } from "../labels.js";
import { esc } from "./html.js";

const LOOK = {
  berlaku: ["✓", "berlaku"],
  tidak_berlaku: ["✕", "tidak berlaku"],
  diubah_atau_dicabut_sebagian: ["±", "diubah sebagian"],
  tetap: ["✓", "tetap"],
  kosong: ["?", "tanpa status"],
};

/** Claims as [source, normalized, verbatim, retrieved_at], one per distinct source and value. */
export function compactClaims(claims) {
  const seen = new Set();
  const out = [];
  for (const c of claims) {
    const key = `${c.source}|${c.value_normalized}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([c.source, c.value_normalized, c.value_verbatim || "", c.retrieved_at || ""]);
  }
  return out;
}

/**
 * HTML for the chips. `dated`: show the source's own words and the retrieval date in the chip
 * (document page); otherwise short words, with the source's words and date in the tooltip.
 */
export function statusChips(compact, { dated = false } = {}) {
  return compact
    .map(([source, value, verbatim, date]) => {
      const [icon, words] = LOOK[value] || ["?", value && value.startsWith("lain:") ? value.slice(5) : "tanpa status"];
      const said = verbatim || "(kosong)";
      const when = formatDate(date);
      const tip = `${source} mencatat “${said}”${when ? `, diambil ${when}` : ""}`;
      const text = dated ? `${said}${when ? ` · ${when}` : ""}` : words;
      return (
        `<span class="chip st-${esc(value || "kosong")}" title="${esc(tip)}">` +
        `<span class="chip-ikon" aria-hidden="true">${icon}</span>` +
        `<span class="chip-sumber">${esc(source)}</span> ${esc(text)}</span>`
      );
    })
    .join("");
}
