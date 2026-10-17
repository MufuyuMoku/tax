// Prints the definition box for some queries on the current corpus (K-096): which term the query
// asks for and the definitions picked, with status and source.
//
//   node scripts/definisi-uji.mjs [query ...]
import { buildSearchPayload } from "../src/lib/search/payload.js";
import { definitionTerm, pickDefinitions, sameTerms } from "../src/lib/search/definitions.js";
const { payload } = buildSearchPayload();
const d = payload.definitions;
console.log("items", d.items.length, "terms", Object.keys(d.terms).length, "bytes", JSON.stringify(d).length);
const known = (k) => sameTerms(k, payload.terms).some((x) => d.terms[x]);
const qs = process.argv.slice(2).length ? process.argv.slice(2) : ["PKP", "PTKP", "NPWP", "Penghasilan", "Pajak Masukan", "BPHTB", "apa itu PKP", "pengertian NPWP", "BPHTB adalah", "PMK 168/2023", "jual rumah", "PPh 21"];
for (const q of qs) {
  const t = definitionTerm(q, known);
  console.log(`\n### ${q} -> ${t}`);
  if (!t) continue;
  const r = pickDefinitions(d, sameTerms(t, payload.terms), payload.units, payload.docs);
  console.log("disputedOnly", r.disputedOnly);
  for (const x of r.shown) {
    const doc = payload.docs[x.doc];
    console.log(`- ${doc.label} [${doc.status}] ${payload.units[x.unit].label} ${x.place} (+${x.alsoIn})`);
    console.log("  " + payload.texts[x.unit].slice(x.start, x.end).slice(0, 300));
  }
}
