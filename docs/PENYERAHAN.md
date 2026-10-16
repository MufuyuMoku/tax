# Penyerahan Saku Pajak v1.0.0

Tanggal: 2026-10-10 · Versi aplikasi: v1.0.0 (tag git `v1.0.0`) · Versi data: 9 Okt 2026

Diperbarui 2026-10-16 untuk v1.2.0 (tag `v1.2.0`): kategori lain masuk di v1.1 dan pembaruan
otomatis di v1.2. Versi dan catatan per versi ada di halaman "Apa yang baru".

## Alamat

**https://mufuyumoku.github.io/tax/**

Alamat, nama repositori, dan path `/tax/` sengaja tidak diubah saat ganti nama menjadi Saku Pajak.
Akibatnya aplikasi yang sudah terpasang tetap jalan, dan nama serta ikonnya ikut berganti.

Saku Pajak bukan situs resmi pemerintah dan tidak berafiliasi dengan Kementerian Keuangan maupun
Direktorat Jenderal Pajak.

## Apa isinya

- Peraturan PPh, KUP, PPN, Bea Meterai, PBB, BPHTB, dan bagian "Lainnya" yang tentang pajak, dari katalog DJP
  dan JDIH Kemenkeu: 3.065 peraturan, 1.786 berteks (data 16 Okt 2026).
- Pencarian sampai ke pasal, berjalan di perangkat.
- Status menurut tiap sumber.
- Koleksi pribadi yang hanya ada di perangkat.
- Bisa dipasang dan dipakai tanpa internet.

Angka cakupan dan batasannya ada di halaman **Tentang dan batasan** (`/tax/tentang/`). Catatan
versi ada di **Apa yang baru** (`/tax/apa-yang-baru/`).

## Cara memasang

Di HP Android dengan Chrome:
1. Buka alamat di atas.
2. Tunggu baris kecil di bawah menu berbunyi "tersimpan di perangkat".
3. Pilih menu ⋮ → **Instal aplikasi**.

Langkah lengkap dan cara memeriksanya tanpa internet ada di [docs/PASANG.md](PASANG.md). Di
komputer kantor tidak perlu dipasang: cukup buka alamatnya di browser.

## Cara memperbarui

**Pengguna:**
- Saat daring, situs memeriksa sendiri apakah ada versi baru, dan hanya mengunduh berkas yang
  berubah.
- Bila sudah siap, muncul tombol **Muat data baru**. Halaman yang sedang dibaca tidak berubah
  sebelum tombol itu ditekan.

**Pengelola data** (perintah di folder repositori; butuh Python 3, Node 22, dan
`pip install -r pipeline/requirements-ambil.txt`):

```
python -m pipeline.pembaruan rencana                  # berapa permintaan yang dibutuhkan, tanpa jaringan
python -m pipeline.pembaruan jalan --tanpa-vpn        # ambil peraturan baru dan yang berubah
python -m pipeline.build                              # bangun ulang korpus dari data yang diambil
npm test && npm run build                             # periksa dan bangun situs
git add -A && git commit && git push                  # terbit lewat GitHub Actions
```

Aturan pengambilan:
- Ikuti `docs/SPEC.md` bagian 8: hanya sumber resmi, jeda 20 detik, dan batas 1.500 permintaan per
  host per 24 jam.
- Bila host menolak, pengambil berhenti total. Hanya manusia yang boleh mencabut berkas
  penghentiannya.
- Jangan pernah lewat VPN atau proxy.

Sejak v1.2.0, data diperbarui otomatis oleh GitHub Actions. Panduannya ada di
[docs/PEMBARUAN.md](PEMBARUAN.md).

## Batasan utama

- Tidak memuat Surat Edaran, Nota Dinas, penegasan, putusan, pajak daerah, atau KMK kurs dan bunga.
- Sejak v1.1, Bea Meterai, PBB, BPHTB, dan bagian "Lainnya" yang tentang pajak ikut dimuat. PBB rumah
  dan tanah serta BPHTB kini pajak daerah; yang ada di sini hanya aturan pusatnya.
- Situs tidak menentukan status peraturan. Untuk 18% peraturan (data 16 Okt 2026), sumber resmi berbeda pendapat.
- Relasi antarperaturan dibaca otomatis: 16 dari 20 contoh benar. Karena itu setiap relasi selalu
  disertai kutipannya.
- Sekitar 42% peraturan tanpa teks, karena sumbernya hanya memuat data ringkas.

## Kontak pembuat

MufuyuMoku (nama samaran), lewat GitHub: https://github.com/MufuyuMoku
