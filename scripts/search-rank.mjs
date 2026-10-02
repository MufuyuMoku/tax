// Where do given documents land for a query? For judging a query against known relevant documents.
//
//   node scripts/search-rank.mjs "karyawan dapat bonus tahunan" pmk-168-2023 per-djp-16-2016
import { buildSearchPayload } from "../src/lib/search/payload.js";
import { SearchEngine } from "../src/lib/search/engine.js";

const [query, ...ids] = process.argv.slice(2);
const engine = new SearchEngine(buildSearchPayload().payload);
const summary = engine.search(query);
const all = engine.page(0, summary.total);
console.log(`"${query}": ${summary.total} dokumen`);
for (const id of ids) {
  const at = all.findIndex((r) => r.id === id);
  const r = all[at];
  console.log(
    at === -1
      ? `  ${id}: tidak ada di hasil`
      : `  ${id}: peringkat ${at + 1} · cakupan ${r.coverage}/${r.conceptCount} · tidak ditemukan: ${r.missing.join(", ") || "-"} · ${r.units[0]?.label || "-"}`
  );
}
