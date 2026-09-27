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
