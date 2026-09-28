// Wording shown to readers. Status labels always say whose claim it is: this site never
// concludes that a regulation is in force (SPEC invariant 1).

export const STATUS_LABEL = {
  berlaku: "Berlaku menurut sumber",
  tidak_berlaku: "Tidak berlaku menurut sumber",
  diubah_atau_dicabut_sebagian: "Diubah atau dicabut sebagian",
  tetap: "Tetap",
  tidak_pasti: "Tidak pasti",
  kosong: "Sumber tidak menyebutkan status",
};

export const STATUS_SHORT = {
  berlaku: "Berlaku",
  tidak_berlaku: "Tidak berlaku",
  diubah_atau_dicabut_sebagian: "Diubah sebagian",
  tetap: "Tetap",
  tidak_pasti: "Tidak pasti",
  kosong: "Tanpa status",
};

export function statusLabel(value, short = false) {
  const table = short ? STATUS_SHORT : STATUS_LABEL;
  if (table[value]) return table[value];
  if (value && value.startsWith("lain:")) return `Nilai lain di sumber: ${value.slice(5)}`;
  return value || "Tanpa status";
}

export const TYPE_LABEL = {
  UU: "Undang-Undang",
  PERPU: "Perpu",
  PP: "Peraturan Pemerintah",
  PERPRES: "Peraturan Presiden",
  KEPPRES: "Keputusan Presiden",
  INPRES: "Instruksi Presiden",
  PMK: "Peraturan Menteri Keuangan",
  KMK: "Keputusan Menteri Keuangan",
  "PER-DJP": "Peraturan Dirjen Pajak",
  "KEP-DJP": "Keputusan Dirjen Pajak",
  "INS-DJP": "Instruksi Dirjen Pajak",
  "ND-DJP": "Nota Dinas Dirjen Pajak",
  SE: "Surat Edaran",
  "PER-ESELON1": "Peraturan Unit Eselon I",
  "KEP-ESELON1": "Keputusan Unit Eselon I",
  UUD: "Undang-Undang Dasar",
};

export function typeLabel(code) {
  if (code === "?") return "Jenis tidak terbaca dari sumber";
  return TYPE_LABEL[code] || code;
}

/** Two documents have a number the sources wrote in a way the pipeline could not parse. */
export function yearLabel(year) {
  return year ? year : "Tahun tidak terbaca";
}

export const STRUCTURE_NOTE = {
  perubahan:
    "Peraturan perubahan. Pasal I memuat ketentuan peraturan yang diubah, Pasal II ketentuan penutup.",
  diktum: "Keputusan: isinya diktum (KESATU, KEDUA, …), bukan pasal.",
  biasa: null,
};

const FLAG_NOTE = {
  anomali_romawi:
    "Penomoran pasal janggal: ada pasal berangka Romawi yang tidak mengikuti pola peraturan perubahan. " +
    "Kemungkinan salah ketik di teks sumber. Label dibiarkan apa adanya dan perlu diperiksa manusia.",
  urutan_loncat: "Nomor pasal meloncat di teks sumber.",
  pasal_ganda: "Ada nomor pasal yang muncul lebih dari sekali di teks sumber.",
  tidak_mulai_dari_1: "Pasal pertama di teks sumber bukan Pasal 1.",
  tidak_ada_pasal: "Teks sumber tidak memuat pasal maupun diktum yang bisa dikenali.",
};

/** Turn a pipeline flag such as "urutan_loncat:39->4" into a sentence plus its detail. */
export function flagNote(flag) {
  const [name, detail] = flag.split(":");
  return { name, detail: detail || null, note: FLAG_NOTE[name] || "Penanda mutu dari pipa data." };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-09-21T14:06:27+00:00" -> "21 Sep 2026". Returns null when there is nothing to show. */
export function formatDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

export function documentTitle(doc) {
  const number = doc.source_records.find((r) => r.number_as_written)?.number_as_written;
  return number ? `${number} — ${doc.title}` : doc.title;
}
