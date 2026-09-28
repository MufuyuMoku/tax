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
