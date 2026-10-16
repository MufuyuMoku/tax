# Pembaruan otomatis Saku Pajak

Panduan untuk pemilik (M9, K-090, K-091). Tidak ada yang perlu Anda jalankan dalam keadaan normal.
Bila ada yang butuh tangan manusia, sebuah **issue GitHub** dibuka, dan GitHub mengirimkannya ke
email Anda.

## Cara kerjanya

Workflow **Pembaruan otomatis** (`.github/workflows/pembaruan.yml`) berjalan di GitHub Actions.
Server GitHub lolos uji: DJP dan JDIH menjawab halaman daftar sungguhan dari sana.

**Setiap hari pukul 02.00 WIB: ambil data**
1. Peraturan DJP yang baru dan yang berubah. Halaman daftar terbaru diperiksa, ditambah sapuan
   bergilir, sehingga seluruh katalog terperiksa sekitar sebulan sekali. Peraturan yang disebut
   "terkait" oleh peraturan baru juga diperiksa.
2. Peraturan baru di daftar "Lainnya" diberi usulan cakupan. Yang meragukan tidak diambil sampai
   Anda putuskan.
3. Daftar JDIH sejak 21 September, dan status JDIH untuk dokumen baru.

Semua aturan pengambilan berlaku (SPEC bagian 8): jeda 20 detik, paling banyak 1.500 permintaan per
host per 24 jam, dan berhenti total bila host menolak. Hasilnya di-commit oleh `github-actions[bot]`.

**Setiap hari Minggu: periksa dan terbitkan**
1. Korpus dibangun dari data terbaru dan dibandingkan dengan yang sedang terbit.
2. **Tidak ada perubahan:** hanya "terakhir diperiksa" yang dicatat. HP tidak mengunduh apa pun.
3. **Ada perubahan:** catatan "Peraturan baru dan yang berubah" ditulis, lalu dijalankan
   pemeriksaan invarian, `npm test` (termasuk kesetaraan hasil pencarian dan gerbang median), build
   situs (halaman luring harus identik), dan uji luring di Chrome.
   - **Semua lulus:** data baru diterbitkan. Paling sering seminggu sekali.
   - **Satu saja gagal:** tidak ada yang terbit, situs tetap seperti sebelumnya, dan sebuah issue
     dibuka.
   - **Ada pertanyaan set evaluasi yang turun peringkatnya:** dilaporkan, tetapi tidak menahan
     terbit.
   - **Median memburuk melewati batas:** terbit ditahan.

**Di HP:**
- Data baru diunduh sendiri saat aplikasi dibuka dengan internet, dan dipakai saat aplikasi dibuka
  lagi dari keadaan tertutup. Bila halaman sedang terbuka, muncul tombol **Muat data baru**.
- Baris kecil di bawah menu menyebut kapan data terakhir diperiksa dan kapan terakhir berubah.

## Arti issue yang masuk

Semua berlabel `pembaruan-otomatis`. Masalah yang sama tidak membuka issue baru; issue yang sudah
ada mendapat komentar baru.

| Judul | Arti | Yang perlu dilakukan |
|---|---|---|
| Pembaruan harian: host menolak | DJP atau JDIH menolak (HTTP 401/403/429/503) atau koneksinya berkali-kali putus. Pengambilan ke host itu **berhenti total**. | Periksa apakah situsnya memang bermasalah. Bila sudah aman, cabut status berhenti (lihat di bawah). Jangan pernah memakai proxy atau VPN. |
| Pembaruan harian: ada langkah yang gagal | Salah satu langkah berhenti dengan galat, misalnya sumber mengubah tampilan halamannya. | Baca keluaran di issue. Bila perlu perbaikan kode, minta sesi pengembangan. |
| Pembaruan harian: perlu keputusan cakupan | Ada peraturan baru di daftar "Lainnya" yang judulnya meragukan. | Putuskan di `src/data/cakupan-lainnya.json` (cara di `src/data/README-cakupan.md`). Daftarnya di `docs/LAINNYA-MERAGUKAN.md`. |
| Terbit ditahan: … gagal | Data baru melanggar invarian, gagal tes, gagal build, gagal uji luring, atau median memburuk. Situs tidak berubah. | Baca bagian "Yang gagal". Setelah diperbaiki atau diputuskan, jalankan workflow manual dengan langkah `terbit` dan `paksa`. |
| Pembaruan mingguan: data baru diterbitkan | Terbit berhasil, tetapi ada pertanyaan yang turun peringkatnya. | Tinjau tabelnya. Penurunan tercatat di `tests/search/garis-dasar.json` dengan `"otomatis": true`. Bila disetujui, hapus tanda itu; bila tidak, minta perbaikan pencarian. |

Issue berjudul `[UJI] …` berasal dari uji ujung ke ujung, bukan dari data sungguhan.

## Mencabut status berhenti

Penolakan dicatat di berkas berhenti. Hanya manusia yang boleh mengubahnya:
- DJP: `harvest/host_stopped.json`
- JDIH: `harvest/jdih/host_stopped.json`
- Peninggalan bukti konsep: `poc/data/host_stopped.json`

Langkahnya:
1. Pastikan penyebabnya sudah jelas dan aman. Jangan pernah mencoba dari jaringan lain, lewat proxy,
   atau lewat VPN.
2. Buka berkas itu di GitHub (ikon pensil), hapus entri host yang bersangkutan, lalu commit.
3. Pembaruan berikutnya berjalan lagi seperti biasa. Bila ingin segera, jalankan manual.

Penolakan yang hanya terlihat dari server GitHub di luar negeri tidak berarti situsnya menolak
semua orang. Kalau itu yang terjadi, pengambilan bisa dijalankan dari mesin Anda sendiri dengan
perintah di bawah.

## Mematikan pembaruan

- **Sementara:** di GitHub, buka **Actions → Pembaruan otomatis → ⋯ → Disable workflow**. Hidupkan
  lagi dengan **Enable workflow**.
- **Berhenti di tengah jalan:** buka run yang sedang berjalan, lalu **Cancel run**. Data yang sudah
  diambil tetap tersimpan pada run berikutnya.

## Menjalankan manual

**Di GitHub:** buka **Actions → Pembaruan otomatis → Run workflow**, lalu pilih:
- **langkah:** `harian` (ambil data), `terbit` (periksa dan terbitkan), atau `keduanya`;
- **paksa:** terbitkan walau terbit terakhir kurang dari 7 hari lalu;
- **uji:** `berhasil` atau `gagal` menjalankan uji ujung ke ujung dengan data tiruan. Uji ini tidak
  pernah menerbitkan apa pun.

**Di mesin sendiri** (folder repositori, Python 3 dan Node 22, tanpa VPN atau proxy):

```
pip install -r pipeline/requirements-ambil.txt
npm ci
python -m pipeline.otomatis harian
python -m pipeline.otomatis terbit --paksa
git add -A && git commit -m "Pembaruan manual" && git push
```

Perintah per langkah ada di `pipeline/otomatis.py`. Untuk berhenti rapi di tengah pengambilan,
buat berkas `harvest/BERHENTI`.

## Yang tidak dicakup pembaruan otomatis

- Perubahan status di JDIH untuk dokumen lama. Yang diperiksa hanya daftar JDIH baru dan status
  dokumen baru.
- Peraturan "Lainnya" yang meragukan. Peraturan itu menunggu keputusan Anda.
- Versi aplikasi. Pembaruan otomatis hanya mengubah data; versi aplikasi naik hanya saat kode
  berubah.
