// What the M7 category lists hold (K-085, K-086), from the fetched lists; no network.
//
//   node scripts/rincian-m7.mjs
//
// For every M7 list: rows, unique regulations, already in the corpus, weekly exchange-rate and
// monthly interest-rate decrees, and the rest by type. For "Lainnya", the rest by topic, from words
// in the title, so its scope can be decided with numbers. For BPHTB and PBB: the DJP status of
// each regulation as the list states it (JDIH's claim comes later).
import fs from "node:fs";

const jsonl = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const KURS = /nilai\s+kurs\s+sebagai\s+dasar|tarif\s+bunga\s+sebagai\s+dasar|nilai\s+dasar\s+perhitungan\s+bea\s+masuk/i;
// First match wins; the order puts the most specific topics first.
const TOPICS = [
  ["bea masuk, bea keluar, cukai, kepabeanan", /\bbea masuk|\bbea keluar|\bcukai\b|kepabeanan|pabean|impor sementara|kawasan berikat|gudang berikat/i],
  ["PNBP", /penerimaan negara bukan pajak|\bpnbp\b/i],
  ["pajak daerah dan retribusi", /pajak daerah|retribusi|pemerintah daerah|dana bagi hasil/i],
  ["PBB dan BPHTB", /pajak bumi dan bangunan|\bpbb\b|bea perolehan hak/i],
  ["Bea Meterai", /bea meterai|meterai/i],
  ["PPh", /pajak penghasilan|\bpph\b/i],
  ["PPN dan PPnBM", /pajak pertambahan nilai|\bppn\b|barang mewah/i],
  ["KUP, tata cara, administrasi pajak", /tata cara|ketentuan umum|npwp|surat pemberitahuan|pemeriksaan|penagihan|keberatan|banding|pembukuan|e-faktur|elektronik/i],
  ["anggaran, perbendaharaan, keuangan negara", /anggaran|apbn|perbendaharaan|kekayaan negara|barang milik negara|hibah|pinjaman|surat berharga/i],
  ["organisasi dan kepegawaian", /organisasi|tata kerja|pegawai|jabatan|kantor|direktorat jenderal pajak/i],
  ["perjanjian perpajakan (P3B)", /persetujuan.*penghindaran pajak berganda|double taxation|avoidance of double/i],
];

const index = JSON.parse(fs.readFileSync("corpus/index.json", "utf8"));
const inCorpus = new Set();
for (const entry of index) {
  const doc = JSON.parse(fs.readFileSync(`corpus/documents/${entry.id}.json`, "utf8"));
  for (const r of doc.source_records) if (r.source === "DJP") inCorpus.add(r.url.replace("https://www.pajak.go.id", ""));
}
const rows = jsonl("harvest/djp_list.jsonl");
const state = JSON.parse(fs.readFileSync("harvest/state.json", "utf8"));
const count = (items, key) => Object.entries(items.reduce((m, x) => ((m[key(x)] = (m[key(x)] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);

for (const name of ["BM", "BPHTB", "PBB", "Lainnya"]) {
  const c = state.categories[name];
  const listed = rows.filter((r) => r._kategori_daftar === name && r.path);
  const byPath = new Map(listed.map((r) => [r.path, r]));
  const unique = [...byPath.values()];
  const corpus = unique.filter((r) => inCorpus.has(r.path));
  const kurs = unique.filter((r) => !inCorpus.has(r.path) && KURS.test(r.judul || ""));
  const rest = unique.filter((r) => !inCorpus.has(r.path) && !KURS.test(r.judul || ""));
  console.log(`\n== ${name}: daftar ${c.pages_done.length}/${c.last_page + 1} halaman, ${listed.length} baris, ${unique.length} unik`);
  console.log(`   sudah di korpus ${corpus.length} · KMK kurs/bunga ${kurs.length} · sisanya ${rest.length}`);
  console.log("   sisanya per jenis: " + count(rest, (r) => r.jenis || "(kosong)").map(([k, v]) => `${k} ${v}`).join(", "));
  if (name === "Lainnya") {
    const topic = (r) => (TOPICS.find(([, re]) => re.test(r.judul || "")) || ["lain-lain"])[0];
    console.log("   sisanya per topik (dari kata di judul):");
    for (const [k, v] of count(rest, topic)) console.log(`     ${String(v).padStart(5)}  ${k}`);
  }
  if (name === "BPHTB" || name === "PBB") {
    console.log("   status DJP (semua unik): " + count(unique, (r) => r.status || "(kosong)").map(([k, v]) => `${k} ${v}`).join(", "));
    console.log("   status DJP (belum di korpus, bukan kurs): " + count(rest, (r) => r.status || "(kosong)").map(([k, v]) => `${k} ${v}`).join(", "));
  }
}
const pbbBphtb = new Map(rows.filter((r) => ["BPHTB", "PBB"].includes(r._kategori_daftar) && r.path).map((r) => [r.path, r]));
const active = [...pbbBphtb.values()].filter((r) => /^aktif$/i.test(r.status || "")).length;
console.log(`\nBPHTB dan PBB gabungan: ${pbbBphtb.size} peraturan unik, ${active} berstatus "Aktif" menurut DJP.`);
