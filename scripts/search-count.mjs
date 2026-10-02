// How often words and phrases occur in the corpus (normalised, OCR-corrected), and in how many
// documents. Evidence for src/data/search/padanan.json.
//
//   node scripts/search-count.mjs karyawan pegawai "peredaran bruto"
import { buildSearchPayload } from "../src/lib/search/payload.js";
import { normalizeText } from "../src/lib/search/normalize.js";

const { payload } = buildSearchPayload();
const units = payload.texts.map((t) => " " + normalizeText(t, payload.ocr).text + " ");
const titles = payload.docs.map((d) => " " + normalizeText(d.title || "", payload.ocr).text + " ");
for (const phrase of process.argv.slice(2)) {
  const needle = " " + normalizeText(phrase, payload.ocr).text + " ";
  let count = 0;
  const docs = new Set();
  units.forEach((text, i) => {
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
      count++;
      docs.add(payload.units[i].doc);
    }
  });
  titles.forEach((text, d) => {
    if (text.includes(needle)) docs.add(d);
  });
  console.log(`${phrase}\t${count} kali\t${docs.size} dokumen`);
}
