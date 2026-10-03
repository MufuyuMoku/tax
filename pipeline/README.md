# pipeline

Pipa data Tax: mengubah arsip bukti konsep di `poc/` menjadi korpus baku di `corpus/`.

**Pembangunan korpus (`pipeline.build`) tidak membuat permintaan jaringan sama sekali.** Seluruh
masukannya ada di repo. Satu-satunya bagian yang mengambil dari jaringan adalah pengambil KUP dan
PPN (`pipeline.harvest`, M5), yang tunduk penuh pada SPEC bagian 8; lihat bagian di bawah.

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

## Pengambilan KUP dan PPN (M5)

Pengambil butuh `requests`, `beautifulsoup4`, dan `lxml`. Pasang sekali di lingkungan terpisah:

```
python -m venv .venv
.venv\Scripts\python -m pip install -r pipeline/requirements-ambil.txt
```

**Perintah malam, dijalankan pemilik** (melanjutkan dari titik terakhir, berhenti sendiri saat kuota
24 jam habis, saat kegagalan menumpuk, atau saat semuanya selesai):

```
.venv\Scripts\python -m pipeline.harvest jalan --tanpa-vpn
```

`--tanpa-vpn` adalah pernyataan Anda bahwa koneksi ini tanpa VPN (termasuk Cloudflare WARP) dan
tanpa proxy. Tanpa tanda itu, perintah menanyakannya. Pengambil tetap memeriksa sendiri adapter VPN,
proxy sistem, variabel proxy, dan status WARP, dan menolak jalan bila ada yang aktif.

**Melihat kemajuan** (tanpa jaringan):

```
.venv\Scripts\python -m pipeline.harvest kemajuan
```

**Menghentikan putaran dengan rapi** (misalnya sebelum internet dimatikan): buat berkas kosong
`harvest/BERHENTI`. Putaran berhenti setelah permintaan yang sedang berjalan, menyimpan catatannya,
dan perintah `jalan` berikutnya menghapus berkas itu lalu melanjutkan dari titik berhenti.

```
type nul > harvest\BERHENTI
```

Perintah lain: `uji` (satu permintaan, robots.txt) dan `intai` (halaman pertama dan terakhir daftar
tiap kategori). `--batas N` membatasi jumlah permintaan halaman dalam satu putaran.

**Aturan yang dijaga kode** (`polite.py`, `net_guard.py`):

- robots.txt dibaca dan dipatuhi; jeda 20 detik per host; paling banyak 1.500 permintaan per host
  dalam 24 jam bergulir, dihitung dari `harvest/fetch_log.jsonl`.
- HTTP 401, 403, 429, atau 503 menghentikan host untuk selamanya, tercatat di
  `harvest/host_stopped.json`. Hanya manusia yang menghapus entrinya. Penghentian lama di
  `poc/data/host_stopped.json` tetap dihormati.
- Koneksi terputus atau waktu habis tanpa kode itu dicatat, dan itemnya diulang di putaran
  berikutnya. Bila lebih dari 6 dari 20 permintaan terakhir gagal, putaran berhenti tanpa
  menghentikan host. Hanya 8 kegagalan sambung berturut-turut yang dianggap host berhenti melayani
  kita, dan menghentikannya untuk selamanya.
- Satu proses pengambil pada satu waktu; user agent jujur; proxy dari lingkungan diabaikan.

**Berkas** di `harvest/`: `state.json` (kemajuan), `djp_list.jsonl` (baris katalog beserta daftar
kategori tempat baris itu ditemukan), `djp_detail.jsonl` (halaman detail beserta teksnya),
`fetch_log.jsonl`. Ketiganya di-commit seperti `poc/data`. `cache/` dan berkas kunci tidak.
Bidang `kategori` dan `tag` milik halaman sumber tidak pernah disimpan (K-010).

Tes pengambil berjalan tanpa jaringan dan butuh dependensi di atas:

```
.venv\Scripts\python -m unittest discover -s pipeline/tests -t .
```
