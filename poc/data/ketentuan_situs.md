# Ketentuan situs sumber: pengambilan otomatis & penerbitan ulang

Diakses 2026-09-21. Kutipan verbatim (ejaan asli dipertahankan).

## JDIH Kementerian Keuangan (jdih.kemenkeu.go.id)

**robots.txt** (https://jdih.kemenkeu.go.id/robots.txt): `User-Agent: * / Allow: /`, kecuali
`/api/auth`, `/api/health`, `/pdfjs`. Menyediakan sitemap. `/api/download/…` (berkas PDF) tidak dilarang.

**Prasyarat** (https://jdih.kemenkeu.go.id/prasyarat), bagian *Copyright*:

> Situs ini memiliki hak cipta dan telah terdaftar secara resmi di Kementerian Hukum dan HAM. Dengan demikian,
> isi keseluruhan (teks, grafis dan media lain) pada situs web ini adalah karya cipta dan properti Kementerian
> Keuangan yang dilindungi hukum. Segala bentuk penggunaan material yang bersifat komersial harus mendapatkan
> izin dari Biro Hukum Kementerian Keuangan.

Bagian *Terminasi Akses*:

> Kami berhak untuk menghentikan akses yang tidak sah dan membahayakan situs ini dalam rangka melakukan
> perlindungan segala konten yang ada di dalamnya.

**FAQ** (https://jdih.kemenkeu.go.id/faq):

> JDIH memberikan pelayanan kepada masyarakat umum diataranya adalah penyediaan koleksi regulasi yang ada dapat
> dibaca dan/atau disalin dan buku-buku bertemakan hukum.

> Sebagian besar Keputusan Menteri Keuangan merupakan produk hukum yang bersifat menetapkan (beschikking) dan
> hanya disampaikan kepada para penerima salinan yang tercantum dalam Keputusan Menteri Keuangan tersebut.

Halaman https://jdih.kemenkeu.go.id/terms-and-conditions (tercantum di sitemap) tidak berisi teks apa pun saat diakses.

## Direktorat Jenderal Pajak (www.pajak.go.id)

**robots.txt**: hanya melarang `/core/`, `/profiles/`, `/admin/`, `/search/`, `/user/…`, `/node/add/`, dll.
Katalog `/id/peraturan` dan halaman detail `/id/peraturan/<slug>` tidak dilarang.

**Prasyarat Pengguna** (https://www.pajak.go.id/prasyarat-pengguna), butir 6 *Copyright*:

> Isi keseluruhan (teks, grafis dan seluruh atribut yang ada) pada situs web ini adalah karya cipta dan properti
> Direktorat Jenderal Pajak yang dilindungi hukum. Segala bentuk penggunaan material yang bersifat komersial
> harus seizin Ditjen Pajak.

Butir 4 *Revisi dan Kesalahan*:

> Materi yang muncul di situs web Direktorat Jenderal Pajak dapat memiliki kesalahan teknis, kesalahan ketik, atau
> fotografi. Dalam hal terdapat ketidaksesuaian informasi teknis perpajakan dengan ketentuan peraturan perundangan
> yang berlaku maka yang dianggap valid adalah informasi sesuai dengan ketentuan peraturan perundangan yang berlaku
> saat pengguna mengakses informasi terkait. [...] Direktorat Jenderal Pajak tidak membuat komitmen apapun untuk
> memperbaharui materi.

Butir 11 *Terminasi Akses*:

> Kami berhak untuk menghentikan akses terhadap situs web ini dengan memproteksi password terhadap penyalahgunaan
> situs web ini.

## Database Peraturan BPK (peraturan.bpk.go.id)

robots.txt dan seluruh halaman dilindungi Cloudflare *managed challenge* ("Performing security verification ...
verifies you are not a bot"), HTTP 403 untuk klien non-browser; di browser pun tantangan tidak lolos otomatis.
Ketentuan situs tidak dapat dibaca. **Tidak diambil** (menembus deteksi bot tidak dilakukan).

## Catatan penafsiran (bukan nasihat hukum)

- Kedua situs **tidak menyebut penerbitan ulang non-komersial** secara eksplisit: yang diatur hanya
  "penggunaan material yang bersifat komersial" (wajib izin). Tidak ada larangan eksplisit atas pengambilan otomatis.
- Klaim hak cipta situs mencakup "isi keseluruhan (teks...)". Namun teks peraturan perundang-undangan itu sendiri,
  menurut UU 28/2014 tentang Hak Cipta Pasal 42 huruf b, bukan objek hak cipta. **Kutipan pasal ini belum
  diverifikasi dari sumber resmi dalam sesi ini** (lihat laporan). Yang mungkin tetap dilindungi: tata letak,
  abstrak, metadata/klasifikasi, konsolidasi, terjemahan, dan desain situs.
- Bila aplikasi dipakai di lingkungan kantor (berpotensi dianggap komersial), meminta izin tertulis ke
  Biro Hukum Kemenkeu dan DJP adalah langkah aman.
