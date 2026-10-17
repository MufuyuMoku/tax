// The Saku Pajak app icon, from the three proposals of K-097; the owner chose C, "lencana" (K-098),
// and proposals A (head in the pocket) and B (whole rabbit) were removed; they remain in git history.
// The design: a plain rabbit with pointed ears, no mouth,
// black and gold, of the same family as the Pyonkuro mark but not that mark, peeking from a pocket
// with a magnifying glass. This writes the SVG sources and the preview sheet into docs/ikon-usulan/;
// public/ikon-lencana*.svg are copies of those sources, rendered by scripts/make-icons.mjs.
//
//   node scripts/ikon-usulan.mjs
//
// Each variant comes in two forms: "biasa" (rounded square with a gold rim, for favicons and
// browsers) and "maskable" (full bleed; everything inside the central 80% circle that Android may
// cut to). The sheet shows 512, 192, 48 and 16 px on light and dark, the Android masks, and the
// icon on a phone home screen.
import fs from "node:fs";
import path from "node:path";
import { launch, sleep } from "./cdp.mjs";

const OUT = path.join(process.cwd(), "docs", "ikon-usulan");
const INK = "#161616";
const GOLD = "#c9a44c";

// Pointed ears as on the Pyonkuro rabbit: tall, narrow, slightly apart.
const ear = (x, base, tip, lean) =>
  `<path d="M${x - 20} ${base} C${x - 26} ${base - 60} ${x - 16 + lean} ${tip + 40} ${x + lean} ${tip} ` +
  `C${x + 16 + lean} ${tip + 40} ${x + 22} ${base - 60} ${x + 18} ${base} Z" fill="${GOLD}"/>`;
const lens = (cx, cy, r, angle, handle) => {
  const rad = (angle * Math.PI) / 180;
  const x1 = cx + Math.cos(rad) * (r + 4);
  const y1 = cy + Math.sin(rad) * (r + 4);
  const x2 = cx + Math.cos(rad) * (r + handle);
  const y2 = cy + Math.sin(rad) * (r + handle);
  return (
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="34" stroke-linecap="round"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${GOLD}" stroke-width="20" stroke-linecap="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK}" stroke="${INK}" stroke-width="30"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK}" stroke="${GOLD}" stroke-width="16"/>` +
    `<path d="M${cx - r * 0.5} ${cy - r * 0.15} A${r * 0.55} ${r * 0.55} 0 0 1 ${cx - r * 0.1} ${cy - r * 0.5}" fill="none" stroke="${GOLD}" stroke-width="8" stroke-linecap="round"/>`
  );
};
// A pocket: straight top, rounded point at the bottom, a stitched line under the opening.
const pocket = (x0, x1, top, bottom) => {
  const mid = (x0 + x1) / 2;
  const side = bottom - (bottom - top) * 0.32;
  const shape = `M${x0} ${top} H${x1} V${side} Q${x1} ${side + 22} ${mid + 30} ${bottom - 6} Q${mid} ${bottom + 6} ${mid - 30} ${bottom - 6} Q${x0} ${side + 22} ${x0} ${side} Z`;
  return (
    `<path d="${shape}" fill="${GOLD}" stroke="${INK}" stroke-width="14" paint-order="stroke" stroke-linejoin="round"/>` +
    `<path d="M${x0 + 16} ${top + 28} H${x1 - 16}" stroke="${INK}" stroke-width="7" stroke-dasharray="16 11" stroke-linecap="round"/>`
  );
};

const VARIANTS = {
  "c-lencana": {
    title: "C. Siluet lencana",
    note: "Lingkaran lencana, saku dengan kaca pembesar sebagai lambang, dan dua telinga yang menyembul. Paling jelas di 16 px.",
    art: () =>
      `<circle cx="256" cy="256" r="190" fill="none" stroke="${GOLD}" stroke-width="14"/>` +
      ear(222, 250, 118, -8) +
      ear(290, 250, 118, 8) +
      pocket(150, 362, 236, 396) +
      `<circle cx="248" cy="310" r="34" fill="none" stroke="${INK}" stroke-width="13"/>` +
      `<line x1="273" y1="335" x2="300" y2="362" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>`,
  },
};

function svg(variant, maskable) {
  const art = VARIANTS[variant].art();
  const body = maskable
    ? `<rect width="512" height="512" fill="${INK}"/><g transform="translate(256 256) scale(0.92) translate(-256 -256)">${art}</g>`
    : `<rect x="8" y="8" width="496" height="496" rx="112" fill="${INK}" stroke="${GOLD}" stroke-width="12"/>` +
      `<g transform="translate(256 256) scale(0.96) translate(-256 -256)">${art}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Saku Pajak">${body}</svg>\n`;
}

const uri = (text) => `data:image/svg+xml;base64,${Buffer.from(text).toString("base64")}`;

function sheet(variant) {
  const plain = uri(svg(variant, false));
  const full = uri(svg(variant, true));
  const { title, note } = VARIANTS[variant];
  const sizes = (bg, fg, label) =>
    `<div class="baris" style="background:${bg};color:${fg}"><span class="label">${label}</span>` +
    [512, 192, 48, 16]
      .map((s) => `<figure><img src="${plain}" width="${s}" height="${s}"><figcaption>${s} px</figcaption></figure>`)
      .join("") +
    `<figure><img src="${plain}" width="16" height="16" style="width:64px;height:64px;image-rendering:pixelated" data-kecil><figcaption>16 px, diperbesar 4×</figcaption></figure>` +
    `</div>`;
  const masks = (bg, fg) =>
    `<div class="baris" style="background:${bg};color:${fg}"><span class="label">Ikon maskable: bulat, squircle, persegi; garis = zona aman</span>` +
    [["50%", "bulat"], ["30%", "squircle"], ["12%", "persegi"]]
      .map(([r, n]) => `<figure><img src="${full}" width="192" height="192" style="border-radius:${r}"><figcaption>${n}</figcaption></figure>`)
      .join("") +
    `<figure style="position:relative"><img src="${full}" width="192" height="192"><span style="position:absolute;left:19px;top:19px;width:154px;height:154px;border:2px dashed #e0443e;border-radius:50%"></span><figcaption>zona aman 80%</figcaption></figure>` +
    `</div>`;
  const app = (label, img, mine) =>
    `<div class="app"><div class="ikon" style="${mine ? "" : `background:${img}`}">${mine ? `<img src="${full}" width="56" height="56">` : ""}</div><span>${label}</span></div>`;
  const phone = (wallpaper, fg, label) =>
    `<figure class="hp"><div class="layar" style="background:${wallpaper};color:${fg}">` +
    `<div class="jam">09.41</div><div class="grid">` +
    app("Kamera", "#3d6fb6") + app("Galeri", "#d9734e") + app("Pesan", "#4caf72") + app("Kalender", "#e8e8e8") +
    app("Berkas", "#f2c14e") + app("Saku Pajak", "", true) + app("Peta", "#5fa3a0") + app("Setelan", "#888") +
    `</div><div class="dok">${app("Telepon", "#4caf72")}${app("Chrome", "#e8e8e8")}${app("Kontak", "#3d6fb6")}${app("Musik", "#c2185b")}</div>` +
    `</div><figcaption>${label}</figcaption></figure>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font:15px system-ui,"Segoe UI",sans-serif;background:#fff;color:#1a1a1a;width:1500px}
    header{padding:22px 28px 6px} h1{margin:0;font-size:26px} header p{margin:6px 0 0;color:#555}
    .baris{display:flex;align-items:flex-end;gap:28px;padding:22px 28px}
    .label{width:150px;align-self:center;font-weight:600}
    figure{margin:0;text-align:center} figure img{display:block;margin:0 auto 6px} figcaption{font-size:13px;opacity:.8}
    .hp-baris{display:flex;gap:40px;padding:22px 28px;background:#f3f3f3}
    .hp .layar{width:300px;height:520px;border-radius:34px;border:10px solid #222;padding:18px 16px;box-sizing:border-box;display:flex;flex-direction:column}
    .jam{font-size:46px;font-weight:300;text-align:center;margin:18px 0 40px}
    .grid,.dok{display:grid;grid-template-columns:repeat(4,1fr);gap:18px 6px}
    .dok{margin-top:auto;padding-top:14px;border-top:1px solid rgb(127 127 127 / .3)}
    .app{display:flex;flex-direction:column;align-items:center;gap:5px;font-size:11px}
    .ikon{width:56px;height:56px;border-radius:50%;overflow:hidden;display:flex}
    .ikon img{width:56px;height:56px}
    .dok .app span{display:none}
  </style></head><body>
  <header><h1>${title}</h1><p>${note} Belum dipasang. Warna: hitam ${INK} dan emas ${GOLD}.</p></header>
  ${sizes("#ffffff", "#1a1a1a", "Latar terang")}
  ${sizes("#15181c", "#e8e8e8", "Latar gelap")}
  ${masks("#ffffff", "#1a1a1a")}
  <div class="hp-baris">
    ${phone("linear-gradient(160deg,#cfe3f5,#f6efe2)", "#1a1a1a", "Layar beranda, wallpaper terang")}
    ${phone("linear-gradient(160deg,#1c2733,#0d0f12)", "#f0f0f0", "Layar beranda, wallpaper gelap")}
    ${phone("linear-gradient(160deg,#7a5a3a,#2d3b2a)", "#f0f0f0", "Layar beranda, foto berwarna")}
  </div>
  </body></html>`;
}

fs.mkdirSync(OUT, { recursive: true });
const chrome = await launch({ port: 9343 });
try {
  const { targetId } = await chrome.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await chrome.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (method, params = {}) => chrome.send(method, params, sessionId);
  await S("Page.enable");
  for (const variant of Object.keys(VARIANTS)) {
    fs.writeFileSync(path.join(OUT, `${variant}.svg`), svg(variant, false));
    fs.writeFileSync(path.join(OUT, `${variant}-maskable.svg`), svg(variant, true));
    const html = sheet(variant);
    const file = path.join(OUT, `${variant}.html`);
    fs.writeFileSync(file, html);
    await S("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
    await S("Page.navigate", { url: `file:///${file.replace(/\\/g, "/")}` });
    await sleep(700);
    const height = (await S("Runtime.evaluate", { expression: "document.documentElement.scrollHeight", returnByValue: true })).result.value;
    const { data } = await S("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1500, height, scale: 1 } });
    fs.writeFileSync(path.join(OUT, `${variant}-pratinjau.png`), Buffer.from(data, "base64"));
    fs.rmSync(file);
    console.log(`docs/ikon-usulan/${variant}: svg, maskable svg, pratinjau png`);
  }
} finally {
  chrome.close();
}
