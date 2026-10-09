// Screenshots of the main screens at 320 px and desktop width, for before/after comparisons of the
// interface. Needs a finished build in dist/.
//
//   node scripts/tangkap-layar.mjs <folder> [light|dark]
//
// Writes <screen>-320.png and <screen>-desktop.png for: the empty home page, the results for
// "jual rumah" and "PMK 168/2023", a document whose status is uncertain, a document without text,
// one pasal, and the personal collection.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { launch, sleep } from "./cdp.mjs";

const out = process.argv[2];
const scheme = process.argv[3] || "light";
if (!out) throw new Error("Pakai: node scripts/tangkap-layar.mjs <folder> [light|dark]");
fs.mkdirSync(out, { recursive: true });

const PORT = 4398;
const ORIGIN = `http://localhost:${PORT}`;
const BASE = "/tax/";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, ORIGIN);
  let file = path.join("dist", decodeURIComponent(url.pathname.slice(BASE.length)));
  if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
  if (!url.pathname.startsWith(BASE) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(PORT, resolve));

// Documents chosen from the corpus, so the script keeps working when the data changes.
const index = JSON.parse(fs.readFileSync(path.join("corpus", "index.json"), "utf8"));
const load = (id) => JSON.parse(fs.readFileSync(path.join("corpus", "documents", `${id}.json`), "utf8"));
const uncertain = index
  .filter((e) => e.status === "tidak_pasti" && e.text_available)
  .map((e) => load(e.id))
  .find((d) => new Set(d.status_claims.map((c) => c.value_normalized)).size > 1);
const bare = index.find((e) => !e.text_available && e.sources.length > 1) || index.find((e) => !e.text_available);

const SCREENS = [
  ["beranda", `${BASE}`, null],
  ["cari-jual-rumah", `${BASE}#q=jual+rumah+kena+pajak+berapa`, "#hasil-daftar .kartu"],
  ["cari-pmk-168-2023", `${BASE}#q=PMK+168%2F2023`, "#hasil-daftar .kartu"],
  ["dokumen-tidak-pasti", `${BASE}dokumen/${uncertain.id}/`, null],
  ["dokumen-tanpa-teks", `${BASE}dokumen/${bare.id}/`, null],
  ["pasal", `${BASE}pasal/uu-7-2021--b036-9/`, null],
  ["koleksi", `${BASE}koleksi/`, null],
];
const VIEWS = [
  ["320", { width: 320, height: 720, deviceScaleFactor: 2, mobile: true }],
  ["desktop", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }],
];

const chrome = await launch({ port: 9338 });
const { targetId } = await chrome.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await chrome.send("Target.attachToTarget", { targetId, flatten: true });
const S = (method, params = {}) => chrome.send(method, params, sessionId);
await S("Page.enable");
await S("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
const js = async (expression) => (await S("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
async function until(expression, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await js(expression).catch(() => false)) return;
    await sleep(200);
  }
  throw new Error(`tidak terpenuhi: ${expression}`);
}

const report = [];
try {
  for (const [view, metrics] of VIEWS) {
    await S("Emulation.setDeviceMetricsOverride", metrics);
    for (const [name, url, waitFor] of SCREENS) {
      await S("Page.navigate", { url: "about:blank" });
      await S("Page.navigate", { url: ORIGIN + url });
      await until("document.readyState === 'complete'");
      if (waitFor) await until(`document.querySelector(${JSON.stringify(waitFor)})`);
      await sleep(800);
      // Cards off screen are skipped by content-visibility; draw them for the picture.
      await js("document.head.insertAdjacentHTML('beforeend', '<style>.kartu{content-visibility:visible!important}</style>'); true");
      const scroll = await js("document.documentElement.scrollWidth");
      const height = Math.min(await js("document.documentElement.scrollHeight"), view === "320" ? 2600 : 2200);
      const { data } = await S("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: metrics.width, height, scale: 1 },
      });
      fs.writeFileSync(path.join(out, `${name}-${view}.png`), Buffer.from(data, "base64"));
      report.push(`${name}-${view}: lebar halaman ${scroll} px${scroll > metrics.width ? " (GULIR SAMPING)" : ""}`);
    }
  }
} finally {
  chrome.close();
  server.close();
}
console.log(report.join("\n"));
console.log(`dokumen tidak pasti: ${uncertain.id}; tanpa teks: ${bare.id}`);
