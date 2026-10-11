# Cakupan daftar "Lainnya" — `cakupan-lainnya.json`

Daftar "Lainnya" di katalog DJP mencampur peraturan pajak dengan bea cukai, PNBP, organisasi, dan
topik lain. Berkas ini memuat keputusan untuk **setiap** peraturan di daftar itu: masuk Saku Pajak
atau tidak (keputusan pemilik 2026-10-11, K-088).

Yang tidak dicantumkan di sini:
- peraturan yang sudah ada di korpus;
- peraturan yang juga ada di daftar kategori lain (PPh, KUP, PPN, Bea Meterai, BPHTB, PBB);
- KMK kurs mingguan dan tarif bunga.

## Isi satu baris

```json
{"path": "/id/peraturan/...", "nomor": "...", "jenis": "...", "judul": "...", "masuk": true, "kelompok": "P3B", "alasan": "...", "diputuskan": "usulan judul"}
```

**`masuk`:**
- `true`: detailnya diambil dan masuk korpus.
- `false`: tidak diambil dan tidak masuk.
- `null`: meragukan. Tidak diambil sampai ada yang memutuskan.

**`kelompok` yang masuk:**
- KUP dan administrasi pajak
- P3B
- PBB dan BPHTB
- PPN dan PPh
- tempat terdaftar wajib pajak
- pajak daerah dan retribusi (dengan keterangan pajak daerah, K-086)

**`kelompok` yang tidak masuk:**
- bea masuk, bea keluar, cukai, kepabeanan
- Permendag
- PNBP
- anggaran dan perbendaharaan
- organisasi dan kepegawaian
- lain-lain bukan pajak DJP

**`diputuskan`:**
- `"usulan judul"`: usulan awal dari kata di judul (`scripts/cakupan-lainnya.mjs`).
- `"pemilik"`: diputuskan manusia. Baris seperti ini tidak pernah diubah skrip.

## Cara memindahkan sebuah peraturan

1. Cari barisnya, misalnya lewat nomor atau judul.
2. Ubah `masuk` (`true` atau `false`), `kelompok`, dan `alasan` (satu kalimat singkat).
3. Ubah `diputuskan` menjadi `"pemilik"`.
4. Jalankan `npm test`. Tes memeriksa bentuk berkas: nilai `masuk`, `kelompok` yang dikenal, dan
   alasan yang terisi.
5. Peraturan yang baru dipindah ke `true` diambil pada putaran berikutnya:
   `python -m pipeline.harvest jalan --tanpa-vpn`. Status JDIH-nya ikut diantrekan.

Peraturan yang dipindah ke `false` setelah detailnya sempat diambil tetap tersimpan di
`harvest/`, tetapi tidak masuk korpus.

## Memperbarui daftar

Setelah daftar "Lainnya" diambil ulang, jalankan `node scripts/cakupan-lainnya.mjs`:
- peraturan baru mendapat usulan dari judulnya;
- baris `"pemilik"` dibiarkan;
- daftar yang meragukan ditulis ulang ke `docs/LAINNYA-MERAGUKAN.md`.
