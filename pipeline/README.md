# pipeline

Pipa data Tax: mengubah arsip bukti konsep di `poc/` menjadi korpus baku di `corpus/`.

**Tidak ada permintaan jaringan sama sekali.** Seluruh masukannya sudah ada di repo. Pengambilan
jaringan baru baru muncul di M6 dan tunduk penuh pada SPEC bagian 8.

## Menjalankan

```
python -m pipeline.build        # bangun ulang corpus/ dari nol
python -m pipeline.fingerprint  # checksum korpus, untuk membuktikan hasilnya sama
python -m unittest discover -s pipeline/tests -t .
```

Pipa selalu menulis ulang `corpus/` dari nol dan hasilnya deterministik: dua kali jalan memberi
sidik jari yang sama.

## Masukan

Semuanya dari `poc/data` dan `poc/text`. Berkas `poc/data/host_stopped.json` hanya boleh diubah
manusia, dan pipa ini tidak menyentuhnya.

## Keluaran

| Berkas | Isi |
|---|---|
| `corpus/documents/<id>.json` | satu berkas per dokumen |
| `corpus/pasal/<id>.json` | satu berkas per pasal, diktum, atau pasal peraturan perubahan |
| `corpus/index.json` | indeks ringkas untuk daftar dan, nanti, pencarian |
| `corpus/meta.json` | jumlah, sebaran, dan checksum tiap berkas masukan |

Identitas dokumen dipakai sebagai `id`, misalnya `pmk-168-2023`. Nomor KMK berulang antar seri,
jadi serinya ikut jadi kunci (`kmk-744-km-4-2020`). Ralat dan naskah konsolidasi berbagi nomor
dengan induknya, jadi variannya ikut (`...-ralat`, `...-konsolidasi`).

## Modul

| Modul | Tugas |
|---|---|
| `identity.py` | menormalkan identitas peraturan dari dua gaya penulisan nomor |
| `pasal.py` | memecah teks jadi pasal, butir perubahan, atau diktum; menandai struktur janggal |
| `status.py` | menyusun status dari klaim tiap sumber; tidak pernah menebak |
| `relations.py` | membaca relasi mencabut/mengubah dari teks, selalu dengan kutipan kalimatnya |
| `attachments.py` | mencocokkan nomor di nama berkas lampiran dengan dokumen induknya |
| `checks.py` | memeriksa invarian; pelanggaran menggagalkan build, korpus tidak ditulis |
| `build.py` | menggabungkan semuanya dan menulis korpus |

## Yang sengaja tidak dilakukan

- Tidak menggabungkan dua dokumen yang sumbernya beri jenis berbeda. Bila nomor, tahun, dan
  judulnya sama tetapi jenisnya beda, keduanya tetap terpisah dan saling menunjuk lewat
  `identity_conflicts`. Menggabungkan berarti menebak.
- Tidak memperbaiki teks sumber. Salah ketik seperti "Pasal 3" yang muncul dua kali tetap apa
  adanya, ditandai di `quality_flags`.
- Tidak memakai klasifikasi sumber (`label`, `tematik`, `kategori`, `tag`); bidang itu sudah
  dihapus dari berkas yang di-commit (K-010).
- `poc/select_pph.py` tidak dijalankan lagi. Pemilihan dokumen PPh sudah selesai dan hasilnya
  dipakai apa adanya dari `poc/data/jdih_pph_candidates.jsonl`.
