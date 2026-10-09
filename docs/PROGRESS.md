# Kemajuan

Satu entri per milestone, ditulis saat milestone itu selesai. Urutan terbaru di atas.
Format entri:

```
## M<n> — <nama milestone>
Tanggal: YYYY-MM-DD
Status: selesai | sebagian (sebutkan apa yang belum)

**Dibangun:** apa yang benar-benar ada sekarang.
**Verifikasi:** bagaimana tiap kriteria selesai di SPEC bagian 7 dibuktikan, dengan perintah atau
angka nyata, bukan klaim.
**Diputuskan sendiri:** keputusan yang diambil tanpa diminta, dengan tautan ke DECISIONS.
**Belum dikerjakan / diketahui pincang:** hal yang ditinggalkan dengan sengaja.
```

---

## M5 — KUP dan PPN
Tanggal: 2026-10-03
Status: sebagian — pengintaian dan pengambil selesai; pengambilan berjalan (dilanjutkan Senin 5 Oktober)

**Dibangun:** `pipeline/polite.py` (pengambil sopan, turunan `poc/fetch.py`), `pipeline/net_guard.py`
(pemeriksaan VPN/proxy lokal), `pipeline/harvest.py` (daftar dan detail KUP/PPN, bisa dilanjutkan,
berkas keadaan `harvest/state.json`, sinyal berhenti `harvest/BERHENTI`). 13 tes luring baru.

**Penolakan bukti konsep (K-049):** DJP tidak pernah menolak (0 kode 4xx/503 dari 1.988 permintaan),
jadi penghentiannya dicabut atas izin pemilik; uji robots.txt HTTP 200. JDIH tidak dicoba: putusnya
TLS seluruh domain 9 jam setelah 884 permintaan berjeda 4 detik tidak bisa dibedakan antara blokir
terhadap kita dan blokir alamat VPN.

**Pengintaian (2026-10-03):** katalog DJP punya kategori KUP (254 halaman, 1.268 baris) dan PPN
(496 halaman, 2.480 baris), sama dengan 21 September.

**Hasil sementara, dihentikan rapi 11.13 WIB karena internet pemilik dimatikan 11.30:**
- Daftar KUP lengkap: 1.268 baris, 1.266 dokumen unik, **275 sudah ada di korpus PPh**, 140 KMK
  kurs/bunga di luar cakupan. Detail yang perlu diambil: 892.
- Daftar PPN: 19 dari 496 halaman (95 dokumen, 69 sudah di korpus PPh). Belum bisa disimpulkan.
- 13 dokumen sejauh ini tercatat di KUP dan PPN sekaligus.
- 285 permintaan ke `www.pajak.go.id` dalam 24 jam; 1 putus koneksi (diulang); tidak dihentikan.

**Perkiraan sisa:** 477 halaman daftar PPN dan sekitar 890 detail KUP plus detail PPN. Dengan
jeda rata-rata 26 detik dan batas 1.500 per 24 jam, butuh sekitar dua putaran malam.

**Belum dikerjakan:** B3–B5 (korpus, situs, kriteria selesai), menunggu data lengkap dan keputusan
pemilik tentang label kategori (K-051).

## Perbaikan setelah M5: jawaban sah, PKP, teratas per kategori
Tanggal: 2026-10-09
Status: selesai dan terbit (acuan median "semua" 6, keputusan pemilik K-080)

**Jawaban sah (K-077):** jawaban ditolak hanya bila semua sumbernya menyatakan tidak berlaku. Aturan
pertama yang lebih ketat ditarik atas keputusan pemilik; kunci jawaban kembali seperti sebelumnya,
kecuali restitusi: KEP-DJP 28/1996 diganti UU 7/2021 Pasal 9 ayat (4b). Restitusi 3 → 40 (garis
dasar 82); karena itu median 45 pertanyaan 5 → 6, melewati acuan 5 yang diukur saat restitusi 3.
**PKP (K-078):** kata PPN, faktur, atau pengusaha mengutamakan Pengusaha Kena Pajak; tidak ada
pertanyaan yang berubah. Singkatan lain tidak perlu aturan.
**Teratas per kategori (K-079):** tampil di atas hasil gabungan, kartu ringkas, urutan tidak berubah;
tes kesetaraan lulus. Peringkat dalam kategori: median 5, 34 dari 45 di 10 besar.
**Tes:** 60 tes lulus setelah acuan median "semua" menjadi 6 (K-080).
**Terbuka (K-081):** kotak definisi untuk pertanyaan "apa itu" ("apa itu PKP" berperingkat 146).

## M5 tahap 2 — PPN terbit; padanan KUP/PPN; daftar bertahap
Tanggal: 2026-10-09
Status: selesai dan terbit

**Korpus (K-072):** 2.614 dokumen: PPh 1.122, KUP 1.112, PPN 992; 1.602 berteks. Ke-1.017 alamat
PPN dalam cakupan tercakup. PPN: 585 berteks, 520 klaim DJP saja, 472 dengan klaim JDIH.
**Set evaluasi:** 10 pertanyaan PPN baru (45 total). Sebelum PPN → sesudah PPN → sesudah padanan dan
jawaban sah restitusi: median semua 8 (35 pertanyaan) → 11 (45) → 5; median PPh 6 → 6 → 6;
10 besar 21/35 → 19/45 → 29/45. Empat penurunan disetujui pemilik (K-075).
**Padanan (K-073):** 10 kelompok masuk, 4 ditolak, 3 tidak berpengaruh. Set uji tahan tidak dipakai.
**Daftar bertahap (K-074):** siap mencari di 6x 4,1–5,7 → 1,5 detik; `/semua/` untuk tanpa
JavaScript.
**Pemeriksa nomor keputusan (K-071):** `npm test` gagal bila ada K-xxx yang tidak ada di DECISIONS.
**Terbuka (K-076):** pertanyaan sehari-hari tertimbun dokumen kategori lain.
**Unduhan:** `cari/data.json` 32,5 MB, 7,6 MB gzip; `index.html` 2,8 MB, 228 KB gzip.
**Tes:** `npm test` 55 lulus; tes Python lulus.

## M5 — teks JDIH PPh dan arsitektur data pencarian
Tanggal: 2026-10-09
Status: selesai dan terbit; PPN (tahap 2) belum dimasukkan

**Teks JDIH PPh (K-068):** terbit atas persetujuan pemilik. JDIH PPh 88/88: 76 berkas terbaca
(29 PDF, 47 HTML), 32 berkas HTTP 404. Dokumen berteks 1.202 → 1.261. Gerbang: median PPh 6,
toleransi turun ≤ 2 peringkat tanpa keluar dari 10 besar.

**Set evaluasi setelah teks JDIH masuk** (sebelum → sesudah): jual rumah 45 → 10, omzet UMKM
19 → 20, makan siang 80 → 84, hibah ke anak 44 → 46, beasiswa 2 → 3, batas tidak kena pajak
29 → 30, orang asing 5 → 6, kontraktor 100 → 105, denda telat lapor 7 → 8, pengungkapan 32 → 33,
restitusi 82 → 83; lainnya sama. Median PPh 5 → 6, median semua 8, 10 besar 21 dari 35.

**Arsitektur data pencarian (K-069):** dua prototipe diukur pada korpus ukur PPh+KUP+PPN (2.614
dokumen, di luar main). Dipilih B, indeks kosakata saat build: siap 1,95 detik, pencarian terberat
366–388 md, memori 35,7 MB pada 6x (mesin lama 5,2–6,0 detik, 2,2–2,6 detik, 70,6 MB). Hasil
identik dengan mesin lama, dibuktikan otomatis (69 kueri, 101.284 baris hasil;
`tests/search/setara.test.mjs` di setiap `npm test`). Unduhan PPh+KUP kini 6,3 MB gzip.

**Halaman daftar (K-070):** `content-visibility: auto` pada kartu; `DOMContentLoaded` di 6x
2,9 → 1,2–1,4 detik. `scripts/measure-load.mjs` diperbaiki (balapan navigasi dan `#keadaan`).

**Catatan proses:** `git worktree remove` sempat menghapus sebagian `node_modules` lewat junction;
dipulihkan dengan `npm ci`. Entri K-066 dan K-067 ternyata tidak pernah tertulis karena perintah
berantai yang gagal; ditulis sekarang dengan catatan itu.

## M5 tahap 1 — KUP terbit
Tanggal: 2026-10-09
Status: tahap 1 (KUP) selesai dan terbit; tahap 2 (PPN) menunggu

**Pengambilan:** detail KUP 892/892; daftar PPN 496/496 (2.480 baris, 2.459 dokumen unik, 617 sudah
di korpus PPh, 1.442 KMK kurs/bunga); detail PPN 810/810. Sebagian besar diambil pemilik 6–8
Oktober. JDIH: status KUP 441/441, status PPN 472/472, teks PPh 84/88 (K-062, K-066).
**Aturan JDIH (K-062):** sama dengan DJP; 404 = tidak ada di sumber. Uji 5 alamat acak: kelimanya 200.

**Korpus (K-060):** 1.970 dokumen (PPh 1.122, KUP 1.112, keduanya 264), 1.202 berteks, 16.473
berkas, deterministik (sidik jari sama dua kali). Ke-1.126 alamat KUP dalam cakupan tercakup dalam
1.112 dokumen (10 dokumen punya lebih dari satu alamat). KUP: 846 berteks, 671 dengan status satu
sumber, 441 dengan klaim JDIH. Status satu sumber tampil "klaim DJP saja; belum dibandingkan dengan
sumber lain, diambil <tanggal>".

**Situs:** saringan Kategori, "Dari daftar KUP katalog DJP" di kartu dan halaman dokumen, masa
berlaku dari halaman JDIH di bagian Sumber, label "Tanpa teks di situs ini". Lebar 320 px tanpa
gulir samping.

**Set evaluasi (K-063):** 35 pertanyaan; median PPh 5 (acuan 5), median semua 8, 10 besar 20 dari
35. Empat penurunan disetujui pemilik. `npm test` 52 lulus; tes Python lulus.
**Set uji tahan (K-064):** pertanyaan 5 tetap 1; pertanyaan 7 kini berjawaban KUP, peringkat 20
(tidak bersih); pertanyaan 1 turun 3 → 9.
**Beban (K-067):** data 21,2 MB (3,6 MB gzip); siap 1,0 / 3,5 / 4,7 detik pada 1x / 4x / 6x; heap
54,6 MB.

**Ditahan:** teks 75 berkas JDIH PPh (K-066), karena median PPh memburuk; menunggu pemilik.

## M5 — KUP dan PPN, putaran 5 Oktober
Tanggal: 2026-10-05
Status: sebagian — dihentikan rapi 14.20 WIB (internet pemilik mati 14.30)

**DJP, detail KUP: 873 dari 892**, 19 tersisa dan 9 menunggu diulang (putus koneksi biasa). Pagi
tadi sempat macet karena jendela kegagalan yang tidak pernah kedaluwarsa (K-057, sudah diperbaiki).
Daftar PPN masih 19/496. 586 permintaan dalam 24 jam; tidak dihentikan.

**JDIH, berjalan bersamaan (K-058): DIHENTIKAN 14.07 WIB.** 142 permintaan berhasil berjeda 20
detik, lalu satu `ReadTimeout` (120 detik) pada `/dok/192-pmk-03-2018`. Sesuai aturan pemilik
(penolakan sekecil apa pun = berhenti total, tanpa coba ulang), JDIH dihentikan di
`harvest/jdih/host_stopped.json`; hanya pemilik yang mencabutnya. Antrean: status KUP 140 dari 441,
status PPN 0 dari 16, teks PPh 0 dari 106. 144 permintaan dalam 24 jam.

**Mutu PDF (K-055):** pemeriksa siap (`scripts/jdih-pdf-text.mjs`, aturan dan kode yang sama dengan
koleksi pribadi); belum ada berkas JDIH yang diambil, jadi belum ada hasil nyata.

**robots.txt (K-056):** DJP dan JDIH tanpa Crawl-delay; jeda tetap 20 detik.
**Penghematan dari halaman daftar (K-059):** tidak ada yang aman; tidak diubah.

**B3/B4 tahap KUP (K-060), di cabang lokal `m5-kup`, belum di-push dan belum terbit:** korpus 1.970
dokumen (PPh 1.122, KUP 1.112), saringan Kategori, label asal daftar. Belum terbit karena set
evaluasi memburuk (K-061) dan detail KUP belum lengkap.

## M5 — KUP dan PPN, lanjutan
Tanggal: 2026-10-04
Status: sebagian — detail KUP berjalan; dihentikan rapi 11.28 WIB (internet pemilik mati 11.40)

**Keputusan pemilik hari ini:** urutan menjadi detail KUP, sisa daftar PPN, detail PPN (K-053);
M5 dua tahap, KUP terbit dulu (SPEC bagian 7); label kategori boleh sebagai asal daftar, tiga nilai
saja (K-051, SPEC bagian 9); tanda "cocok lemah" yang tidak dipasang diterima (K-044).

**Pengambilan DJP** (putaran 09.52–11.28 WIB, 274 permintaan): detail KUP **269 dari 892**, 623
tersisa, 5 putus koneksi menunggu diulang. Tidak ada 4xx/503; host tidak dihentikan. Daftar PPN
masih 19/496.

**JDIH (K-054):** blokir lama dicabut atas izin pemilik; uji 2 permintaan (robots.txt 200, halaman
PMK 81/2024 200), tanpa penolakan. Keadaan dan batas JDIH terpisah di `harvest/jdih/`.
Pengintaian luring dari daftar JDIH bukti konsep (`pipeline/jdih_scout.py`):
- KUP: 448 dari 1.264 nomor DJP ada di JDIH, semuanya berstatus JDIH (244 Berlaku, 204 Tidak
  Berlaku), jadi untuk 448 dokumen itu status bisa dua sumber. Sisanya (kebanyakan PER/SE DJP)
  hanya klaim DJP.
- PPN (dari 95 baris daftar yang sudah ada): 46 ada di JDIH.
- PPh JDIH-only: 99 dokumen, semuanya tanpa teks di korpus, semuanya punya berkas teks penuh di
  JDIH: 69 HTML (teks pasti), 30 hanya PDF (lapisan teks baru diketahui saat diambil).

**Permintaan 24 jam:** `www.pajak.go.id` 275, `jdih.kemenkeu.go.id` 2.

## Perbaikan sebelum M5
Tanggal: 2026-10-03
Status: selesai

**Urutan milestone diubah pemilik:** M5 KUP dan PPN, M6 pemasangan dan luring, M7 kategori lain dan
pipa malam, M8 rilis. SPEC bagian 3, 5, 7, 8 diperbarui dengan riwayat bertanggal (K-048).

- **Rujukan koleksi mengikuti korpus (K-042):** sidik jari korpus di `cari/data.json`; rujukan
  dicocokkan ulang saat sidik jari berubah. Tes: rujukan PMK 81/2024 yang tadinya teks menjadi
  tautan saat korpus "baru" memuatnya.
- **TER (K-046):** masuk `istilah.json`; pertanyaan 4 set uji tahan 11 → 1 dan ditandai tidak bersih.
- **Cocok lemah (K-044):** diuji, tidak dipasang. Tidak ada ambang yang menandai pertanyaan 6 dan 10
  tanpa menandai jawaban benar: hasil teratas pertanyaan 6 hanya kehilangan 33% bobot kata,
  sedangkan tujuh jawaban benar kehilangan 43–66%.
- **Pajak daerah (K-045):** `pajak-daerah.json`; hanya pertanyaan 6 dan 10 yang memicu keterangan,
  PBB-P5L dan PPnBM kendaraan tidak.
- **Mutu teks PDF (K-043):** tiruan PDF tanpa ToUnicode (pdf.js mengembalikan 775 karakter acak);
  dinilai tidak terbaca (0% kata dikenal, 14% karakter janggal), diperlakukan seperti pindaian,
  bisa ditimpa pengguna. Dokumen tiruan normal 91–97% kata dikenal; 10% korpus yang ditahan dari
  kosakata minimal 86%.
- **Pesan penyimpanan (K-047):** penjelasan bila belum permanen; diminta ulang otomatis saat terpasang.
- **Verifikasi:** `npm test` 51 tes; `scripts/verify-collection.mjs` lulus dengan 11 dokumen tiruan
  (cadangan 105.315 byte sama persis, 10 dari 10 berkas cocok, konsol 0 pesan, kebocoran 0).

## M4 — koleksi pribadi
Tanggal: 2026-10-02
Status: selesai

**Dibangun:**
- Halaman `/koleksi/`: impor PDF, .txt, atau teks tempel; isian jenis, nomor, tanggal, perihal,
  catatan; daftar koleksi; tampilan dokumen di `#dok=<id>`; status penyimpanan; ekspor, pulihkan
  (gabung atau ganti), dan hapus semua. Tautan "Koleksi pribadi" di setiap halaman.
- `src/lib/collection/`: ekstraksi (pdf.js dimuat hanya saat impor PDF, di-host di situs sendiri),
  rujukan ke peraturan publik, catatan dan payload pencarian, cadangan, IndexedDB.
- Pencarian di halaman daftar mencari koleksi dengan mesin yang sama, menampilkannya di bagian
  sendiri yang tampil berbeda, dengan saringan Sumber dan Jenis koleksi. Setiap dokumen koleksi
  berlabel "Belum terverifikasi" di kartu hasil, daftar koleksi, dan halaman dokumennya.
- 12 dokumen tiruan (SE, ND, penegasan, putusan × PDF berteks, PDF gambar, .txt) dari
  `scripts/make-mock-documents.mjs`.
- `scripts/verify-collection.mjs`: uji ujung ke ujung di Chrome dengan rekaman jaringan.

**Verifikasi:**
- Ekstraksi: keempat PDF berteks terbaca (440–769 karakter); keempat PDF gambar memberi 0 karakter,
  memunculkan peringatan "tidak punya lapisan teks", dan hanya tercari lewat isian.
- Rujukan: SE tiruan menautkan PMK 168/2023, PP 58/2023, PER-DJP 11/2025, masing-masing dengan
  kalimatnya; PMK 81/2024 tampil sebagai teks "tidak ada di korpus PPh situs ini".
- Pencarian: "majelis" menemukan putusan berteks tetapi tidak versi pindaiannya; "Perihal tiruan
  putusan pindai" menemukan versi pindaian di peringkat 1; "SE-901/PJ/2026" hanya mengenai koleksi.
- Pulang-pergi: impor → ekspor → hapus semua → pulihkan (ganti) → ekspor lagi: kedua cadangan
  70.656 byte dan sama persis; 9 dari 9 berkas tersimpan cocok SHA-256 dengan berkas tiruan.
- Invarian 7 (K-041): 0 permintaan jaringan saat mencari, membuka dokumen, mengekspor, menghapus,
  memulihkan; saat impor 2 permintaan berkas statis pdf.js pada PDF pertama. Tidak ada id atau isi
  dokumen di URL permintaan, isi permintaan, judul tab, atau konsol (konsol 0 pesan).
- Tampilan: lebar 320px tanpa gulir samping di halaman koleksi dan hasil pencarian.
- Tes: `npm test` 41 tes (11 baru untuk koleksi: ekstraksi, rujukan, pencarian, cadangan, tiruan).

**Diputuskan sendiri:** K-034 sampai K-041.

**Belum dikerjakan / diketahui pincang:**
- Rujukan dihitung terhadap korpus saat impor dan tidak diperbarui otomatis (K-038).
- Cadangan tidak terenkripsi (K-040).
- Dokumen tidak bisa disunting setelah diimpor; hanya dihapus dan diimpor ulang.
- Impor PDF pertama di tiap kunjungan masih mengambil berkas pdf.js; di M5 berkas itu disimpan di
  perangkat.

## Perbaikan sebelum M4
Tanggal: 2026-10-02
Status: selesai

**Kueri di fragmen:** pencarian dan saringan kini di `#q=...`; tautan lama `?q=` dibaca sekali lalu
ditulis ulang. Dibuktikan di browser: setelah tautan lama dibuka, memuat ulang hanya meminta
`GET /tax/` tanpa kueri. K-028 diperbarui.

**PP 34/2016:** bukan catatan kembar dan bukan salah angka laporan. Dokumen itu hanya tercatat di
JDIH (tidak ada di 2.468 baris daftar PPh DJP), dan "teks 2010-an 100%" di LAPORAN dihitung atas
katalog DJP saja; SPEC bagian 5 menghilangkan kata "di DJP". Di korpus ada 38 dokumen 2010-an dan
9 dokumen 2020-an yang hanya tercatat JDIH dan tidak berteks. Usulan perbaikan kalimat SPEC di
K-032. Padanan khusus judul dokumen tanpa teks: "jual rumah kena pajak berapa" 157 → 42, tidak ada
pertanyaan lain yang berubah; dipakai (K-032).

**Set evaluasi:** kutipan "buruh harian lepas" diganti ke PMK 168/2023 Pasal 5 dan PP 58/2023 Pasal
2; "warisan" diterima pemilik; semua tetap "belum diverifikasi ahli". Median 5, 10 besar 18 dari
25, tidak ada yang memburuk.

**Set uji tahan (K-033):** 10 pertanyaan pemilik di `tests/search/kasus-tahan.json`. Golongan (a)
6 pertanyaan: peringkat jawaban 3, 1, 1, 11, 1, 1. Golongan (b) 2: denda telat SPT (UU KUP Pasal
7) dan pemadanan NIK (PMK 112/2022), keduanya di luar cakupan v1. Golongan (c) 2: pajak kendaraan
bermotor dan PBB-P2, pajak daerah. Penilaian kartu hasil untuk (b) dan (c) ada di laporan sesi.

## Koreksi M3
Tanggal: 2026-10-02
Status: selesai

**Terbit:** commit `4e531d4` (koreksi M2) dan `0397548` (M3) didorong ke `main`. Alur Actions
`37013762181` lulus, termasuk langkah `npm test` (24 lulus, 0 gagal) sebelum build. Dicek dengan
curl pada `https://mufuyumoku.github.io/tax/`: halaman daftar memuat kotak cari, HTTP 200,
`Content-Encoding: gzip`, 105.979 byte dikirim (1.169.211 byte dibuka); `cari/data.json` HTTP 200,
`Content-Type: application/json`, `Content-Encoding: gzip`, 1.874.515 byte dikirim (10.536.888
byte dibuka). Pages tidak mengirim brotli.

**Padanan kata (K-030):** set evaluasi 25 pertanyaan kasus berkosakata awam di
`tests/search/kasus.json`, tiap jawaban dengan pasal dan kutipan yang dicocokkan otomatis ke
korpus; 3 ditandai "perlu dicek pemilik". Garis dasar dicatat sebelum perubahan. Padanan di
`src/data/search/padanan.json` (11 kelompok, bobot 0,6), singkatan THR/PHK/JHT/WNA/WNI di
`istilah.json`. Hasil: median 11 → 5, 10 besar 12 → 18 dari 25, tidak ada yang memburuk dari
garis dasar. Satu penurunan dibanding varian tanpa padanan: "THR karyawan kena pajak tidak" 1 → 6
akibat karyawan=pegawai (garis dasarnya 84). Set evaluasi masuk `npm test` (28 tes).

**Beban di HP (K-031):** heap worker 28,6 MB; siap mencari 0,30 / 1,06 / 2,03 detik dan satu
pencarian 25–47 / 117–208 / 188–381 md pada CPU 1x / 4x / 6x (mesin diukur di thread utama karena
DevTools tidak bisa memperlambat worker). Proyeksi M6 sekitar 17 detik sampai siap dan heap
sekitar 240 MB pada 6x; dicatat sebagai risiko terbuka dengan pilihannya, tidak dirombak.

**Pengintaian M4:** `samples-local/` hanya berisi `README.md` milik proyek sendiri. Belum ada satu
pun dokumen kiriman calon pengguna, jadi jumlah PDF berlapis teks versus pindaian adalah 0 dan 0.
Pustaka pembaca PDF (pypdf, PyMuPDF) juga belum terpasang di mesin ini.

**Diputuskan sendiri:** K-030, K-031; K-027 diperbarui statusnya.

## M3 — pencarian
Tanggal: 2026-10-02
Status: selesai

**Dibangun:**
- Pencarian teks penuh di perangkat (`src/lib/search/`): normalisasi bersama untuk build dan browser,
  pengurai kueri (nomor, istilah, frasa bertanda kutip, kata umum), mesin peringkat, potongan teks
  berkonteks. Berjalan di Web Worker atas satu berkas `cari/data.json` yang dibuat saat build.
- Kotak cari dan saringan jenis, dari/sampai tahun, dan status (termasuk "Tidak pasti") di halaman
  daftar. Kueri dan saringan tersimpan di URL.
- Kartu hasil: label, jenis, status, tahun, alasan cocok (nomor, judul, menyebut nomor ini), konsep
  yang cocok dan yang tidak ditemukan, sampai tiga pasal yang cocok dengan potongan teks bertanda
  dan tautan langsung ke halaman pasalnya. Dokumen tanpa teks tampil dengan keterangan dan tautan ke
  sumber.
- Berkas yang bisa disunting: `src/data/search/istilah.json`, `kata-umum.json`, `ocr.json`, beserta
  `README.md`. Skrip bantu: `scripts/search-demo.mjs`, `scripts/search-rank.mjs`,
  `scripts/search-ocr-list.mjs`.
- Tes: `npm test`, 24 tes (unit dan integrasi pada korpus nyata), dijalankan CI sebelum build.

**Verifikasi:**
- Tanpa permintaan jaringan: setelah halaman dimuat, server pratinjau dihentikan; `fetch` ke server
  gagal, sedangkan empat pencarian berikutnya tetap memberi hasil.
- Bentuk nomor: "PMK 168/2023", "168/PMK.03/2023", "PMK-168/PMK.03/2023" → PMK 168/2023 di peringkat
  1; "PER-11/PJ/2025", "PER 11 2025" → PER-DJP 11/2025 di peringkat 1, diikuti PER-DJP 3/2026 yang
  menyebut nomor itu.
- Dokumen tanpa teks: "PTKP" menemukan KMK 564/KMK.03/2004, KMK 361/KMK.04/1998, dan lainnya lewat
  judul; "PP 20/2026" menemukan catatan JDIH tanpa teks di peringkat 1.
- Singkatan: "PPh 21" dicari sebagai PPh 21 = PPh Pasal 21 = Pajak Penghasilan Pasal 21 (134
  dokumen); "PTKP", "NPWP", "KUP" menemukan bentuk panjangnya.
- OCR: `"rencana penanaman modal baru"` menemukan PMK 130/2020 Pasal 14 yang di sumber tertulis
  "penanarnan", dan potongan teksnya menampilkan "penanarnan ... dimaksucl clalam" apa adanya.
- Saringan: "natura" + status tidak pasti → 9 dokumen, semuanya berstatus tidak pasti; saringan
  jenis dan tahun diuji di tes integrasi.
- Layar 320px: `scrollWidth` = `clientWidth` = 320 pada halaman hasil.
- Ukuran indeks: `cari/data.json` 10.536.888 byte, 1.786.472 byte setelah gzip. Memuat dan
  menormalkan sekitar 0,7 detik di desktop; satu pencarian 5–60 md.

**Pencarian berbentuk kasus**, "karyawan dapat bonus tahunan" (508 dokumen): tiga teratas UU 7/1983
Pasal 6 ("gaji karyawan termasuk bonus" sebagai biaya), PER-DJP 15/2006 dan KEP-DJP 545/2000 ("bonus,
premi tahunan" sebagai penghasilan tidak teratur), keduanya sudah tidak berlaku. Peraturan yang
berlaku untuk kasus itu, PMK 168/2023, baru di peringkat 16; PER-16/PJ/2016 di 39; PP 58/2023
(tarif efektif) di 418. Penyebab utamanya kosakata: peraturan menulis "pegawai", bukan "karyawan".
Dengan padanan "karyawan = pegawai" (diuji, tidak disimpan) PMK 168/2023 naik ke peringkat 3.

**Diputuskan sendiri:** K-023 sampai K-029 di `docs/DECISIONS.md`. Koreksi M2 sebelum M3: K-020
sampai K-022.

**Belum dikerjakan / diketahui pincang:**
- Pertanyaan kasus bergantung pada kata yang sama dengan teks peraturan. Tidak ada padanan kata
  biasa di daftar istilah; itu keputusan pemilik proyek (K-027).
- Data pencarian dimuat ulang setiap kali halaman daftar dibuka; penyimpanan di perangkat baru di M5.
- Halaman dokumen dan pasal belum punya kotak cari sendiri; pencarian hanya dari halaman daftar.

## M2 — halaman
Tanggal: 2026-09-28
Status: selesai

**Dibangun:**
- Halaman daftar (`/`): 1.122 kartu, pengurutan tahun/judul/jenis/status di browser, status dan
  tahun terlihat, dokumen tanpa teks ditandai beserta tautan ke sumbernya.
- Halaman dokumen (`/dokumen/<id>/`): identitas, klaim status tiap sumber dengan tanggal ambil,
  relasi dengan kutipan kalimat sumbernya, lampiran sebagai tautan PDF, dan batang tubuh per pasal.
- Halaman pasal (`/pasal/<id>/`): satu unit punya alamat sendiri, dengan tautan ke dokumen induk,
  navigasi antar unit, dan sumber teksnya.
- Total 8.508 halaman statis, terbangun dalam sekitar 25 detik.

**Verifikasi:**
- Layar sempit: enam halaman contoh diukur pada lebar 320px, `scrollWidth` sama dengan
  `clientWidth`, jadi tidak ada gulir samping. Diperiksa juga pada 375px.
- Tautan: pemeriksaan seluruh 8.508 halaman menemukan 0 tautan internal mati.
- Aturan tampilan dibuktikan dengan dokumen nyata; lihat laporan sesi M2.

**Diputuskan sendiri:** K-016 sampai K-019 di `docs/DECISIONS.md`.

**Belum dikerjakan:** pencarian (M3). Daftar hanya bisa diurutkan, belum bisa dicari atau disaring.

## M1 — pipa data
Tanggal: 2026-09-27
Status: selesai

**Dibangun:**
- Paket `pipeline/`: `identity`, `pasal`, `status`, `relations`, `attachments`, `checks`, `build`,
  `fingerprint`. Tanpa permintaan jaringan; masukannya arsip `poc/`.
- Korpus `corpus/`: 1.122 berkas dokumen, 7.385 berkas pasal, `index.json`, `meta.json`.
- Tes: 39 tes untuk pemecah pasal, penyusun status, pencocokan lampiran, dan pemeriksa invarian.

**Verifikasi:**
- Deterministik: dua kali `python -m pipeline.build` memberi sidik jari sama,
  `670b4e33...` untuk 8.509 berkas. Korpus ditulis ber-LF agar sama di semua sistem.
- Cocok dengan LAPORAN: 1.122 dokumen, 573 berteks, 549 tanpa teks, 190 status tidak pasti,
  52 dokumen bertanda mutu.
- Unit pasal 6.253 versus 6.319 di LAPORAN; selisihnya terjelaskan penuh: 62 dari posting ganda
  yang dulu dihitung per teks (K-013) dan 4 dari bug pemecah yang diperbaiki (K-015).
- Invarian dijaga kode: `checks.py` menggagalkan build bila ada rekaman tanpa URL/tanggal, status
  yang tidak berasal dari klaim sumber, dokumen tanpa teks tanpa alasan, relasi tanpa kutipan, atau
  lampiran tanpa hasil pencocokan. Delapan tes memastikan pemeriksa itu benar-benar gagal.
- Tes: `python -m unittest discover -s pipeline/tests -t .` → 39 tes, OK.

**Diputuskan sendiri:** K-012 sampai K-015 di `docs/DECISIONS.md`.

**Belum dikerjakan:** halaman situs (M2). Korpus belum dipakai oleh Astro sama sekali.

## M0 — kerangka
Tanggal: 2026-09-27
Status: selesai

**Dibangun:**
- Repositori `tax` dengan identitas git per repo (MufuyuMoku + alamat noreply akun itu).
- Kerangka situs Astro statis: `astro.config.mjs`, `src/layouts/Base.astro`,
  `src/pages/index.astro`, `src/styles/global.css`. Satu halaman, tanpa data peraturan.
- Folder `pipeline/` sebagai tempat pipa data (diisi pada M1, berisi README saja).
- Arsip bukti konsep `poc/` masuk ke dalam repo.
- `docs/SPEC.md`, `CLAUDE.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`.
- Alur penerbitan GitHub Actions ke GitHub Pages.

**Verifikasi:**
- Situs bisa dibangun: `npx astro build` menghasilkan `dist/index.html` (1 halaman, 3,45 detik).
- Alur GitHub Actions berhasil: run `36281837583`, kesimpulan `success`.
- Halaman benar-benar hidup: `curl https://mufuyumoku.github.io/tax/` menjawab **HTTP 200** dan
  memuat isi halaman; diperiksa juga lewat browser.
- Invarian 9 ada di halaman terbit: kalimat "bukan situs resmi pemerintah" ditemukan di HTML hasil
  terbit, beserta penyebutan kedua sumber data.
- Sumber penerbitan adalah GitHub Actions, bukan branch: `gh api repos/MufuyuMoku/tax/pages`
  mengembalikan `build_type: workflow`.
- Identitas git per repo, global tidak tersentuh: `git config --local user.email` berisi alamat
  noreply MufuyuMoku, sedangkan `git config --global user.email` tetap milik akun lain.

Catatan: percobaan deploy pertama gagal (`HttpError: Not Found`) karena GitHub Pages belum
diaktifkan saat push pertama. Setelah Pages diaktifkan dengan sumber Actions, alur yang sama
dijalankan ulang dan berhasil.

**Diputuskan sendiri:** K-001 sampai K-006 di `docs/DECISIONS.md`.

**Belum dikerjakan:** semua fitur. M0 memang hanya kerangka.
