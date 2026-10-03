# Tax — konteks proyek

Alat pencari peraturan pajak Indonesia. Pengguna: petugas pajak di KPP, lewat browser komputer kantor
yang tidak bisa memasang aplikasi, dan HP pribadi untuk dipakai tanpa internet.
Baca `docs/SPEC.md` sebelum mengerjakan apa pun; angka dan temuan yang mendasarinya ada di
`poc/LAPORAN.md`. Keputusan di `docs/DECISIONS.md`, kemajuan di `docs/PROGRESS.md`.

## Tumpukan

- Astro statis murni. Tanpa framework UI, tanpa Tailwind. CSS biasa dengan CSS variables.
- Tanpa server, tanpa akun, tanpa telemetri. Pencarian berjalan di perangkat.
- Terbit ke GitHub Pages lewat GitHub Actions (`.github/workflows/deploy.yml`).
- Pipa data: Python, di `pipeline/` (diisi pada M1; skrip asal ada di `poc/`).

## Aturan kerja

- **Satu milestone per sesi.** Urutan dan kriteria selesai ada di SPEC bagian 7. Jangan lompat ke
  depan. Jangan membuat antarmuka untuk lapis yang belum ada datanya.
- Setelah satu milestone selesai: **berhenti dan laporkan** apa yang dibangun, bagaimana kriteria
  selesainya diverifikasi, dan keputusan apa yang diambil sendiri.
- Kalau SPEC tidak menjawab suatu pertanyaan: ambil keputusan paling sederhana, lalu sebutkan di
  laporan. Jangan menebak diam-diam.
- **Jangan menulis kode yang mengembalikan nilai palsu.** Yang belum diimplementasikan harus
  mengembalikan galat yang jelas.
- Setiap keputusan dicatat di `docs/DECISIONS.md` beserta alasannya.
- Bahasa: kode, identifier, komentar, dan pesan commit dalam bahasa Inggris. Dokumen dan seluruh
  teks antarmuka dalam bahasa Indonesia.
- Identitas git sudah disetel per repo (MufuyuMoku + alamat noreply). Jangan mengubah setelan global.

## Invarian

Rincian dan alasannya di SPEC bagian 4. Ringkasnya, tidak boleh dilanggar apa pun alasannya:

1. Status tidak pernah ditebak; klaim tiap sumber tampil apa adanya dengan tanggal ambilnya; yang
   bertentangan ditandai tidak pasti (17% dokumen).
2. Tiap dokumen selalu membawa URL sumber dan tanggal pengambilan.
3. Dokumen tanpa teks tetap muncul, dengan keterangan dan tautan ke aslinya. Tidak disembunyikan.
4. Lampiran pindaian tampil sebagai PDF asli, tidak pernah sebagai teks OCR.
5. Relasi adalah petunjuk, bukan kebenaran; selalu disertai kutipan kalimat sumbernya.
6. Nomor di nama berkas lampiran dicocokkan dengan dokumen induk; yang tidak cocok ditandai.
7. Koleksi pribadi tidak pernah meninggalkan perangkat.
8. Skor keyakinan OCR tidak pernah jadi penentu kelayakan.
9. Situs menyatakan dirinya bukan situs resmi pemerintah dan menyebut sumber datanya.
10. Dokumen kiriman calon pengguna (SE, ND, penegasan, putusan) tidak pernah masuk repo, data
    bawaan situs, atau commit mana pun; hanya lokal di `samples-local/` yang di-gitignore.

## Aturan pengambilan data

Berlaku penuh, warisan bukti konsep (SPEC bagian 8): hanya sumber resmi, hormati robots.txt, jeda
20 detik, batas dalam jendela 24 jam bergulir, berhenti total bila host menolak, **tidak pernah**
mengakali pembatasan (tidak ganti IP, tidak proxy, tidak VPN, tidak memalsukan user agent). Syarat
jam 21.00 WIB dicabut pemilik pada 2026-10-03. Koneksi yang diputus DJP sporadis itu normal: catat, lanjutkan, ulang di putaran
berikutnya. `poc/data/host_stopped.json` hanya boleh diubah manusia.

## Jangan dibangun

- Bot yang merangkai jawaban, OCR di perangkat, pencarian berbasis makna.
- Data dari sumber tidak resmi; KMK kurs dan tarif bunga berkala.
- Lisensi apa pun (belum diputuskan; jangan ditambahkan).
