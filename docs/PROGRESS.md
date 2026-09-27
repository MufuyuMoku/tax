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
