// Writes the app icons in public/ (M6): a white page with text lines on the site's accent colour.
// No packages: the PNG is encoded here with Node's zlib.
//
//   node scripts/make-icons.mjs
//
// The drawing keeps to the middle 60% so it survives the mask Android puts on installed icons.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ACCENT = [0x1f, 0x4f, 0x82];
const WHITE = [0xff, 0xff, 0xff];

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixel) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) row.set(pixel(x / size, y / size), 1 + x * 3);
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Page: x 0.30..0.70, y 0.24..0.76, with the top right corner folded. Lines in the accent colour.
function pixel(x, y) {
  const inPage = x >= 0.3 && x <= 0.7 && y >= 0.24 && y <= 0.76;
  const folded = x - 0.6 > y - 0.24; // corner cut off along a diagonal
  if (!inPage || folded) return ACCENT;
  const lines = [0.38, 0.47, 0.56, 0.65];
  const onLine = lines.some((l) => y >= l && y <= l + 0.035) && x >= 0.36 && x <= (y > 0.64 ? 0.54 : 0.64);
  return onLine ? ACCENT : WHITE;
}

const out = path.join(process.cwd(), "public");
fs.mkdirSync(out, { recursive: true });
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(out, `ikon-${size}.png`), png(size, pixel));
  console.log(`public/ikon-${size}.png`);
}
