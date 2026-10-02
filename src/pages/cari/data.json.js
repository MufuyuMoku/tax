// The search data, written once at build time as a static file next to the pages. The browser
// loads it with the page and searches it in memory; typing a query sends nothing anywhere.
import { buildSearchPayload } from "../../lib/search/payload.js";

export function GET() {
  const { payload } = buildSearchPayload();
  return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
}
