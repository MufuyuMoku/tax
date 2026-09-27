# samples-local — bahan uji lokal, tidak pernah masuk repo

Folder ini tempat menaruh dokumen yang dikirim calon pengguna: Surat Edaran, nota dinas,
surat penegasan, putusan Pengadilan Pajak, dan sejenisnya yang tidak ada di sumber publik.

**Aturannya, invarian 10 di `docs/SPEC.md`:**

> Dokumen yang dikirim calon pengguna tidak pernah masuk ke repo, ke data bawaan situs, atau ke
> commit mana pun. Berkas seperti itu hanya dipakai lokal sebagai bahan uji fitur koleksi pribadi.

Alasannya: dokumen itu berasal dari sistem internal kantor penggunanya. Menerbitkannya di situs
publik persis kebocoran yang membuat alat ini diminta sejak awal.

## Yang berlaku di folder ini

- Seluruh isinya diabaikan git lewat `.gitignore` (`samples-local/*`), kecuali berkas README ini.
- Jangan pernah memakai `git add -f` di sini.
- Jangan menyalin isinya ke `pipeline/`, ke `src/`, ke `public/`, atau ke `poc/`.
- Jangan menjadikannya bahan uji otomatis yang ikut ter-commit. Bila sebuah uji butuh contoh,
  buat contoh tiruan yang ditulis sendiri, bukan salinan dokumen asli.
- Dokumen di sini tidak pernah menjadi data bawaan situs. Jalurnya hanya fitur koleksi pribadi
  (M4), yang menyimpan berkas di perangkat pengguna dan tidak mengirimkannya ke mana pun.

## Kalau tidak sengaja ter-commit

Jangan cuma dihapus di commit berikutnya, karena isinya tetap ada di riwayat. Tulis ulang riwayat
(`git filter-repo --invert-paths --path <berkas>`), force push, lalu catat kejadiannya di
`docs/DECISIONS.md`.
