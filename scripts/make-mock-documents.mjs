// Writes the mock documents used to build and test the personal collection (M4). Every document
// here is invented: numbers, names, and wording. Real documents sent by future users never enter
// the repository (SPEC invariant 10); these stand in for them.
//
//   node scripts/make-mock-documents.mjs
//
// For each of four kinds (SE, ND, penegasan, putusan) it writes:
//   tests/fixtures/koleksi/<kind>-teks.pdf     a PDF with a text layer
//   tests/fixtures/koleksi/<kind>-pindai.pdf   a PDF that is one image per page, like a scan
//   tests/fixtures/koleksi/<kind>.txt          the same text, for .txt import
// No libraries: the PDFs are written by hand, so the output is byte-for-byte reproducible.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT = path.join("tests", "fixtures", "koleksi");
const MARK = "DOKUMEN TIRUAN UNTUK PENGUJIAN - BUKAN DOKUMEN ASLI";

const DOCUMENTS = {
  se: [
    MARK,
    "",
    "SURAT EDARAN DIREKTUR JENDERAL PAJAK",
    "NOMOR SE-901/PJ/2026 (TIRUAN)",
    "TENTANG",
    "PENEGASAN PEMOTONGAN PAJAK PENGHASILAN PASAL 21 ATAS BONUS PEGAWAI",
    "",
    "A. Umum",
    "Sehubungan dengan berlakunya Peraturan Menteri Keuangan Nomor 168 Tahun 2023,",
    "perlu disampaikan penegasan mengenai bonus tahunan yang dibayarkan kepada pegawai tetap.",
    "",
    "B. Penegasan",
    "1. Bonus tahunan merupakan penghasilan yang bersifat tidak teratur dan dipotong",
    "   Pajak Penghasilan Pasal 21 sesuai tarif efektif dalam Peraturan Pemerintah",
    "   Nomor 58 Tahun 2023.",
    "2. Pelaporan pemotongan mengikuti PER-11/PJ/2025.",
    "3. Tata cara pendaftaran mengikuti Peraturan Menteri Keuangan Nomor 81 Tahun 2024.",
    "",
    "Demikian disampaikan untuk dilaksanakan.",
    "Direktur Jenderal Pajak (nama tiruan)",
  ],
  nd: [
    MARK,
    "",
    "NOTA DINAS",
    "NOMOR ND-902/PJ.03/2026 (TIRUAN)",
    "Yth. : Kepala Kantor Pelayanan Pajak Contoh",
    "Dari : Kepala Seksi Contoh",
    "Hal  : Perlakuan makanan bersama bagi seluruh pegawai",
    "",
    "Menindaklanjuti pertanyaan Wajib Pajak, disampaikan bahwa makanan dan minuman",
    "yang disediakan pemberi kerja bagi seluruh pegawai dikecualikan dari objek",
    "Pajak Penghasilan sebagaimana diatur dalam PMK 66 Tahun 2023 Pasal 4.",
    "Ketentuan umum mengenai natura merujuk pada PP 55/2022.",
    "",
    "Demikian untuk menjadi perhatian.",
  ],
  penegasan: [
    MARK,
    "",
    "SURAT PENEGASAN",
    "NOMOR S-903/PJ.03/2026 (TIRUAN)",
    "Hal : Penegasan peredaran bruto usaha orang pribadi",
    "",
    "Sesuai Peraturan Pemerintah Nomor 55 Tahun 2022 Pasal 60, bagian peredaran bruto",
    "dari usaha sampai dengan lima ratus juta rupiah dalam satu tahun pajak tidak",
    "dikenai Pajak Penghasilan. Tata caranya diatur dalam PMK-164/PMK.03/2023.",
    "Wajib Pajak dalam surat ini adalah contoh dan tidak ada.",
  ],
  putusan: [
    MARK,
    "",
    "PUTUSAN PENGADILAN PAJAK",
    "NOMOR PUT-904/PP/M.XA/15/2026 (TIRUAN)",
    "",
    "Pokok sengketa: koreksi Pajak Penghasilan Pasal 23 atas jasa pemeliharaan.",
    "Majelis berpendapat bahwa jasa tersebut termasuk jenis jasa lain sebagaimana",
    "dimaksud dalam 141/PMK.03/2015 dan Undang-Undang Nomor 36 Tahun 2008.",
    "Para pihak dalam putusan ini adalah tiruan.",
    "",
    "MENGADILI: mengabulkan sebagian banding Pemohon Banding (tiruan).",
  ],
};

// ---------- a PDF writer, just enough for these documents ----------

function pdf(objects) {
  // objects: array of Buffers/strings, object n is objects[n-1]; the catalog is object 1.
  const parts = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  const offsets = [];
  let length = parts[0].length;
  objects.forEach((body, i) => {
    offsets.push(length);
    const chunk = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`, "latin1"),
      Buffer.isBuffer(body) ? body : Buffer.from(body, "latin1"),
      Buffer.from("\nendobj\n", "latin1"),
    ]);
    parts.push(chunk);
    length += chunk.length;
  });
  const xref = [`xref\n0 ${objects.length + 1}\n`, "0000000000 65535 f \n"];
  for (const offset of offsets) xref.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  xref.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`);
  parts.push(Buffer.from(xref.join(""), "latin1"));
  return Buffer.concat(parts);
}

function stream(dictionary, data) {
  return Buffer.concat([
    Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`, "latin1"),
    data,
    Buffer.from("\nendstream", "latin1"),
  ]);
}

const escapePdf = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function textPdf(lines) {
  const content = ["BT", "/F1 11 Tf", "15 TL", "56 780 Td"];
  for (const line of lines) content.push(`(${escapePdf(line)}) Tj T*`);
  content.push("ET");
  const data = Buffer.from(content.join("\n"), "latin1");
  return pdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    stream("", data),
  ]);
}

// 5x7 glyphs, one number per row, bit 4 is the leftmost pixel.
const GLYPHS = {
  A: [14, 17, 17, 17, 31, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [28, 18, 17, 17, 17, 18, 28], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12],
  ".": [0, 0, 0, 0, 0, 12, 12], ",": [0, 0, 0, 0, 12, 4, 8], ":": [0, 12, 12, 0, 12, 12, 0],
  ";": [0, 12, 12, 0, 12, 4, 8], "/": [0, 1, 2, 4, 8, 16, 0], "-": [0, 0, 0, 31, 0, 0, 0],
  "(": [2, 4, 8, 8, 8, 4, 2], ")": [8, 4, 2, 2, 2, 4, 8], "'": [12, 4, 8, 0, 0, 0, 0],
  "?": [14, 17, 1, 2, 4, 0, 4], "&": [12, 18, 20, 8, 21, 18, 13], "%": [24, 25, 2, 4, 8, 19, 3],
};

function imagePdf(lines) {
  const width = 1240;
  const height = 1754;
  const scale = 2;
  const pixels = Buffer.alloc(width * height, 0xf4); // off-white paper
  // Deterministic speckle, so the page looks scanned and stays reproducible.
  let seed = 7;
  for (let i = 0; i < pixels.length; i += 97) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    if (seed % 13 === 0) pixels[i] = 0xc8;
  }
  lines.forEach((line, row) => {
    const top = 120 + row * 24;
    [...line.toUpperCase()].forEach((ch, col) => {
      const glyph = GLYPHS[ch];
      if (!glyph) return;
      const left = 110 + col * 12;
      glyph.forEach((bits, y) => {
        for (let x = 0; x < 5; x++) {
          if (!(bits & (16 >> x))) continue;
          for (let dy = 0; dy < scale; dy++)
            for (let dx = 0; dx < scale; dx++) pixels[(top + y * scale + dy) * width + left + x * scale + dx] = 0x22;
        }
      });
    });
  });
  const image = zlib.deflateSync(pixels, { level: 9 });
  const content = Buffer.from("q 595 0 0 842 0 0 cm /Im0 Do Q", "latin1");
  return pdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>",
    stream(`/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, image),
    stream("", content),
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [kind, lines] of Object.entries(DOCUMENTS)) {
  fs.writeFileSync(path.join(OUT, `${kind}-teks.pdf`), textPdf(lines));
  fs.writeFileSync(path.join(OUT, `${kind}-pindai.pdf`), imagePdf(lines));
  fs.writeFileSync(path.join(OUT, `${kind}.txt`), lines.join("\n") + "\n");
}
console.log(`${Object.keys(DOCUMENTS).length * 3} berkas tiruan ditulis ke ${OUT}`);
