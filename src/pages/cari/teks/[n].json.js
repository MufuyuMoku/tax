// One part of the search data (K-099): the pasal texts and token ids of the documents whose id
// falls in this part, split like the offline page data (K-082).
import { SHARDS } from "../../../lib/render/shards.js";
import { buildSearchData } from "../../../lib/search/payload.js";

export function getStaticPaths() {
  return Array.from({ length: SHARDS }, (_, n) => ({ params: { n: String(n).padStart(2, "0") } }));
}

export function GET({ params }) {
  const { parts } = buildSearchData();
  return new Response(parts[Number(params.n)], { headers: { "Content-Type": "application/json" } });
}
