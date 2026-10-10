// Renders the app icons in public/ from the SVG sources (K-084), with a local Chrome; no packages.
//
//   node scripts/make-icons.mjs [preview.png]
//
// public/ikon.svg           the icon (rounded square), also used as the SVG favicon
// public/ikon-maskable.svg  full-bleed variant for Android's masks and Apple's touch icon
// Writes ikon-192.png, ikon-512.png, ikon-maskable-512.png, apple-touch-icon.png (180) and
// favicon.ico (16, 32, 48). With a path, also a preview sheet: several sizes on light and dark.
import fs from "node:fs";
import path from "node:path";
import { launch, sleep } from "./cdp.mjs";

const PUBLIC = path.join(process.cwd(), "public");
const svg = (name) => `data:image/svg+xml;base64,${fs.readFileSync(path.join(PUBLIC, name)).toString("base64")}`;

const chrome = await launch({ port: 9340 });
const { targetId } = await chrome.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await chrome.send("Target.attachToTarget", { targetId, flatten: true });
const S = (method, params = {}) => chrome.send(method, params, sessionId);
await S("Page.enable");
await S("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });

async function render(html, width, height) {
  await S("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await S("Page.navigate", { url: `data:text/html;base64,${Buffer.from(html).toString("base64")}` });
  await sleep(400);
  const { data } = await S("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 1 } });
  return Buffer.from(data, "base64");
}

const icon = (source, size) =>
  render(`<html><body style="margin:0;background:transparent"><img src="${svg(source)}" width="${size}" height="${size}" style="display:block"></body></html>`, size, size);

/** An .ico holding PNG images, which every current browser reads. */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(([size, png]) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...pngs.map(([, png]) => png)]);
}

try {
  const out = {
    "ikon-192.png": await icon("ikon.svg", 192),
    "ikon-512.png": await icon("ikon.svg", 512),
    "ikon-maskable-512.png": await icon("ikon-maskable.svg", 512),
    "apple-touch-icon.png": await icon("ikon-maskable.svg", 180),
    "favicon.ico": ico([[16, await icon("ikon.svg", 16)], [32, await icon("ikon.svg", 32)], [48, await icon("ikon.svg", 48)]]),
  };
  for (const [name, bytes] of Object.entries(out)) {
    fs.writeFileSync(path.join(PUBLIC, name), bytes);
    console.log(`public/${name}: ${bytes.length} byte`);
  }

  const preview = process.argv[2];
  if (preview) {
    const sizes = [16, 32, 48, 72, 128];
    const row = (bg, fg, source, label, round) =>
      `<div style="background:${bg};color:${fg};padding:16px 20px;display:flex;align-items:end;gap:22px;font:14px system-ui">` +
      `<span style="width:150px">${label}</span>` +
      sizes.map((s) => `<figure style="margin:0;text-align:center"><img src="${svg(source)}" width="${s}" height="${s}" style="display:block;margin:auto;${round ? "border-radius:50%" : ""}"><figcaption>${s}px</figcaption></figure>`).join("") +
      `</div>`;
    const html =
      `<html><body style="margin:0">` +
      row("#ffffff", "#1a1a1a", "ikon.svg", "Latar terang", false) +
      row("#15181c", "#e8e8e8", "ikon.svg", "Latar gelap", false) +
      row("#ffffff", "#1a1a1a", "ikon-maskable.svg", "Android, topeng bulat", true) +
      row("#15181c", "#e8e8e8", "ikon-maskable.svg", "Android, topeng bulat", true) +
      `</body></html>`;
    fs.writeFileSync(preview, await render(html.replace("<body style=\"margin:0\">", "<body style=\"margin:0;overflow:hidden\">"), 760, 4 * 176));
    console.log(preview);
  }
} finally {
  chrome.close();
}
