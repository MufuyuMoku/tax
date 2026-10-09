// Build step for offline use (M6, K-082), run by Astro after every page is written:
//
// 1. Writes the offline page data, dist/luring/data/NN.json: every document view and every unit,
//    split by document id (src/lib/render/shards.js).
// 2. Renders every document and pasal page again from that data, the way the service worker will
//    on a phone, and fails the build unless each one is byte-identical to the page Astro wrote.
// 3. Writes dist/sw.js: the service worker, with the list of files to keep and the hash of each.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dataDate } from "../corpus.js";
import { fillShell } from "../render/html.js";
import { renderDocumentPage, renderPasalPage } from "../render/pages.js";
import { documentOfPasal, shardOf, shardPath, SHARDS } from "../render/shards.js";
import { documentIds, documentView, listPasalIds, unitView } from "../render/views.js";

const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16);

function writeShards(dist) {
  const shards = Array.from({ length: SHARDS }, () => ({ docs: {}, units: {} }));
  for (const id of documentIds()) {
    const doc = documentView(id);
    const shard = shards[shardOf(id)];
    shard.docs[id] = doc;
    for (const pasalId of doc.pasal_ids) shard.units[pasalId] = unitView(pasalId);
  }
  shards.forEach((shard, n) => {
    const file = path.join(dist, shardPath(n));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(shard));
  });
}

/** Render every page from the written data files, as the service worker does; list differences. */
export function compare(dist, base) {
  const shell = fs.readFileSync(path.join(dist, "luring", "kerangka", "index.html"), "utf8");
  const data = Array.from({ length: SHARDS }, (_, n) => JSON.parse(fs.readFileSync(path.join(dist, shardPath(n)), "utf8")));
  const different = [];
  let checked = 0;
  const check = (file, view) => {
    checked += 1;
    if (fillShell(shell, view) !== fs.readFileSync(path.join(dist, file), "utf8")) different.push(file);
  };
  for (const shard of data) {
    for (const doc of Object.values(shard.docs)) {
      check(path.join("dokumen", doc.id, "index.html"), renderDocumentPage(doc, doc.pasal_ids.map((p) => shard.units[p]), base));
    }
    for (const unit of Object.values(shard.units)) {
      const doc = shard.docs[documentOfPasal(unit.id)];
      check(path.join("pasal", unit.id, "index.html"), renderPasalPage(doc, unit, base));
    }
  }
  const expected = documentIds().length + listPasalIds().length;
  if (checked !== expected) different.push(`(${checked} halaman diperiksa, seharusnya ${expected})`);
  return { checked, different };
}

/** Files the service worker keeps, as { path, url, hash, bytes }. */
function filesToKeep(dist, base) {
  const pages = ["index.html", "semua/index.html", "koleksi/index.html", "cara-pakai/index.html", "luring/kerangka/index.html"];
  const listed = (dir) => fs.readdirSync(path.join(dist, dir)).map((name) => `${dir}/${name}`);
  const paths = [
    ...pages,
    ...listed("_astro"),
    "cari/data.json",
    ...listed("luring/data"),
    "manifest.webmanifest",
    "keadaan.js",
    ...fs.readdirSync(dist).filter((name) => /^ikon-.*\.png$/.test(name)),
  ];
  return paths.map((p) => {
    const bytes = fs.readFileSync(path.join(dist, p));
    // Pages are asked for by their directory URL, which is how links and the browser name them.
    const url = base + p.replace(/(^|\/)index\.html$/, "$1");
    return { path: p, url, hash: hash(bytes), bytes: bytes.length };
  });
}

export async function writeWorker(dist, base, root) {
  const files = filesToKeep(dist, base);
  const dataFiles = files.filter((f) => f.path === "cari/data.json" || f.path.startsWith("luring/data/"));
  const manifest = {
    version: hash(files.map((f) => `${f.url} ${f.hash}`).join("\n")),
    base,
    shell: `${base}luring/kerangka/`,
    data: { version: hash(dataFiles.map((f) => f.hash).join("\n")), date: dataDate() },
    files,
  };
  const { build } = await import("esbuild");
  const result = await build({
    entryPoints: [path.join(root, "src", "sw", "sw.js")],
    bundle: true,
    format: "iife",
    write: false,
    define: { __TAX__: JSON.stringify(manifest) },
  });
  fs.writeFileSync(path.join(dist, "sw.js"), result.outputFiles[0].text);
  return manifest;
}

export default function offline() {
  let base = "/";
  let root = process.cwd();
  return {
    name: "tax-luring",
    hooks: {
      "astro:config:done": ({ config }) => {
        base = config.base.endsWith("/") ? config.base : `${config.base}/`;
        root = fileURLToPath(config.root);
      },
      "astro:build:done": async ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        writeShards(dist);
        const { checked, different } = compare(dist, base);
        if (different.length) {
          throw new Error(
            `Halaman luring berbeda dari halaman terbit (${different.length} dari ${checked}): ${different.slice(0, 5).join(", ")}`
          );
        }
        logger.info(`${checked} halaman dokumen dan pasal: hasil luring sama persis dengan halaman terbit`);
        const manifest = await writeWorker(dist, base, root);
        const mb = (manifest.files.reduce((sum, f) => sum + f.bytes, 0) / 1e6).toFixed(1);
        logger.info(`sw.js: versi ${manifest.version}, data ${manifest.data.version} (${manifest.data.date}), ${manifest.files.length} berkas, ${mb} MB`);
      },
    },
  };
}
