// The search data, written once at build time as static files next to the pages: this head and
// the 64 parts in cari/teks/ (K-099). The browser loads them with the page and searches them in
// memory; typing a query sends nothing anywhere.
import { buildSearchData } from "../../lib/search/payload.js";

export function GET() {
  const { head } = buildSearchData();
  return new Response(JSON.stringify(head), { headers: { "Content-Type": "application/json" } });
}
