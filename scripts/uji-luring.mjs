// Offline and update test in a real Chrome window (M6, K-082). Needs a finished build in dist/.
//
//   node scripts/uji-luring.mjs [folder for screenshots]
//
// 1. Serves dist/ at http://localhost:4399/tax/, opens it, waits until everything is stored.
// 2. Checks the site is installable by Chrome's own check, and reads the manifest.
// 3. Stops the server and switches the tab offline, then opens the list, a document, a document
//    without text, a pasal, searches, and filters.
// 4. Makes a fake new data version (a copy of dist/ with one data file changed and a new sw.js),
//    serves it, and checks that the update is offered, does not reload the page by itself, that
//    only changed files are downloaded, and that "Muat data baru" switches to it.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { launch, sleep } from "./cdp.mjs";
import { writeWorker } from "../src/lib/offline/integration.js";

const PORT = 4399;
const ORIGIN = `http://localhost:${PORT}`;
const BASE = "/tax/";
const shots = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "tax-luring-"));
fs.mkdirSync(shots, { recursive: true });

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json" };

let requests = [];
function serve(root) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, ORIGIN);
    requests.push(url.pathname);
    if (!url.pathname.startsWith(BASE)) return res.writeHead(404).end();
    let file = path.join(root, decodeURIComponent(url.pathname.slice(BASE.length)));
    if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) return res.writeHead(404).end("tidak ada");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "max-age=600" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}
const stop = (server) => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const chrome = await launch({ port: 9335, headless: false });
const { targetId } = await chrome.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await chrome.send("Target.attachToTarget", { targetId, flatten: true });
const S = (method, params = {}) => chrome.send(method, params, sessionId);
await S("Page.enable");
await S("Runtime.enable");
await S("Network.enable");

async function js(expression) {
  const { result, exceptionDetails } = await S("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}
async function until(expression, ms = 120000) {
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
async function shot(name) {
  const { data } = await S("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(shots, `${name}.png`), Buffer.from(data, "base64"));
}
const text = (selector) => js(`(document.querySelector(${JSON.stringify(selector)})||{}).textContent||""`);

let server = await serve("dist");
try {
  // ---------- 1. first visit stores everything ----------
  await go(`${ORIGIN}${BASE}`);
  const started = Date.now();
  await until("navigator.serviceWorker.controller && /Tersimpan di perangkat/.test(document.getElementById('keadaan-simpan').textContent)", 300000);
  const stored = await text("#keadaan-simpan");
  check("kunjungan pertama menyimpan semua berkas", true, `${((Date.now() - started) / 1000).toFixed(0)} detik; "${stored.trim()}"`);
  const firstVersion = await js("navigator.serviceWorker.controller && new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = e => r(e.data); navigator.serviceWorker.controller.postMessage({type:'info'}, [c.port2]); })");
  const cacheBytes = await js("navigator.storage.estimate().then(e => e.usage)");
  check("ukuran simpanan di perangkat", cacheBytes < 100e6, `navigator.storage.estimate(): ${(cacheBytes / 1e6).toFixed(1)} MB; berkas: ${firstVersion.files}, ${(firstVersion.bytes / 1e6).toFixed(1)} MB`);

  // ---------- 2. installable, then installed ----------
  const { installabilityErrors } = await S("Page.getInstallabilityErrors");
  check("situs memenuhi syarat dipasang (Chrome)", installabilityErrors.length === 0, installabilityErrors.map((e) => e.errorId).join(", ") || "tanpa galat");
  // Installing itself cannot be driven from here: the DevTools protocol lists PWA.install, but
  // stable Chrome does not answer it. Chrome's own installability check above, and its reading of
  // the manifest below, are what can be checked; the install is a manual step (docs/PASANG.md).
  const { errors, data: manifestText } = await S("Page.getAppManifest");
  const manifest = JSON.parse(manifestText || "{}");
  check(
    "manifes terbaca Chrome tanpa galat",
    errors.length === 0 && manifest.display === "standalone" && manifest.icons.length >= 2,
    errors.map((e) => e.message).join("; ") || `${manifest.name}, ${manifest.display}, mulai di ${manifest.start_url}`
  );

  // After install the page asks again for persistent storage (K-047) and shows the answer. Chrome
  // cannot emulate the installed window (display-mode) through DevTools, so for this one check the
  // page is made to believe it runs installed by answering matchMedia("(display-mode: standalone)").
  const { identifier } = await S("Page.addScriptToEvaluateOnNewDocument", {
    source: `const real = window.matchMedia.bind(window);
      window.matchMedia = (q) => q.includes("display-mode: standalone") ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q);`,
  });
  await go(`${ORIGIN}${BASE}`);
  const persisted = await until("(t => /Penyimpanan permanen|permintaan ditolak/.test(t) && t)(document.getElementById('keadaan-simpan').textContent)", 30000);
  check("seolah terpasang: penyimpanan permanen diminta lagi dan hasilnya tampil", true, persisted.trim());
  await S("Page.removeScriptToEvaluateOnNewDocument", { identifier });


  // A document with text, relations and attachments; one without text; one of its pasal.
  const docs = [];
  for (const name of fs.readdirSync(path.join("dist", "luring", "data"))) {
    const shard = JSON.parse(fs.readFileSync(path.join("dist", "luring", "data", name), "utf8"));
    docs.push(...Object.values(shard.docs));
  }
  const rich = docs.find((d) => d.text.available && d.attachments.length && d.relations.revokes.length && d.status_claims.length > 1);
  const bare = docs.find((d) => !d.text.available);
  const pasal = rich.pasal_ids[0];

  // ---------- 3. offline ----------
  await stop(server);
  await S("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await sleep(500);

  await go(`${ORIGIN}${BASE}`);
  check("luring: daftar terbuka", await until("document.querySelectorAll('#daftar .kartu').length >= 100"), await text("#jumlah-tampil"));
  check("luring: penanda luring tampil", /Luring/.test(await text("#keadaan-jaringan")), await text("#keadaan-situs"));

  await js(`document.getElementById('q').value = 'tarif PPh pesangon'; document.getElementById('cari').requestSubmit(); true`);
  await until("!document.getElementById('hasil').hidden && document.querySelectorAll('#hasil-daftar .kartu').length > 0", 60000);
  check("luring: cari 'tarif PPh pesangon'", true, await text("#hasil-ringkas"));
  await js(`const s = document.getElementById('kategori'); s.value = 'PPh'; s.dispatchEvent(new Event('change', {bubbles: true})); true`);
  await sleep(1500);
  const filtered = await text("#hasil-ringkas");
  check("luring: saring kategori PPh", /PPh/.test(await js("document.getElementById('kategori').value")) && (await js("document.getElementById('hasil-kategori').hidden")), filtered);
  await shot("luring-cari");

  await go(`${ORIGIN}${BASE}dokumen/${rich.id}/`);
  const docPage = await js(`({
    h1: document.querySelector('h1').textContent,
    claims: [...document.querySelectorAll('.klaim li')].length,
    dated: [...document.querySelectorAll('.klaim li .hint')].every(e => /diambil \\d/.test(e.textContent)),
    quotes: document.querySelectorAll('.relasi blockquote').length,
    category: [...document.querySelectorAll('.ringkasan dt')].find(d => /Kategori/.test(d.textContent))?.nextElementSibling.textContent || '',
    chips: [...document.querySelectorAll('.ringkasan .chip')].map(c => c.textContent).join(' | '),
    externalLinks: [...document.querySelectorAll('a')].filter(a => a.href && new URL(a.href).origin !== location.origin).length,
    marked: document.querySelectorAll('a.luar-luring').length,
    markedText: getComputedStyle(document.querySelector('a.luar-luring'), '::after').content,
  })`);
  check(
    "luring: halaman dokumen dari data di perangkat",
    docPage.claims > 1 && docPage.dated && docPage.quotes > 0 && docPage.category,
    `${docPage.h1}: status per sumber "${docPage.chips}", ${docPage.claims} baris klaim dan sumber bertanggal, ${docPage.quotes} kutipan relasi, label "${docPage.category}"`
  );
  check("luring: tautan ke sumber dan lampiran bukan tautan aktif", docPage.externalLinks === 0 && docPage.marked > 0, `${docPage.marked} tautan luar ditandai ${docPage.markedText}`);
  await shot("luring-dokumen");

  await go(`${ORIGIN}${BASE}dokumen/${bare.id}/`);
  const bareNote = await text("#isi + .notice strong");
  check("luring: dokumen tanpa teks tetap tampil dengan keterangan", /Teks/.test(bareNote), `${bare.id}: "${bareNote}"`);

  await go(`${ORIGIN}${BASE}pasal/${pasal}/`);
  const pasalPage = await js(`({ h1: document.querySelector('h1').textContent, chars: document.querySelector('.teks-pasal').textContent.length, source: document.querySelector('p.hint:last-of-type').textContent })`);
  check("luring: halaman pasal", pasalPage.chars > 0, `${pasalPage.h1}, ${pasalPage.chars} karakter`);
  // "Salin kutipan" (K-083): regulation, pasal, title, text, and the page address, offline too.
  await chrome.send("Browser.grantPermissions", { origin: ORIGIN, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] });
  await js("document.querySelector('button.salin').click(); true");
  await sleep(500);
  const copied = await js("navigator.clipboard.readText()");
  check(
    "luring: Salin kutipan menyalin label, pasal, teks, dan tautan",
    copied.includes(pasalPage.h1) && copied.includes(`${BASE}pasal/${pasal}/`) && copied.length > pasalPage.chars,
    copied.split("\n")[0]
  );
  await shot("luring-pasal");

  await go(`${ORIGIN}${BASE}koleksi/`);
  check("luring: halaman koleksi pribadi terbuka", await until("!!document.getElementById('halaman-koleksi')"));

  // ---------- 4. a new data version ----------
  const fake = fs.mkdtempSync(path.join(os.tmpdir(), "tax-tiruan-"));
  fs.cpSync("dist", fake, { recursive: true });
  const shardFile = path.join(fake, "luring", "data", "00.json");
  const shard = JSON.parse(fs.readFileSync(shardFile, "utf8"));
  shard.tiruan = "versi data tiruan untuk uji pembaruan";
  fs.writeFileSync(shardFile, JSON.stringify(shard));
  const next = await writeWorker(fake, BASE, process.cwd());

  await S("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  server = await serve(fake);
  requests = [];
  await go(`${ORIGIN}${BASE}`);
  await js("window.__tandaBaca = 'masih halaman yang sama'; true");
  await until("!document.getElementById('tawaran-baru').hidden", 180000);
  const offer = await text("#tawaran-teks");
  const samePage = await js("window.__tandaBaca === 'masih halaman yang sama'");
  check("pembaruan ditawarkan tanpa memuat ulang halaman", samePage, offer);
  const fetched = requests.filter((p) => p !== `${BASE}` && !p.endsWith("sw.js"));
  check("hanya berkas yang berubah diunduh", fetched.length === 1 && fetched[0].endsWith("luring/data/00.json"), fetched.join(", ") || "tidak ada");
  await shot("tawaran-pembaruan");

  await js("document.getElementById('muat-baru').click(); true");
  await until("window.__tandaBaca === undefined && document.readyState === 'complete' && /Tersimpan di perangkat/.test(document.getElementById('keadaan-simpan').textContent)", 60000);
  const after = await text("#keadaan-simpan");
  check("'Muat data baru' memakai versi baru", after.includes(next.data.version.slice(0, 8)), `sebelum ${firstVersion.data.version.slice(0, 8)}, sesudah: "${after.trim()}"`);
  fs.rmSync(fake, { recursive: true, force: true });
} finally {
  await stop(server).catch(() => {});
  chrome.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} dari ${results.length} lulus. Tangkapan layar: ${shots}`);
process.exit(failed.length ? 1 : 0);
