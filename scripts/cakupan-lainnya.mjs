// Which regulations of the DJP list "Lainnya" enter the corpus (owner, 2026-10-11, K-088).
//
//   node scripts/cakupan-lainnya.mjs           write or update src/data/cakupan-lainnya.json
//   node scripts/cakupan-lainnya.mjs --cek     report only; exits 1 when the file is out of date
//
// One entry per regulation of "Lainnya" that is not already in the corpus, not in another category
// list (PPh, KUP, PPN, BM, BPHTB, PBB) and not a weekly exchange-rate or interest-rate decree.
// The first decision is a proposal from words in the title ("diputuskan": "usulan judul"). A title
// that fits no group, or fits a group that enters and one that does not, is "meragukan" (masuk:
// null): it is never guessed, and it is not fetched until a person decides. An entry a person has
// edited ("diputuskan": "pemilik") is never changed by this script. See src/data/README-cakupan.md.
import fs from "node:fs";

const FILE = "src/data/cakupan-lainnya.json";
const KURS = /nilai\s+kurs\s+sebagai\s+dasar|tarif\s+bunga\s+sebagai\s+dasar|nilai\s+dasar\s+perhitungan\s+bea\s+masuk/i;

// Groups that enter (owner's decision), checked on the title.
const IN = [
  ["P3B", /penghindaran pajak berganda|pajak berganda|double taxation|avoidance of double|pencegahan pengelakan pajak/i],
  ["tempat terdaftar wajib pajak", /tempat (pendaftaran|terdaftar)|tempat pelaporan usaha|pemindahan wajib pajak|wajib pajak (besar|madya)|kantor pelayanan pajak (madya|wajib pajak besar)|wajib pajak tertentu yang terdaftar/i],
  ["PBB dan BPHTB", /pajak bumi dan bangunan|\bpbb\b|bea perolehan hak atas tanah/i],
  ["pajak daerah dan retribusi", /pajak daerah|retribusi daerah|\bretribusi\b|pajak bahan bakar kendaraan bermotor|pajak kendaraan bermotor/i],
  ["PPN dan PPh", /pajak pertambahan nilai|\bppn\b|barang mewah|pajak penghasilan|\bpph\b/i],
  ["KUP dan administrasi pajak", /ketentuan umum dan tata cara perpajakan|\bkup\b|npwp|nomor pokok wajib pajak|surat pemberitahuan|\bspt\b|pemeriksaan pajak|pemeriksaan bukti permulaan|penagihan pajak|surat paksa|keberatan|banding|gugatan|pembukuan|faktur|e-faktur|restitusi|pengembalian kelebihan pembayaran pajak|pengurangan atau penghapusan sanksi|sanksi administrasi|wajib pajak|pengusaha kena pajak|perpajakan|penyidikan.*pajak|konsultan pajak|kuasa wajib pajak|penanggung pajak|pengampunan pajak|setoran pajak|pembayaran pajak|penyetoran pajak|sengketa pajak|pengadilan pajak|sensus pajak|utang pajak|tunggakan pajak|kode akun pajak|bukti potong|pemungut(an)? pajak|pemotong(an)? pajak/i],
];
// Groups that do not enter (owner's decision).
const OUT = [
  ["bea masuk, bea keluar, cukai, kepabeanan", /\bbea masuk|\bbea keluar|\bcukai\b|kepabeanan|pabean|impor sementara|kawasan berikat|gudang berikat|tempat penimbunan berikat/i],
  ["PNBP", /penerimaan negara bukan pajak|\bpnbp\b/i],
  ["anggaran dan perbendaharaan", /anggaran|\bapbn\b|perbendaharaan|kekayaan negara|barang milik negara|piutang negara|surat berharga negara|pinjaman|hibah|rekening|kas negara|akuntansi pemerintah|laporan keuangan/i],
  ["organisasi dan kepegawaian", /organisasi|tata kerja|pembentukan tim|\bteam\b|\btim\b|lomba|seleksi|percontohan|penghargaan|pegawai|kepegawaian|jabatan|naskah dinas|\bcap\b|seragam|pakaian dinas|tunjangan|cuti|disiplin|diklat|pendidikan dan pelatihan|kode etik|informasi publik|bantuan hukum|standar pelayanan|keamanan informasi|kearsipan|tata naskah|pengadaan barang/i],
];
const PERMENDAG = /menteri perdagangan/i;

function classify(row) {
  const title = row.judul || "";
  // Some titles come from the source without spaces ("PENYEMPURNAANKEPUTUSAN..."): the words
  // cannot be read, so the regulation is left for a person.
  if (/\S{40,}/.test(title.replace(/https?:\S+/g, ""))) {
    return { masuk: null, kelompok: "meragukan", alasan: "judul di sumber tanpa spasi; tidak bisa dibaca aturan judul" };
  }
  if (PERMENDAG.test(row.jenis || "")) return { masuk: false, kelompok: "Permendag", alasan: "jenisnya Peraturan Menteri Perdagangan" };
  const out = OUT.find(([, re]) => re.test(title));
  // "pajak" alone is weak evidence: only the specific groups count against an excluded group.
  const strongIn = IN.slice(0, 5).find(([, re]) => re.test(title));
  const anyIn = IN.find(([, re]) => re.test(title));
  if (out && strongIn) {
    return { masuk: null, kelompok: "meragukan", alasan: `judul memuat ${strongIn[0]} dan ${out[0]}` };
  }
  if (/pajak ekspor/i.test(title)) {
    return { masuk: null, kelompok: "meragukan", alasan: "pajak ekspor: pungutan atas ekspor komoditas, bukan jelas pajak yang dikelola DJP" };
  }
  if (out) {
    return { masuk: false, kelompok: out[0], alasan: `judul memuat kata kelompok ${out[0]}` };
  }
  if (anyIn) return { masuk: true, kelompok: anyIn[0], alasan: `judul memuat kata kelompok ${anyIn[0]}` };
  if (/pajak/i.test(title)) {
    return { masuk: null, kelompok: "meragukan", alasan: "judul hanya menyebut 'pajak' tanpa topik yang jelas" };
  }
  if (/dirjen pajak|direktur jenderal pajak/i.test(row.jenis || "")) {
    return { masuk: null, kelompok: "meragukan", alasan: "diterbitkan Dirjen Pajak, tetapi judulnya tidak menyebut topik pajak yang jelas" };
  }
  return { masuk: false, kelompok: "lain-lain bukan pajak DJP", alasan: "judul tidak menyebut pajak maupun kelompok yang masuk" };
}

const jsonl = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const index = JSON.parse(fs.readFileSync("corpus/index.json", "utf8"));
const elsewhere = new Set();
for (const entry of index) {
  const doc = JSON.parse(fs.readFileSync(`corpus/documents/${entry.id}.json`, "utf8"));
  for (const r of doc.source_records) if (r.source === "DJP") elsewhere.add(r.url.replace("https://www.pajak.go.id", ""));
}
for (const r of jsonl("poc/data/djp_pph_list.jsonl")) if (r.path) elsewhere.add(r.path);
const lists = jsonl("harvest/djp_list.jsonl");
for (const r of lists) if (r.path && r._kategori_daftar !== "Lainnya") elsewhere.add(r.path);

const candidates = new Map();
for (const r of lists) {
  if (r._kategori_daftar !== "Lainnya" || !r.path || elsewhere.has(r.path) || KURS.test(r.judul || "")) continue;
  if (!candidates.has(r.path)) candidates.set(r.path, r);
}

const before = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { peraturan: [] };
const kept = new Map(before.peraturan.map((e) => [e.path, e]));
const entries = [...candidates.values()].map((row) => {
  const old = kept.get(row.path);
  if (old && old.diputuskan === "pemilik") return old;
  return { path: row.path, nomor: row.nomor, jenis: row.jenis, judul: row.judul, ...classify(row), diputuskan: "usulan judul" };
});
entries.sort((a, b) => a.path.localeCompare(b.path));

const output = [
  "{",
  `  "keterangan": "Cakupan daftar 'Lainnya' katalog DJP (K-088). masuk: true = diambil detailnya dan masuk korpus; false = tidak; null = meragukan, belum diputuskan, tidak diambil. Ubah 'masuk', 'kelompok', dan 'alasan', lalu tulis 'diputuskan': 'pemilik' supaya skrip tidak menimpanya. Lihat README-cakupan.md.",`,
  `  "peraturan": [`,
  entries.map((e) => "    " + JSON.stringify(e)).join(",\n"),
  "  ]",
  "}",
  "",
].join("\n");

const count = (pick) => entries.reduce((m, e) => ((m[pick(e)] = (m[pick(e)] || 0) + 1), m), {});
const summary = count((e) => `${e.masuk === true ? "masuk" : e.masuk === false ? "tidak" : "ragu"} · ${e.kelompok}`);
for (const [k, v] of Object.entries(summary).sort()) console.log(`${String(v).padStart(5)}  ${k}`);
console.log(`${String(entries.length).padStart(5)}  jumlah`);

if (process.argv.includes("--cek")) {
  const current = fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8") : "";
  if (current !== output) {
    console.error(`${FILE} belum diperbarui: jalankan node scripts/cakupan-lainnya.mjs`);
    process.exit(1);
  }
} else {
  fs.writeFileSync(FILE, output);
  console.log(`ditulis: ${FILE}`);
  // The undecided ones, as their own list for the owner (never guessed).
  const doubtful = entries.filter((e) => e.masuk === null);
  const byReason = new Map();
  for (const e of doubtful) byReason.set(e.alasan, [...(byReason.get(e.alasan) || []), e]);
  const lines = [
    "# Daftar \"Lainnya\" yang meragukan",
    "",
    `Dibuat oleh \`scripts/cakupan-lainnya.mjs\` dari \`src/data/cakupan-lainnya.json\` (K-088). ${doubtful.length} peraturan`,
    "yang judulnya tidak jelas masuk kelompok mana. Belum diambil detailnya. Putuskan di berkas JSON",
    "(lihat `src/data/README-cakupan.md`); daftar ini ikut berubah saat skrip dijalankan lagi.",
    "",
  ];
  for (const [reason, items] of [...byReason].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`## ${reason[0].toUpperCase()}${reason.slice(1)} (${items.length})`, "");
    lines.push("| Nomor | Jenis | Judul |", "|---|---|---|");
    for (const e of items) lines.push(`| ${(e.nomor || "").replace(/\|/g, "/")} | ${e.jenis || ""} | ${(e.judul || "").replace(/\|/g, "/")} |`);
    lines.push("");
  }
  fs.writeFileSync("docs/LAINNYA-MERAGUKAN.md", lines.join("\n"));
  console.log("ditulis: docs/LAINNYA-MERAGUKAN.md");
}
