// Time until the search engine is ready, with the engine on the page's main thread so Chrome's CPU
// throttling applies to it (the way of K-031 and K-069; a Web Worker cannot be throttled through
// the DevTools protocol). Fetching the search data over localhost is included.
//
//   node scripts/ukur-mesin.mjs <dist> <source root> [rate ...]
//
// <source root> is the checkout whose engine is measured: its src/lib/search/ decides whether the
// data is read as one cari/data.json (format 2) or as a head and 64 parts (format 3, K-099).
// Writes a throwaway page into <dist>/__ukur/ and removes it afterwards.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { launch, sleep } from "./cdp.mjs";

const [dist, sourceRoot, ...rateArgs] = process.argv.slice(2);
if (!dist || !sourceRoot) throw new Error("Pakai: node scripts/ukur-mesin.mjs <dist> <akar sumber> [laju ...]");
const rates = (rateArgs.length ? rateArgs : ["1", "4", "6"]).map(Number);
const split = fs.existsSync(path.join(sourceRoot, "src", "lib", "search", "assemble.js"));
const lib = path.resolve(sourceRoot, "src", "lib", "search").replace(/\\/g, "/");

const entry = `
import { SearchEngine } from "${lib}/engine.js";
${split ? `import { assemblePayload, partUrl } from "${lib}/assemble.js";` : ""}
const get = (u) => fetch(u).then((r) => r.json());
window.ukur = async () => {
  const t0 = performance.now();
  const url = new URL("../cari/data.json", location.href).href;
  ${split
    ? `const head = await get(url);
  const parts = await Promise.all(head.parts.map((h, n) => get(partUrl(url, n, h))));
  const t1 = performance.now();
  const engine = new SearchEngine(assemblePayload(head, parts));`
    : `const payload = await get(url);
  const t1 = performance.now();
  const engine = new SearchEngine(payload);`}
  const t2 = performance.now();
  const timed = (q) => { const s = performance.now(); const r = engine.search(q); return [performance.now() - s, r.total]; };
  return { fetch: t1 - t0, build: t2 - t1, ready: t2 - t0, pph21: timed("PPh 21"), kasus: timed("karyawan dapat bonus tahunan") };
};
`;
const out = path.join(dist, "__ukur");
fs.mkdirSync(out, { recursive: true });
const { build } = await import("esbuild");
await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "js" }, bundle: true, format: "esm", outfile: path.join(out, "mesin.js") });
fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><meta charset="utf-8"><script type="module" src="mesin.js"></script>`);

const PORT = 4397;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let file = path.join(dist, decodeURIComponent(url.pathname.replace(/^\/tax\//, "")));
  if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(PORT, resolve));
const chrome = await launch({ port: 9345 });
try {
  console.log(`${dist} (${split ? "format 3: kepala + 64 bagian" : "format 2: satu data.json"})`);
  for (const rate of rates) {
    const { targetId } = await chrome.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await chrome.send("Target.attachToTarget", { targetId, flatten: true });
    const S = (method, params = {}) => chrome.send(method, params, sessionId);
    await S("Page.enable");
    await S("Page.navigate", { url: `http://localhost:${PORT}/tax/__ukur/` });
    await sleep(1000);
    await S("Emulation.setCPUThrottlingRate", { rate });
    const { result } = await S("Runtime.evaluate", { expression: "window.ukur()", awaitPromise: true, returnByValue: true });
    const r = result.value;
    const s = (ms) => `${(ms / 1000).toFixed(2)} dtk`;
    console.log(`  CPU ${rate}x: siap ${s(r.ready)} (ambil ${s(r.fetch)}, bangun ${s(r.build)}); "PPh 21" ${r.pph21[0].toFixed(0)} md; kasus ${r.kasus[0].toFixed(0)} md`);
    await chrome.send("Target.closeTarget", { targetId });
  }
} finally {
  chrome.close();
  server.close();
  fs.rmSync(out, { recursive: true, force: true });
}
