// Screenshots of article reference searches (K-101) at 320 px and desktop width.
//
//   node scripts/tangkap-pasal.mjs <folder> [origin]
//
// Without an origin the finished build in dist/ is served locally; with one
// (https://mufuyumoku.github.io) the published site is used, for the "before" pictures. Each
// picture starts at the search box and runs down through the box and the first results.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { launch, sleep } from "./cdp.mjs";

const out = process.argv[2];
if (!out) throw new Error("Pakai: node scripts/tangkap-pasal.mjs <folder> [origin]");
fs.mkdirSync(out, { recursive: true });
const BASE = "/tax/";
const PORT = 4398;
let origin = process.argv[3];
let server = null;
if (!origin) {
  origin = `http://localhost:${PORT}`;
  const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
  server = http.createServer((req, res) => {
    const url = new URL(req.url, origin);
    let file = path.join("dist", decodeURIComponent(url.pathname.slice(BASE.length)));
    if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
    if (!url.pathname.startsWith(BASE) || !fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(PORT, resolve));
}

const VIEWS = [
  ["320", { width: 320, height: 720, deviceScaleFactor: 2, mobile: true }, 2600],
  ["desktop", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, 1700],
];
const QUERIES = ["16D", "pasal 21 pesangon", "14D"];

const report = [];
const chrome = await launch({ port: 9343 });
try {
  const { targetId } = await chrome.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await chrome.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (method, params = {}) => chrome.send(method, params, sessionId);
  await S("Page.enable");
  const js = async (expression) => (await S("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
  const until = async (expression, ms = 90000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await js(expression).catch(() => false)) return true;
      await sleep(200);
    }
    return false;
  };
  for (const [view, metrics, maxHeight] of VIEWS) {
    await S("Emulation.setDeviceMetricsOverride", metrics);
    for (const q of QUERIES) {
      await S("Page.navigate", { url: "about:blank" });
      await S("Page.navigate", { url: `${origin}${BASE}#q=${encodeURIComponent(q)}` });
      await until("document.readyState === 'complete'");
      if (!(await until("document.querySelector('#hasil-daftar .kartu')"))) report.push(`${q} ${view}: hasil tidak muncul`);
      await sleep(1200);
      await js("document.head.insertAdjacentHTML('beforeend', '<style>.kartu{content-visibility:visible!important}</style>'); true");
      const top = await js("document.getElementById('cari').getBoundingClientRect().top + scrollY - 8");
      const height = Math.min(await js("document.documentElement.scrollHeight") - top, maxHeight);
      const { data } = await S("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: top, width: metrics.width, height, scale: 1 } });
      const name = `${q.replace(/\s+/g, "-").toLowerCase()}-${view}.png`;
      fs.writeFileSync(path.join(out, name), Buffer.from(data, "base64"));
      const scroll = await js("document.documentElement.scrollWidth");
      const line = await js("document.getElementById('hasil-ringkas').innerText");
      report.push(`${name}: lebar ${scroll} px${scroll > metrics.width ? " (GULIR SAMPING)" : ""} · ${line}`);
    }
  }
} finally {
  chrome.close();
  if (server) server.close();
}
console.log(report.join("\n"));
