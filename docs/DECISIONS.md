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

## K-034 — Dokumen tiruan ditulis skrip, PDF dibuat tanpa pustaka
Tanggal: 2026-10-02 · Milestone: M4 · Status: berlaku

**Keputusan:** `scripts/make-mock-documents.mjs` menulis 12 berkas di `tests/fixtures/koleksi/`:
SE, ND, surat penegasan, dan putusan, masing-masing sebagai PDF berlapis teks, PDF berisi gambar
saja (huruf 5×7 digambar ke bitmap abu-abu dengan bintik, meniru pindaian), dan .txt. Isinya
karangan penyusun dengan nomor fiktif, dan setiap berkas diawali "DOKUMEN TIRUAN UNTUK PENGUJIAN -
BUKAN DOKUMEN ASLI"; tes memeriksa tanda itu. Skrip ditulis tanpa pustaka sehingga keluarannya sama
persis setiap kali dijalankan (dicek dengan SHA-256 dua kali jalan).
**Alasan:** `samples-local/` masih kosong, dan invarian 10 melarang dokumen kiriman masuk repo.
Tiruan memuat rujukan ke peraturan yang ada di korpus (PMK 168/2023, PP 58/2023, PER-11/PJ/2025,
PMK 66/2023, PP 55/2022, PMK 164/2023, PMK 141/2015, UU 36/2008) dan satu yang tidak ada (PMK
81/2024), supaya pencocokan rujukan teruji di kedua arah.

## K-035 — pdf.js di-host di situs sendiri dan dimuat hanya saat PDF diimpor
Tanggal: 2026-10-02 · Milestone: M4 · Status: berlaku

**Keputusan:** dependensi `pdfjs-dist` 6.3. `src/lib/collection/pdf-browser.js` diimpor secara
dinamis saat pengguna memilih berkas PDF; Vite memecahnya menjadi `pdf-browser.*.js` dan
`pdf.worker.min.*.mjs` di folder situs. Satu `PDFWorker` dipakai bersama untuk semua impor dalam
satu halaman. Ekstraksi hanya memakai `getTextContent`, tanpa font, eval, maupun gambar.
**Ambang lapisan teks:** PDF dianggap tanpa lapisan teks bila kurang dari 20 karakter bukan spasi
bisa dibaca. Tidak ada OCR (SPEC bagian 10).
**Alternatif yang ditolak:** CDN (dilarang pemilik, dan bocor ke pihak ketiga); memuat pdf.js
bersama halaman (membebani setiap kunjungan, padahal impor jarang).

## K-036 — Koleksi pribadi disimpan di IndexedDB, penyimpanan permanen diminta setelah impor pertama
Tanggal: 2026-10-02 · Milestone: M4 · Status: berlaku

**Keputusan:** basis data `tax-koleksi-pribadi`, satu object store `dokumen`. Tiap catatan memuat
id acak (`k` + 24 heksadesimal, tidak diturunkan dari isi), jenis, nomor, tanggal, perihal,
catatan, sumber (pdf, txt, tempel), berkas asli (nama, jenis, ukuran, SHA-256, byte utuh), teks
terbaca atau `null`, rujukan, tanggal impor, dan `verified: false`. `navigator.storage.persist()`
diminta otomatis saat dokumen pertama disimpan, dan bisa diminta lagi lewat tombol; hasilnya,
pemakaian, dan kuota ditampilkan.
**Diketahui:** Chrome headless menolak permintaan permanen, jadi yang teruji otomatis hanya
tampilan "belum permanen". Di browser biasa keputusan ada di tangan browser.

## K-037 — Koleksi dicari dengan mesin yang sama, dalam instans dan bagian hasil sendiri
Tanggal: 2026-10-02 · Milestone: M4 · Status: berlaku

**Keputusan:** worker pencarian membaca IndexedDB sendiri, membentuk payload koleksi dengan bentuk
yang sama seperti korpus publik (`collectionPayload`), dan menjalankan `SearchEngine` kedua. Hasil
koleksi tampil di bagian "Koleksi pribadi" di atas hasil publik, dengan kartu berwarna dan bergaris
putus-putus, tanda "Koleksi pribadi" dan "Belum terverifikasi". Saringan baru: Sumber (keduanya,
hanya publik, hanya pribadi) dan Jenis koleksi. Dokumen pindaian tidak punya unit teks, jadi hanya
isian pengguna yang tercari, dan kartunya mengatakan itu.
**Alasan:** skor dua mesin dengan idf berbeda tidak bisa dibandingkan; menggabungkan peringkatnya
akan pura-pura presisi. Bagian terpisah juga membuat asal setiap hasil tidak mungkin tertukar.
**Alternatif yang ditolak:** satu indeks gabungan — dokumen pribadi akan ikut memengaruhi idf
peraturan publik.

## K-038 — Rujukan dari dokumen impor dibaca dengan parseNumber, disimpan saat impor
Tanggal: 2026-10-02 · Milestone: M4 · Status: berlaku

**Keputusan:** `findReferences` mencari pola nomor di teks impor, memberi `parseNumber` konteks
paling banyak 80 karakter sebelum nomor dan tidak melewati nomor sebelumnya (supaya jenis satu
peraturan tidak terbawa ke nomor berikutnya), lalu mencocokkan ke identitas korpus. Nomor dokumen
itu sendiri dilewati. Yang cocok ditautkan ke halaman peraturannya; yang tidak cocok tampil sebagai
teks "tidak ada di korpus PPh situs ini". Setiap rujukan membawa kalimat sumbernya dan kotak
"petunjuk, bukan kepastian" (invarian 5).
**Diketahui:** rujukan dihitung terhadap korpus saat impor. Bila korpus diperbarui (M6), rujukan
lama tidak ikut berubah sampai dokumen diimpor ulang.

## K-039 — Halaman dokumen pribadi beralamat fragmen, judul tab tidak pernah berubah
Tanggal: 2026-10-02 · Milestone: M4 · Status: berlaku

**Keputusan:** `/koleksi/#dok=<id>`. Fragmen tidak pernah dikirim browser, jadi id tidak muncul di
permintaan mana pun. Judul tab tetap "Koleksi pribadi — Tax" untuk setiap dokumen. Berkas asli
dibuka lewat URL `blob:` yang dibuat di perangkat. Halaman tidak menulis apa pun ke konsol.
**Tafsir:** id memang terlihat di bilah alamat, karena rute berbasis fragmen memang meletakkannya
di sana; yang dijamin adalah id tidak pernah meninggalkan perangkat lewat permintaan jaringan.

## K-040 — Cadangan satu berkas JSON deterministik, pemulihan gabung atau ganti
Tanggal: 2026-10-02 · Milestone: M4 · Status: berlaku

**Keputusan:** `exportBackup` menulis JSON dengan kunci terurut dan dokumen terurut menurut tanggal
impor, berkas asli dalam base64 beserta SHA-256-nya. Tanggal ekspor hanya ada di nama berkas, jadi
koleksi yang sama selalu menghasilkan byte yang sama. Pemulihan menolak seluruh cadangan bila satu
berkas di dalamnya tidak cocok dengan SHA-256-nya. Pengguna memilih "gabungkan" (dokumen dengan id
yang sudah ada dibiarkan, yang baru ditambahkan) atau "ganti seluruh koleksi"; penulisan ke
IndexedDB dalam satu transaksi.
**Diketahui:** cadangan tidak terenkripsi; halaman mengatakan itu. Enkripsi menambah kata sandi
yang bisa lupa dan memutus pemulihan; diputuskan pemilik bila perlu.

## K-041 — Bukti invarian 7 lewat Chrome sungguhan, per langkah
Tanggal: 2026-10-02 · Milestone: M4 · Status: berlaku

**Keputusan:** `scripts/verify-collection.mjs` mengendalikan Chrome lewat DevTools Protocol,
mencatat setiap permintaan (halaman dan worker), pesan konsol, dan judul tab, lalu menjalankan
impor 9 berkas tiruan plus teks tempel, membuka dokumen, mencari, mengekspor, menghapus semua,
memulihkan, dan mengekspor lagi. Skrip gagal bila ada permintaan, pesan konsol, atau judul yang
memuat id atau isi dokumen, bila cadangan kedua tidak sama persis dengan yang pertama, atau bila
berkas tersimpan berbeda dari berkas tiruan.
**Hasil:** 0 permintaan saat mencari, membuka dokumen, mengekspor, menghapus, dan memulihkan.
Saat impor ada 2 permintaan: pustaka pdf.js dan worker-nya, berkas statis situs ini tanpa data
pengguna, hanya pada impor PDF pertama di halaman itu. Berpindah halaman memuat halaman statis dan
`cari/data.json`. Konsol 0 pesan. Kebocoran 0. Cadangan 70.656 byte, sama persis byte demi byte;
9 dari 9 berkas cocok SHA-256.
**Juga:** `<link rel="icon" href="data:,">` di tata letak, supaya browser tidak meminta
`/favicon.ico` sendiri.

## K-042 — Rujukan koleksi pribadi mengikuti sidik jari korpus
Tanggal: 2026-10-03 · Milestone: sebelum M5 · Status: berlaku; menggantikan catatan "diketahui" di K-038

**Keputusan:** `cari/data.json` membawa `corpus.fingerprint`, 16 heksadesimal pertama SHA-256 dari
identitas seluruh dokumen (id, label, jenis, nomor, tahun). Setiap catatan koleksi menyimpan sidik
jari korpus tempat rujukannya dicocokkan. Saat halaman cari atau halaman koleksi dibuka, worker
mencocokkan ulang rujukan semua catatan yang sidik jarinya berbeda, lalu menulisnya kembali ke
IndexedDB. Pencocokan ulang memakai `refreshReferences`, fungsi murni yang dites.
**Alasan:** setelah M5 menambah KUP dan PPN, rujukan yang dulu tampil sebagai teks "tidak ada di
korpus" bisa menjadi tautan. Sidik jari dihitung dari identitas, bukan isi, karena rujukan hanya
bergantung pada nomor dan jenis dokumen.

## K-043 — Mutu teks PDF: teks yang tidak terbaca diperlakukan seperti pindaian
Tanggal: 2026-10-03 · Milestone: sebelum M5 · Status: berlaku

**Masalah:** PDF dengan font tanpa peta Unicode punya lapisan teks yang berisi derau. Pemilik
menemukannya pada PDF sungguhan; tiruannya `tests/fixtures/koleksi/se-tanpa-tounicode.pdf`, font
Type3 dengan bentuk huruf yang benar di layar, nama glyph karangan, kode karakter teracak, tanpa
ToUnicode. pdf.js mengembalikan 775 karakter acak dari berkas itu dan menganggapnya berteks.
**Keputusan:** `assessText` mengukur dua hal. (1) Rasio karakter janggal: karakter bukan spasi
yang bukan huruf, angka, atau tanda baca biasa, termasuk U+FFFD, karakter kendali, dan area pakai
pribadi. (2) Rasio kata (3 huruf atau lebih) yang ada di kosakata korpus. Teks dianggap terbaca bila
karakter janggal paling banyak 10% dan kata dikenal paling sedikit 50%; di bawah 15 kata, cukup
syarat pertama. Teks yang tidak terbaca disimpan di `unreadableText`, tidak ditampilkan sebagai isi,
tidak dicari, dan tidak dibaca rujukannya; pengguna diminta mengisi nomor atau perihal. Pengguna bisa
menimpa penilaian ("teksnya sebenarnya terbaca"), dan halaman dokumen mencatat timpaan itu.
**Kalibrasi:** dokumen tiruan normal 91–97% kata dikenal, 0% karakter janggal; PDF rusak 0% kata
dikenal, 14% karakter janggal. Unit korpus: minimum 97%. Karena kosakata berasal dari korpus itu
sendiri, diuji juga dengan 10% dokumen yang tidak ikut membentuk kosakata: minimum 86%, persentil 1
91%, tidak satu pun di bawah ambang. Ambang 50% memberi jarak lebar di kedua sisi.
**Diketahui:** dokumen kiriman yang penuh nama orang, alamat, atau istilah di luar PPh bisa punya
rasio kata dikenal lebih rendah daripada korpus. Bila itu terjadi, tombol timpa yang menanganinya.
Ambang perlu ditinjau ulang setelah KUP dan PPN memperluas kosakata.

## K-044 — Tanda "cocok lemah" tidak dipasang: data tidak bisa memisahkannya
Tanggal: 2026-10-03 · Milestone: sebelum M5 · Status: ditolak setelah diuji

**Permintaan:** tandai hasil yang tidak memuat kata kueri yang jarang; pertanyaan 6 dan 10 di set
uji tahan harus bertanda, jawaban yang benar tidak boleh.
**Hasil uji** (`scripts/search-weak.mjs`): tidak ada ambang yang memenuhi keduanya. Hasil teratas
pertanyaan 6 hanya kehilangan 33% bobot kata kueri yang ada di korpus (cek, online). Beberapa
jawaban yang benar kehilangan lebih banyak: zakat 66%, pajak luar negeri 61%, kontraktor 53%, batas
tidak kena pajak 52%, SPT 1770 SS 47%, TER 45%, EFIN 43%. Pertanyaan 10 (61%) setara dengan pajak
luar negeri. Kata yang sama sekali tidak ada di korpus (siang, gratis, ruko, kuliah) tidak membantu:
jawaban benar juga kehilangannya. Ambang yang menangkap pertanyaan 6 akan menandai sekitar 10
jawaban benar.
**Keputusan:** tanda tidak dipasang. Tanda yang salah pada jawaban benar lebih merugikan daripada
tidak ada tanda. Yang membuat pertanyaan 6 dan 10 keliru adalah wilayahnya, pajak daerah; itu
ditangani K-045. Daftar "tidak ditemukan" di kartu tetap ada, dan hasil halaman kini membawa idf
tiap kata yang hilang (`missingIdf`) untuk analisis berikutnya.
**Pemilik (2026-10-04):** diterima.

## K-045 — Keterangan pajak daerah dari berkas data
Tanggal: 2026-10-03 · Milestone: sebelum M5 · Status: berlaku

**Keputusan:** `src/data/search/pajak-daerah.json` berisi kelompok istilah, kalimat keterangan,
dan `batal_bila`. Bila kueri memuat istilahnya, kotak "Pajak daerah" tampil di atas hasil. PBB
punya dua kelompok: yang khusus (PBB-P2, PBB perdesaan/perkotaan, SPPT) dan yang umum ("PBB"
saja), dengan kalimat yang menyebut bahwa PBB-P5L masih dikelola DJP; keduanya batal bila kueri
memuat perkebunan, perhutanan, pertambangan, migas, panas bumi, atau P5L. Hanya keterangan yang
lebih khusus yang tampil bila keduanya cocok.
**Alasan memilih istilah:** "kendaraan bermotor" sendiri muncul 240 kali di 30 dokumen pajak pusat
(PPnBM, PPh Pasal 22), jadi pemicunya "pajak kendaraan bermotor", PKB, Samsat, STNK, BBNKB.
**Hasil:** di kedua set, hanya pertanyaan 6 dan 10 yang memicu keterangan; tidak ada pertanyaan set
evaluasi yang ikut. PBB perkebunan, PBB P5L pertambangan, PPnBM kendaraan bermotor, dan PPh 22
importir kendaraan bermotor tidak memicu.

## K-046 — Singkatan TER, dan set uji tahan tidak lagi bersih untuk pertanyaan 4
Tanggal: 2026-10-03 · Milestone: sebelum M5 · Status: berlaku

**Keputusan:** `["TER", "Tarif Efektif Rata-rata", "tarif efektif"]` di `istilah.json`. "Tarif
efektif rata-rata" hanya muncul 6 kali di 1 dokumen; PP 58/2023 dan PMK 168/2023 menulis "tarif
efektif" (28 kali, 3 dokumen), dan TER dalam pemakaian sehari-hari menunjuk tarif itu. Pertanyaan 4
set uji tahan naik dari 11 ke 1. Karena singkatan ini ditambahkan setelah set itu menunjukkan
kegagalannya, pertanyaan 4 diberi tanda `tidak_bersih` di berkasnya. Set evaluasi tidak berubah
(median 5, 18 dari 25 di 10 besar).

## K-047 — Pesan penyimpanan belum permanen, dan permintaan ulang setelah dipasang
Tanggal: 2026-10-03 · Milestone: sebelum M5 · Status: berlaku

**Keputusan:** bila penyimpanan belum permanen, halaman koleksi menjelaskan bahwa ini lazim untuk
situs yang belum dipasang, bahwa koleksi hanya terhapus bila ruang perangkat hampir habis, dan
mengingatkan untuk mengekspor cadangan. Saat halaman dibuka dalam mode terpasang
(`display-mode: standalone`), `navigator.storage.persist()` diminta ulang otomatis.

## K-048 — Perubahan SPEC: cakupan PPh, KUP, PPN; urutan milestone; jam dan VPN
Tanggal: 2026-10-03 · Milestone: sebelum M5 · Status: berlaku

**Keputusan pemilik, diterapkan di SPEC dengan riwayat perubahan bertanggal:** cakupan v1 PPh, KUP,
PPN (bagian 3); M5 KUP dan PPN, M6 pemasangan dan luring, M7 kategori lain dan pipa pembaruan malam,
M8 penyiapan rilis (bagian 7); kalimat ketersediaan teks dari K-032 (bagian 5); syarat jam 21.00 WIB
dicabut dan VPN dinyatakan termasuk proxy (bagian 8). CLAUDE.md diselaraskan.

## K-049 — Penolakan bukti konsep dibaca ulang: DJP dicabut, JDIH tidak dicoba
Tanggal: 2026-10-03 · Milestone: M5 · Status: berlaku

**Bukti DJP:** `poc/data/fetch_log.jsonl` mencatat 1.988 permintaan ke `www.pajak.go.id` berstatus
200 dan 25 kegagalan, semuanya `RemoteDisconnected` atau `ReadTimeout`. Tidak ada 401, 403, 429,
atau 503. Penghentian 26 September dipicu pemutus sirkuit kita sendiri (4 dari 20 gagal), bukan
penolakan dari DJP; SPEC bagian 8 sendiri menyebut pemutusan sporadis DJP normal.
**Tindakan DJP:** golongan (a). Atas izin pemilik, entri `www.pajak.go.id` dihapus dari
`poc/data/host_stopped.json` (2026-10-03), lalu satu permintaan uji ke robots.txt: HTTP 200.
**Bukti JDIH:** 884 permintaan pada 21 September 13.59–15.01 UTC dengan jeda median 4 detik (aturan
20 detik belum berlaku), semuanya berhasil. Sekitar 9 jam kemudian, 00.15 UTC, seluruh koneksi ke
`jdih.kemenkeu.go.id` dan `www.kemenkeu.go.id` gagal di tahap TLS (curl exit 35), juga 30 menit
kemudian. Tidak ada kode HTTP, karena koneksinya tidak pernah terbentuk. Tidak tercatat uji dari
browser biasa, dan tidak tercatat apakah VPN aktif saat itu.
**Tindakan JDIH:** tidak dicoba. Pola "seluruh domain terputus setelah semburan permintaan rapat"
cocok dengan blokir terhadap pengambil kita (golongan b), dan juga dengan blokir alamat VPN
(golongan a); keduanya tidak bisa dibedakan dari data yang ada. Mencoba lagi dari koneksi lain saat
blokir terhadap kita masih berlaku berarti mengakali pembatasan. Pemilik diminta memeriksa sendiri
dengan browser biasa (lihat laporan sesi); entri JDIH di `poc/data/host_stopped.json` tetap.
**Juga diperiksa:** Cloudflare WARP terpasang di mesin ini, berstatus *Disconnected (Manual
Disconnection)* saat pengambilan dimulai; tidak ada adapter VPN aktif; proxy sistem Windows
nonaktif.

## K-050 — Pengambil M5: putus koneksi mengakhiri putaran, bukan menghentikan host selamanya
Tanggal: 2026-10-03 · Milestone: M5 · Status: berlaku

**Keputusan:** `pipeline/polite.py`, turunan `poc/fetch.py`, dengan aturan bagian 8 utuh (robots.txt,
jeda 20 detik, 1.500 per host per 24 jam bergulir, satu proses, user agent jujur). Bedanya:
(1) HTTP 401/403/429/503 menghentikan host selamanya, seperti dulu; (2) koneksi terputus atau waktu
habis tanpa kode itu dicatat dan itemnya diulang putaran berikutnya; lebih dari 6 dari 20 gagal
mengakhiri putaran tanpa menulis penghentian; (3) 8 kegagalan sambung berturut-turut, pola host yang
berhenti melayani kita, menghentikan host selamanya; (4) proxy dari variabel lingkungan diabaikan
(`trust_env = False`) dan `net_guard.py` menolak jalan bila ada VPN, proxy sistem, atau WARP aktif,
lalu meminta konfirmasi manusia untuk yang tidak bisa diperiksa (VPN di router).
**Alasan:** aturan lama (lebih dari 3 dari 20 gagal = berhenti selamanya) menghentikan DJP karena
perilaku yang SPEC sebut normal, dan pencabutannya butuh manusia. Aturan baru membedakan
penolakan dari gangguan biasa, tanpa melonggarkan penolakan.
**Dependensi:** `requests`, `beautifulsoup4`, `lxml` di `.venv` (`pipeline/requirements-ambil.txt`).
`pipeline.build` tetap tanpa dependensi. Tes pengambil luring dan dilewati bila dependensinya tidak
ada.

## K-051 — Daftar kategori disimpan sebagai asal pengambilan, bukan klasifikasi sumber
Tanggal: 2026-10-03 · Milestone: M5 · Status: berlaku untuk data; tampilan menunggu pemilik

**Keputusan:** `harvest/djp_list.jsonl` mencatat di daftar kategori mana sebuah baris ditemukan
(`_kategori_daftar`: KUP atau PPN, beserta `_list_url`), sama seperti `_list_url` yang sudah ada
untuk PPh di `poc/data`. Bidang `kategori` dan `tag` di halaman detail tidak disimpan, sesuai K-010.
**Pertanyaan untuk pemilik sebelum B4:** M5 meminta label dan saringan kategori. K-010 menghapus
`kategori` DJP dari repo karena klasifikasi buatan sumber tetap dilindungi (SPEC bagian 9). Apakah
menampilkan "ditemukan di daftar KUP katalog DJP" dianggap menerbitkan ulang klasifikasi itu? Data
untuk kedua jawaban sudah ada; yang perlu diputuskan hanya tampilannya.
**Keputusan pemilik (2026-10-04):** boleh, dengan batas. Label kategori dipakai untuk saringan dan
kartu, hanya dalam bentuk asal daftar ("Dari daftar KUP katalog DJP") dan hanya tiga nilai: PPh, KUP,
PPN. Tag, klasifikasi rinci, dan abstrak sumber tetap tidak diterbitkan (SPEC bagian 9, K-010).
**Alasan:** keterangan di daftar mana dokumen ditemukan adalah asal-usul pengambilan, sejenis URL
sumber dan tanggal ambil yang memang wajib tampil (invarian 2). Itu bukan penerbitan ulang susunan
klasifikasi sumber: tiga nilai yang kami pilih sendiri sebagai cakupan, bukan pohon kategori DJP.
SPEC bagian 9 diberi penegasan ini.

## K-052 — Putaran pengambilan bisa dihentikan rapi dengan berkas sinyal
Tanggal: 2026-10-03 · Milestone: M5 · Status: berlaku

**Keputusan:** bila `harvest/BERHENTI` ada, putaran berhenti di antara dua permintaan, menyimpan
keadaan dan catatan putarannya. Perintah `jalan` berikutnya menghapus berkas itu dan melanjutkan.
**Alasan:** pada 2026-10-03 internet pemilik harus mati pukul 11.30, sedangkan daftar katalog baru
selesai sekitar 14.45. Mematikan proses secara paksa memang tidak merusak data (keadaan disimpan per
halaman), tetapi catatan putarannya hilang. Mempercepat dengan jeda di bawah 20 detik tidak
dipertimbangkan (SPEC bagian 8).

## K-053 — Urutan pengambilan: KUP sampai tuntas dulu, lalu PPN
Tanggal: 2026-10-04 · Milestone: M5 · Status: berlaku

**Keputusan pemilik:** urutan putaran menjadi daftar KUP, detail KUP, daftar PPN, detail PPN
(sebelumnya kedua daftar dulu). Begitu detail KUP lengkap, B3–B5 dikerjakan untuk KUP saja dan
diterbitkan; PPN menyusul sebagai tahap kedua M5 (SPEC bagian 7).
**Alasan:** KUP adalah prioritas pengguna. Dengan urutan lama, sisa 477 halaman daftar PPN harus
selesai dulu sebelum satu pun detail KUP diambil.

## K-054 — JDIH diuji ulang: lulus; keadaan dan batasnya terpisah per host
Tanggal: 2026-10-04 · Milestone: M5 · Status: berlaku

**Bukti dari pemilik:** `jdih.kemenkeu.go.id` terbuka di browser biasa tanpa VPN, dari jaringan rumah
dan dari data seluler. Menurut kriteria di laporan sesi 2026-10-03, blokir lama sudah tidak berlaku.
Atas izin pemilik, entri JDIH dihapus dari `poc/data/host_stopped.json`; entri `setpp` tetap.
**Uji** (`pipeline/jdih_probe.py`): dua permintaan pada 2026-10-04 02.55 UTC, robots.txt (HTTP 200,
halaman uji diizinkan) lalu `/dok/pmk-81-tahun-2024` (HTTP 200, 458 KB). Tidak ada penolakan.
Halaman masih memuat data dokumen yang sama dengan bukti konsep: masa berlaku ("01 Jan 2025 - s.d.
Dicabut"), relasi terstruktur, dan 8 berkas unduhan.
**Keadaan per host:** `Fetcher(root=...)` memberi JDIH log, berkas penghentian, kunci proses, dan
cache sendiri di `harvest/jdih/`, sehingga batas 24 jam dan penghentiannya terpisah dari DJP.
Penghentian yang tertulis di mana pun tetap dihormati semua pengambil.
**Catatan pemilik:** kegagalan bukti konsep terjadi setelah sekitar 884 permintaan berjeda 3–4 detik,
jadi kemungkinan besar dulu pengambil kitalah yang diblokir. Karena itu penolakan sekecil apa pun
dari JDIH berarti berhenti total tanpa coba ulang. Pengambilan JDIH sungguhan dijadwalkan setelah
detail KUP, dengan jeda 20 detik.
**Pengintaian luring** (`pipeline/jdih_scout.py`, dari daftar JDIH bukti konsep, 8.647 dokumen):
lihat laporan M5 di PROGRESS.

## K-055 — Satu aturan mutu teks untuk koleksi pribadi dan berkas JDIH
Tanggal: 2026-10-05 · Milestone: M5 · Status: berlaku

**Keputusan (permintaan pemilik):** teks berkas teks penuh JDIH (terutama 30 dokumen PPh JDIH-only
yang hanya berupa PDF) dinilai dengan aturan K-043 yang sama persis: `scripts/jdih-pdf-text.mjs`
memanggil `extractPdf` dan `assessText` dari `src/lib/collection/extract.js`, dengan kosakata korpus
yang sama seperti di browser. Ambang tetap: karakter janggal ≤ 10%, kata dikenal ≥ 50%, minimal 15
kata. Teks di bawah ambang, atau PDF tanpa lapisan teks, tidak masuk korpus; dokumennya tampil
sebagai tanpa teks dengan tautan ke PDF asli (invarian 3 dan 4).
**Alasan memakai Node, bukan versi Python:** satu kode berarti satu aturan; versi kedua dalam bahasa
lain bisa menyimpang diam-diam. pdf.js sudah ada di repo, PyMuPDF tidak. Diuji pada 9 PDF tiruan:
4 terbaca (kata dikenal 91–97%), 4 tanpa lapisan teks, 1 tanpa ToUnicode ditolak (0% kata dikenal,
13,8% karakter janggal).

## K-056 — robots.txt DJP dan JDIH: tidak ada Crawl-delay, jeda tetap 20 detik
Tanggal: 2026-10-05 · Milestone: M5 · Status: berlaku

**Diperiksa:** robots.txt `www.pajak.go.id` (bawaan Drupal: hanya Disallow untuk /admin/, /search/,
/user/, dan sejenisnya) dan `jdih.kemenkeu.go.id` (`Allow: /`, Disallow /api/auth, /api/health,
/pdfjs). Keduanya tanpa Crawl-delay. Sesuai arahan pemilik, jeda tetap 20 detik; kuota 1.500/24 jam
tidak berubah. `polite.py` kini menyimpan salinan robots.txt di cache tiap host dan memakai
Crawl-delay bila suatu saat ada.

## K-057 — Jendela kegagalan hanya menghitung putaran yang sedang berjalan
Tanggal: 2026-10-05 · Milestone: M5 · Status: berlaku (memperbaiki K-050)

**Masalah:** aturan "lebih dari 6 dari 20 permintaan terakhir gagal" menghitung 20 catatan terakhir di
log tanpa melihat umurnya. Pagi ini (10.23–10.25 WIB) DJP memberi 1 putus koneksi lalu 5 galat TLS
(`SSLEOFError`, `UNEXPECTED_EOF_WHILE_READING`) berturut-turut, sehingga putaran berakhir. Pukul 13.01
robots.txt dan satu detail kembali HTTP 200, lalu satu waktu habis membuat jendela tetap 7 dari 20,
dan lima putaran berikutnya berhenti tanpa satu permintaan pun. Jendela itu tidak akan pernah pulih.
**Keputusan:** jendela hanya memuat permintaan sejak putaran ini dimulai. Aturan lain tidak berubah.
**Catatan bukti:** galat TLS beruntun itu bukan kode penolakan (401/403/429/503), jadi bukan alasan
berhenti total menurut bagian 8; DJP kembali melayani 2,5 jam kemudian. Polanya mirip awal kegagalan
JDIH di bukti konsep, jadi dicatat dan dilaporkan ke pemilik. Aturan 8 kegagalan sambung
berturut-turut tetap menghentikan host selamanya.

## K-058 — Pengambil JDIH: tiga antrean, kegagalan apa pun menghentikannya
Tanggal: 2026-10-05 · Milestone: M5 · Status: berlaku

**Keputusan:** `pipeline/jdih_harvest.py`, berjalan bersamaan dengan pengambil DJP, dengan log, kunci,
cache, dan penghentian sendiri di `harvest/jdih/`. Urutan pemilik: (a) halaman dokumen JDIH untuk
dokumen KUP yang juga ada di JDIH, (b) sama untuk PPN dari daftar yang sudah diambil, (c) halaman dan
berkas teks penuh dokumen PPh yang hanya ada di JDIH (HTML bila ada, karena teksnya pasti; PDF bila
tidak). Pencocokan DJP ke JDIH lewat nomor, seperti `pipeline.build`.
- KMK kurs dan bunga dibuang dari antrean (SPEC bagian 3). Dua sempat terambil sebelum ini diperbaiki;
  rekamannya dibuang.
- **Kegagalan apa pun dari JDIH, termasuk putus koneksi tanpa kode, menghentikannya selamanya**, lebih
  ketat dari DJP. Alasannya arahan pemilik ("penolakan sekecil apa pun") dan riwayat bukti konsep:
  JDIH dulu gagal di tahap TLS, bukan dengan kode HTTP.
- `Label` di halaman JDIH adalah klasifikasi sumber dan tidak disimpan (K-010). Berkas unduhan
  disimpan di `harvest/jdih/files/` dan tidak di-commit; teksnya diambil oleh K-055.

## K-059 — Halaman daftar tidak bisa menggantikan halaman detail
Tanggal: 2026-10-05 · Milestone: M5 · Status: diperiksa, tidak ada perubahan

**Pertanyaan pemilik:** apakah daftar KUP/PPN sudah memuat cukup data sehingga sebagian detail tidak
perlu diambil? **Hasil (luring, 709 detail):** daftar memuat nomor, judul, jenis, tanggal, dan
status, dan nilainya sama persis dengan detail (709 dari 709). Yang hanya ada di detail: teks batang
tubuh, tautan lampiran, dan peraturan terkait. 96 detail (14%) ternyata tidak menambah apa pun (tanpa
teks, lampiran, maupun relasi), tetapi daftar tidak memberi petunjuk mana yang begitu.
**Kesimpulan:** tidak ada penghematan aman di luar yang sudah dilakukan: 275 dokumen yang sudah ada di
korpus PPh, 140 KMK kurs/bunga, dan dokumen yang tercatat di dua kategori hanya diambil sekali.


## K-060 — Korpus KUP (tahap 1 M5): kategori sebagai asal daftar, status JDIH dari daftarnya
Tanggal: 2026-10-05 · Milestone: M5 · Status: dikerjakan di cabang `m5-kup`, belum terbit

**Keputusan:**
- `pipeline.build` membaca daftar dan detail KUP dari `harvest/`; kategori yang masuk korpus diatur
  `config.DJP_CATEGORIES` (kini `["KUP"]`, PPN ditambahkan di tahap 2). Dokumen yang ada di daftar
  PPh dan KUP tetap satu dokumen dengan dua kategori.
- Tiap dokumen membawa `categories`: daftar `{kategori, asal}` dengan asal `daftar_djp` (daftar
  kategori katalog DJP tempat dokumen ditemukan) atau `pilihan_jdih` (kandidat PPh yang dipilih
  bukti konsep dari JDIH). Situs menulisnya "Dari daftar KUP katalog DJP" atau "PPh menurut pilihan
  situs ini dari JDIH", tidak pernah dengan klasifikasi sumber (K-051).
- Klaim status JDIH untuk dokumen KUP yang juga ada di JDIH diambil dari daftar JDIH bukti konsep
  (21 September), seperti untuk PPh. Halaman dokumen JDIH yang diambil di M5 menambah relasi dan masa
  berlakunya bila sudah ada.
- Status satu sumber kini ditulis "klaim satu sumber saja (DJP); tidak ada sumber kedua untuk
  dibandingkan", bukan "hanya satu sumber".
- Dokumen JDIH yang berkasnya tidak lolos K-055 tampil tanpa teks dengan tautan ke PDF aslinya.
- Detail KUP yang belum diambil diberi alasan "halaman detail sumber belum diambil", bukan "gagal".
**Hasil build (detail KUP 712 dari 892 saat itu):** 1.970 dokumen (PPh 1.122, KUP 1.112, keduanya
264), semua pemeriksaan invarian lulus.

## K-061 — Set evaluasi memburuk dengan KUP: belum terbit
Tanggal: 2026-10-05 · Milestone: M5 · Status: terbuka

**Temuan:** dengan KUP di korpus, 4 dari 25 pertanyaan turun peringkat: honor pembicara 10 → 23,
zakat 13 → 22, beasiswa 1 → 2, pajak luar negeri 7 → 11. Median tetap 5, 10 besar 18 → 16. Contoh
penyebab: "honor jadi pembicara seminar dipotong pajak" kini dimenangkan PER-DJP 26/2020 (KUP,
permohonan pegawai DJP menjadi pembicara), yang memang cocok kata per kata; kata "pembicara" juga
kehilangan kelangkaannya karena muncul di lebih banyak dokumen.
**Keputusan:** kriteria M5 "set evaluasi tidak memburuk" belum terpenuhi, jadi tahap KUP tidak
diterbitkan dulu. Perbaikannya keputusan peringkat (misalnya bobot kategori atau padanan baru) dan
dikerjakan di sesi berikutnya dengan data KUP lengkap; tidak ditebak di sesi ini.

## K-062 — Aturan JDIH disamakan dengan DJP; 404 berarti tidak ada di sumber
Tanggal: 2026-10-08 · Milestone: M5 · Status: berlaku (menggantikan butir "kegagalan apa pun" di K-058)

**Keputusan pemilik:** JDIH mengikuti aturan yang sama dengan DJP. Kode penolakan (401, 403, 429,
503) menghentikannya selamanya; waktu habis atau putus koneksi diulang di putaran berikutnya; aturan
putaran `polite.py` berlaku (lebih dari 6 dari 20 gagal mengakhiri putaran, 8 kegagalan sambung
berturut-turut menghentikan host). **HTTP 404 dicatat "tidak ada di sumber" lalu dilewati**, untuk
DJP maupun JDIH (`polite.NotFound`); itemnya tidak diulang. Berkas teks penuh JDIH yang 404 membuat
dokumennya tetap tanpa teks.
**Latar:** dengan aturan lama, satu berkas unduhan yang memang tidak ada
(`/api/download/b2ddfb7e-…/475 a~KMK 1995Kep.htm`) menghentikan JDIH enam kali antara 6 dan 7
Oktober, karena berkas itu selalu berada di depan antrean. Pemilik mencabut penghentian JDIH pada
2026-10-08.
**Catatan:** halaman `/dok/192-pmk-03-2018`, penyebab penghentian 5 Oktober, menurut log berhasil
diambil saat diulang (5 Oktober 12.59 UTC, HTTP 200, PMK 192/PMK.03/2018). Waktu habis pertama itu
gangguan sesaat, bukan halaman yang tidak ada.
**Uji alamat (2026-10-09):** 5 alamat acak dari 94 yang tersisa di antrean
(`pipeline.jdih_harvest cek-alamat`): kelimanya HTTP 200 dengan data dokumen. Daftar JDIH bukti
konsep (21 September) masih berlaku; tidak perlu diambil ulang sekarang.

## K-063 — Gerbang set evaluasi: median tidak boleh memburuk, penurunan per pertanyaan perlu persetujuan
Tanggal: 2026-10-09 · Milestone: M5 · Status: berlaku (keputusan pemilik atas K-061)

**Keputusan pemilik:** penurunan peringkat akibat korpus bertambah tidak otomatis menghalangi terbit.
`tests/search/kasus.test.mjs` kini gagal bila:
- median peringkat 25 pertanyaan PPh lebih buruk dari 5 (median sebelum KUP), atau median ke-35
  pertanyaan lebih buruk dari 8 (diukur 2026-10-09);
- sebuah pertanyaan lebih buruk dari garis dasarnya **dan** tidak tercantum di
  `penurunan_disetujui` (`tests/search/garis-dasar.json`) beserta penjelasan, atau lebih buruk dari
  peringkat `paling_buruk` yang disetujui.
**Disetujui pemilik 2026-10-08:** honor pembicara (garis dasar 10, disetujui sampai 24), zakat (13,
sampai 22), beasiswa (1, sampai 2), pajak luar negeri (7, sampai 13). Pajak luar negeri bernilai 11
pada 5 Oktober (detail KUP 712/892) dan 13 dengan detail lengkap; angka yang dicatat adalah yang
terukur saat persetujuan diterapkan.
**10 pertanyaan KUP berkosakata awam** ditambahkan (`kategori: "KUP"`), masing-masing dengan pasal dan
kutipan yang dicocokkan otomatis ke korpus. Peringkat pertamanya menjadi garis dasarnya: surat teguran
2, pemeriksaan 4, denda telat lapor 7, NPWP jabatan 8, keberatan 13, pembetulan SPT 16, pengungkapan
ketidakbenaran 32, daluwarsa penagihan 36, angsuran tunggakan 52, restitusi 82 (median 14,5). Tidak
ada padanan baru; kosakata "dicicil", "restitusi", "hangus" belum dijembatani.

## K-064 — Set uji tahan: pertanyaan 7 kini berjawaban KUP, dan tidak lagi bersih
Tanggal: 2026-10-09 · Milestone: M5 · Status: berlaku

**Keputusan:** pertanyaan 7 ("denda jika telat atau tidak melaporkan SPT Tahunan") pindah dari
golongan (b) ke (a), karena KUP kini di korpus. Jawabannya UU 28/2007 Pasal I, yang mengubah Pasal 7
ayat (1) UU KUP. Peringkatnya 20. Mesin dan padanan tidak disetel terhadapnya.
**Tidak bersih:** pertanyaan set evaluasi "denda telat lapor" berjawaban pasal yang sama, dan set
evaluasi dipakai untuk menyetel. Seperti pertanyaan 4 (K-046), angka pertanyaan 7 mulai sekarang
dibaca dengan catatan itu.
**Pertanyaan 5** (batas waktu SPT) tetap peringkat 1. Pertanyaan 1 (NPWP online) turun 3 → 9 karena
dokumen KUP tentang NPWP ikut bersaing; dilaporkan, tidak digerbang.

## K-065 — Rujukan koleksi pribadi: PMK 81/2024 kini tertaut
Tanggal: 2026-10-09 · Milestone: M5 · Status: berlaku

PMK 81/2024 masuk korpus lewat KUP, sehingga tes yang memakainya sebagai contoh "tidak ada di korpus"
diganti dengan nomor tiruan (PMK 999/2099) di dokumen tiruan SE. Keterangan di halaman koleksi
menjadi "tidak ada di korpus situs ini" (bukan "korpus PPh").
