// End-to-end test of an automatic data update on the phone side (M9, K-091), in Chrome.
//
//   node scripts/uji-pembaruan-hp.mjs <dist before> <dist after>
//
// 1. Serves the build before the update, opens it, waits until everything is stored.
// 2. Serves the build after the update. With the page open: the new version downloads in the
//    background and "Muat data baru" is offered; nothing changes by itself.
// 3. Closes the app and opens it again: the new version is in use without pressing anything.
// 4. Offline: "Peraturan baru dan yang berubah" lists the new regulation and the status change, and
//    the new regulation's page opens.
// 5. Reports what was downloaded for the update: per file, raw and gzip size.
// TAX_CHROME_HEADLESS=1 on a server without a screen.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { launch, sleep } from "./cdp.mjs";

const [before, after] = process.argv.slice(2);
if (!before || !after) throw new Error("Pakai: node scripts/uji-pembaruan-hp.mjs <dist sebelum> <dist sesudah>");
const PORT = 4395;
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
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const chrome = await launch({ port: 9343, headless: process.env.TAX_CHROME_HEADLESS === "1" });
async function tab() {
  const { targetId } = await chrome.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await chrome.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (method, params = {}) => chrome.send(method, params, sessionId);
  await S("Page.enable");
  const js = async (expression) => (await S("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
  const until = async (expression, ms = 180000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await js(expression).catch(() => false)) return true;
      await sleep(300);
    }
    throw new Error(`tidak terpenuhi: ${expression}`);
  };
  const go = async (url) => {
    await S("Page.navigate", { url: ORIGIN + url });
    await sleep(500);
    await until("document.readyState === 'complete'");
  };
  return { targetId, S, js, until, go };
}
const stored = "(document.getElementById('keadaan-simpan')||{}).textContent || ''";

try {
  // 1. before the update
  let t = await tab();
  await t.go(BASE);
  await t.until(`navigator.serviceWorker.controller && /Tersimpan di perangkat/.test(${stored})`);
  const first = await t.js(stored);
  check("versi lama tersimpan di perangkat", true, first.trim());

  // 2. the update is published; the page is open
  root = after;
  served = [];
  await t.go(BASE);
  await t.js("window.__tanda = 'halaman masih sama'; true");
  await t.until("!document.getElementById('tawaran-baru').hidden");
  const offer = await t.js("document.getElementById('tawaran-teks').textContent");
  check("halaman terbuka: tawaran 'Muat data baru' muncul, halaman tidak berganti sendiri", (await t.js("window.__tanda")) === "halaman masih sama", offer);
  // Everything the server sent after the update was published: sw.js and the files whose hash changed
  // (the page itself came from the phone's own copy).
  const downloaded = [...new Set(served)];
  const rows = downloaded.map((f) => {
    const bytes = fs.readFileSync(f);
    return { file: path.relative(after, f), raw: bytes.length, gzip: zlib.gzipSync(bytes).length };
  });
  const sum = (key) => rows.reduce((total, r) => total + r[key], 0);
  console.log("Diunduh untuk pembaruan:");
  for (const r of rows.sort((a, b) => b.gzip - a.gzip)) console.log(`   ${r.file}: ${(r.raw / 1e6).toFixed(2)} MB mentah, ${(r.gzip / 1e6).toFixed(2)} MB gzip`);
  console.log(`   jumlah: ${(sum("raw") / 1e6).toFixed(1)} MB mentah, ${(sum("gzip") / 1e6).toFixed(1)} MB lewat jaringan (gzip)`);

  // 3. close the app, open it again: the new version is used without pressing anything
  await chrome.send("Target.closeTarget", { targetId: t.targetId });
  await sleep(1500);
  t = await tab();
  await t.go(BASE);
  await t.until(`/Tersimpan di perangkat/.test(${stored})`);
  await sleep(1000);
  const second = await t.js(stored);
  check("dibuka lagi dari keadaan tertutup: versi baru terpasang sendiri", second !== first && (await t.js("document.getElementById('tawaran-baru').hidden")), second.trim());

  // 4. offline: the changes page and the new regulation
  online = false;
  await t.S("Network.enable");
  await t.S("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await t.go(`${BASE}perubahan/`);
  const page = await t.js("document.querySelector('main, .wrap').innerText");
  check("luring: halaman 'Peraturan baru' memuat peraturan baru", /UJI TIRUAN PEMBARUAN OTOMATIS/.test(page));
  check("luring: halaman 'Peraturan baru' memuat status yang berubah, per sumber", /PMK 117\/2024[\s\S]*DJP: “Aktif” → “Dicabut”/.test(page));
  const link = await t.js("(document.querySelector('.pembaruan a[href*=\"/dokumen/\"]')||{}).getAttribute ? document.querySelector('.pembaruan a[href*=\"/dokumen/\"]').getAttribute('href') : ''");
  await t.go(link || `${BASE}`);
  check("luring: halaman peraturan baru terbuka", /UJI TIRUAN/.test(await t.js("document.querySelector('.judul-dokumen') ? document.querySelector('.judul-dokumen').textContent : ''")), link);
} finally {
  chrome.close();
  server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} dari ${results.length} lulus.`);
process.exit(failed.length ? 1 : 0);
