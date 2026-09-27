# Tax

Alat pencari peraturan pajak Indonesia. Situs statis, dipakai langsung di browser, dan bisa dipasang
di HP untuk dipakai tanpa internet.

**Bukan situs resmi pemerintah.** Sumber data: katalog peraturan Direktorat Jenderal Pajak dan JDIH
Kementerian Keuangan. Setiap dokumen membawa URL sumber dan tanggal pengambilannya.

Status: **M0 — kerangka.** Belum ada data peraturan, daftar, maupun pencarian.

| Berkas | Isi |
|---|---|
| `docs/SPEC.md` | Spesifikasi: cakupan, invarian, milestone, kriteria selesai |
| `docs/PROGRESS.md` | Kemajuan per milestone |
| `docs/DECISIONS.md` | Keputusan beserta alasannya |
| `CLAUDE.md` | Konteks tetap proyek dan aturan kerja |
| `pipeline/` | Pipa data (diisi pada M1) |
| `poc/` | Arsip bukti konsep, termasuk `poc/LAPORAN.md` |

Pengembangan: `npm install`, lalu `npm run dev` atau `npm run build`.
