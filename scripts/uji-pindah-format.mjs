// A phone that keeps an old version moves to the split search data (K-099) without losing anything.
//
//   node scripts/uji-pindah-format.mjs <dist lama> <dist baru>
//
// 1. Serves the old build (one cari/data.json), opens it, waits until it is kept on the device.
// 2. Fills what belongs to the reader: one document in the personal collection (a mock PDF from
//    tests/fixtures/koleksi, invariant 10), one saved pasal, and the search history.
// 3. Serves the new build. With the page open the new version is downloaded and offered; the reader
//    takes it ("Muat data baru").
// 4. Checks, online and then offline: the new data format is in use, searching works (public and
//    the personal document), and the collection, the saved pasal and the history are unchanged.
// 5. Reports what the move downloaded.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { launch, sleep } from "./cdp.mjs";

const [before, after] = process.argv.slice(2);
if (!before || !after) throw new Error("Pakai: node scripts/uji-pindah-format.mjs <dist lama> <dist baru>");
const PORT = 4396;
const ORIGIN = `http://localhost:${PORT}`;
const BASE = "/tax/";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };

let root = before;
let online = true;
let served = [];
const server = http.createServer((req, res) => {
  if (!online) return req.socket.destroy();
  const url = new URL(req.url, ORIGIN);
  let file = path.join(root, decodeURIComponent(url.pathname.slice(BASE.length)));
  if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
  if (!url.pathname.startsWith(BASE) || !fs.existsSync(file)) return res.writeHead(404).end();
  served.push(file);
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(PORT, resolve));

const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const chrome = await launch({ port: 9344, headless: true });
const { targetId } = await chrome.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await chrome.send("Target.attachToTarget", { targetId, flatten: true });
const S = (method, params = {}) => chrome.send(method, params, sessionId);
await S("Page.enable");
await S("Network.enable");
async function js(expression) {
  const { result, exceptionDetails } = await S("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}
async function until(expression, ms = 180000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const value = await js(expression);
      if (value) return value;
    } catch {
      // page in the middle of loading
    }
    await sleep(250);
  }
  throw new Error(`tidak terpenuhi dalam ${ms / 1000} detik: ${expression}`);
}
async function go(url) {
  await S("Page.navigate", { url });
  await sleep(300);
  await until("document.readyState === 'complete'");
}
const version = () =>
  js("navigator.serviceWorker.controller && new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = e => r(e.data); navigator.serviceWorker.controller.postMessage({type:'info'}, [c.port2]); })");
const reader = () =>
  js(`new Promise((resolve) => {
    const open = indexedDB.open("tax-koleksi-pribadi");
    open.onsuccess = () => {
      const all = open.result.transaction("dokumen").objectStore("dokumen").getAll();
      all.onsuccess = () => resolve({
        collection: all.result.map((r) => [r.id, r.number, r.file && r.file.sha256].join(" ")).sort(),
        saved: localStorage.getItem("tax-tersimpan"),
        history: localStorage.getItem("tax-riwayat"),
      });
    };
  })`);
async function search(query) {
  await js(`document.getElementById('q').value = ${JSON.stringify(query)}; document.getElementById('cari').requestSubmit(); true`);
  await until("!document.getElementById('hasil').hidden && /dokumen untuk|koleksi pribadi/.test(document.getElementById('hasil').innerText)", 120000);
  await sleep(500);
  return js("({ publik: document.getElementById('hasil-ringkas').textContent, pribadi: document.getElementById('hasil-pribadi').hidden ? '' : document.getElementById('hasil-pribadi-ringkas').textContent })");
}

try {
  // ---------- 1. the old version, kept on the device ----------
  await go(`${ORIGIN}${BASE}`);
  await until("navigator.serviceWorker.controller && /Tersimpan di perangkat/.test(document.getElementById('keadaan-simpan').textContent)", 300000);
  const old = await version();
  check("versi lama tersimpan di perangkat", old.files > 0, `aplikasi ${old.app}, ${old.files} berkas, data ${old.data.version.slice(0, 8)}`);

  // ---------- 2. what belongs to the reader ----------
  await go(`${ORIGIN}${BASE}koleksi/`);
  await until("!document.getElementById('info-simpan').textContent.startsWith('Memeriksa')");
  const { root: dom } = await S("DOM.getDocument", { depth: 0 });
  const { nodeId } = await S("DOM.querySelector", { nodeId: dom.nodeId, selector: "#berkas" });
  await S("DOM.setFileInputFiles", { nodeId, files: [path.resolve("tests/fixtures/koleksi/se-teks.pdf")] });
  await until("!document.getElementById('hasil-baca').hidden && !document.getElementById('ringkas-baca').textContent.startsWith('Membaca')", 120000);
  await js(`(() => {
    document.getElementById('isi-jenis').value = 'SE';
    document.getElementById('isi-nomor').value = 'SE-901/PJ/2026';
    document.getElementById('isi-tanggal').value = '2026-09-01';
    document.getElementById('isi-perihal').value = 'Perihal tiruan uji pindah format';
    document.getElementById('simpan').click();
  })()`);
  await until("document.querySelectorAll('#daftar-koleksi > li').length === 1", 180000).catch(async (error) => {
    throw new Error(`${error.message}; pesan: "${await js("document.getElementById('pesan-impor').textContent")}", ${await js("JSON.stringify({hash: location.hash, ringkas: document.getElementById('ringkas-baca').textContent, li: document.querySelectorAll('li').length, ids: [...document.querySelectorAll('ol[id],ul[id]')].map(e => e.id + ':' + e.children.length)})")}`);
  });
  await go(`${ORIGIN}${BASE}pasal/uu-7-2021--b036-9/`);
  await js("document.querySelector('button.simpan').click(); true");
  await go(`${ORIGIN}${BASE}`);
  await search("tarif PPh pesangon");
  await search("SE-901/PJ/2026");
  const mine = await reader();
  check(
    "isi milik pembaca di versi lama",
    mine.collection.length === 1 && /uu-7-2021--b036-9/.test(mine.saved || "") && /SE-901/.test(mine.history || ""),
    `koleksi ${mine.collection.length}, tersimpan ${JSON.parse(mine.saved || "[]").length}, riwayat ${JSON.parse(mine.history || "[]").length}`
  );

  // ---------- 3. the new version arrives ----------
  root = after;
  served = [];
  await go(`${ORIGIN}${BASE}`);
  await until("!document.getElementById('tawaran-baru').hidden", 300000);
  check("versi baru ditawarkan", true, (await js("document.getElementById('tawaran-teks').textContent")).trim());
  await js("document.getElementById('muat-baru').click(); true");
  await sleep(3000);
  await until("document.readyState === 'complete' && navigator.serviceWorker.controller");
  const next = await version();
  check("versi baru dipakai", next.data.version !== old.data.version, `data ${old.data.version.slice(0, 8)} → ${next.data.version.slice(0, 8)}, ${next.files} berkas`);
  const parts = await until("caches.keys().then(async (names) => { const c = await caches.open(names.find((n) => n.startsWith('tax-'))); return (await c.keys()).filter((r) => /cari\\/teks\\//.test(r.url)).length; })");
  check("data pencarian format baru tersimpan (64 bagian)", parts === 64, `${parts} bagian di cache`);

  // ---------- 4. everything still there and working ----------
  const kept = await reader();
  check("koleksi pribadi utuh", JSON.stringify(kept.collection) === JSON.stringify(mine.collection), kept.collection.join("; "));
  check("Tersimpan utuh", kept.saved === mine.saved);
  check("riwayat utuh", kept.history === mine.history, JSON.parse(kept.history || "[]").join(" | "));
  const online1 = await search("tarif PPh pesangon");
  check("daring: pencarian publik dengan data baru", /dokumen untuk/.test(online1.publik), online1.publik);
  const online2 = await search("SE-901/PJ/2026");
  check("daring: dokumen koleksi pribadi tetap tercari", /1 dokumen dari koleksi pribadi/.test(online2.pribadi), online2.pribadi);

  online = false;
  await S("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await go(`${ORIGIN}${BASE}`);
  const offline1 = await search("apa itu PKP");
  check("luring: pencarian dan kotak definisi", /dokumen untuk/.test(offline1.publik) && (await js("!document.getElementById('definisi').hidden")), offline1.publik);
  const offline2 = await search("SE-901/PJ/2026");
  check("luring: dokumen koleksi pribadi tercari", /1 dokumen dari koleksi pribadi/.test(offline2.pribadi), offline2.pribadi);
  await go(`${ORIGIN}${BASE}tersimpan/`);
  const saved = await until("document.querySelector('#daftar-pasal a') && document.querySelector('#daftar-pasal a').textContent");
  check("luring: halaman Tersimpan", /Pasal 9/.test(saved), saved);

  // ---------- 5. what the move downloaded ----------
  const unique = [...new Set(served)];
  const raw = unique.reduce((sum, f) => sum + fs.statSync(f).size, 0);
  const gzip = unique.reduce((sum, f) => sum + zlib.gzipSync(fs.readFileSync(f)).length, 0);
  console.log(`\nDiunduh untuk pindah: ${unique.length} berkas, ${(raw / 1e6).toFixed(1)} MB mentah, ${(gzip / 1e6).toFixed(2)} MB gzip.`);
} finally {
  chrome.close();
  server.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed} dari ${results.length} lulus.`);
process.exit(passed === results.length ? 0 : 1);
