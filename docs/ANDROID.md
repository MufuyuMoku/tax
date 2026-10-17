# Aplikasi Android Saku Pajak (APK)

Panduan untuk pemilik (K-094).

## Apa isinya

APK Saku Pajak adalah pembungkus tipis (Trusted Web Activity) untuk
https://mufuyumoku.github.io/tax/. Isinya situs yang sama, dibuka Chrome tanpa bilah alamat.
- Nama aplikasi: **Saku Pajak**. Ikon sama dengan situs.
- Nama paket: `io.github.mufuyumoku.sakupajak`.
- Data, pencarian, pemakaian tanpa internet, dan koleksi pribadi semuanya dari situs. Pembaruan data
  dan tampilan datang lewat situs, sehingga APK **jarang perlu dirilis ulang**.
- Butuh **Google Chrome** di HP. Tanpa Chrome, aplikasi terbuka di browser lain dengan bilah alamat.

Cara lain tetap berlaku: membuka situs di Chrome lalu **Instal aplikasi** (lihat `docs/PASANG.md`).
APK berguna untuk orang yang lebih terbiasa memasang berkas aplikasi, atau bila tautan situs
dibagikan sebagai berkas.

## Memasang dari berkas APK

1. Salin berkas `SakuPajak-<versi>.apk` ke HP (unduh, kabel, atau aplikasi berbagi berkas).
2. (Disarankan) Cocokkan SHA-256 berkas dengan yang diumumkan pembuat. Di komputer Windows:
   `certutil -hashfile SakuPajak-<versi>.apk SHA256`.
3. Di HP, buka berkas itu dari aplikasi Berkas/Files atau dari browser.
4. Android menampilkan peringatan **"Untuk keamanan, HP Anda tidak diizinkan menginstal aplikasi
   tidak dikenal dari sumber ini"**. Ketuk **Setelan**, nyalakan **Izinkan dari sumber ini** untuk
   aplikasi yang Anda pakai membuka berkas, lalu kembali.
5. Ketuk **Instal**. Play Protect bisa memperingatkan bahwa aplikasinya tidak dikenal, karena tidak
   berasal dari Play Store. Ketuk **Detail lainnya → Tetap instal**.
6. Setelah terpasang, matikan lagi **Izinkan dari sumber ini** (Setelan → Aplikasi → aplikasi
   pembuka berkas → Instal aplikasi tidak dikenal).
7. Buka **Saku Pajak**. Pembukaan pertama harus dengan internet, supaya data tersimpan di HP.
   Setelah itu aplikasi bisa dipakai tanpa internet.

## Memeriksa setelah dipasang

Uji ini belum bisa dijalankan di emulator (K-094), jadi perlu satu HP sungguhan:
1. Buka **Saku Pajak** dari layar utama dengan internet menyala. Halaman harus tampil **tanpa bilah
   alamat** di atas. Bila bilah alamat muncul, tunggu satu menit, tutup, lalu buka lagi: Chrome
   memeriksa Digital Asset Links saat pembukaan pertama. Bila masih muncul, laporkan.
2. Tunggu baris kecil di bawah menu berbunyi "tersimpan di perangkat".
3. Cari `tarif PPh pesangon`, buka satu peraturan, lalu satu pasal.
4. Nyalakan mode pesawat, tutup aplikasi, lalu buka lagi. Daftar, pencarian, dokumen, dan pasal
   harus tetap terbuka, dan penanda menyebut "Luring".

## Merilis ulang

APK hanya perlu dirilis ulang bila yang berubah adalah pembungkusnya: nama, ikon peluncur, nama
paket, alamat awal, atau persyaratan Android/Play yang baru. Perubahan isi situs tidak memerlukannya.

Bahan pembuatnya ada di luar repo, di `C:\Users\sorar\SakuPajak-android\`:
- `bangun.mjs` (salinannya di repo: `android/bangun.mjs`);
- pustaka Bubblewrap;
- `sdk\`, folder berisi junction ke Android SDK. **Jangan hapus folder ini dengan perintah hapus
  rekursif**, karena isi SDK sungguhan bisa ikut terhapus; pakai `rmdir` untuk tiap junction.

Langkah:
1. Naikkan nomor versi. `versionCode` harus lebih besar dari rilis sebelumnya, misalnya 2;
   `versionName` disamakan dengan versi aplikasi, misalnya 1.3.0.
2. Di PowerShell, dari `C:\Users\sorar\SakuPajak-android`:
   `$env:SAKU_KS_PASS = "<kata sandi keystore>"; node bangun.mjs 2 1.3.0`
3. Hasilnya `hasil\SakuPajak-1.3.0.apk`. Hitung SHA-256-nya dengan
   `certutil -hashfile hasil\SakuPajak-1.3.0.apk SHA256`.
4. Bagikan berkasnya bersama SHA-256-nya. Bila ingin dilampirkan ke GitHub Release:
   `gh release create apk-1.3.0 hasil\SakuPajak-1.3.0.apk --title "Saku Pajak APK 1.3.0"`.
   **APK tidak pernah di-commit ke repo.**

APK baru hanya bisa memperbarui APK lama bila ditandatangani dengan **kunci yang sama**.

## Kunci tanda tangan

- **Lokasi:** `C:\Users\sorar\Documents\SakuPajak-kunci-tanda-tangan\sakupajak-upload.keystore`,
  alias `sakupajak`.
- **Kata sandi:** di berkas `KATA-SANDI-PINDAHKAN-LALU-HAPUS.txt` di folder yang sama. Pindahkan ke
  pengelola kata sandi, lalu hapus berkas itu.
- **Cadangan:** wajib di **dua tempat terpisah**, misalnya flashdisk yang disimpan di rumah dan
  penyimpanan awan pribadi yang terenkripsi. Cadangkan keystore dan kata sandinya. **Bila keduanya
  hilang, APK Saku Pajak tidak bisa diperbarui lagi**: Android menolak memasang pembaruan yang
  ditandatangani kunci lain, dan semua pengguna harus mencopot lalu memasang ulang.
- **Tidak boleh masuk repo mana pun.** `.gitignore` menolak `*.keystore`, `*.jks`, `*.apk`, dan
  `KATA-SANDI*`.
- Sidik jari SHA-256 sertifikatnya ada di Digital Asset Links:
  `83:AC:96:BB:0A:3C:DE:42:E9:E1:E4:99:FC:ED:E9:A3:FE:EE:57:D0:21:26:35:83:AD:1A:64:49:1E:6C:74:44`.

## Digital Asset Links (supaya tanpa bilah alamat)

Chrome hanya membuka aplikasi tanpa bilah alamat bila situs menyatakan aplikasinya sah, lewat
https://mufuyumoku.github.io/.well-known/assetlinks.json. Berkas itu ada di repo
`MufuyuMoku/mufuyumoku.github.io`, yang isinya sengaja minimal: berkas itu, halaman kosong yang
menunjuk ke `/tax/`, dan `.nojekyll`. Situs proyek lain seperti `/tax/` dan `/portofolio/` tidak
terganggu.

Bila kunci tanda tangan berganti (misalnya lewat Play Store, lihat di bawah), sidik jari baru harus
ditambahkan ke berkas itu. Kalau tidak, aplikasi tampil dengan bilah alamat.

## Bila nanti ingin ke Play Store

1. Buat akun Google Play Console. Ada biaya pendaftaran sekali, dan identitas pengembang
   diverifikasi.
2. Buat AAB, bukan APK: di folder proyek, `gradlew.bat bundleRelease`, lalu tandatangani dengan
   kunci yang sama. Play memakai **Play App Signing**: kunci ini menjadi "kunci unggah", dan Google
   menandatangani aplikasi yang dibagikan dengan kunci miliknya.
3. **Tambahkan sidik jari kunci penandatanganan dari Play** (Play Console → Integritas aplikasi) ke
   `assetlinks.json`, di samping sidik jari yang sekarang.
4. Isi formulir toko:
   - deskripsi yang tidak mengaku resmi; sebutkan "bukan aplikasi resmi pemerintah";
   - tangkapan layar;
   - kebijakan privasi: halaman "Tentang dan batasan" bagian Privasi bisa dirujuk;
   - formulir Keamanan Data: tidak ada data yang dikumpulkan;
   - rating konten.
5. Play mensyaratkan **target API** Android terbaru dalam jangka waktu tertentu. Saat itu tiba,
   bangun ulang dengan Bubblewrap versi terbaru dan naikkan `versionCode`.
6. Aplikasi yang memakai nama atau tampilan lembaga pemerintah bisa ditolak. Saku Pajak tidak
   memakai lambang negara atau logo DJP/Kemenkeu, dan penafiannya ada di setiap halaman.
