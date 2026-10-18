// What a phone downloads (K-092, K-099): the first time, and for an update from one build to the
// next. Only files the service worker keeps count, and an update downloads only the files whose
// content changed (src/sw/sw.js). Sizes raw and gzip (GitHub Pages serves JSON, HTML, JS and CSS
// gzipped).
//
//   node scripts/ukur-unduhan.mjs <dist sesudah> [<dist sebelum>]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { filesToKeep } from "../src/lib/offline/integration.js";

const [after, before] = process.argv.slice(2);
if (!after) throw new Error("Pakai: node scripts/ukur-unduhan.mjs <dist sesudah> [<dist sebelum>]");
const BASE = "/tax/";
const mb = (n) => (n / 1e6).toFixed(2);
const gz = (file) => (/\.(png|ico)$/.test(file) ? fs.statSync(file).size : zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length);

const files = filesToKeep(after, BASE);
const total = files.reduce((s, f) => s + f.bytes, 0);
const totalGz = files.reduce((s, f) => s + gz(path.join(after, f.path)), 0);
console.log(`Unduhan pertama: ${files.length} berkas, ${mb(total)} MB mentah, ${mb(totalGz)} MB gzip (simpanan di perangkat ±${mb(total)} MB).`);

if (before) {
  const changed = files.filter((f) => {
    const old = path.join(before, f.path);
    return !fs.existsSync(old) || Buffer.compare(fs.readFileSync(old), fs.readFileSync(path.join(after, f.path))) !== 0;
  });
  const rows = changed.map((f) => [f.path, f.bytes, gz(path.join(after, f.path))]).sort((a, b) => b[2] - a[2]);
  const raw = rows.reduce((s, r) => s + r[1], 0);
  const zipped = rows.reduce((s, r) => s + r[2], 0);
  console.log(`Pembaruan: ${rows.length} berkas berubah, ${mb(raw)} MB mentah, ${mb(zipped)} MB gzip.`);
  for (const [p, r, g] of rows) console.log(`  ${p}: ${mb(r)} MB mentah, ${mb(g)} MB gzip`);
}
