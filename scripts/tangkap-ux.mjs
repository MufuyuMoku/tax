// Before/after screenshots for the v1.3.0 usability changes (K-096), at 320 px and desktop width.
//
//   node scripts/tangkap-ux.mjs <folder> [origin]
//
// Without an origin the finished build in dist/ is served locally, slowed to about 20 MB/s so the
// first-open progress can be seen; with one (https://mufuyumoku.github.io) the published site is
// used, for the "before" pictures. Screens that do not exist on that site are skipped and listed.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { launch, sleep } from "./cdp.mjs";

const out = process.argv[2];
if (!out) throw new Error("Pakai: node scripts/tangkap-ux.mjs <folder> [origin]");
fs.mkdirSync(out, { recursive: true });
const BASE = "/tax/";
const PORT = 4399;
let origin = process.argv[3];
let server = null;
if (!origin) {
  origin = `http://localhost:${PORT}`;
  const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
  const RATE = 20e6; // bytes per second
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, origin);
    let file = path.join("dist", decodeURIComponent(url.pathname.slice(BASE.length)));
    if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
    if (!url.pathname.startsWith(BASE) || !fs.existsSync(file)) return res.writeHead(404).end();
    const body = fs.readFileSync(file);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    for (let at = 0; at < body.length; at += 256e3) {
      res.write(body.subarray(at, at + 256e3));
      await sleep((256e3 / RATE) * 1000);
    }
    res.end();
  });
  await new Promise((resolve) => server.listen(PORT, resolve));
}

const VIEWS = [
  ["320", { width: 320, height: 720, deviceScaleFactor: 2, mobile: true }],
  ["desktop", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }],
];
const HISTORY = ["apa itu PKP", "PMK 168/2023", "restitusi PPN", "PPh 21 pesangon", "faktur pajak"];
const SAVED = [
  { kind: "pasal", id: "uu-7-2021--b036-9", label: "UU 7/2021 Pasal 9", title: "HARMONISASI PERATURAN PERPAJAKAN", savedAt: "2026-10-17T02:00:00.000Z" },
  { kind: "dokumen", id: "pmk-168-2023", label: "PMK 168/2023", title: "PETUNJUK PELAKSANAAN PEMOTONGAN PAJAK ATAS PENGHASILAN SEHUBUNGAN DENGAN PEKERJAAN, JASA, ATAU KEGIATAN ORANG PRIBADI", savedAt: "2026-10-17T01:00:00.000Z" },
];

// [name, path, wait for, what to capture: null = top of page, or a CSS selector, seeded storage]
const SCREENS = [
  ["kredit-kaki", `${BASE}tentang/`, null, "footer"],
  ["kredit-tentang", `${BASE}tentang/`, null, "#hak-cipta"],
  ...["apa itu PKP", "PTKP", "NPWP", "Penghasilan", "Pajak Masukan", "BPHTB"].map((q) => [
    `definisi-${q.toLowerCase().replace(/\s+/g, "-")}`,
    `${BASE}#q=${encodeURIComponent(q)}`,
    "#hasil-daftar .kartu",
    null,
  ]),
  ["kosong", `${BASE}#q=${encodeURIComponent("zqxwv kjhgf")}`, "#hasil-ringkas:not(:empty)", null],
  ["riwayat", `${BASE}`, null, null, true],
  ["simpan-pasal", `${BASE}pasal/uu-7-2021--b036-9/`, null, null, true],
  ["simpan-dokumen", `${BASE}dokumen/pmk-168-2023/`, null, null, true],
  ["tersimpan", `${BASE}tersimpan/`, null, null, true],
];

async function session(chrome) {
  const { targetId } = await chrome.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await chrome.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (method, params = {}) => chrome.send(method, params, sessionId);
  await S("Page.enable");
  const js = async (expression) => (await S("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
  const until = async (expression, ms = 60000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await js(expression).catch(() => false)) return true;
      await sleep(150);
    }
    return false;
  };
  const shoot = async (file, metrics, selector) => {
    let clip;
    if (selector) {
      const box = await js(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); if (!n) return null;
        let end = n; if (n.tagName === "H2") { const ul = []; for (let s = n.nextElementSibling; s && s.tagName !== "H2"; s = s.nextElementSibling) end = s; }
        const a = n.getBoundingClientRect(), b = end.getBoundingClientRect();
        return { y: a.top + scrollY - 8, h: b.bottom - a.top + 16 }; })()`);
      if (!box) return false;
      clip = { x: 0, y: box.y, width: metrics.width, height: box.h, scale: 1 };
    } else {
      const height = Math.min(await js("document.documentElement.scrollHeight"), metrics.mobile ? 1500 : 1100);
      clip = { x: 0, y: 0, width: metrics.width, height, scale: 1 };
    }
    const { data } = await S("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
    fs.writeFileSync(path.join(out, file), Buffer.from(data, "base64"));
    return true;
  };
  return { S, js, until, shoot };
}

const report = [];
try {
  // The first open, on a fresh profile per width: the progress while the data is being kept.
  for (const [view, metrics] of VIEWS) {
    const chrome = await launch({ port: 9341 });
    try {
      const { S, js, until, shoot } = await session(chrome);
      await S("Emulation.setDeviceMetricsOverride", metrics);
      await S("Page.navigate", { url: origin + BASE });
      await until("document.readyState === 'complete'");
      const seen = await until("/menyimpan|Menyiapkan/i.test(document.body.innerText)", 30000);
      await sleep(1500);
      await shoot(`pembukaan-pertama-${view}.png`, metrics, null);
      report.push(`pembukaan-pertama-${view}: ${seen ? "kemajuan tampil" : "kemajuan TIDAK terlihat"}; ${await js("(document.getElementById('persiapan')||document.getElementById('keadaan-simpan')).innerText.replace(/\\s+/g,' ')")}`);
    } finally {
      chrome.close();
    }
  }

  const chrome = await launch({ port: 9342 });
  try {
    const { S, js, until, shoot } = await session(chrome);
    await S("Page.navigate", { url: origin + BASE });
    await until("document.readyState === 'complete'");
    for (const [view, metrics] of VIEWS) {
      await S("Emulation.setDeviceMetricsOverride", metrics);
      for (const [name, url, waitFor, selector, seeded] of SCREENS) {
        await js(
          seeded
            ? `localStorage.setItem("tax-riwayat", ${JSON.stringify(JSON.stringify(HISTORY))}); localStorage.setItem("tax-tersimpan", ${JSON.stringify(JSON.stringify(SAVED))}); true`
            : `localStorage.removeItem("tax-riwayat"); localStorage.removeItem("tax-tersimpan"); true`
        );
        await S("Page.navigate", { url: "about:blank" });
        await S("Page.navigate", { url: origin + url });
        await until("document.readyState === 'complete'");
        const missing = await js("/not found|tidak ditemukan|404/i.test(document.title)");
        if (missing) {
          report.push(`${name}-${view}: tidak ada di situs ini`);
          continue;
        }
        if (waitFor && !(await until(`document.querySelector(${JSON.stringify(waitFor)})`, 60000))) report.push(`${name}-${view}: menunggu ${waitFor} habis waktu`);
        await sleep(900);
        await js("document.head.insertAdjacentHTML('beforeend', '<style>.kartu{content-visibility:visible!important}</style>'); true");
        const ok = await shoot(`${name}-${view}.png`, metrics, selector);
        const scroll = await js("document.documentElement.scrollWidth");
        report.push(`${name}-${view}: ${ok ? "ok" : "bagian tidak ada"}, lebar ${scroll} px${scroll > metrics.width ? " (GULIR SAMPING)" : ""}`);
      }
    }
  } finally {
    chrome.close();
  }
} finally {
  if (server) server.close();
}
console.log(report.join("\n"));
