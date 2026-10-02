// Measures the search page under CPU throttling, the way DevTools does, through the Chrome
// DevTools Protocol. No packages: Node's own WebSocket and a local Chrome.
//
//   npm run preview -- --port 4321        (in another terminal)
//   node scripts/measure-load.mjs [url] [rate ...]
//
// Reports, per throttling rate: time from navigation until the search is ready, the time of two
// searches, and the JS heap of the page and of the search worker after a forced garbage collection.
// Chrome cannot throttle a Web Worker through this protocol, so the search engine itself runs at
// full speed here; the script says so in its output. See K-031 for how the engine was measured.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const url = process.argv[2] || "http://localhost:4321/tax/";
const rates = (process.argv.slice(3).length ? process.argv.slice(3) : ["1", "4", "6"]).map(Number);
const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
].find((p) => fs.existsSync(p));
if (!CHROME) throw new Error("Chrome atau Edge tidak ditemukan");

const PORT = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "tax-measure-"));
const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--headless=new", "--no-first-run", "about:blank"], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let version = null;
for (let i = 0; i < 50 && !version; i++) {
  try {
    version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  } catch {
    await sleep(200);
  }
}
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

let nextId = 1;
const waiting = new Map();
const listeners = [];
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && waiting.has(msg.id)) {
    const { resolve, reject } = waiting.get(msg.id);
    waiting.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) {
    for (const listener of listeners) listener(msg);
  }
});
function send(method, params = {}, sessionId = undefined) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((resolve, reject) => waiting.set(id, { resolve, reject }));
}

const READY = `new Promise((resolve) => {
  const state = document.getElementById("keadaan");
  const check = () => state && state.textContent.startsWith("Siap") && resolve(performance.now());
  check();
  new MutationObserver(check).observe(state, { childList: true, characterData: true, subtree: true });
})`;
const SEARCH = (query) => `new Promise((resolve) => {
  const list = document.getElementById("hasil-daftar");
  const input = document.getElementById("q");
  const started = performance.now();
  const observer = new MutationObserver(() => {
    if (!list.children.length) return;
    observer.disconnect();
    const engine = (document.getElementById("keadaan").textContent.match(/dalam (\\d+) md/) || [])[1];
    resolve({ total: performance.now() - started, engine: Number(engine), results: document.getElementById("hasil-ringkas").textContent.split(" ")[0] });
  });
  observer.observe(list, { childList: true });
  input.value = ${JSON.stringify(query)};
  document.getElementById("cari").requestSubmit();
})`;

const mb = (bytes) => (bytes / 1048576).toFixed(1);
for (const rate of rates) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  let workerSession = null;
  const throttled = [];
  listeners.length = 0;
  listeners.push(async (msg) => {
    if (msg.method === "Target.attachedToTarget" && msg.params.targetInfo.type === "worker") {
      workerSession = msg.params.sessionId;
      // Throttle the worker too: the search engine runs there.
      try {
        await send("Emulation.setCPUThrottlingRate", { rate }, workerSession);
        throttled.push("worker");
      } catch (error) {
        throttled.push(`worker tidak bisa diperlambat: ${error.message}`);
      }
      await send("Runtime.runIfWaitingForDebugger", {}, workerSession);
    }
  });
  await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId);
  await send("Network.enable", {}, sessionId);
  await send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
  await send("Emulation.setCPUThrottlingRate", { rate }, sessionId);
  throttled.push("halaman");
  await send("Page.enable", {}, sessionId);
  await send("Page.navigate", { url }, sessionId);
  await sleep(300);
  const ready = await send("Runtime.evaluate", { expression: READY, awaitPromise: true, returnByValue: true }, sessionId);
  const first = await send("Runtime.evaluate", { expression: SEARCH("PPh 21"), awaitPromise: true, returnByValue: true }, sessionId);
  const second = await send("Runtime.evaluate", { expression: SEARCH("karyawan dapat bonus tahunan"), awaitPromise: true, returnByValue: true }, sessionId);
  await send("HeapProfiler.collectGarbage", {}, sessionId);
  const pageHeap = await send("Runtime.getHeapUsage", {}, sessionId);
  let workerHeap = null;
  if (workerSession) {
    await send("HeapProfiler.collectGarbage", {}, workerSession);
    workerHeap = await send("Runtime.getHeapUsage", {}, workerSession);
  }
  const f = (r) => `${Math.round(r.result.value.total)} md (mesin ${r.result.value.engine} md, ${r.result.value.results} dokumen)`;
  console.log(`\nCPU ${rate}x  (diperlambat: ${throttled.join(", ")})`);
  console.log(`  siap mencari: ${(ready.result.value / 1000).toFixed(2)} detik sejak navigasi`);
  console.log(`  cari "PPh 21": ${f(first)}`);
  console.log(`  cari "karyawan dapat bonus tahunan": ${f(second)}`);
  console.log(`  heap JS halaman: ${mb(pageHeap.usedSize)} MB · worker pencarian: ${workerHeap ? mb(workerHeap.usedSize) + " MB" : "tidak terbaca"}`);
  await send("Target.closeTarget", { targetId });
}
ws.close();
chrome.kill();
