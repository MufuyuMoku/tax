# Berkas pengaturan pencarian

Tiga berkas di folder ini boleh disunting tanpa menyentuh kode. Perubahan berlaku setelah situs
dibangun ulang (`npm run build`, atau otomatis saat di-push ke `main`). Setelah menyunting,
jalankan `npm test` untuk memastikan pencarian masih memenuhi janjinya.

## `istilah.json` — singkatan dan istilah

Daftar kelompok. Semua bentuk dalam satu kelompok dianggap sama: mencari salah satunya menemukan
dokumen yang memuat bentuk mana pun.

```json
["PTKP", "Penghasilan Tidak Kena Pajak"]
```

- `{n}` dan `{m}` berarti angka. `["PPh {n}", "PPh Pasal {n}", "Pajak Penghasilan Pasal {n}"]`
  membuat "PPh 21" menemukan "Pajak Penghasilan Pasal 21", dan sebaliknya.
- Huruf besar-kecil tidak berpengaruh. Tanda baca dibaca sebagai jeda kata: "e-Bupot" dibaca
  "e bupot", sedangkan "eBupot" satu kata. Karena itu keduanya ditulis sebagai bentuk tersendiri.
- Bentuk yang lebih panjang dicocokkan lebih dulu, jadi "PPh 21" tidak terbaca sebagai "PPh"
  ditambah angka 21.
- Satu singkatan boleh punya beberapa kepanjangan, misalnya PKP (Penghasilan Kena Pajak dan
  Pengusaha Kena Pajak). Pencarian akan menemukan keduanya.
- Padanan kata biasa (misalnya "karyawan" dan "pegawai") juga bisa ditulis di sini, tetapi
  pertimbangkan baik-baik: padanan yang terlalu longgar membuat hasil pencarian melebar.

## `padanan.json` — padanan kata awam

Kata awam dan istilah peraturan yang dianggap sama, misalnya "karyawan" dan "pegawai", atau
"omzet" dan "peredaran bruto". Bedanya dengan `istilah.json`: kecocokan lewat padanan berbobot
lebih rendah (`bobot`, sekarang 0,6) daripada kata yang benar-benar diketik, sehingga dokumen
yang memakai kata pengguna sendiri tetap di atas.

```json
{ "bentuk": ["omzet", "peredaran bruto"], "bukti": "omzet 0 kali; peredaran bruto 412 kali" }
```

Aturan menambah kelompok (K-030):

1. Hitung kemunculan tiap bentuk di korpus: `node scripts/search-count.mjs omzet "peredaran bruto"`.
   Tulis hasilnya di `bukti`.
2. Jalankan `node scripts/search-eval.mjs --compare` untuk melihat peringkat set evaluasi
   (`tests/search/kasus.json`) sebelum dan sesudah.
3. Kelompok hanya dimasukkan bila menolong dan tidak membuat pertanyaan lain memburuk.
   `npm test` gagal bila ada pertanyaan yang lebih buruk dari garis dasar.

## `kata-umum.json` — kata yang diabaikan

Kata yang terlalu umum untuk menentukan hasil ("yang", "dan", "untuk"). Diabaikan bila diketik
sebagai kata lepas, tetapi tetap dipakai di dalam frasa bertanda kutip dan di dalam istilah.
Bila semua kata di kotak pencarian adalah kata umum, kata-kata itu tetap dicari.

## `ocr.json` — toleransi galat OCR

Sebagian teks DJP hasil OCR yang tidak dikoreksi: "clan" untuk "dan", "rnenteri" untuk
"menteri". Koreksi di sini **hanya dipakai saat mencocokkan**. Teks yang ditampilkan di situs
tetap persis seperti sumbernya, termasuk salah ketiknya.

- `aturan`: pasangan huruf yang sering tertukar oleh OCR, misalnya `["rn", "m"]`.
- `ambang`: sebuah kata dianggap salah baca bila ia jarang di korpus (paling banyak
  `frekuensi_maks` kali, minimal `panjang_min` huruf), dan satu penggantian menurut `aturan`
  menghasilkan kata yang muncul paling sedikit `frekuensi_benar_min` kali dan `kelipatan_min`
  kali lebih sering. Korpus dipakai sebagai pengganti kamus.
- `pasangan`: koreksi yang ditulis tangan, dipakai di samping yang dihitung otomatis.
- `jangan_dikoreksi`: kata yang benar walaupun mirip salah baca, misalnya "mengenal" (bukan
  "mengenai"). Tambahkan di sini bila menemukan koreksi otomatis yang keliru.

Daftar koreksi yang dihitung otomatis bisa dilihat dengan:

```
node scripts/search-ocr-list.mjs
```

## `pajak-daerah.json` — keterangan pajak daerah

Bila kueri memuat istilah pajak daerah (pajak kendaraan bermotor, PBB perdesaan dan perkotaan,
BPHTB, pajak hotel, dan sejenisnya), hasil pencarian diberi keterangan bahwa pajak itu dikelola
pemerintah daerah dan peraturannya tidak ada di situs ini.

- `istilah`: bentuk yang memicu keterangan. Hindari kata yang juga dipakai pajak pusat:
  "kendaraan bermotor" saja muncul ratusan kali di peraturan PPnBM dan PPh Pasal 22, jadi yang
  dipakai "pajak kendaraan bermotor", "PKB", "Samsat".
- `pesan`: kalimat yang ditampilkan.
- `batal_bila`: bila kueri juga memuat salah satu kata ini, keterangan tidak muncul. Dipakai
  supaya PBB sektor perkebunan, perhutanan, dan pertambangan (PBB-P5L), yang masih urusan DJP,
  tidak diberi keterangan pajak daerah.
- Bila dua kelompok cocok dan istilah yang satu bagian dari istilah yang lain ("PBB" dalam
  "PBB perdesaan"), hanya keterangan yang lebih khusus yang tampil.
