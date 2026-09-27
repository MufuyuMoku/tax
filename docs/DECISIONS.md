# Keputusan

Setiap keputusan yang diambil sendiri saat mengerjakan, beserta alasannya. Yang sudah dikunci
pemilik proyek ada di `docs/SPEC.md`, bukan di sini. Urutan lama di atas, nomor tidak dipakai ulang.
Format entri:

```
## K-<nnn> — <judul singkat>
Tanggal: YYYY-MM-DD · Milestone: M<n> · Status: berlaku | diganti oleh K-<nnn>

**Keputusan:** apa yang dipilih.
**Alasan:** kenapa, dengan angka atau kendala nyata.
**Alternatif yang ditolak:** apa lagi yang dipertimbangkan dan kenapa tidak dipakai.
**Akibat:** apa yang jadi terikat oleh keputusan ini.
```

---

## K-001 — Repo dibuat di folder proyek yang sudah ada, bukan folder baru
Tanggal: 2026-09-27 · Milestone: M0 · Status: berlaku

**Keputusan:** `git init` dijalankan di `C:\Users\sorar\Downloads\Tax`, folder yang sudah memuat
`poc/`, sehingga arsip bukti konsep langsung berada di dalam repo tanpa dipindahkan.
**Alasan:** hasilnya sama persis dengan yang diminta (poc di dalam repo bernama tax), tanpa
memindahkan 570 MB berkas dan tanpa risiko putusnya jejak berkas.
**Alternatif yang ditolak:** membuat folder baru lalu memindahkan `poc/` ke dalamnya. Lebih banyak
gerakan berkas, tidak ada untungnya.
**Akibat:** akar repo adalah folder proyek; `.venv/` milik bukti konsep ikut ada di situ dan
dikecualikan lewat `.gitignore`.

## K-002 — Astro diletakkan di akar repo, bukan di subfolder `site/`
Tanggal: 2026-09-27 · Milestone: M0 · Status: berlaku

**Keputusan:** `package.json`, `astro.config.mjs`, dan `src/` berada di akar repo.
**Alasan:** alur penerbitan Astro resmi bekerja tanpa penyetelan tambahan, dan hanya ada satu
aplikasi web di repo ini.
**Alternatif yang ditolak:** `site/` sebagai subfolder. Menambah satu lapis konfigurasi tanpa
kebutuhan nyata.
**Akibat:** `pipeline/`, `poc/`, dan `docs/` duduk sejajar dengan `src/` di akar.

## K-003 — Kerangka Astro ditulis tangan, bukan hasil `npm create astro`
Tanggal: 2026-09-27 · Milestone: M0 · Status: berlaku

**Keputusan:** empat berkas ditulis sendiri: konfigurasi, satu layout, satu halaman, satu berkas CSS.
**Alasan:** pemasang resmi menolak folder yang sudah berisi `poc/` dan `.venv/`, dan templatnya
membawa berkas contoh yang tidak dipakai. Kerangka yang ditulis tangan lebih kecil dan seluruhnya
terpakai.
**Alternatif yang ditolak:** membuat di folder sementara lalu menyalin masuk. Hasil akhirnya sama,
langkahnya lebih banyak.
**Akibat:** tidak ada berkas contoh bawaan templat yang perlu dibersihkan nanti.

## K-004 — `poc/cache/` tidak masuk git, `poc/raw/` masuk
Tanggal: 2026-09-27 · Milestone: M0 · Status: **diganti oleh K-007** (bagian `poc/raw/` keliru)

**Keputusan:** `poc/cache/` (381 MB) dikecualikan; `poc/raw/` (167 MB), `poc/data/` (25 MB),
`poc/out/` (14 MB), dan `poc/text/` (13 MB) ikut masuk.
**Alasan:** `cache/` hanya cache HTTP mentah yang isinya sudah ada di `raw/` dalam bentuk yang
berguna. Sebaliknya `raw/` adalah arsip HTML asli yang justru dipakai supaya penguraian ulang tidak
perlu mengambil ulang dari jaringan (laporan bagian 10).
**Alternatif yang ditolak:** mengecualikan `raw/` juga demi repo kecil. Ditolak karena menghapus
satu-satunya salinan lokal arsip sumber, padahal sumbernya sedang tidak bisa diakses.
**Akibat:** repo berisi arsip sekitar 220 MB sebelum kompresi git.

## K-005 — Halaman kosong tetap memuat penafian dan sumber
Tanggal: 2026-09-27 · Milestone: M0 · Status: berlaku

**Keputusan:** layout dasar sudah memuat pernyataan bahwa situs ini bukan situs resmi pemerintah dan
menyebut sumber datanya, walaupun belum ada data sama sekali.
**Alasan:** invarian 9 di SPEC tidak punya pengecualian untuk halaman kosong, dan menaruhnya di
layout membuat setiap halaman berikutnya otomatis membawanya.
**Alternatif yang ditolak:** menunda sampai ada isi. Menunda invarian berarti mudah terlupa.
**Akibat:** semua halaman berikutnya mewarisi penafian ini lewat `Base.astro`.

## K-006 — Repositori GitHub bersifat publik
Tanggal: 2026-09-27 · Milestone: M0 · Status: berlaku

**Keputusan:** repo `MufuyuMoku/tax` dibuat publik.
**Alasan:** GitHub Pages pada akun gratis hanya menerbitkan dari repo publik, sedangkan M0
mensyaratkan halaman yang benar-benar hidup. Isinya pun teks peraturan yang bukan objek hak cipta
(SPEC bagian 9) dan tidak memuat data pribadi.
**Alternatif yang ditolak:** repo privat. Tidak bisa menerbitkan Pages tanpa langganan berbayar.
**Akibat:** seluruh isi repo, termasuk arsip `poc/`, dapat dilihat umum. Abstrak dan metadata sumber
ada di dalam arsip itu, jadi jangan diterbitkan ulang sebagai halaman situs (SPEC bagian 9).

## K-007 — `poc/raw/` dikeluarkan dari git dan dihapus dari riwayat
Tanggal: 2026-09-27 · Milestone: M0 · Status: berlaku · Mengganti: K-004

**Keputusan:** `poc/raw/` tidak lagi dilacak git, dan riwayat ditulis ulang sehingga berkasnya tidak
ada di revisi mana pun. Salinannya lebih dulu dipindahkan ke luar repo, ke
`C:\Users\sorar\Downloads\tax-poc-raw-archive` (1.475 berkas, 166,9 MB, diverifikasi identik), dan
aslinya tetap ada di disk.
**Alasan:** K-004 salah menimbang. `poc/raw/` berisi salinan utuh halaman DJP, termasuk tata letak,
metadata, klasifikasi, dan abstrak. Bagian-bagian itu tetap dilindungi hak cipta menurut temuan
proyek ini sendiri (SPEC bagian 9); yang bebas hanya teks peraturannya. Arsip seperti itu berguna
di mesin pemelihara, bukan di repo publik. Alasan kedua: 167 MB membuat setiap klon dan setiap
alur CI menyeretnya. Penulisan ulang dikerjakan sekarang karena repo baru berumur satu hari dan
belum ada yang mengklon atau mem-fork, jadi biayanya paling murah saat ini.
**Alternatif yang ditolak:** (a) hanya `git rm` tanpa menulis ulang riwayat — berkasnya tetap ada di
revisi lama, jadi tidak menyelesaikan apa pun; (b) membiarkannya demi kemudahan — menukar kepatuhan
hak cipta dengan kenyamanan.
**Akibat:** ukuran `.git` pada klon segar turun dari sekitar 200 MB menjadi 9,3 MB. Seluruh SHA
commit berubah (`12f5b43` → `65004ec`), sehingga klon lama tidak bisa di-pull dan harus diklon
ulang. Penguraian ulang dari HTML mentah kini hanya bisa dilakukan di mesin pemelihara.
**Belum tuntas:** commit lama masih bisa diambil di GitHub lewat SHA penuh sampai GitHub menjalankan
pengumpulan sampahnya sendiri. Lihat laporan sesi ini untuk pilihan penanganannya.

## K-008 — Dokumen kiriman calon pengguna tidak pernah masuk repo (invarian 10)
Tanggal: 2026-09-27 · Milestone: M0 · Status: berlaku

**Keputusan:** ditambahkan sebagai invarian 10 di SPEC, bukan sebagai preferensi. Dokumen yang
dikirim calon pengguna — Surat Edaran, nota dinas, surat penegasan, putusan Pengadilan Pajak — tidak
pernah masuk ke repo, ke data bawaan situs, atau ke commit mana pun. Tempatnya hanya folder lokal
`samples-local/`, yang ditutup `.gitignore` (`samples-local/*`, kecuali README-nya).
**Alasan:** dokumen itu berasal dari sistem internal kantor penggunanya. Menerbitkannya di situs
publik persis kebocoran yang membuat alat ini diminta sejak awal. Karena itu ia harus berupa
invarian yang diperiksa tiap milestone, bukan kebiasaan baik yang bisa luput.
**Alternatif yang ditolak:** menaruhnya di `poc/` atau `pipeline/` dengan catatan "jangan
di-commit". Satu `git add -A` sudah cukup untuk melanggarnya.
**Akibat:** aturan `.gitignore` dipasang sebelum foldernya dibuat, dan diuji dengan berkas umpan
yang memang terabaikan. Invarian ini juga mengikat turunannya: kutipan, potongan teks, indeks
pencarian, dan berkas uji yang dibuat dari dokumen itu. Fitur koleksi pribadi (M4) tetap menjadi
satu-satunya jalur untuk dokumen semacam ini, dan datanya tidak pernah meninggalkan perangkat
pengguna (invarian 7).
