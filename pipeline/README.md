# pipeline

Pipa data Tax. **Kosong sampai M1.**

Rencananya (SPEC bagian 7, M1): skrip bukti konsep di `poc/` dirapikan menjadi paket tetap di sini,
yang membaca data arsip `poc/` dan menghasilkan korpus baku per dokumen dan per pasal untuk situs.
M1 tidak melakukan pengambilan jaringan sama sekali.

Pengambilan jaringan baru baru muncul di M6, dan tunduk penuh pada aturan di SPEC bagian 8: hanya
sumber resmi, hormati `robots.txt`, jeda 20 detik, batas dalam jendela 24 jam bergulir, berhenti
total bila host menolak, tidak pernah mengakali pembatasan, dan dijalankan di atas pukul 21.00 WIB.

`poc/data/host_stopped.json` hanya boleh diubah manusia. Saat ini `www.pajak.go.id` tercatat
berhenti di sana, hasil pemutus sirkuit pada putaran 26 September 2026.
