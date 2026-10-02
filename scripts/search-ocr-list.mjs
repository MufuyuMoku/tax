// Lists the OCR corrections the build computes from the corpus and src/data/search/ocr.json, so
// they can be reviewed and any wrong one added to `jangan_dikoreksi`.
//
//   node scripts/search-ocr-list.mjs
import { buildSearchPayload } from "../src/lib/search/payload.js";

const { payload, ocrGenerated } = buildSearchPayload();
for (const [wrong, right, rule, countWrong, countRight] of ocrGenerated) {
  console.log(`${wrong} -> ${right}\t(${rule}; ${countWrong}x vs ${countRight}x)`);
}
const manual = Object.keys(payload.ocr).length - ocrGenerated.length;
console.log(`\n${ocrGenerated.length} koreksi otomatis, ${manual} dari pasangan tulis tangan.`);
