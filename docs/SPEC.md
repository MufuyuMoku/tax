# Tax — spesifikasi

Versi 1, disusun pada M0 (2026-09-27). Sumber rujukan utama: `poc/LAPORAN.md`, laporan bukti konsep
yang memuat seluruh angka dan temuan yang mendasari keputusan di sini. Setiap rujukan "laporan"
di bawah menunjuk ke berkas itu.

**Riwayat perubahan**

- **2026-10-03**, keputusan pemilik atas permintaan pengguna:
  - Cakupan v1 menjadi PPh, KUP, dan PPN (bagian 3).
  - Urutan milestone diubah: M5 KUP dan PPN, M6 pemasangan dan luring, M7 kategori lain dan pipa
    pembaruan malam, M8 penyiapan rilis (bagian 7).
  - Kalimat ketersediaan teks di bagian 5 diperjelas: angka 100% hanya berlaku untuk katalog DJP
    (K-032).
  - Syarat jam pengambilan "di atas pukul 21.00 WIB" dicabut, dan VPN dinyatakan termasuk proxy
    (bagian 8). Alasannya: pola kegagalan per jam di laporan bagian 12 kemungkinan tercampur
    pemakaian VPN di mesin pemilik saat itu.
- **2026-10-10**, keputusan pemilik:
  - Urutan: M8 (penyiapan rilis) dikerjakan dan diterbitkan lebih dulu sebagai v1.0.0, dengan
    cakupan PPh, KUP, PPN dan nama tampilan "Saku Pajak". M7 (kategori lain dan pembaruan
    bertahap) dimulai bersamaan tetapi terbit sebagai v1.1 (bagian 7).
- **2026-10-04**, keputusan pemilik:
  - M5 dikerjakan dalam dua tahap: KUP dulu (diambil, masuk korpus, dan terbit), PPN menyusul
    (bagian 7).
  - Label kategori boleh tampil sebagai keterangan asal daftar, dengan batasnya (bagian 9, K-051).

---

## 1. Apa ini

Tax adalah alat pencari peraturan pajak Indonesia.

- **Pengguna:** petugas pajak di Kantor Pelayanan Pajak.
- **Dipakai di dua tempat:** browser komputer kantor yang tidak bisa memasang aplikasi apa pun, dan
  HP pribadi yang dipasangi situs ini untuk dipakai tanpa internet.
- **Kebutuhan inti:** menemukan pasal yang tepat dengan cepat, dan tahu seberapa bisa dipercaya
  status keberlakuannya.

## 2. Bentuk

- Situs statis **Astro**, di-host **GitHub Pages**, sumber penerbitan **GitHub Actions** (bukan branch).
- **Pencarian berjalan di perangkat.** Tidak ada server, tidak ada akun, tidak ada telemetri, tidak
  ada permintaan jaringan saat dipakai.
- Astro statis murni: tanpa framework UI, CSS biasa dengan CSS variables, tanpa Tailwind.
- Bahasa: kode, identifier, komentar, dan pesan commit dalam bahasa Inggris. Dokumen dan seluruh
  teks antarmuka dalam bahasa Indonesia.

## 3. Cakupan v1

**Kategori PPh, KUP, dan PPN.** Data PPh sudah lengkap terkumpul di `poc/`, jadi v1 dimulai dari data
itu. KUP dan PPN diambil di M5, didahulukan atas permintaan pengguna (terutama KUP). Kategori pajak
lain masuk di M7.

Ukuran data PPh yang sudah ada (laporan bagian 4):

| Hal | Angka |
|---|---|
| Dokumen substantif unik | 1.122 |
| Punya teks lengkap | 573 |
| Tanpa teks di sumber | 549 |
| Unit pasal / diktum | 6.319 |
| Teks mentah | 10,65 MB (1,92 MB setelah gzip) |
| Berstatus tidak pasti | 190 (17%) |

**KMK kurs dan tarif bunga berkala di luar cakupan**, 1.430 dokumen. Jumlahnya dicatat, isinya tidak
diproses dan tidak ditampilkan.

## 4. Invarian

Tidak boleh dilanggar, apa pun alasannya. Setiap milestone diperiksa terhadap daftar ini.

1. **Status tidak pernah ditebak.** Klaim tiap sumber ditampilkan apa adanya beserta tanggal
   ambilnya. Yang bertentangan ditandai tidak pasti. 17% dokumen berstatus tidak pasti dan memang
   ditampilkan begitu. Tidak ada satu label status tunggal yang disintesis sendiri oleh aplikasi.
2. **Tiap dokumen selalu membawa URL sumber dan tanggal pengambilan.** Berlaku di data maupun di
   tampilan.
3. **Dokumen tanpa teks tetap muncul** di daftar dan hasil pencarian, dengan keterangan bahwa
   teksnya tidak tersedia di sumber dan tautan ke aslinya. Tidak pernah disembunyikan.
4. **Lampiran pindaian ditampilkan sebagai PDF asli**, tidak pernah sebagai teks OCR.
5. **Relasi antarperaturan adalah petunjuk, bukan kebenaran.** Ketepatannya 80% dan tidak
   membedakan pencabutan penuh dari sebagian, jadi selalu disertai kutipan kalimat sumbernya.
6. **Nomor peraturan di nama berkas lampiran dicocokkan dengan nomor dokumen induknya.** Yang tidak
   cocok ditandai dan tidak ditampilkan begitu saja. Nama berkas tanpa nomor diperlakukan sebagai
   tidak terverifikasi, bukan cocok.
7. **Koleksi pribadi tidak pernah meninggalkan perangkat.** Berlaku untuk fitur apa pun yang
   ditambahkan kemudian.
8. **Skor keyakinan OCR tidak pernah dipakai sebagai penentu kelayakan.** Alasannya di laporan
   bagian 5.1a: 0,93–0,99 pada teks yang jelas rusak.
9. **Situs menyatakan dengan jelas bahwa ia bukan situs resmi pemerintah**, dan menyebut sumber
   datanya.
10. **Dokumen yang dikirim calon pengguna tidak pernah masuk ke repo, ke data bawaan situs, atau ke
    commit mana pun.** Berkas seperti itu hanya dipakai lokal sebagai bahan uji fitur koleksi
    pribadi, di folder `samples-local/` yang ditutup `.gitignore`.
    Alasannya: dokumen itu — Surat Edaran, nota dinas, surat penegasan, putusan Pengadilan Pajak —
    berasal dari sistem internal kantor penggunanya. Menerbitkannya di situs publik persis
    kebocoran yang membuat alat ini diminta sejak awal.
    Berlaku juga untuk turunannya: kutipan, potongan teks, indeks pencarian, dan berkas uji yang
    dibuat dari dokumen itu. Bila sebuah uji butuh contoh, buat contoh tiruan yang ditulis sendiri.

## 5. Temuan data yang membentuk rancangan

Ringkasan dari laporan; angka lengkapnya ada di sana.

- **Teks hanya lengkap untuk 2010 ke atas, dan hanya untuk dokumen di katalog DJP.** Untuk dokumen di
  katalog DJP, teks 2010-an dan 2020-an tersedia 100%; 2000-an 49%, 1990-an 10%, 1980-an 4%.
  Dokumen yang hanya tercatat di JDIH tidak berteks, karena JDIH berhenti sebelum teksnya diambil.
  Dokumen tanpa teks tampil sebagai metadata dengan tautan ke sumber.
- **Status tidak sejajar antar sumber.** Dari 337 dokumen yang bisa dibandingkan, 121 (36%) berbeda.
  Kosakata DJP "Diubah/Disempurnakan/Dicabut sebagian" mencampur dua keadaan hukum yang berbeda.
- **Teks DJP sebagian hasil OCR yang tidak dikoreksi.** 23 dari 570 berkas memuat galat khas OCR
  (`clan` untuk `dan`, `rnenteri` untuk `menteri`). Pencarian harus tahan terhadap ini; perbaikan
  otomatis hanya boleh menyentuh kata yang tidak ada di kamus dan wajib menyimpan teks asli.
- **Surat Edaran Dirjen Pajak praktis tidak ada** di sumber resmi yang bisa diambil, dan **putusan
  Pengadilan Pajak** tertutup. Keduanya hanya bisa masuk lewat koleksi pribadi pengguna (M4).
- **Satu sumber tersisa.** JDIH berhenti bisa diakses, BPK dan Direktori Putusan MA tertutup.

## 6. Bentuk data (garis besar, dirinci di M1)

Korpus baku hasil pipa data, dalam dua lapis:

- **Dokumen:** identitas (jenis, nomor, tahun, varian ralat/konsolidasi), judul, tanggal,
  daftar klaim status per sumber, daftar rekaman sumber (URL + tanggal ambil), lampiran beserta
  hasil pencocokan nomornya, relasi beserta kutipan kalimatnya, dan penanda mutu.
- **Pasal:** unit batang tubuh atau diktum, label pasal apa adanya, teks, penanda struktur janggal,
  dan penunjuk ke dokumen induk.

Aturan yang mengikat: tidak ada nilai yang disintesis tanpa jejak sumbernya, dan setiap penanda
mutu dari bukti konsep dibawa terus, tidak dibuang.

## 7. Milestone dan kriteria selesai

Satu milestone per sesi. Jangan lompat ke depan. Jangan membuat antarmuka untuk lapis yang belum
ada datanya.

### M0 — kerangka
Repo, CLAUDE.md, SPEC.md, kerangka Astro, deploy Pages kosong yang sudah hidup.
**Selesai bila:** repo berisi situs Astro yang bisa dibangun, folder `pipeline/`, arsip `poc/`,
dokumen di `docs/`; alur GitHub Actions berhasil dan halaman kosong benar-benar bisa dibuka di URL
Pages-nya.

### M1 — pipa data
Skrip di `poc/` dirapikan menjadi paket tetap di `pipeline/`. Keluarannya korpus baku per dokumen
dan per pasal. **Tanpa pengambilan jaringan baru.**
**Selesai bila:** pipa bisa dijalankan ulang dari data `poc/` dan menghasilkan korpus yang sama
(deterministik); jumlah dokumen, pasal, dan status cocok dengan angka laporan; setiap rekaman
membawa URL sumber dan tanggal ambil; ada pemeriksaan yang gagal bila invarian dilanggar.

### M2 — halaman
Halaman daftar, halaman dokumen, halaman pasal. Status multi-sumber, relasi dengan kutipan,
lampiran sebagai PDF. Belum ada pencarian.
**Selesai bila:** setiap dokumen dan pasal punya halaman sendiri; dokumen tanpa teks tampil dengan
keterangannya; status tampil per sumber dengan tanggal; relasi tampil dengan kutipan; lampiran yang
nomornya tidak cocok tampil dengan tanda; situs terbangun dan terbit.

### M3 — pencarian
Pencarian di perangkat, pengenalan singkatan ("PPh 21" = "Pajak Penghasilan Pasal 21"), saringan
jenis, tahun, status.
**Selesai bila:** pencarian berjalan tanpa permintaan jaringan; dokumen tanpa teks tetap muncul lewat
metadatanya; singkatan umum dikenali; saringan bekerja; ukuran indeks dilaporkan.

### M4 — koleksi pribadi
Impor, simpan di perangkat, ikut tercari, ekspor cadangan, tersambung ke peraturan publik yang
dirujuknya.
**Selesai bila:** berkas pengguna tidak pernah dikirim ke mana pun; hasil impor ditandai sebagai
belum terverifikasi; ekspor cadangan bisa dipulihkan; rujukan ke peraturan publik tertaut.

### M5 — KUP dan PPN
Kategori KUP dan PPN dari katalog DJP masuk korpus. Satu peraturan yang tercatat di beberapa
kategori tetap satu dokumen dengan daftar kategorinya. Saringan dan label kategori di situs.
**Selesai bila:** korpus memuat KUP dan PPN dengan jumlah yang cocok dengan hasil pengambilan;
pengambilan mematuhi bagian 8; status dari satu sumber ditampilkan sebagai klaim satu sumber, tidak
pernah sebagai kepastian; set evaluasi pencarian tidak memburuk; ukuran data dan beban diukur ulang.
**Dua tahap** (pemilik, 2026-10-04): KUP lebih dulu, karena itulah yang paling dibutuhkan pengguna.
Begitu detail KUP lengkap, kriteria di atas dikerjakan untuk KUP saja dan diterbitkan; PPN menyusul
sebagai tahap kedua dengan kriteria yang sama.

### M6 — pemasangan dan luring
Bisa dipasang di HP dan jalan tanpa internet.
**Selesai bila:** situs bisa dipasang; setelah dipasang, daftar, halaman, dan pencarian tetap jalan
dalam keadaan luring; ada penanda kapan data terakhir diperbarui.

### M7 — kategori lain dan pipa pembaruan bertahap (v1.1)
Perluasan ke kategori pajak lainnya di katalog DJP, ditambah perintah pembaruan bertahap yang bisa
dijalankan terjadwal di mesin mana pun. Terbit sebagai v1.1, tidak bersama v1.0.0 (pemilik,
2026-10-10).
**Selesai bila:** pipa hanya mengambil yang baru dan berubah, mematuhi seluruh aturan pengambilan
di bagian 8, dan berhenti sendiri bila host menolak; ukuran simpanan di perangkat diukur dengan
semua kategori.

### M8 — penyiapan rilis v1.0.0
Halaman tentang sumber dan batasan, nama tampilan dan ikon, versi aplikasi, lalu penyerahan ke
pemintanya. **Dikerjakan dan diterbitkan sebelum M7** (pemilik, 2026-10-10), dengan cakupan PPh, KUP,
dan PPN.
**Selesai bila:** halaman batasan memuat angka nyata (cakupan, ketidakpastian status, ketepatan
relasi) dan tanggal data; versi aplikasi (semver) dan versi data (tanggal) tampil terpisah;
penyerahan tercatat; tag git v1.0.0.

## 8. Aturan pengambilan data

Berlaku penuh, warisan bukti konsep, dan tidak boleh dilonggarkan:

- Hanya sumber resmi pemerintah. Tidak pernah dari kompilasi komersial atau sumber tidak resmi.
- Hormati `robots.txt`.
- Jeda minimal 20 detik per host.
- Batas permintaan per host dalam **jendela 24 jam bergulir**, bukan per hari kalender.
- Berhenti total bila host menolak; status berhenti tersimpan di berkas dan hanya dicabut manusia.
- **Tidak pernah mengakali pembatasan dengan cara apa pun**: tidak ganti IP, tidak proxy, tidak
  memalsukan user agent, tidak menembus deteksi bot. **VPN termasuk proxy.** Pengambil memeriksa
  bahwa koneksi tidak lewat VPN atau proxy sebelum jalan, dan meminta konfirmasi manusia untuk hal
  yang tidak bisa dipastikan otomatis.
- **DJP memutus koneksi secara sporadis tanpa mengirim 403 atau 429. Ini normal**: catat yang gagal,
  lanjutkan, ulang di putaran berikutnya.

## 9. Hak cipta

Sudah diverifikasi pemilik proyek langsung dari naskah UU 28/2014 Pasal 42: **tidak ada hak cipta
atas peraturan perundang-undangan dan putusan pengadilan.** Ini memperbarui laporan bagian 11, yang
masih mencatat status itu sebagai dugaan yang belum diverifikasi.

Yang tetap dilindungi dan **tidak boleh diterbitkan ulang**: abstrak, metadata, klasifikasi, naskah
konsolidasi, dan tata letak situs sumber. Aplikasi ini gratis dan nonkomersial.

**Penegasan untuk label kategori** (pemilik, 2026-10-04, K-051): keterangan di daftar kategori mana
sebuah dokumen ditemukan boleh dipakai untuk saringan dan kartu, **hanya** dalam bentuk asal daftar,
misalnya "Dari daftar KUP katalog DJP", dan **hanya** tiga nilai: PPh, KUP, PPN. Ini keterangan
asal-usul, sejenis URL sumber dan tanggal ambil, bukan penerbitan ulang susunan klasifikasi sumber.
Tag, klasifikasi rinci, dan abstrak sumber tetap tidak diterbitkan (K-010).

## 10. Tidak dibangun di v1

- Bot yang merangkai jawaban.
- OCR di perangkat.
- Pencarian berbasis makna (kelayakannya diuji terpisah).
- Data dari sumber tidak resmi.
- KMK kurs dan tarif bunga berkala.
