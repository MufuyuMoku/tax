// End-to-end check of the personal collection (M4) in a real Chrome, with every network request,
// console message and tab title recorded. Evidence for SPEC invariant 7.
//
//   npm run build && npm run preview -- --port 4321     (in another terminal)
//   node scripts/verify-collection.mjs [base-url]
//
// It imports the mock documents in tests/fixtures/koleksi (PDF with text, scanned PDF, .txt, and
// pasted text), searches, opens a document, exports a backup, deletes everything, restores, and
// exports again. Then it reports, per step, which requests were made, and checks that no request,
// console message, or title carries a document id or document content, and that the second backup
// is byte-for-byte equal to the first.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { launch, sleep } from "./cdp.mjs";

const BASE = process.argv[2] || "http://localhost:4321/tax/";
const FIXTURES = path.resolve("tests", "fixtures", "koleksi");
const downloads = fs.mkdtempSync(path.join(os.tmpdir(), "tax-unduh-"));
const browser = await launch();
const { send, on } = browser;

const requests = [];
const consoleLines = [];
const titles = [];
let phase = "muat";

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId: page } = await send("Target.attachToTarget", { targetId, flatten: true });
on(async (msg) => {
  if (msg.method === "Target.attachedToTarget") {
    const session = msg.params.sessionId;
    for (const domain of ["Network", "Runtime", "Log"]) await send(`${domain}.enable`, {}, session).catch(() => {});
    await send("Runtime.runIfWaitingForDebugger", {}, session).catch(() => {});
  } else if (msg.method === "Network.requestWillBeSent") {
    const r = msg.params.request;
    requests.push({ phase, url: r.url, method: r.method, body: r.postData || "", from: msg.sessionId === page ? "halaman" : "worker" });
  } else if (msg.method === "Runtime.consoleAPICalled") {
    consoleLines.push(msg.params.args.map((a) => (a.value !== undefined ? String(a.value) : a.description || "")).join(" "));
  } else if (msg.method === "Runtime.exceptionThrown") {
    consoleLines.push(`EXCEPTION ${msg.params.exceptionDetails.text} ${msg.params.exceptionDetails.exception?.description || ""}`);
  } else if (msg.method === "Log.entryAdded") {
    consoleLines.push(`${msg.params.entry.level}: ${msg.params.entry.text} ${msg.params.entry.url || ""}`);
  } else if (msg.method === "Page.javascriptDialogOpening") {
    await send("Page.handleJavaScriptDialog", { accept: true }, msg.sessionId);
  }
});
await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, page);
for (const domain of ["Network", "Runtime", "Log", "Page", "DOM"]) await send(`${domain}.enable`, {}, page);
await send("Network.setCacheDisabled", { cacheDisabled: true }, page);
await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads, eventsEnabled: true });

const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, page);
  if (exceptionDetails) throw new Error(`${exceptionDetails.text} ${exceptionDetails.exception?.description || ""}`);
  return result.value;
};
async function waitFor(expression, what, timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression).catch(() => false)) return;
    await sleep(100);
  }
  throw new Error(`menunggu terlalu lama: ${what}`);
}
async function navigate(url) {
  await send("Page.navigate", { url }, page);
  await sleep(300);
  await waitFor("document.readyState === 'complete'", "halaman dimuat");
}
async function setFiles(selector, file) {
  const { root } = await send("DOM.getDocument", { depth: 0 }, page);
  const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector }, page);
  await send("DOM.setFileInputFiles", { nodeId, files: [file] }, page);
}
const count = () => evaluate("document.querySelectorAll('#daftar-koleksi > li').length");
const recordTitle = async (where) => titles.push({ where, title: await evaluate("document.title"), url: await evaluate("location.href") });

// ---------- load the collection page and let the search data arrive ----------
await navigate(`${BASE}koleksi/`);
await waitFor("!document.getElementById('info-simpan').textContent.startsWith('Memeriksa')", "info penyimpanan");
await waitFor("true", "");
for (let i = 0; i < 100 && !requests.some((r) => r.url.endsWith("cari/data.json")); i++) await sleep(100);
await sleep(1500);
await recordTitle("halaman koleksi");

// ---------- import ----------
phase = "impor";
const KINDS = { se: ["SE", "SE-901/PJ/2026"], nd: ["ND", "ND-902/PJ.03/2026"], penegasan: ["penegasan", "S-903/PJ.03/2026"], putusan: ["putusan", "PUT-904/PP/M.XA/15/2026"] };
let expected = 0;
async function importFile(file, kind, number, subject) {
  await setFiles("#berkas", path.join(FIXTURES, file));
  await waitFor("!document.getElementById('hasil-baca').hidden && !document.getElementById('ringkas-baca').textContent.startsWith('Membaca')", `membaca ${file}`);
  const summary = await evaluate("document.getElementById('ringkas-baca').textContent");
  const scanWarning = await evaluate("!document.getElementById('peringatan-pindai').hidden");
  const garbledWarning = await evaluate("!document.getElementById('peringatan-rusak').hidden");
  await evaluate(`(() => {
    document.getElementById('isi-jenis').value = ${JSON.stringify(kind)};
    document.getElementById('isi-nomor').value = ${JSON.stringify(number)};
    document.getElementById('isi-tanggal').value = '2026-09-01';
    document.getElementById('isi-perihal').value = ${JSON.stringify(subject)};
    document.getElementById('isi-catatan').value = 'catatan uji';
    document.getElementById('simpan').click();
  })()`);
  expected++;
  await waitFor(`document.querySelectorAll('#daftar-koleksi > li').length === ${expected}`, `menyimpan ${file}`);
  return { file, summary, scanWarning, garbledWarning };
}
const imports = [];
for (const [kind, [code, number]] of Object.entries(KINDS)) {
  imports.push(await importFile(`${kind}-teks.pdf`, code, number, `Perihal tiruan ${kind} teks`));
  imports.push(await importFile(`${kind}-pindai.pdf`, code, number, `Perihal tiruan ${kind} pindai`));
}
imports.push(await importFile("nd.txt", "ND", "ND-902/PJ.03/2026", "Perihal tiruan nd txt"));
imports.push(await importFile("se-tanpa-tounicode.pdf", "SE", "SE-901/PJ/2026", "Perihal tiruan se rusak"));
await evaluate(`(() => {
  document.getElementById('tempel').value = 'Teks tempel tiruan: bonus tahunan pegawai mengikuti PMK 168 Tahun 2023.';
  document.getElementById('baca').click();
})()`);
// Reading pasted text waits for the worker's quality check before the form is ready.
await waitFor("document.getElementById('ringkas-baca').textContent.startsWith('Teks tempel')", "membaca teks tempel");
await evaluate(`(() => {
  document.getElementById('isi-perihal').value = 'Catatan tempel tiruan';
  document.getElementById('simpan').click();
})()`);
expected++;
await waitFor(`document.querySelectorAll('#daftar-koleksi > li').length === ${expected}`, "menyimpan teks tempel");
const storageLine = await evaluate("document.getElementById('info-simpan').textContent");

const ids = await evaluate(`new Promise((resolve) => {
  const open = indexedDB.open('tax-koleksi-pribadi');
  open.onsuccess = () => {
    const req = open.result.transaction('dokumen').objectStore('dokumen').getAll();
    // Documents with readable references first, so the view below shows them.
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.references.length - a.references.length).map((r) => r.id));
  };
})`);

// ---------- open a document (fragment route) ----------
phase = "buka-dokumen";
await evaluate(`location.hash = 'dok=${ids[0]}'`);
await waitFor("!document.getElementById('tampilan-dokumen').hidden && document.querySelector('#tampilan-dokumen h2')", "tampilan dokumen");
const documentView = await evaluate("document.getElementById('tampilan-dokumen').innerText.slice(0, 400)");
const referenceLinks = await evaluate("[...document.querySelectorAll('#tampilan-dokumen .relasi a')].map((a) => a.getAttribute('href'))");
await recordTitle("tampilan dokumen");
for (const id of ids.slice(1, 4)) {
  await evaluate(`location.hash = 'dok=${id}'`);
  await sleep(200);
}
await evaluate("location.hash = ''");
await sleep(300);

// ---------- search on the main page ----------
phase = "navigasi";
await navigate(BASE);
await waitFor("document.getElementById('keadaan').textContent.startsWith('Siap')", "pencarian siap", 60000);
await sleep(500);
phase = "cari";
const searches = {};
for (const query of ["bonus tahunan", "Perihal tiruan putusan pindai", "SE-901/PJ/2026", "majelis"]) {
  await evaluate(`(() => { document.getElementById('q').value = ${JSON.stringify(query)}; document.getElementById('cari').requestSubmit(); })()`);
  await sleep(700);
  searches[query] = await evaluate(`({
    pribadi: [...document.querySelectorAll('#hasil-pribadi-daftar > li')].map((li) => li.innerText.split('\\n').slice(0, 3).join(' | ')),
    publik: document.getElementById('hasil-ringkas').textContent.split(' ')[0],
    url: location.href,
  })`);
}
await recordTitle("halaman cari");

// ---------- export, delete, restore, export again ----------
phase = "navigasi";
await navigate(`${BASE}koleksi/`);
await waitFor(`document.querySelectorAll('#daftar-koleksi > li').length === ${expected}`, "daftar koleksi");
async function exportOnce(name) {
  const before = new Set(fs.readdirSync(downloads));
  await evaluate("document.getElementById('ekspor').click()");
  for (let i = 0; i < 100; i++) {
    const added = fs.readdirSync(downloads).filter((f) => !before.has(f) && !f.endsWith(".crdownload"));
    if (added.length) {
      const target = path.join(downloads, name);
      await sleep(300);
      fs.renameSync(path.join(downloads, added[0]), target);
      return fs.readFileSync(target);
    }
    await sleep(100);
  }
  throw new Error("unduhan cadangan tidak muncul");
}
phase = "ekspor";
const first = await exportOnce("cadangan-1.json");
phase = "hapus";
await evaluate("document.getElementById('hapus-semua').click()");
await waitFor("document.querySelectorAll('#daftar-koleksi > li').length === 0", "koleksi kosong");
phase = "pulihkan";
await setFiles("#pulihkan", path.join(downloads, "cadangan-1.json"));
await waitFor("!document.getElementById('pilihan-pulih').hidden", "pilihan pemulihan");
const restoreQuestion = await evaluate("document.getElementById('ringkas-pulih').textContent");
await evaluate("document.getElementById('pulih-ganti').click()");
await waitFor(`document.querySelectorAll('#daftar-koleksi > li').length === ${expected}`, "koleksi pulih");
phase = "ekspor";
const second = await exportOnce("cadangan-2.json");

// Stored files against the fixtures, byte for byte.
const stored = await evaluate(`new Promise((resolve) => {
  const open = indexedDB.open('tax-koleksi-pribadi');
  open.onsuccess = () => {
    const req = open.result.transaction('dokumen').objectStore('dokumen').getAll();
    req.onsuccess = async () => {
      const out = [];
      for (const r of req.result) {
        if (!r.file) continue;
        const digest = await crypto.subtle.digest('SHA-256', r.file.bytes);
        out.push([r.file.name, [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')]);
      }
      resolve(out);
    };
  };
})`);
const sha = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const fileChecks = stored.map(([name, digest]) => [name, digest === sha(fs.readFileSync(path.join(FIXTURES, name)))]);

browser.close();

// ---------- report ----------
const isStaticAsset = (r) => r.url.startsWith(BASE) && r.method === "GET" && !r.body;
const leaks = [];
const secrets = [...ids, "TIRUAN", "SE-901", "Perihal tiruan", "Teks tempel tiruan", "catatan uji"];
for (const r of requests) for (const s of secrets) if (decodeURIComponent(r.url).includes(s) || r.body.includes(s)) leaks.push(`permintaan ${r.url} memuat "${s}"`);
for (const line of consoleLines) for (const s of secrets) if (line.includes(s)) leaks.push(`konsol memuat "${s}"`);
for (const t of titles) for (const s of secrets) if (t.title.includes(s)) leaks.push(`judul tab memuat "${s}"`);

console.log("== Impor");
for (const i of imports) {
  const notes = `${i.scanWarning ? " [peringatan pindaian tampil]" : ""}${i.garbledWarning ? " [peringatan teks tak terbaca tampil]" : ""}`;
  console.log(`  ${i.file}: ${i.summary}${notes}`);
}
console.log(`  penyimpanan: ${storageLine}`);
console.log("== Tampilan dokumen");
console.log(`  ${documentView.replace(/\n+/g, " | ").slice(0, 300)}`);
console.log(`  tautan rujukan: ${referenceLinks.join(", ")}`);
console.log("== Pencarian");
for (const [q, r] of Object.entries(searches)) console.log(`  "${q}": publik ${r.publik}, pribadi ${r.pribadi.length}: ${r.pribadi.slice(0, 2).join(" // ")}`);
console.log("== Cadangan");
console.log(`  pertanyaan pemulihan: ${restoreQuestion}`);
console.log(`  cadangan 1: ${first.length} byte, cadangan 2: ${second.length} byte, sama persis: ${Buffer.compare(first, second) === 0}`);
console.log(`  berkas tersimpan = berkas tiruan (SHA-256): ${fileChecks.filter(([, ok]) => ok).length} dari ${fileChecks.length}`);
console.log("== Lalu lintas jaringan per langkah");
for (const step of ["muat", "impor", "buka-dokumen", "navigasi", "cari", "ekspor", "hapus", "pulihkan"]) {
  const list = requests.filter((r) => r.phase === step);
  const network = list.filter((r) => !r.url.startsWith("blob:") && !r.url.startsWith("data:"));
  console.log(`  ${step}: ${network.length} permintaan jaringan${list.length !== network.length ? ` (+${list.length - network.length} blob: lokal)` : ""}`);
  for (const r of network) console.log(`    ${r.method} ${r.url.replace(BASE, "/")} [${r.from}]${isStaticAsset(r) ? " aset statis situs" : " BUKAN ASET STATIS"}`);
}
console.log("== Judul tab dan URL");
for (const t of titles) console.log(`  ${t.where}: "${t.title}" · ${t.url.replace(/dok=k[0-9a-f]+/, "dok=<id>")}`);
console.log(`== Konsol: ${consoleLines.length} pesan`);
for (const line of consoleLines) console.log(`  ${line.slice(0, 200)}`);
console.log(`== Kebocoran: ${leaks.length ? leaks.join("; ") : "tidak ada"}`);
if (leaks.length || Buffer.compare(first, second) !== 0 || fileChecks.some(([, ok]) => !ok)) process.exit(1);
