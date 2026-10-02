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
