# Penyerahan Saku Pajak v1.0.0

Tanggal: 2026-10-10 · Versi aplikasi: v1.0.0 (tag git `v1.0.0`) · Versi data: 9 Okt 2026

## Alamat

**https://mufuyumoku.github.io/tax/**

Alamat, nama repositori, dan path `/tax/` sengaja tidak diubah saat ganti nama menjadi Saku Pajak.
Akibatnya aplikasi yang sudah terpasang tetap jalan, dan nama serta ikonnya ikut berganti.

Saku Pajak bukan situs resmi pemerintah dan tidak berafiliasi dengan Kementerian Keuangan maupun
Direktorat Jenderal Pajak.

## Apa isinya

- Peraturan PPh, KUP, dan PPN dari katalog DJP dan JDIH Kemenkeu: 2.614 peraturan, 1.602 berteks.
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

Catatan: hasil `pipeline.pembaruan` belum dibaca oleh `pipeline.build`. Hasil itu masuk situs
bersama kategori lain di v1.1 (M7).

## Batasan utama

- Tidak memuat Surat Edaran, Nota Dinas, penegasan, putusan, pajak daerah, atau KMK kurs dan bunga.
- Kategori DJP PBB, BPHTB, Bea Meterai, dan "Lainnya" belum masuk; disiapkan untuk v1.1.
- Situs tidak menentukan status peraturan. Untuk 19% peraturan, sumber resmi berbeda pendapat.
- Relasi antarperaturan dibaca otomatis: 16 dari 20 contoh benar. Karena itu setiap relasi selalu
  disertai kutipannya.
- Sekitar 39% peraturan tanpa teks, karena sumbernya hanya memuat data ringkas.

## Kontak pembuat

MufuyuMoku (nama samaran), lewat GitHub: https://github.com/MufuyuMoku
