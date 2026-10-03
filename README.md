# Tax

Alat pencari peraturan pajak Indonesia. Situs statis, dipakai langsung di browser, dan bisa dipasang
di HP untuk dipakai tanpa internet.

**Bukan situs resmi pemerintah.** Sumber data: katalog peraturan Direktorat Jenderal Pajak dan JDIH
Kementerian Keuangan. Setiap dokumen membawa URL sumber dan tanggal pengambilannya.

Status: **M4 — koleksi pribadi.** Daftar, halaman dokumen dan pasal, pencarian di perangkat, dan
koleksi pribadi yang tersimpan hanya di perangkat sudah ada. Belum ada pemasangan luring (M5).

| Berkas | Isi |
|---|---|
| `docs/SPEC.md` | Spesifikasi: cakupan, invarian, milestone, kriteria selesai |
| `docs/PROGRESS.md` | Kemajuan per milestone |
| `docs/DECISIONS.md` | Keputusan beserta alasannya |
| `CLAUDE.md` | Konteks tetap proyek dan aturan kerja |
| `pipeline/` | Pipa data Python: arsip `poc/` menjadi korpus `corpus/` |
| `src/data/search/` | Singkatan, kata umum, dan toleransi OCR untuk pencarian; boleh disunting |
| `src/lib/collection/` | Koleksi pribadi: impor, IndexedDB, rujukan, cadangan |
| `tests/` | Tes pencarian dan koleksi (`npm test`); `tests/fixtures/koleksi/` hanya berisi dokumen tiruan |
| `poc/` | Arsip bukti konsep, termasuk `poc/LAPORAN.md` |

Pengembangan: `npm install`, lalu `npm run dev` atau `npm run build`. Tes: `npm test` untuk
pencarian, `python -m unittest discover -s pipeline/tests -t .` untuk pipa data.
