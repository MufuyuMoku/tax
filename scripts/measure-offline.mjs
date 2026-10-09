// Measures what the site would keep on a phone for offline use (M6), from a finished build.
//
//   npm run build && node scripts/measure-offline.mjs
//
// Prints, per part of dist/: file count, raw bytes (what Cache Storage keeps: the browser stores the
// decoded body), and gzip bytes (what is downloaded once).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const DIST = path.join(process.cwd(), "dist");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const parts = new Map();
for (const file of walk(DIST)) {
  const rel = path.relative(DIST, file).split(path.sep);
  const part = rel[0];
  const bytes = fs.readFileSync(file);
  const row = parts.get(part) || { files: 0, raw: 0, gzip: 0 };
  row.files += 1;
  row.raw += bytes.length;
  row.gzip += zlib.gzipSync(bytes, { level: 6 }).length;
  parts.set(part, row);
}

const mb = (n) => (n / 1e6).toFixed(1).padStart(7) + " MB";
let total = { files: 0, raw: 0, gzip: 0 };
console.log("Bagian".padEnd(28) + "Berkas".padStart(8) + "  Mentah".padStart(11) + "    Gzip".padStart(11));
for (const [part, row] of [...parts].sort((a, b) => b[1].raw - a[1].raw)) {
  console.log(part.padEnd(28) + String(row.files).padStart(8) + mb(row.raw) + mb(row.gzip));
  total.files += row.files;
  total.raw += row.raw;
  total.gzip += row.gzip;
}
console.log("Jumlah".padEnd(28) + String(total.files).padStart(8) + mb(total.raw) + mb(total.gzip));
