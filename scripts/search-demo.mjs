// Runs real queries against the same engine the browser uses, on the real corpus.
//
//   node scripts/search-demo.mjs "PPh 21" "karyawan dapat bonus tahunan"
//
// Prints the parsed query, the result count, and the top documents with their best pasal.
import { buildSearchPayload } from "../src/lib/search/payload.js";
import { SearchEngine } from "../src/lib/search/engine.js";

const args = process.argv.slice(2);
const top = Number(process.env.TOP || 8);
const t0 = Date.now();
const { payload, ocrGenerated } = buildSearchPayload();
const t1 = Date.now();
const engine = new SearchEngine(payload);
console.log(
  `payload ${t1 - t0} ms, engine ${Date.now() - t1} ms, ${payload.docs.length} dokumen, ` +
    `${payload.units.length} unit, ${Object.keys(payload.ocr).length} koreksi OCR (${ocrGenerated.length} otomatis)`
);

const filters = process.env.FILTER ? JSON.parse(process.env.FILTER) : null;
for (const query of args) {
  const summary = engine.search(query, filters);
  console.log(`\n=== "${query}"${filters ? " " + JSON.stringify(filters) : ""}`);
  console.log(
    `  ${summary.total} dokumen, ${summary.took} ms` +
      (summary.number ? ` · nomor ${JSON.stringify(summary.number)}` : "") +
      (summary.concepts.length ? ` · konsep: ${summary.concepts.map((c) => (c.forms ? `[${c.forms.join(" | ")}]` : c.label)).join(" + ")}` : "") +
      (summary.ignored.length ? ` · diabaikan: ${summary.ignored.join(", ")}` : "")
  );
  for (const [i, r] of engine.page(0, top).entries()) {
    const status = r.status === "tidak_pasti" ? "TIDAK PASTI" : r.status;
    console.log(
      `  ${i + 1}. ${r.label} [${status}]${r.hasText ? "" : " (tanpa teks)"} ${r.title.slice(0, 90)}` +
        `\n     alasan: ${r.reasons.join(", ")} · cakupan ${r.coverage}/${r.conceptCount}` +
        (r.missing.length ? ` · tidak ditemukan: ${r.missing.join(", ")}` : "") +
        ` · ${r.unitCount} unit cocok`
    );
    for (const u of r.units.slice(0, Number(process.env.UNITS || 1))) {
      const text = u.segments.map((s) => (s.mark ? `[${s.text}]` : s.text)).join("");
      console.log(`     ${u.label}: ${u.before ? "…" : ""}${text.slice(0, 260)}${u.after ? "…" : ""}`);
    }
  }
}
