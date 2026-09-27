# Bukti konsep: pengumpulan peraturan pajak Indonesia

Disusun 2026-09-25. Seluruh angka berasal dari data yang diambil 2026-09-21 sampai 2026-09-22 dan tersimpan di
`poc/data`, `poc/raw`, `poc/text`, `poc/out`. Tidak ada satu pun angka di laporan ini yang diisi dari ingatan.

---

## 1. Kesimpulan singkat

**Datanya bisa dikumpulkan dengan bersih, tetapi hanya untuk peraturan tahun 2010 ke atas, dan saat ini hanya dari
satu sumber.** Untuk kategori Pajak Penghasilan, 1.122 dokumen substantif berhasil diidentifikasi dan 573 di antaranya
punya teks lengkap (10,65 MB, 1,92 MB setelah gzip, 6.319 unit pasal). Pemecahan per pasal bekerja baik: hanya 52
dokumen (9,1% dari yang berteks) yang perlu diperiksa manusia karena struktur pasalnya janggal, dan hampir semua
kejanggalan itu memang salah ketik di teks sumber, bukan salah program.

Tiga hal yang harus menjadi bahan keputusan desain:

1. **Teks peraturan lama tidak ada.** Di DJP, dokumen 2010 ke atas punya teks lengkap 100%, dekade 2000-an hanya 49%,
   dekade 1990-an 10%, dekade 1980-an 4%. Halaman dokumen lama hanya berisi metadata, tanpa teks dan tanpa lampiran.
2. **Status tidak bisa dipercaya tanpa pemeriksaan manusia.** Dari 337 dokumen yang statusnya bisa dibandingkan di dua
   sumber, 121 (36%) berbeda. Ditambah konflik dengan bukti pencabutan dari teks, total 190 dokumen (17%) berstatus
   tidak pasti.
3. **Satu sumber saja yang tersisa.** JDIH Kemenkeu berhenti bisa diakses di tengah pengumpulan dan belum pulih. BPK
   dan Direktori Putusan MA tertutup untuk pengambilan otomatis.
4. **Batang tubuh peraturan tidak butuh OCR, lampiran butuh dan hasilnya buruk.** Teks batang tubuh di DJP berbentuk
   HTML. Sebaliknya, 3 dari 10 lampiran PDF yang disampel memuat halaman pindaian (79 dari 258 halaman), dan OCR-nya
   kehilangan spasi antar kata serta merusak angka pada tabel tarif. Lampiran pindaian sebaiknya tidak dijadikan teks
   yang dapat dicari tanpa koreksi manusia.

---

## 2. Peta sumber resmi

### 2.1 JDIH Kementerian Keuangan — `jdih.kemenkeu.go.id`

| Aspek | Hasil |
|---|---|
| Jenis peraturan | PMK 4.688, KMK 1.201, PP 1.005, Peraturan Unit Eselon I 446, Perpres 434, UU 410, Lainnya 269 (termasuk SE), Keputusan Unit Eselon I 190, Perpu 19, Instruksi Menteri 6, Putusan Pengadilan Pajak 5 |
| Total terdata | **8.671 dokumen** (hasil enumerasi penuh; cocok dengan angka facet situs) |
| Bentuk berkas | PDF teks untuk dokumen baru; HTML untuk banyak dokumen lama; abstrak PDF terpisah; pratinjau JPG |
| Status | Tercantum: Berlaku 5.724, Tidak Berlaku 2.993, Tetap 210, kosong 2.063 (seluruh situs) |
| Relasi | **Terstruktur dan paling baik dari semua sumber**: daftar `Relasi` berisi kode, jenis, nama ("Mencabut", "Mengubah"), nomor, judul, slug, dan tanggal |
| robots.txt | `User-Agent: * / Allow: /`, larangan hanya `/api/auth`, `/api/health`, `/pdfjs`. Menyediakan sitemap. Unduhan berkas `/api/download/...` tidak dilarang |
| Ketentuan situs | Tidak melarang pengambilan otomatis. Penggunaan komersial wajib izin Biro Hukum. Kutipan lengkap di `data/ketentuan_situs.md` |

**Status akses saat ini: berhenti.** Setelah sekitar 884 permintaan dengan jeda 3 detik, seluruh koneksi ke
`jdih.kemenkeu.go.id` dan `www.kemenkeu.go.id` gagal pada tahap TLS (curl exit 35) mulai 2026-09-22 sekitar 00:15 UTC.
Satu permintaan uji 30 menit kemudian tetap gagal, jadi JDIH dihentikan untuk sesi ini. Dari satu jaringan, pemblokiran
IP dan gangguan situs tidak bisa dibedakan. Tidak ada upaya mengakalinya.

Akibatnya: metadata JDIH lengkap, tetapi **teks JDIH hanya 1 dokumen** yang sempat terambil.

### 2.2 Direktorat Jenderal Pajak — `www.pajak.go.id/id/peraturan`

| Aspek | Hasil |
|---|---|
| Jenis peraturan | 38 jenis di katalog: UU, Perpu, PP, Perpres, Keppres, PMK, KMK, Peraturan/Keputusan/Instruksi Dirjen Pajak, peraturan kementerian lain, dll. **Tidak ada Surat Edaran** |
| Total katalog | **6.307 dokumen**; PPh 2.468, PPN 2.480, KUP 1.268, Lainnya 1.883, PBB 236, BPHTB 80, Bea Meterai 64 (satu dokumen bisa masuk beberapa kategori) |
| Bentuk berkas | **Teks lengkap langsung sebagai HTML** di halaman detail, bukan PDF. Sebagian punya lampiran PDF terpisah |
| Status | Tercantum: Aktif, Dicabut, Diubah/Disempurnakan/Dicabut sebagian, Diubah/Disempurnakan dan Sudah dicabut |
| Relasi | Ada kolom "Peraturan Terkait", tetapi **tanpa jenis relasi** dan hampir selalu kosong: hanya terisi pada 39 dari 1.122 dokumen |
| robots.txt | Melarang `/core/`, `/profiles/`, `/admin/`, `/search/`, `/user/...`. Katalog dan halaman detail tidak dilarang |
| Ketentuan situs | Tidak melarang pengambilan otomatis. Penggunaan komersial wajib izin DJP. Butir 4 menyatakan materinya bisa memuat kesalahan dan DJP tidak berkomitmen memperbaruinya |

### 2.3 Database Peraturan BPK — `peraturan.bpk.go.id`

**Tidak diambil.** Seluruh situs, termasuk robots.txt, dilindungi Cloudflare *managed challenge* ("Performing security
verification... verifies you are not a bot"), HTTP 403 untuk klien non-browser, dan tantangannya tidak lolos sendiri di
browser. Ketentuan situsnya tidak bisa dibaca. Menembus deteksi bot tidak dilakukan.

### 2.4 Putusan Pengadilan Pajak

Diperiksa atas permintaan, hasilnya **tidak tersedia untuk pengambilan otomatis**:

- **Direktori Putusan MA** (`putusan3.mahkamahagung.go.id`): robots.txt melarang semua agen (`User-agent: * / Disallow: /`)
  kecuali beberapa mesin pencari, dan **memblokir `ClaudeBot`, `Claude-SearchBot`, serta `anthropic-ai` secara eksplisit**.
  Tidak diakses lebih jauh.
- **Sekretariat Pengadilan Pajak** (`setpp.kemenkeu.go.id`): tidak terjangkau (HTTP 000), infrastruktur yang sama dengan JDIH.
- **JDIH**: hanya memuat 5 putusan Pengadilan Pajak, semuanya PDF, tahun 2024. Nomornya sendiri mengandung salah baca
  huruf, misalnya `PUTP1-004726.15/2023/PP/MXVIllB` dan `PUT-007161.15/2023/PP/M.XllB`, dengan huruf `l` menggantikan `I`.
  Ini menunjukkan metadata JDIH sebagian diketik dari hasil OCR.

Ukuran satu contoh putusan tidak bisa diukur karena JDIH berhenti sebelum PDF-nya terunduh.

**Kesimpulan cakupan: putusan Pengadilan Pajak tidak bisa menjadi data bawaan produk.** Sama seperti Surat Edaran,
dokumen jenis ini hanya bisa masuk lewat koleksi pribadi pengguna.

---

## 3. Temuan utama: Surat Edaran Dirjen Pajak hilang

SE Dirjen Pajak adalah rujukan sehari-hari untuk penafsiran PPh, dan **praktis tidak tersedia dari sumber resmi mana pun
yang bisa diambil**.

Yang sudah dicari:

| Tempat | Hasil |
|---|---|
| Daftar "Jenis Dokumen" katalog DJP | 38 jenis, tidak ada Surat Edaran sama sekali |
| Pencarian katalog DJP `field_nomor_value=SE-` | 0 hasil |
| Pencarian katalog DJP `title=surat edaran` | 1 hasil, dan itu pun sebuah Peraturan Dirjen |
| JDIH Kemenkeu, seluruh 8.671 metadata | 94 SE, di antaranya **61 SE Dirjen Pajak, semuanya tahun 1994–1995** |
| BPK | tertutup, tidak bisa dinilai |

Tidak ada pencarian ke kompilasi komersial atau sumber tidak resmi.

Sebagai pembanding kasar, DJP menerbitkan puluhan SE per tahun, sehingga yang tersedia hanya sebagian kecil dari beberapa
dekade terakhir. **Produk tidak bisa menjanjikan kelengkapan SE.**

---

## 4. Yang berhasil dikumpulkan untuk kategori Pajak Penghasilan

### 4.1 Cara memilih dokumen PPh

- **DJP**: memakai kategori resmi "PPh - Pajak Penghasilan", 2.468 baris daftar, 2.460 URL unik.
- **JDIH**: kriteria kata kunci pada judul dan label, menghasilkan 614 kandidat dari 8.671 dokumen. Ini heuristik, bukan
  kategori resmi, karena JDIH tidak punya kategori PPh.
- Keduanya digabung dengan kunci identitas (jenis, nomor, tahun), ditambah varian untuk **ralat** dan **naskah konsolidasi**.

### 4.2 KMK kurs dan tarif bunga berkala: di luar cakupan

**1.430 dari 2.468 baris daftar PPh DJP (58%) adalah KMK penetapan kurs mingguan atau tarif bunga bulanan.** Jumlahnya
dicatat di sini, tetapi dokumen ini dikeluarkan dari seluruh angka analisis, estimasi ukuran, dan pengambilan detail.
Sisanya, **1.036 URL substantif**, itulah yang diproses.

### 4.3 Hasil pengumpulan

| Ukuran | Angka |
|---|---|
| Dokumen substantif unik setelah penggabungan | **1.122** |
| Hanya ada di DJP | 686 |
| Hanya ada di JDIH | 99 |
| Ada di kedua sumber | 337 |
| Punya teks lengkap | **573** |
| Tanpa teks | 549 |
| Varian ralat / naskah konsolidasi | 11 / 1 |
| Rentang tahun | 1983–2026 |

Rincian 549 dokumen tanpa teks:

| Sebab | Jumlah |
|---|---|
| Halaman DJP hanya berisi metadata, tanpa teks dan tanpa lampiran | 450 |
| Hanya ada di JDIH, dan JDIH berhenti sebelum teksnya diambil | 99 |
| Pengambilan detail DJP gagal | 0 (22 yang sempat gagal sudah berhasil pada putaran 26 September) |

**Ini bukan kegagalan program, melainkan isi sumbernya.** Sebaran ketersediaan teks di DJP per dekade:

| Dekade | Dokumen | Tanpa teks | Persen tanpa teks |
|---|---|---|---|
| 1980-an | 51 | 49 | 96% |
| 1990-an | 269 | 242 | 90% |
| 2000-an | 301 | 154 | 51% |
| 2010-an | 236 | 0 | 0% |
| 2020-an | 157 | 0 | 0% |

### 4.4 Ukuran teks

| Ukuran | Angka |
|---|---|
| Dokumen berteks | 573 |
| Total teks | 11.163.314 karakter = **10,65 MB** UTF-8 (11.319.787 byte = 10,80 MB sebagai berkas di disk) |
| Setelah gzip | **1,92 MB** (rasio 0,178 terhadap berkas di disk) |
| Rata-rata per dokumen | 19.213 karakter |
| Median per dokumen | 10.042 karakter |
| Terpanjang | 275.666 karakter (PER-11/PJ/2025) |
| Kata unik | 10.179 |

### 4.5 Pemecahan per pasal

| Ukuran | Angka |
|---|---|
| Unit batang tubuh | **6.319** |
| Struktur "biasa" (pasal bernomor Arab) | 446 |
| Struktur "perubahan" (Pasal I berisi butir perubahan, Pasal II penutup) | **113** |
| Struktur "diktum" (KMK/KEP: KESATU, KEDUA, ...) | 22 |
| Dokumen dengan tanda perlu periksa manusia | **52** (9,1% dari yang berteks) |

Rincian tanda: urutan pasal meloncat 38, anomali Romawi 17, pasal ganda 14, tidak mulai dari Pasal 1 sebanyak 3,
tidak ada pasal maupun diktum 5.

Peraturan perubahan ditangani sesuai konvensi penyusunan peraturan: isi Pasal I disimpan sebagai daftar butir perubahan
(nomor butir, pasal sasaran, aksi diubah/disisipkan/dihapus), dan judul "Pasal N" di dalamnya dicatat sebagai pasal yang
dikutip, bukan pasal milik peraturan perubahan itu.

### 4.6 Contoh nyata kejanggalan struktur, semuanya salah di teks sumber

- **PP 42/1985** (JDIH, HTML): pasal pertamanya tertulis "Pasal I" dengan huruf Romawi, padahal ini bukan peraturan
  perubahan. Tidak ada Pasal II, setelahnya langsung Pasal 2 sampai Pasal 34, dan isinya ketentuan PP itu sendiri.
  Ditandai `anomali_romawi`, label tidak diubah otomatis.
- **PER-7/PJ/2024** (DJP): kebalikannya. Ini memang peraturan perubahan, tetapi "Pasal I" tertulis "Pasal 1" sedangkan
  "Pasal II" benar.
- **PMK 72/2023** (DJP): "Pasal 3" muncul dua kali; yang kedua seharusnya Pasal 5.
- **PER-11/PJ/2025** (DJP): ada baris "Pasal 4" nyasar di antara Pasal 39 dan Pasal 40, kemungkinan judul Paragraf yang salah ketik.
- **PMK 28/2024** (DJP): ada "Pasal 130" di tengah ayat Pasal 12.

---

## 5. Mutu teks dan kebutuhan OCR

### 5.1 OCR: hasil pengukuran

Rencana semula mengukur OCR dari PDF JDIH, tetapi JDIH berhenti sebelum satu pun PDF terunduh. Pengukuran akhirnya
dilakukan pada **lampiran PDF resmi di pajak.go.id** (putaran 26 September 2026, 22.00–22.30 WIB), yang merupakan bagian
sah dari peraturan. Teks batang tubuh DJP sendiri berbentuk HTML sehingga tidak butuh OCR.

| Ukuran | Hasil |
|---|---|
| Lampiran PDF tersampel | 10 berhasil, 2 gagal (koneksi diputus) |
| **Dokumen yang memuat halaman pindaian** | **3 dari 10 (30%)** |
| **Halaman pindaian** | **79 dari 258 halaman (31%)** |
| Ukuran rata-rata lampiran | 1,2 MB |
| Skor keyakinan RapidOCR | 0,93–0,99 |
| **Proporsi kata yang dikenal kamus korpus** | **0,942 / 0,708 / 0,646** (median 0,708) |

Dokumen pindaian yang tersampel: PER-09/PJ/2019 (4 dari 4 halaman), PER-20/PJ/2019 (74 dari 74 halaman),
744/KM.4/2020 (1 dari 37 halaman). Semuanya lampiran berisi formulir dan tabel.

### 5.1a Temuan: skor keyakinan OCR tidak boleh dipakai sebagai penentu kelayakan

**Mesin OCR melaporkan keyakinan 0,93–0,99 pada halaman yang hasilnya jelas rusak.** Pada dokumen dengan keyakinan
rata-rata 0,983, hasilnya tetap berbunyi `Lemakdanminyaksertafraksinyadaribinatanglautmenyusui` dan `1212. 2.21.90`.
Penyebabnya masuk akal: mesin OCR menilai seberapa yakin ia mengenali bentuk tiap karakter, bukan apakah keluarannya
membentuk kata dan angka yang benar. Kerusakan yang paling merugikan di sini, yaitu spasi yang hilang dan digit yang
bergeser, justru tidak menurunkan skor itu.

Konsekuensinya untuk semua tahap berikutnya:

- **Jangan pernah memakai ambang skor keyakinan sebagai gerbang otomatis** untuk memutuskan hasil OCR layak dipakai,
  layak ditampilkan, atau layak masuk indeks pencarian.
- Ukuran yang lebih jujur adalah **proporsi kata yang dikenal kamus**. Pada sampel ini skornya 0,942 / 0,708 / 0,646,
  jadi sekitar 30% kata pada dua dari tiga dokumen tidak dikenali. Ukuran ini pun hanya penyaring kasar, bukan jaminan.
- **Berlaku juga untuk fitur koleksi pribadi nanti.** Ketika pengguna mengunggah SE atau putusan Pengadilan Pajak
  miliknya sendiri, hasil OCR-nya harus ditandai sebagai teks belum terverifikasi, apa pun skor keyakinan yang
  dilaporkan mesin. Halaman yang mengandung tabel angka perlu peringatan tersendiri, karena di situlah kesalahan paling
  sulit terlihat dan paling berbahaya akibatnya.

**Contoh nyata hasil OCR** (berkas lengkap di `out/ocr_contoh/`):

- **Spasi antar kata hilang**, ini paling merusak pencarian:
  `PERATURANDIREKTURJENDERALPAJAK`, `BENTUK,ISI,TATACARAPENGISIANDANPENYAMPAIAN`,
  `Lemakdanminyaksertafraksinyadaribinatanglautmenyusui`, `a.n.MENTERIKEUANGANREPUBLIKINDONESIA`.
- **Label formulir kacau**: `Pombotulan Ko-` (Pembetulan Ke-), `Pumbatalan` (Pembatalan), `PPh Tidak Finat` (Final),
  `Dasar Pengensan Pajak` (Pengenaan), `Mesa Pajak` (Masa Pajak), `Tingot (Tide Ta` (potongan tak terbaca).
- **Angka rusak**, paling berbahaya karena lampiran ini berisi tabel kode barang dan tarif:
  `1212. 2.21.90`, `1212. .29.19`, `7101 2 1.00`, `1504. 20 .10`.

**Kesimpulan untuk produk:** lampiran pindaian **tidak layak dijadikan teks yang dapat dicari tanpa koreksi manusia**,
terutama yang berisi tabel angka. Rekomendasi: batang tubuh peraturan (HTML, tanpa OCR) dijadikan isi utama yang dapat
dicari, sedangkan lampiran pindaian ditampilkan sebagai gambar atau PDF asli dengan tautan ke sumber, bukan sebagai
teks hasil OCR yang seolah-olah tepat. Bila lampiran tetap ingin dicari, OCR-nya perlu diperiksa manusia per halaman.

### 5.1b Lampiran tertaut ke dokumen yang salah

Ditemukan dalam sampel kecil ini: halaman **PER-20/PJ/2019** melampirkan berkas `Lampiran PER_23_PJ_2020.pdf`, dan isi
OCR-nya memang lampiran PER-23/PJ/2020, bukan milik PER-20/PJ/2019. Satu kasus dari 10 sampel. Tautan lampiran perlu
diperiksa, tidak bisa dipercaya begitu saja.

### 5.2 Yang sudah terukur: teks DJP sendiri sebagian berasal dari OCR yang tidak dikoreksi

Dari 570 berkas teks yang diperiksa, **23 (4%) mengandung galat khas OCR**, yaitu pola `cl` terbaca menggantikan `d` dan
`rn` menggantikan `m`. Totalnya 35 kemunculan. Contoh nyata, semuanya bisa diperiksa di URL yang tercantum:

- **PMK 168/2023**, aturan pemotongan PPh Pasal 21 yang berlaku sekarang:
  "pemberi kerja yaitu orang pribadi **clan** Badan"
  (`/id/peraturan/petunjuk-pelaksanaan-pemotongan-pajak-atas-penghasilan-sehubungan-dengan-pekerjaan-jasa-1`)
- **PMK 72/2023** tentang penyusutan: "sebagaimana dimaksud pada ayat (3) huruf b **clan** persetujuan penundaan"
- **PMK 130/2020**: "sebagaimana telah diubah **clengan** Peraturan Pemerintah Nomor 45 Tahun 2019"
- **PMK 85/2019**: "bahwa **berclasarkan** Peraturan Menteri Keuangan Nomor 64/PMK.05/2013 ... oleh **Benclahara** Pengeluaran"
- **PMK 80/2024**: "tanggal dimulainya **clan** diselesaikannya"

Selain itu ditemukan teks yang terpotong di awal. **UU 7/1983**, undang-undang induk PPh, bagian Menimbang huruf a-nya
berbunyi "**publik** Indonesia adalah negara hukum berdasarkan Pancasila", jadi frasa "bahwa Negara Re" hilang.

Pemeriksaan lain: 7 berkas tanpa kata "Menimbang" sama sekali, 8 tanpa "MEMUTUSKAN", dan 10 berkas yang bagian
Menimbang-nya tidak dimulai dengan "bahwa". Satu dokumen, PMK 5/2012, isinya hanya kalimat "Selengkapnya lihat di Lampiran".

**Implikasi produk:** pencarian kata akan meleset pada dokumen-dokumen ini, karena "dan" tidak akan cocok dengan "clan".
Perbaikan otomatis untuk pola `cl`→`d` dan `rn`→`m` bisa dilakukan, tetapi berisiko merusak kata yang sah, sehingga
sebaiknya hanya diterapkan pada kata yang tidak ada di kamus dan tetap menyimpan teks aslinya.

---

## 6. Status berlaku: seberapa andal

Aturan yang dipakai: setiap klaim status disimpan apa adanya beserta sumber, URL, dan tanggal ambil. Tidak ada sumber
yang dimenangkan. Status ditandai tidak pasti bila klaim berbeda antar sumber, berbeda di dalam satu sumber, kosong,
atau bertentangan dengan bukti pencabutan dari teks peraturan lain.

| Ukuran | Angka |
|---|---|
| Bisa dibandingkan di dua sumber | 337 |
| Dua sumber sepakat | 216 (64%) |
| **Dua sumber berbeda** | **121 (36%)** |
| Berbeda di dalam satu sumber (rekaman ganda) | 1 |
| Hanya punya satu sumber | 785 |
| Sumber bilang berlaku, tetapi teks peraturan lain mencabutnya | 110 |
| **Total berstatus tidak pasti** | **190 (17% dari 1.122)** |

Rincian ketidaksepakatan:

| Pasangan | Jumlah |
|---|---|
| JDIH "Tidak Berlaku" vs DJP "Aktif" | 53 |
| JDIH "Berlaku" vs DJP "Dicabut" | 33 |
| JDIH "Berlaku" vs DJP "Diubah/Disempurnakan/Dicabut sebagian" | 22 |
| JDIH "Tidak Berlaku" vs DJP "Diubah/Disempurnakan/Dicabut sebagian" | 13 |

Contoh konkret yang bisa diperiksa sendiri:

- **PP 30/2020** tentang penurunan tarif PPh badan: JDIH "Tidak Berlaku", DJP "Aktif". Teks **PP 55/2022** mencabutnya.
- **PP 29/2020** tentang fasilitas PPh Covid-19: JDIH "Tidak Berlaku", DJP "Aktif". Dicabut oleh PP 55/2022.
- **PP 46/1996** tercatat dua kali di JDIH dengan status berbeda, satu "Berlaku" dan satu "Tidak Berlaku".

Selain itu, kosakata statusnya tidak sejajar. "Diubah/Disempurnakan/Dicabut sebagian" milik DJP mencampur dua keadaan
yang berbeda akibat hukumnya, yaitu masih berlaku dengan perubahan, dan sudah dicabut sebagian. Ini tidak bisa
dipetakan ke "Berlaku" atau "Tidak Berlaku" milik JDIH tanpa membaca teksnya.

**Kesimpulan: status dari sumber tidak cukup untuk menyatakan sebuah pasal masih berlaku.** Produk sebaiknya menampilkan
klaim tiap sumber apa adanya beserta tanggal ambilnya, bukan satu label tunggal.

---

## 7. Relasi antarperaturan

| Sumber relasi | Hasil |
|---|---|
| JDIH, terstruktur | Tersedia dan paling rapi, tetapi **hanya 1 dokumen** sempat terambil sebelum JDIH berhenti |
| DJP "Peraturan Terkait" | Terisi pada 39 dari 1.122 dokumen, dan tanpa jenis relasi |
| **Ekstraksi dari teks** | 207 dokumen punya relasi "mencabut" (439 acuan), 118 dokumen punya relasi "mengubah" |

Dari 439 acuan pencabutan, 308 (70%) berhasil ditautkan ke dokumen lain di dalam korpus. Sisanya menunjuk peraturan di
luar kategori PPh. Penyaring hierarki menolak 12 acuan yang mustahil secara hukum, misalnya sebuah PMK yang seolah-olah
mencabut sebuah UU.

Deteksi "mengubah" dari judul: 237 dokumen berjudul mengandung kata "perubahan", 118 (50%) berhasil dipetakan ke
peraturan yang diubah. Sisanya memakai rumusan judul yang belum tertangkap pola.

**Uji ketepatan manual, 20 pasangan pencabutan diperiksa satu per satu:**

| Hasil | Jumlah |
|---|---|
| Benar | 16 |
| Pencabutan sebagian, tetapi tercatat sebagai pencabutan penuh | 2 (PERPU 1/2020, PMK 37/2017 yang hanya mencabut Pasal 4 dan Pasal 5 PMK 200/2015) |
| Perlu diperiksa manusia | 2 |

Ketepatannya sekitar 80%. Kelemahan utamanya adalah tidak membedakan pencabutan penuh dan pencabutan sebagian, dan itu
justru perbedaan yang penting bagi pengguna.

---

## 8. Berapa yang harus diperiksa manusia

| Kategori | Jumlah |
|---|---|
| Status tidak pasti | 190 |
| Tanda struktur pasal janggal | 52 |
| Tanpa teks | 549 |
| Kunci identitas tidak bisa diurai | 2 |
| **Gabungan unik** | **709 dari 1.122 (63%)** |

Angka 63% terlihat besar, tetapi didominasi dokumen tanpa teks, yang sebagian besar adalah peraturan lama dan sebagian
besar sudah tidak berlaku. Bila dibatasi pada dokumen yang berteks, beban periksa manusia turun menjadi sekitar
190 status tidak pasti ditambah 52 tanda struktur, kira-kira **empat sampai enam jam kerja** untuk satu orang yang
paham pajak, dengan asumsi satu sampai dua menit per dokumen.

---

## 9. Perkiraan untuk SELURUH peraturan pajak

Dasar hitung:

1. Katalog DJP seluruh kategori: **6.307 dokumen** (dihitung dari jumlah halaman × 5 item, halaman terakhir dihitung persis).
2. Dikurangi KMK kurs dan tarif bunga berkala: **1.430**.
3. Perkiraan dokumen substantif: **4.877**.
4. Rata-rata panjang teks dari sampel PPh: **19.213 karakter per dokumen**.

| Perkiraan | Angka |
|---|---|
| Teks mentah UTF-8 | **89 MB** (rentang wajar 63–134 MB) |
| Setelah gzip, rasio 0,178 dari korpus nyata | **15,9 MB** (rentang 11–24 MB) |
| Yang benar-benar bisa diambil sekarang, dengan rasio ketersediaan teks 51% seperti di PPh | **sekitar 46 MB mentah, 8 MB gzip** |

Asumsi dan batasnya:

- Semua KMK kurs dianggap terdaftar di kategori PPh sehingga dikurangkan sekali. Bila sebagian hanya ada di kategori
  lain, angka substantif ini terlalu tinggi.
- Panjang rata-rata kategori lain dianggap sama dengan PPh. PPN dan KUP kemungkinan mirip; Bea Meterai lebih pendek.
- **Belum termasuk** Surat Edaran (tidak ada di katalog) dan dokumen yang hanya ada di JDIH.
- Satu karakter dihitung satu byte, wajar untuk teks Indonesia yang hampir seluruhnya ASCII.

Untuk produk: **ukuran segini sangat nyaman untuk situs statis.** Korpus PPh saja 1,92 MB gzip, dan seluruh pajak
diperkirakan belasan MB gzip. Pemasangan di HP dan pencarian per pasal di browser kantor tidak akan terhambat ukuran data.

---

## 10. Risiko utama: ketergantungan pada satu sumber

Saat ini **DJP adalah satu-satunya sumber yang bisa diambil.** JDIH berhenti, BPK tertutup, MA melarang lewat robots.txt.

Kalau DJP ikut berhenti bisa diakses:

- **Pengumpulan baru berhenti total.** Tidak ada sumber pengganti yang legal dan otomatis.
- **Produk tidak langsung mati.** Data yang sudah terkumpul tetap bisa dipakai, karena situs statis tidak bergantung
  pada sumber saat dipakai.
- **Yang hilang adalah kesegaran data.** Peraturan baru dan perubahan status tidak masuk. Untuk aplikasi pajak, data
  basi berbahaya: pengguna bisa memakai tarif atau aturan yang sudah dicabut.
- **Mitigasi wajib:** setiap halaman menampilkan tanggal pengambilan per dokumen, dan ada peringatan jelas bila data
  lebih tua dari ambang tertentu, misalnya 30 hari.

Mitigasi lain yang perlu dipertimbangkan sejak awal:

1. **Simpan arsip mentah.** Sudah dilakukan: seluruh HTML asli tersimpan di `raw/`, sehingga penguraian ulang tidak perlu
   mengambil ulang dari jaringan.
2. **Pipa data harus bertahap, bukan pengambilan ulang penuh.** Enumerasi awal PPh saja memakan sekitar 2.900 permintaan
   dan beberapa jam. Pembaruan berkala cukup memeriksa halaman pertama katalog per kategori, mengambil hanya dokumen
   yang nomornya belum ada, dan memeriksa ulang status berkala untuk dokumen yang berstatus berlaku. Perkiraannya
   beberapa puluh permintaan per hari, bukan ribuan.
3. **Minta akses resmi.** Ini jalan keluar yang paling tahan lama: surat ke Biro Hukum Kemenkeu dan DJP untuk meminta
   akses data atau izin penggunaan, sekaligus menyelesaikan soal izin bila aplikasinya dipakai di lingkungan kantor.

---

## 11. Soal hak cipta dan penerbitan ulang

Kutipan lengkap ada di `data/ketentuan_situs.md`. Ringkasnya:

- Kedua situs mengklaim hak cipta atas "isi keseluruhan" situsnya, dan mensyaratkan izin hanya untuk **penggunaan komersial**.
- Keduanya **tidak mengatur penerbitan ulang non-komersial secara eksplisit**, dan **tidak melarang pengambilan otomatis**.
- FAQ JDIH menyebut koleksi regulasinya "dapat dibaca dan/atau disalin".
- Ada dugaan bahwa UU 28/2014 tentang Hak Cipta Pasal 42 menyatakan peraturan perundang-undangan bukan objek hak cipta.
  **Dugaan ini tidak diverifikasi di sini dan tidak boleh dijadikan dasar sebelum dipastikan.** Pemeriksaannya diambil
  alih pemilik proyek, langsung dari sumber resmi. Pencarian dari sesi ini dihentikan, dan tidak ada pengambilan dari
  kompilasi tidak resmi.
- Yang kemungkinan tetap dilindungi meskipun teks peraturannya tidak: abstrak, metadata dan klasifikasi, naskah
  konsolidasi, terjemahan, serta tata letak situs.

---

## 12. Kejujuran data: yang gagal dan yang belum terukur

| Hal | Jumlah | Keterangan |
|---|---|---|
| Detail DJP gagal diambil | **0 tersisa** | 22 dokumen sempat gagal karena koneksi diputus, dan **seluruhnya berhasil diambil** pada putaran 26 September 2026. 12 di antaranya ternyata halaman tanpa teks |
| Halaman DJP tanpa teks | **456 dari 1.036** | Isi sumbernya memang hanya metadata |
| Teks JDIH | 1 dari 614 kandidat | JDIH berhenti |
| Relasi terstruktur JDIH | 1 dokumen | idem |
| Lampiran PDF gagal diunduh | 2 dari 12 percobaan | Koneksi diputus server |
| Ukuran contoh putusan Pengadilan Pajak | belum terukur | Sumbernya tertutup |
| Baris log rusak | 2 | Akibat dua proses menulis log bersamaan, sudah diperbaiki dengan kunci berkas |

Catatan koreksi: angka "74 halaman tanpa teks" yang sempat dilaporkan di tengah jalan berasal dari data parsial
(223 dokumen pertama). Angka yang benar setelah seluruh 1.036 dokumen substantif terambil adalah **456 dari 1.036**.

### Pola kegagalan per jam (WIB)

Seluruh 1.975 permintaan ke pajak.go.id, 21 di antaranya gagal (1,1%):

| Jam WIB | Permintaan | Gagal | Persen gagal |
|---|---|---|---|
| 07 | 420 | 0 | 0% |
| 09 | 204 | 4 | 2,0% |
| 10 | 274 | 8 | 2,9% |
| 11 | 276 | 7 | 2,5% |
| 12 | 77 | 2 | 2,6% |
| 21 | 705 | 0 | 0% |
| 22 | 19 | 0 | 0% |

**Polanya mengikuti jam kerja.** Nol kegagalan pada pukul 07, 21, dan 22; sekitar 2–3% kegagalan pada pukul 09 sampai 12.
Ini konsisten dengan server yang terbebani pengguna biasa di jam kerja, bukan dengan pembatasan yang menyasar kita
(tidak ada satu pun HTTP 403, 429, atau 503). **Rekomendasi: jalankan pipa data di luar jam kerja, misalnya di atas
pukul 21.00 WIB.**

Catatan penting soal batas harian: aturan lama menghitung per hari UTC, dan dalam 24 jam nyata tercatat **1.975
permintaan** ke pajak.go.id, melewati batas 1.500 yang dimaksudkan. Celah ini sudah ditutup.

---

## 13. Pengaman pengambilan data yang sekarang berlaku

Semua di `fetch.py`, dan sudah diuji offline:

1. **Jeda 20 detik** per host.
2. **Batas 1.500 permintaan per host dalam jendela 24 jam bergulir**, dihitung dari log yang persisten, bukan per hari
   kalender, sehingga tidak ada celah dua kuota di sekitar pergantian hari.
3. **Ambang kegagalan**: lebih dari 3 dari 20 permintaan terakhir gagal dengan jenis apa pun berarti host dihentikan.
   Pemutusan koneksi berulang diperlakukan sebagai penolakan. HTTP 401, 403, 429, dan 503 langsung menghentikan host.
4. **Status berhenti tersimpan di berkas** `data/host_stopped.json` beserta alasan dan waktunya, dan hanya bisa dicabut
   manusia. Isinya sekarang: JDIH, setpp, putusan3.mahkamahagung.go.id, dan BPK.
5. **Satu penulis log**: hanya satu proses pengambil boleh berjalan, dan setiap penulisan log memakai kunci berkas.
   Sudah diuji dengan 4 proses menulis 2.000 baris bersamaan, hasilnya 0 baris rusak.
6. Setiap dokumen menyimpan URL sumber dan tanggal pengambilan. Setiap permintaan, berhasil maupun gagal, tercatat di
   `data/fetch_log.jsonl`.

---

## 14. Putaran kecil yang belum dijalankan

Skrip `putaran_kecil.py` sudah siap dan sudah teruji menolak berjalan sebelum waktunya. Isinya 22 dokumen DJP yang gagal
(satu percobaan masing-masing) ditambah sampel sekitar 20 lampiran PDF untuk mengukur OCR, total sekitar 42 permintaan
dengan jeda 20 detik dan batas keras 45 permintaan.

**Sudah dijalankan 26 September 2026, pukul 22.00–22.30 WIB.** Hasilnya:

- 22 dokumen DJP yang sebelumnya gagal: **semuanya berhasil diambil**.
- Sampel lampiran PDF: 10 berhasil, 2 gagal. Angka OCR ada di bagian 5.
- Total 38 permintaan jaringan, jauh di bawah batas keras 45.

**Putaran berhenti sendiri karena pemutus sirkuit**, tepat seperti rancangannya: 4 dari 20 permintaan terakhir gagal
(koneksi diputus server), sehingga `www.pajak.go.id` dihentikan dan dicatat di `data/host_stopped.json`. Tidak ada satu
pun HTTP 403, 429, atau 503; polanya sama dengan kegagalan sporadis sebelumnya. **Entri ini harus dihapus manusia
sebelum pengambilan berikutnya.**

Satu bug ditemukan dan diperbaiki saat putaran: `ocr_sample.py` tidak menangkap galat koneksi per dokumen sehingga
seluruh proses berhenti pada kegagalan pertama. Sekarang galat per dokumen dicatat dan proses lanjut, serta sampel
yang sudah selesai tidak diunduh ulang.

---

## 15. Rekomendasi untuk keputusan desain

1. **Batasi cakupan versi pertama ke peraturan 2010 ke atas.** Di rentang itu ketersediaan teks 100%, dan justru itu yang
   dipakai sehari-hari. Peraturan lama ditampilkan sebagai metadata saja, dengan tautan ke sumber.
2. **Jangan tampilkan satu label status.** Tampilkan klaim tiap sumber, tanggal ambilnya, dan tanda jelas "tidak pasti"
   untuk 17% dokumen yang bermasalah. Untuk aplikasi pajak, salah menyatakan sesuatu masih berlaku lebih berbahaya
   daripada mengaku tidak tahu.
3. **Relasi ditampilkan sebagai petunjuk, bukan kebenaran.** Ketepatannya 80% dan tidak membedakan pencabutan penuh
   dengan pencabutan sebagian. Sertakan kutipan kalimat sumbernya supaya pengguna bisa menilai sendiri.
4. **Cocokkan nomor peraturan di nama berkas lampiran dengan nomor dokumen induknya, dan tandai yang tidak cocok.**
   Nama berkas lampiran di DJP hampir selalu memuat nomor peraturannya, misalnya `Lampiran_PER_09_PJ_2019.pdf` atau
   `Lampiran PMK 80 TAHUN 2024.pdf`, sehingga nomor itu bisa diurai dan dibandingkan otomatis dengan nomor dokumen
   induk. Dasarnya temuan di bagian 5.1b: halaman **PER-20/PJ/2019** melampirkan `Lampiran PER_23_PJ_2020.pdf`, dan
   isinya memang milik PER-23/PJ/2020, yaitu 1 kasus dari 10 sampel. Lampiran yang nomornya tidak cocok **jangan
   ditampilkan begitu saja** sebagai lampiran resmi dokumen itu; tampilkan dengan tanda ketidakcocokan, sebutkan nomor
   yang terbaca dari nama berkas, dan masukkan ke antrean periksa manusia. Nama berkas yang tidak memuat nomor sama
   sekali diperlakukan sebagai tidak terverifikasi, bukan sebagai cocok.
5. **Sediakan jalur koleksi pribadi** untuk Surat Edaran dan putusan Pengadilan Pajak, karena keduanya tidak bisa
   menjadi data bawaan. Hasil OCR unggahan pengguna ditandai belum terverifikasi, tanpa bergantung pada skor keyakinan
   mesin OCR (bagian 5.1a).
6. **Rancang pipa data sebagai pembaruan bertahap sejak awal**, bukan pengambilan ulang penuh, dan jalankan di luar jam
   kerja.
7. **Urus izin tertulis** ke Biro Hukum Kemenkeu dan DJP bila aplikasi dipakai di lingkungan kantor, dan sekaligus
   tanyakan kemungkinan akses data resmi.

---

## 16. Berkas hasil

| Berkas | Isi |
|---|---|
| `data/jdih_metadata.jsonl` | 8.671 metadata dokumen JDIH |
| `data/jdih_pph_candidates.jsonl` | 614 kandidat PPh dari JDIH beserta alasan pemilihan |
| `data/djp_kategori_counts.json` | Jumlah dokumen per kategori DJP |
| `data/djp_pph_list.jsonl` | 2.468 baris daftar PPh DJP |
| `data/djp_pph_detail.jsonl` | 1.036 detail substantif (lengkap) + 428 detail kurs + baris galat lama |
| `data/ketentuan_situs.md` | Kutipan robots.txt dan ketentuan tiap situs |
| `data/fetch_log.jsonl` | Log seluruh permintaan, berhasil maupun gagal |
| `data/host_stopped.json` | Host yang dihentikan beserta alasannya |
| `raw/djp/*.html` | Arsip HTML mentah halaman DJP |
| `text/djp/*.txt`, `text/jdih/*.txt` | Teks hasil ekstraksi |
| `out/korpus_pph.json` | Korpus gabungan: identitas, klaim status, relasi, pecahan pasal |
| `out/pasal/**/*.json` | Hasil pemecahan per pasal, per dokumen |
| `data/ocr_sample.jsonl` | Hasil sampel 12 lampiran PDF: halaman pindaian, skor OCR |
| `out/ocr_contoh/*.txt` | Teks hasil OCR untuk diperiksa sendiri |
| `out/metrik.json` | Seluruh angka di laporan ini |

Skrip: `fetch.py` (pengambil terjaga), `jdih.py`, `jdih_enum.py`, `jdih_docs.py`, `djp_enum.py`, `select_pph.py`,
`ident.py` (identitas peraturan), `pasal.py` (pemecah pasal), `relasi.py` (ekstraksi relasi), `analyze.py`, `metrik.py`,
`ocr.py`, `ocr_sample.py`, `putaran_kecil.py`.
