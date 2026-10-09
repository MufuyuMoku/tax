// Every decision number (K-xxx) mentioned anywhere must exist in docs/DECISIONS.md (K-071).
//
//   node scripts/cek-rujukan.mjs                 checks the repository's own files
//   node scripts/cek-rujukan.mjs laporan.md      checks any other text, e.g. a session report draft
//
// Exits with 1 and lists the problems when a number is missing, duplicated, or out of sequence.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", "dist", ".git", ".astro", "corpus", "harvest", "poc", "samples-local", ".venv", "fixtures"]);
const TEXT = /\.(md|mjs|js|astro|py|json|css|ya?ml)$/;
const REF = /\bK-(\d{3})\b/g;

/** { numbers: Set, problems: [] } for the headings of docs/DECISIONS.md. */
export function decisions(root = ROOT) {
  const text = fs.readFileSync(path.join(root, "docs", "DECISIONS.md"), "utf8");
  const headings = [...text.matchAll(/^## K-(\d{3}) /gm)].map((m) => Number(m[1]));
  const problems = [];
  const seen = new Set();
  headings.forEach((n, i) => {
    if (seen.has(n)) problems.push(`K-${String(n).padStart(3, "0")} muncul dua kali sebagai judul`);
    seen.add(n);
    if (n !== i + 1) problems.push(`judul ke-${i + 1} adalah K-${String(n).padStart(3, "0")}; nomor harus berurutan tanpa lompatan`);
  });
  return { numbers: seen, problems };
}

/** Problems for one text: every K-xxx in it that is not a decision heading. */
export function missingIn(text, numbers, where) {
  const out = [];
  for (const m of text.matchAll(REF)) {
    if (!numbers.has(Number(m[1]))) out.push(`${where}: merujuk ${m[0]}, yang tidak ada di docs/DECISIONS.md`);
  }
  return [...new Set(out)];
}

/** Text files of the repository, without generated data and dependencies. */
export function repositoryFiles(root = ROOT) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (TEXT.test(entry.name)) out.push(full);
    }
  };
  walk(root);
  return out;
}

export function check(files, root = ROOT) {
  const { numbers, problems } = decisions(root);
  for (const file of files) problems.push(...missingIn(fs.readFileSync(file, "utf8"), numbers, path.relative(root, file)));
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const problems = check(args.length ? args.map((a) => path.resolve(a)) : repositoryFiles());
  for (const p of problems) console.log(p);
  console.log(problems.length ? `${problems.length} masalah` : "semua rujukan K-xxx ada di docs/DECISIONS.md");
  process.exit(problems.length ? 1 : 0);
}
