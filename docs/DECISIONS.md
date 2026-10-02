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

## K-009 — Surel pribadi di user agent diganti URL repo
Tanggal: 2026-09-27 · Milestone: M0 · Status: berlaku

**Keputusan:** user agent pengambil data di `poc/fetch.py` memakai
`+https://github.com/MufuyuMoku/tax`, bukan alamat surel pribadi. Seluruh pohon kerja disisir:
kemunculannya hanya satu, di berkas itu.
**Alasan:** user agent memang harus memberi cara menghubungi pengelola bila pengambilan
mengganggu, dan URL repo sudah memenuhi itu tanpa menerbitkan alamat surel pribadi di repo publik.
**Alternatif yang ditolak:** membuat alamat surel khusus proyek. Menambah hal yang harus diurus
tanpa manfaat lebih dibanding URL repo.
**Akibat:** permintaan berikutnya ke sumber memakai identitas baru ini. Aturan pengambilan lain
tidak berubah.

## K-010 — Bidang klasifikasi milik sumber dihapus dari berkas yang di-commit
Tanggal: 2026-09-27 · Milestone: M0 · Status: berlaku

**Keputusan:** `label` dan `tematik` (JDIH), serta `kategori` dan `tag` (DJP) dihapus dari
`poc/data/jdih_metadata.jsonl` (17.342 bidang), `poc/data/djp_pph_detail.jsonl` (2.928 bidang), dan
`poc/data/jdih_pph_candidates.jsonl` (614 bidang). `poc/data/jdih_aggregate_filter.json`, yang
justru memuat kamus label/tematik/bidang JDIH, dipindahkan seluruhnya ke luar repo. Salinan penuh
semuanya ada di `C:\Users\sorar\Downloads\tax-poc-private`. Sisa uji (`_test_detail.jsonl`,
`_test_slugs.txt`) dan empat berkas `.log` ikut dipindahkan ke luar.
**Alasan:** klasifikasi buatan sumber tetap dilindungi hak cipta walaupun teks peraturannya tidak
(SPEC bagian 9), dan proyek ini tidak lagi membutuhkannya: pemilihan dokumen PPh sudah selesai dan
hasilnya tersimpan di `jdih_pph_candidates.jsonl` beserta alasan pemilihannya.
**Alternatif yang ditolak:** menyimpannya karena "mungkin berguna nanti". Menahan bahan berhak
cipta di repo publik demi kemungkinan yang tidak konkret.
**Akibat:** `select_pph.py` tidak bisa dijalankan ulang dari berkas yang di-commit. Ia sekarang
melempar `MissingLabelField` dengan keterangan jelas, bukan diam-diam menghasilkan daftar lebih
pendek, dan tidak menimpa berkas keluarannya sebelum tahu pekerjaannya bisa selesai. Untuk
menjalankan ulang, pakai salinan penuh di luar repo. Bidang `kategori` di `out/korpus_pph.json`
tetap ada karena itu milik proyek ini sendiri (bernilai `substantif`), bukan klasifikasi sumber.

## K-011 — Riwayat dipadatkan jadi satu commit, repo dihapus dan dibuat ulang
Tanggal: 2026-09-27 · Milestone: M0 · Status: **selesai**

**Keputusan:** riwayat empat commit hari pertama dipadatkan menjadi satu commit awal berisi pohon
kerja yang sudah bersih, lalu repo GitHub dihapus dan dibuat ulang dengan nama yang sama.
**Alasan:** commit-commit lama masih memuat bahan yang sengaja dibuang sesudahnya, yaitu surel
pribadi (K-009) dan klasifikasi sumber (K-010). Mendorong riwayat itu apa adanya ke repo baru akan
membatalkan kedua pembersihan tersebut. Riwayat satu hari bernilai jauh lebih kecil daripada itu,
dan isi pekerjaannya tetap tercatat di `docs/PROGRESS.md` dan `docs/DECISIONS.md`. Penghapusan repo
dipilih pemilik proyek karena commit lama masih terjangkau lewat SHA penuh, umur repo baru sehari,
dan tidak ada fork.
**Alternatif yang ditolak:** (a) mendorong riwayat empat commit apa adanya — membatalkan K-009 dan
K-010; (b) `filter-repo --replace-text` plus callback untuk membersihkan bidang JSON di revisi lama
— jauh lebih rumit untuk hasil akhir yang sama, mengingat repo akan dibuat ulang; (c) membiarkan
repo lama — meninggalkan objek yang masih bisa diambil lewat SHA.
**Akibat:** riwayat git dimulai dari nol (`e1ea020`), jadi klon lama tidak bisa di-pull.

**Cara penghapusannya:** `gh repo delete` ditolak HTTP 403 karena token tidak punya scope
`delete_repo`, dan scope itu hanya bisa diberikan lewat alur OAuth di browser. **Penghapusan
akhirnya dilakukan pemilik proyek secara manual lewat Settings → Danger Zone. Tidak ada scope
`delete_repo` yang diberikan ke token**, jadi kemampuan menghapus repo tetap di luar jangkauan
perkakas otomatis — dan memang sebaiknya begitu.

**Hasil, diverifikasi 2026-09-27:**
- Repo dibuat ulang dengan nama sama, publik, lalu riwayat bersih didorong (`09ec5aa`).
- Pages diaktifkan dengan `build_type: workflow`; alur berjalan dan `success`.
- Situs kembali **HTTP 200**, dan kalimat "bukan situs resmi pemerintah" ada di HTML terbit.
- SHA lama tidak lagi bisa diambil: `309fa7c` dan `12f5b43` menjawab **HTTP 422** sebagai commit dan
  **HTTP 404** saat dipakai sebagai `ref` untuk membaca `poc/fetch.py`. Surel pribadi dan
  klasifikasi sumber kini tidak terjangkau dari revisi mana pun.

## K-012 — Korpus ditulis sebagai berkas per dokumen dan per pasal, dan ikut di-commit
Tanggal: 2026-09-27 · Milestone: M1 · Status: berlaku

**Keputusan:** keluaran pipa ditulis ke `corpus/`: satu JSON per dokumen (1.122), satu JSON per
unit pasal/diktum (7.385), ditambah `index.json` dan `meta.json`. Seluruhnya ikut di-commit,
8.509 berkas, 17,8 MB.
**Alasan:** bentuk ini yang diminta SPEC bagian 6, dan M2 bisa membangun halaman langsung dari
berkas-berkas itu tanpa menjalankan Python di CI. Alur GitHub Actions cukup Node saja.
**Alternatif yang ditolak:** (a) beberapa berkas JSONL besar — lebih kecil, tetapi setiap halaman
harus memuat seluruh berkas saat membangun; (b) korpus tidak di-commit dan dibangun saat CI — CI
jadi butuh Python plus arsip `poc/`, dan hasil build tidak bisa ditelusuri lewat riwayat git.
**Akibat:** perubahan pipa terlihat sebagai diff korpus, jadi perubahan tak sengaja gampang
ketahuan. Ukuran repo naik sekitar 18 MB.

## K-013 — Posting ganda di katalog DJP disimpan, bukan dibuang
Tanggal: 2026-09-27 · Milestone: M1 · Status: berlaku

**Keputusan:** bila satu dokumen muncul di beberapa URL katalog DJP, teks terpanjang dipakai
(seri diputus berdasarkan URL supaya deterministik) dan posting lain dicatat di
`text.other_postings` lengkap dengan jumlah karakter dan penanda `differs_from_chosen`.
**Alasan:** 5 dokumen punya posting ganda, dan pada PMK 128/2019 isi kedua posting **berbeda**
(18.624 vs 18.422 karakter). Membuang yang lain diam-diam berarti menyembunyikan perbedaan yang
justru perlu diperiksa manusia.
**Alternatif yang ditolak:** memakai posting pertama yang ditemui. Hasilnya bergantung urutan baca
dan menyembunyikan perbedaan isi.
**Akibat:** jumlah unit pasal korpus dihitung per dokumen, bukan per teks. Ini menjelaskan 62 dari
66 selisih terhadap angka LAPORAN.

## K-014 — Dokumen dengan nomor, tahun, dan judul sama tetapi jenis berbeda tidak digabungkan
Tanggal: 2026-09-27 · Milestone: M1 · Status: berlaku

**Keputusan:** dokumen seperti itu tetap terpisah dan saling menunjuk lewat `identity_conflicts`
beserta catatan bahwa keduanya mungkin peraturan yang sama.
**Alasan:** PP 20/2026 tercatat DJP sebagai "Peraturan Presiden", sedangkan judul dan nama
lampirannya menyebut Peraturan Pemerintah, dan JDIH mencatatnya sebagai PP. Menggabungkan berarti
memilih satu sumber sebagai yang benar, dan itu menebak (invarian 1 berlaku serupa untuk identitas).
Syaratnya diperketat ke judul identik: nomor dan tahun yang sama itu lumrah (PMK 16/2016 dan
PER-16/PJ/2016 dokumen berbeda), dan tanpa syarat judul penandanya menjaring 66 dokumen, hampir
semuanya salah.
**Alternatif yang ditolak:** menggabungkan otomatis berdasarkan judul yang sama. Judul yang sama
tidak menjamin dokumen yang sama, terutama untuk ralat dan naskah konsolidasi.
**Akibat:** 11 dokumen membawa penanda ini, terdiri dari 5 pasangan/triplet.

## K-015 — Bug pemecah pasal dari bukti konsep diperbaiki
Tanggal: 2026-09-27 · Milestone: M1 · Status: berlaku

**Keputusan:** pola pengenal pasal tidak lagi membolehkan akhiran huruf melewati pergantian baris.
**Alasan:** pola lama `\s?[A-Z]?` dengan `re.I` membuat "Pasal 1" yang diikuti baris berawalan
huruf terbaca sebagai "Pasal 1A". Ketahuan lewat tes yang ditulis untuk kasus lain.
**Alternatif yang ditolak:** membiarkannya agar angka persis sama dengan LAPORAN. Angka yang cocok
dengan laporan tetapi salah lebih buruk daripada angka yang benar dan dijelaskan.
**Akibat:** 4 unit pasal palsu hilang. Selisih terhadap LAPORAN kini terjelaskan penuh:
6.319 = 6.253 + 62 (posting ganda) + 4 (bug ini).

## K-016 — Daftar berupa kartu dengan pengurutan di browser, bukan tabel
Tanggal: 2026-09-28 · Milestone: M2 · Status: berlaku

**Keputusan:** daftar 1.122 dokumen dirender sebagai satu halaman berisi kartu, diurutkan di server
(tahun terbaru dulu), dan pengurutan lain dikerjakan JavaScript kecil tanpa pustaka.
**Alasan:** tabel memaksa gulir samping di layar 320px, padahal syarat M2 justru melarangnya. Kartu
mengalir mengikuti lebar layar. Pengurutan di browser membuat halaman tetap bekerja tanpa server dan
tanpa internet, sesuai rencana M5.
**Alternatif yang ditolak:** (a) tabel dengan gulir samping — melanggar syarat; (b) halaman terpisah
per urutan — memperbanyak halaman tanpa manfaat; (c) paginasi — memecah daftar sehingga pengurutan
tidak lagi menyeluruh.
**Akibat:** halaman daftar sekitar 1,2 MB HTML. Tanpa JavaScript, daftar tetap tampil lengkap dalam
urutan tahun terbaru.

## K-017 — Dokumen kembar dijaga berdampingan lewat kunci grup
Tanggal: 2026-09-28 · Milestone: M2 · Status: berlaku

**Keputusan:** tiap dokumen membawa `group_key`, yaitu id terkecil di antara dirinya dan pasangan
`identity_conflicts`-nya. Kunci itu dipakai sebagai kunci pengurutan kedua, di server maupun di
browser, sehingga anggota satu grup selalu bersebelahan pada urutan apa pun. Kartunya memuat
keterangan singkat bahwa ini satu peraturan yang dicatat berbeda oleh dua sumber.
**Alasan:** tanpa itu, PP 20/2026 dan kembarannya bisa terpisah jauh dan terbaca sebagai duplikat
akibat kesalahan aplikasi, padahal itu kesalahan pencatatan sumber.
**Alternatif yang ditolak:** menggabungkan tampilannya jadi satu kartu. Itu menyembunyikan bahwa
sumbernya berbeda, dan menggeser keputusan menebak dari data ke tampilan.
**Akibat:** berlaku untuk seluruh `identity_conflicts`, bukan kasus PP 20/2026 saja. Saat ini 11
dokumen dalam 5 grup, salah satunya bertiga.

## K-018 — Sasaran relasi di luar korpus ditampilkan sebagai teks, bukan tautan
Tanggal: 2026-09-28 · Milestone: M2 · Status: berlaku

**Keputusan:** relasi yang menunjuk peraturan yang tidak ada di korpus ditampilkan sebagai teks
dengan keterangan "di luar korpus PPh, tidak ada halamannya di sini".
**Alasan:** 150 dari 564 sasaran relasi (27%) menunjuk peraturan di luar kategori PPh. Menautkannya
akan menghasilkan 150 tautan mati.
**Alternatif yang ditolak:** menyembunyikan relasi itu. Relasinya nyata dan berguna; yang tidak ada
hanyalah halamannya di situs ini.
**Akibat:** pemeriksaan otomatis atas seluruh 8.508 halaman menemukan 0 tautan internal mati.

## K-019 — Identitas yang tidak terbaca ditampilkan apa adanya
Tanggal: 2026-09-28 · Milestone: M2 · Status: berlaku

**Keputusan:** dua dokumen yang nomornya tidak bisa diurai pipa data tampil dengan label
"Jenis tidak terbaca dari sumber" dan "Tahun tidak terbaca", dan selalu diurutkan paling akhir pada
pengurutan tahun.
**Alasan:** sumbernya menulis "74 TAHUN 200" dan "TAHUN 1945". Menampilkan tahun kosong terbaca
seperti kerusakan aplikasi, sedangkan menebak tahunnya melanggar prinsip yang sama dengan status.
**Alternatif yang ditolak:** menyembunyikan kedua dokumen itu dari daftar. Invarian 3 melarang
menyembunyikan dokumen.
**Akibat:** keduanya tetap bisa dibuka dan tetap membawa tautan ke sumbernya.

## K-020 — Kutipan relasi adalah kalimat sumber, dipotong hanya di daftar panjang
Tanggal: 2026-10-02 · Milestone: koreksi M2 · Status: berlaku

**Keputusan:** kutipan relasi kini kalimat di teks peraturan yang memuat pencabutan atau
perubahannya, bukan nama peraturan sasarannya. Kalimat pencabutan yang berupa daftar panjang
("Pada saat ... mulai berlaku: a. ...; b. ...; dicabut dan dinyatakan tidak berlaku") dipotong
menjadi kalimat pembuka, butir yang menyebut sasaran, dan klausa pencabutnya; bagian yang dibuang
diganti "…" dan halaman menyebut bahwa kutipannya dipotong. Kalimat perubahan diambil dari batang
tubuh ("Beberapa ketentuan dalam ... diubah sebagai berikut:"), tidak pernah dari konsiderans.
Bila kalimatnya tidak ditemukan, `quote` kosong, `quote_unavailable` menyebut alasannya, dan
halaman mengatakannya terang-terangan.
**Alasan:** versi M2 menyimpan `match.group(0)` sebagai kutipan, yaitu nama peraturan saja. Itu
melanggar invarian 5 secara halus: pembaca tidak bisa melihat apakah pencabutannya penuh atau
"ketentuan Pasal 2A ..." saja. Pemeriksa invarian juga hanya memeriksa kutipan tidak kosong.
**Alternatif yang ditolak:** (a) selalu menampilkan kalimat utuh — Pasal 146 PER-11/PJ/2025
mencabut puluhan peraturan dalam satu kalimat, ribuan karakter per relasi; (b) memotong di jumlah
karakter tetap — bisa membuang justru bagian "sepanjang mengatur ...".
**Akibat:** seluruh 564 relasi terdampak. Sekarang 348 berkutipan kalimat utuh, 197 berkutipan
potongan, 10 berkutipan kalimat perubahan yang nomor sasarannya tidak terbaca otomatis (sasarannya
diambil dari judul, dan halaman menyebutnya), 9 tanpa kutipan dengan alasan tertulis. `checks.py`
kini menggagalkan build bila kutipan sama dengan nama peraturan, atau kosong tanpa alasan. Kutipan
yang benar juga memperlihatkan salah baca pipa yang dulu tersembunyi, misalnya "PP 9/2021" yang
terbaca dicabut PP 55/2022 padahal hanya disebut sebagai pengubah PP 94/2010; itulah gunanya.

## K-021 — Label peraturan ditulis "PP 55/2022", jenis DJP tanpa kode seri
Tanggal: 2026-10-02 · Milestone: koreksi M2 · Status: berlaku

**Keputusan:** label relasi, judul halaman dokumen, dan alasan status memakai bentuk pendek dari
kunci identitas: "PP 55/2022", "PMK 168/2023", "KMK 44/KMK.04/1998", "PER-DJP 11/2025". Nomor
seperti yang ditulis sumber tetap tampil di bawah judul ("Nomor menurut sumber: 55 TAHUN 2022").
Bila jenisnya tidak terbaca, labelnya "Jenis tidak terbaca" disertai tulisan sumber.
**Alasan:** "55 TAHUN 2022" tidak menyebut jenis. Untuk peraturan DJP, bentuk lazim
"PER-11/PJ/2025" memuat kode seri (PJ, PJ.1, PJ.31) yang tidak disimpan di kunci identitas;
menuliskannya berarti mengarang bagian nomor.
**Alternatif yang ditolak:** menulis "PER-11/PJ/2025" untuk semua — benar untuk sebagian besar,
salah untuk seri lama, dan tidak bisa dibedakan.
**Akibat:** fungsi label ada dua salinan, `regulationLabel()` di `src/lib/labels.js` dan
`short_label()` di `pipeline/build.py`, dan harus dijaga sama.

## K-022 — Dokumen kembar tanpa teks menunjuk kembarannya yang berteks di bagian teks
Tanggal: 2026-10-02 · Milestone: koreksi M2 · Status: berlaku

**Keputusan:** bila sebuah dokumen tidak berteks dan salah satu anggota grup `identity_conflicts`-nya
berteks, kotak "Teks tidak tersedia di sumber" memuat tautan ke kembaran itu beserta sumber dan
jumlah pasalnya, plus pengingat bahwa situs ini tidak memastikan keduanya peraturan yang sama.
**Alasan:** PP 20/2026 versi JDIH tanpa teks, sedangkan dua catatan DJP-nya berteks. Penunjuk di
bagian atas halaman mudah terlewat oleh orang yang langsung menggulir ke batang tubuh.
**Akibat:** berlaku untuk seluruh grup: saat ini PP 20/2026, KEP-425/PJ/2019, KEP-95/PJ/2019, dan
KEP-8/PJ/2023 (catatan JDIH-nya tanpa teks). Grup PP/Keppres 28/1990 tidak berteks di kedua sisi.

## K-023 — Mesin pencari ditulis sendiri, teks penuh dimuat sekali dan dicari di memori
Tanggal: 2026-10-02 · Milestone: M3 · Status: berlaku

**Keputusan:** saat build, `src/pages/cari/data.json.js` menulis satu berkas `cari/data.json` berisi
daftar dokumen, teks seluruh 7.385 unit pasal dan penjelasan, peta koreksi OCR, dan daftar istilah.
Halaman daftar memuatnya sekali lewat Web Worker, menormalkan teksnya menjadi satu string panjang,
lalu tiap pencarian berjalan di memori dengan `indexOf`. Tidak ada pustaka pencarian.
**Alasan:** normalisasi (OCR, singkatan, bentuk nomor) harus sama persis di build dan di browser;
satu modul JavaScript tanpa dependensi (`src/lib/search/`) menjamin itu dan bisa dites di Node.
Mencari di teks utuh juga memberi frasa persis, awalan kata, dan potongan teks berkonteks tanpa
indeks posisi terpisah. Worker mencegah halaman membeku selama normalisasi di HP.
**Ukuran:** `cari/data.json` 10.536.888 byte mentah, 1.786.472 byte setelah gzip. Di browser
desktop, memuat dan menormalkan memakan sekitar 0,7 detik; satu pencarian 5–60 md.
**Tafsir "tanpa permintaan jaringan":** berkas data diambil satu kali bersama halaman, dari situs
yang sama, seperti CSS-nya. Mengetik dan menyaring tidak mengirim permintaan apa pun. Dibuktikan
dengan menghentikan server setelah halaman dimuat: `fetch` ke server gagal, dan pencarian tetap
memberi hasil. M5 nanti menyimpan berkas ini di perangkat.
**Alternatif yang ditolak:** (a) indeks terbalik siap pakai (lunr, MiniSearch, FlexSearch) —
menambah dependensi dan sulit menyamakan normalisasi OCR serta singkatan; (b) indeks dibagi per
kata dan diambil sesuai kueri — itu permintaan jaringan per pencarian; (c) menyisipkan data ke
HTML — halaman daftar jadi 12 MB dan tidak bisa di-cache terpisah.

## K-024 — Peringkat: konsep yang muncul berdekatan, berbobot kelangkaannya, lalu BM25
Tanggal: 2026-10-02 · Milestone: M3 · Status: berlaku

**Keputusan:** dokumen diurutkan (1) cocok nomor lebih dulu; (2) jumlah bobot konsep kueri yang
muncul dalam jarak 300 karakter di satu pasal atau di judul, dengan bobot = idf konsep itu; (3)
skor BM25 pasal terbaik ditambah judul (bobot 2,5). Penjelasan berbobot 0,5. Kata panjang (4 huruf
ke atas) juga cocok sebagai awalan (bobot 0,7) atau di dalam kata (0,5), jadi "potong" menemukan
"pemotongan" dan "dipotong" tanpa stemmer.
**Alasan:** tanpa syarat kedekatan, pasal panjang dan peraturan berpasal banyak "memuat semua kata"
pertanyaan kasus walaupun kata-katanya berjauhan; tanpa bobot idf, "dapat" sama berharganya dengan
"bonus". Keduanya terlihat pada kueri "karyawan dapat bonus tahunan" dan diperbaiki secara umum,
bukan disetel untuk kueri itu.
**Alternatif yang ditolak:** stemmer bahasa Indonesia tanpa kamus — aturan imbuhan meN-/peN-
ambigu ("memotong", "memakai", "memasukkan") dan menggabungkan "penghasilan" dengan "hasil".
**Akibat:** kartu hasil menyebut konsep yang cocok dan yang tidak ditemukan, supaya pengguna tahu
kenapa sebuah dokumen muncul.

## K-025 — Toleransi OCR dihitung dari korpus, hanya untuk mencocokkan
Tanggal: 2026-10-02 · Milestone: M3 · Status: berlaku

**Keputusan:** kata dianggap salah baca OCR bila jarang (paling banyak 200 kali) dan satu
penggantian khas OCR ("rn"→"m", "cl"→"d", "l"↔"i", "c"→"e", ...) menghasilkan kata yang paling
sedikit 25 kali lebih sering dan muncul paling sedikit 30 kali. Hasilnya 227 koreksi otomatis plus
pasangan tulis tangan. Koreksi diterapkan ke teks dan kueri hanya saat mencocokkan; potongan teks
di hasil dan halaman pasal tetap teks asli. Aturan, ambang, pasangan, dan daftar
`jangan_dikoreksi` ada di `src/data/search/ocr.json`.
**Alasan:** SPEC bagian 5 mewajibkan koreksi hanya menyentuh kata yang tidak ada di kamus, tetapi
proyek ini tidak punya kamus. Korpus sendiri yang dipakai: "intemasional" tidak ada, jadi
"internasional" tidak pernah disentuh.
**Diperiksa manusia:** seluruh daftar dibaca sekali. Dua koreksi keliru ("mengenal"→"mengenai",
"dikenal"→"dikenai") dan satu singkatan ("SLTA") dimasukkan ke `jangan_dikoreksi`. Daftar terbaru
bisa dilihat dengan `node scripts/search-ocr-list.mjs`.

## K-026 — Bentuk nomor peraturan dibaca dari kueri, dicocokkan ke identitas dokumen
Tanggal: 2026-10-02 · Milestone: M3 · Status: berlaku

**Keputusan:** `parseNumber` mengenali "168/PMK.03/2023", "PMK-168/PMK.03/2023", "55 Tahun 2022",
"55/2022", dan "PER 11 2025", plus kata jenis (PMK, PP, PER, KEP, UU, ...). Kode seri setelah
nomor tidak ikut dicocokkan kecuali menentukan jenis ("/PJ" berarti peraturan DJP). Bentuk lepas
"angka tahun" hanya dibaca sebagai nomor bila tidak ada kata lain di kueri, sehingga "PPh 21 2024"
tetap dicari sebagai kata. Bila kueri hanya nomor, dokumen lain yang mengutip nomor itu ikut tampil
di bawahnya dengan tanda "Menyebut nomor ini". Nomor di dalam frasa bertanda kutip dicari sebagai
teks, bukan sebagai nomor.
**Alasan:** dokumen tanpa teks hanya bisa ditemukan lewat identitasnya, dan pengguna menulis nomor
dengan banyak cara. Kode seri PMK ditulis berbeda-beda di sumber (PMK.03, PMK.010), jadi mencocokkan
seri akan menggagalkan pencarian yang benar.

## K-027 — Daftar singkatan, kata umum, dan aturan OCR berupa berkas data yang bisa disunting
Tanggal: 2026-10-02 · Milestone: M3 · Status: berlaku; bagian "sengaja tidak dimasukkan" digantikan
K-030 (padanan diizinkan pemilik proyek dengan syarat)

**Keputusan:** `src/data/search/istilah.json` (61 kelompok, termasuk pola "PPh {n}" = "Pajak
Penghasilan Pasal {n}"), `kata-umum.json`, dan `ocr.json`, dengan petunjuk di `README.md` di folder
yang sama. Berkas ini dibaca saat build dan ikut ke `cari/data.json`.
**Alasan:** diminta pemilik proyek; isi daftar ini keputusan bahasa dan kebiasaan kantor, bukan
keputusan kode.
**Sengaja tidak dimasukkan:** padanan kata biasa seperti "karyawan" = "pegawai". Diuji sementara
(tidak disimpan): untuk "karyawan dapat bonus tahunan", PMK 168/2023 naik dari peringkat 16 ke 3
dan PER-16/PJ/2016 dari 39 ke 6. Itu padanan, bukan singkatan, dan dampaknya ke kueri lain belum
diukur; pemilik proyek yang memutuskan.
**Akibat:** "aturan" dan "peraturan" masuk kata umum karena semua dokumen adalah peraturan; bentuk
panjang seperti "Peraturan Pemerintah" tetap dikenali sebagai istilah.

## K-028 — Saringan dan pencarian di halaman daftar, keadaannya di URL
Tanggal: 2026-10-02 · Milestone: M3 · Status: berlaku; diperbarui 2026-10-02 (sebelum M4): keadaan
pindah ke fragmen

**Keputusan:** kotak cari dan saringan (jenis, dari tahun, sampai tahun, status) ada di halaman
daftar, di atas segalanya. Tanpa kata kunci, saringan menyembunyikan kartu di daftar lengkap;
dengan kata kunci, daftar diganti hasil berperingkat. Pilihan saringan diambil dari data beserta
jumlahnya, jadi "Tidak pasti" muncul sebagai pilihan tersendiri. Kueri dan saringan ditulis ke URL
(`?q=...`). Label kartu daftar memakai label pendek K-021. Tautan pasal di hasil memakai text
fragment (`#:~:text=`) supaya browser yang mendukungnya langsung menggulir ke kata yang cocok.
**Alasan:** satu tempat untuk menelusuri dan mencari; URL bisa dikirim ke rekan atau disimpan.
Tanpa JavaScript, daftar lengkap tetap tampil dan halaman menyebut bahwa pencarian butuh
JavaScript.
**Pembaruan (sebelum M4):** kueri dan saringan kini ditulis ke fragmen (`#q=...&jenis=...`), bukan
ke query string. Browser tidak pernah mengirim fragmen ke server, jadi memuat ulang halaman atau
membuka tautan tidak menaruh kueri di permintaan mana pun maupun di log server. Tautan lama
`?q=...` tetap dibaca sekali, lalu ditulis ulang ke fragmen dengan `history.replaceState`. Membuka
tautan `#q=` saat halaman sudah terbuka (`hashchange`) langsung menjalankan pencarian.

## K-029 — Tes pencarian memakai node:test dan dijalankan di CI sebelum build
Tanggal: 2026-10-02 · Milestone: M3 · Status: berlaku

**Keputusan:** `npm test` menjalankan `tests/search/*.test.mjs`: tes unit pada contoh tulisan
sendiri, dan tes integrasi pada korpus nyata untuk janji M3 (semua bentuk nomor, dokumen tanpa
teks, singkatan, OCR, saringan). Alur deploy menjalankan `npm test` sebelum `npm run build`.
**Alasan:** tanpa dependensi tambahan; kegagalan menghentikan terbitnya situs yang pencariannya
rusak.

## K-030 — Padanan kata awam, berbobot di bawah kata yang diketik, disaring lewat set evaluasi
Tanggal: 2026-10-02 · Milestone: koreksi M3 · Status: berlaku

**Keputusan:** padanan disimpan terpisah dari singkatan, di `src/data/search/padanan.json`. Bentuk
yang diketik pengguna berbobot 1; bentuk lain dalam kelompoknya berbobot 0,6, baik pada skor BM25
maupun pada bobot cakupan yang menentukan urutan. Kelompok hanya masuk bila terbukti menolong
pertanyaan di `tests/search/kasus.json` dan tidak membuat pertanyaan lain memburuk. Garis dasar
(`tests/search/garis-dasar.json`) dicatat sebelum perubahan apa pun; `npm test` gagal bila ada
pertanyaan yang lebih buruk darinya.
**Set evaluasi:** 25 pertanyaan berkosakata awam, tiap jawaban dengan dokumen, pasal, dan kutipan
yang dicocokkan otomatis ke teks korpus. Tiga ditandai "perlu dicek pemilik". Pertanyaan dan
jawabannya disusun penyusun sendiri dari teks peraturan publik, bukan dari dokumen kiriman.
**Masuk (11 kelompok):** karyawan=pegawai, omzet=peredaran bruto, kontraktor=jasa konstruksi,
online=daring=sistem elektronik, marketplace=lokapasar=perdagangan melalui sistem elektronik,
kasih=hibah, kantor=pemberi kerja, buruh/pekerja harian lepas=pegawai tidak tetap,
menikah=kawin, tidak kena pajak=penghasilan tidak kena pajak, orang asing=warga negara asing.
Bukti jumlah kemunculan ada di berkasnya.
**Ditolak setelah diuji satu per satu:** gaji=upah (menolong 137→132, merusak 11→14),
jual=pengalihan (merusak 157→177), rumah=bangunan (menolong 157→113, merusak 131→137),
gratis=cuma-cuma (merusak 90→93), honor=honorarium (merusak 10→13), anak=keluarga sedarah
(hanya 131→127; "anak" juga berarti anak perusahaan), dan ruko, pembicara=penceramah, untung=laba
(tidak berpengaruh pada set evaluasi, jadi tidak ada bukti).
**Diketahui:** karyawan=pegawai membuat "THR karyawan kena pajak tidak" turun dari 1 ke 6
dibanding tanpa padanan; tetap jauh di atas garis dasar 84 dan masih 10 besar. Dipertahankan
karena menolong dua pertanyaan lain (16→4, 11→7).
**Singkatan baru di `istilah.json`:** THR, PHK, JHT, WNA, WNI. Itu singkatan, jadi berbobot penuh.
**Hasil:** median peringkat 11 → 5; masuk 10 besar 12 → 18 dari 25; tidak ada yang memburuk.

## K-031 — Risiko diketahui: beban memuat dan memori pencarian di HP, terutama untuk M6
Tanggal: 2026-10-02 · Milestone: koreksi M3 · Status: risiko terbuka, belum ditangani

**Ukuran nyata (korpus PPh):** `cari/data.json` dikirim GitHub Pages dengan
`Content-Encoding: gzip`, 1.874.515 byte (10.536.888 byte setelah dibuka). Heap JS worker
pencarian sesudah GC: 28,6 MB.
**Diukur dengan Chrome lewat protokol DevTools** (`scripts/measure-load.mjs`). Perlambatan CPU
DevTools tidak berlaku untuk Web Worker ("Operation is only supported for pages, not workers"), jadi
mesinnya juga diukur di thread utama halaman uji sementara supaya ikut diperlambat:

| CPU | Siap mencari (mesin di thread utama) | "PPh 21" | kasus | nomor | Siap di situs (worker tak diperlambat) |
|---|---|---|---|---|---|
| 1x | 0,30 dtk | 25 md | 47 md | 16 md | 0,58 dtk |
| 4x | 1,06 dtk | 117 md | 208 md | 68 md | 1,09 dtk |
| 6x | 2,03 dtk | 188 md | 381 md | 119 md | 2,04 dtk |

Di HP sungguhan kedua beban itu jalan bersamaan (halaman di thread utama, mesin di worker), jadi
perkiraan untuk HP setara 6x sekitar 2–4 detik sampai siap, belum termasuk unduhan 1,9 MB.
**Proyeksi M6:** bukti konsep memperkirakan sekitar 89 MB teks (16 MB gzip), kira-kira 8,4 kali
sekarang. Bila semua tetap linear: unduhan 16 MB, siap mencari sekitar 17 detik pada 6x, satu
pencarian 1,6–3,2 detik pada 6x, dan heap sekitar 240 MB. Heap sebesar itu berisiko membuat tab
dimatikan browser HP, dan waktu siapnya tidak bisa diterima.
**Pilihan yang mungkin (belum dipilih):** (a) data dipecah per kategori pajak, dan hanya kategori
yang dipilih pengguna yang dimuat; (b) indeks terbalik yang dihitung saat build, dengan teks utuh
hanya diambil untuk potongan hasil; (c) teks dinormalkan saat build dan disimpan sebagai larik id
token, bukan string; (d) penjelasan tidak masuk indeks bawaan; (e) teks disimpan di perangkat (M5)
dan dibaca per bagian, bukan seluruhnya ke memori. Pilihan (b) dan (e) tetap memenuhi "tanpa
permintaan jaringan saat mencari" karena bacaan dari penyimpanan perangkat bukan permintaan jaringan.
**Akibat:** tidak ada yang dirombak sekarang. Keputusan diambil paling lambat sebelum M6.

## K-032 — "Teks 2010-an 100%" hanya berlaku untuk katalog DJP; padanan khusus judul tanpa teks
Tanggal: 2026-10-02 · Milestone: sebelum M4 · Status: berlaku

**Temuan:** PP 34/2016 tidak berteks karena hanya tercatat di JDIH, dan JDIH berhenti sebelum
teksnya diambil. Ia bukan catatan kembar: tidak ada di 2.468 baris daftar PPh DJP
(`poc/data/djp_pph_list.jsonl`), dan tidak ada dokumen lain di korpus dengan judul yang sama.
Angka laporan tidak keliru: tabel di `poc/LAPORAN.md` bagian 4 berjudul "Sebaran ketersediaan teks
di DJP per dekade", jadi 0% tanpa teks itu dihitung atas dokumen katalog DJP saja. SPEC bagian 5
meringkasnya tanpa kata "di DJP". Di korpus: dokumen 2010-an yang tercatat DJP semuanya berteks
(239), sedangkan 38 dokumen 2010-an dan 9 dokumen 2020-an yang hanya tercatat JDIH tidak berteks.
Selisih 239 dengan 236 di laporan berasal dari penggabungan identitas di pipa (K-013, K-014).
**Usulan untuk pemilik (SPEC tidak diubah sendiri):** kalimat SPEC bagian 5 menjadi "untuk dokumen
di katalog DJP, teks 2010-an dan 2020-an tersedia 100%; dokumen yang hanya tercatat di JDIH tidak
berteks".
**Keputusan:** `padanan.json` mendukung `"lingkup": "judul_tanpa_teks"`: bentuk lain kelompok itu
hanya dicocokkan ke judul dokumen yang tidak berteks, tidak pernah ke teks pasal. Dua kelompok
dimasukkan: jual ~ pengalihan hak atas tanah dan/atau bangunan, dan rumah ~ tanah dan/atau
bangunan. Di set evaluasi, "jual rumah kena pajak berapa" naik 157 → 42; tidak ada pertanyaan lain
yang berubah. Satu kelompok sendirian hanya 157 → 151; jual~pengalihan di mana saja (pembanding)
justru memburuk ke 177, sesuai K-030.
**Alasan:** dokumen tanpa teks hanya punya judul berbahasa peraturan, jadi kosakata awam tidak
pernah bertemu dengannya. Membatasi padanan ke judul itu menolong tanpa menambah derau di teks.

## K-033 — Set uji tahan dari pemilik, dibekukan terhadap penyetelan
Tanggal: 2026-10-02 · Milestone: sebelum M4 · Status: berlaku

**Keputusan:** 10 pertanyaan pemilik disimpan apa adanya di `tests/search/kasus-tahan.json`,
masing-masing digolongkan (a) jawaban ada di korpus, (b) dasar peraturannya di luar korpus v1, atau
(c) bukan wilayah situs. Padanan dan mesin tidak diubah karena hasil set ini. `npm test` hanya
memeriksa bahwa kutipannya ada di korpus; peringkatnya dilaporkan `scripts/search-tahan.mjs`,
tidak dijadikan gerbang.
**Alasan:** set yang dipakai untuk menyetel tidak bisa lagi mengukur apakah penyetelannya umum.
**Set evaluasi lama:** kutipan "buruh harian lepas" diganti ke PMK 168/2023 Pasal 5 (penghasilan
Pegawai Tidak Tetap berupa upah harian) dan PP 58/2023 Pasal 2 (tarif efektif harian); "warisan"
diterima pemilik. Tidak satu pun jawaban sudah diverifikasi ahli, dan berkasnya mengatakan begitu.
