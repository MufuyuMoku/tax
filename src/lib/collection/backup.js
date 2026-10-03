// One backup file for the whole collection, and restoring it. The file is JSON with every
// original file inside it (base64), written deterministically: the same collection always gives
// the same bytes, so a round trip can be checked byte for byte. It is produced and read on the
// device; nothing here sends anything anywhere.
import { sha256 } from "./records.js";

export const FORMAT = "tax-koleksi-pribadi";
export const VERSION = 1;

function toBase64(bytes) {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** JSON with keys in sorted order at every level, so equal content gives equal bytes. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function order(records) {
  return records.slice().sort((a, b) => (a.importedAt < b.importedAt ? -1 : a.importedAt > b.importedAt ? 1 : a.id < b.id ? -1 : 1));
}

/** The backup file's bytes. No date inside: the export date goes into the file name only. */
export function exportBackup(records) {
  const documents = order(records).map((record) => ({
    ...record,
    file: record.file ? { ...record.file, bytes: toBase64(record.file.bytes) } : null,
  }));
  const text = canonical({ format: FORMAT, version: VERSION, count: documents.length, documents }) + "\n";
  return new TextEncoder().encode(text);
}

export class BackupError extends Error {}

/** Records from a backup file. Every embedded file is checked against its recorded SHA-256. */
export async function parseBackup(bytes) {
  let data;
  try {
    data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new BackupError("berkas ini bukan cadangan koleksi (bukan JSON yang sah)");
  }
  if (!data || data.format !== FORMAT) throw new BackupError("berkas ini bukan cadangan koleksi Tax");
  if (data.version !== VERSION) throw new BackupError(`versi cadangan ${data.version} tidak dikenali`);
  if (!Array.isArray(data.documents) || data.documents.length !== data.count) {
    throw new BackupError("isi cadangan tidak lengkap");
  }
  const records = [];
  for (const document of data.documents) {
    if (!document.id || !document.importedAt) throw new BackupError("ada dokumen tanpa id atau tanggal impor");
    let file = null;
    if (document.file) {
      const raw = fromBase64(document.file.bytes);
      if ((await sha256(raw)) !== document.file.sha256) {
        throw new BackupError(`berkas di dalam cadangan rusak: ${document.file.name}`);
      }
      file = { ...document.file, bytes: raw };
    }
    records.push({ ...document, file, verified: false });
  }
  return records;
}

/**
 * Combine the current collection with restored records.
 * mode "ganti": the backup replaces everything. mode "gabung": records already present (same id)
 * are kept as they are, and only new ones are added.
 */
export function mergeRecords(existing, incoming, mode) {
  if (mode === "ganti") return { records: incoming.slice(), added: incoming.length, kept: 0, skipped: 0 };
  if (mode !== "gabung") throw new Error(`mode pemulihan tidak dikenal: ${mode}`);
  const ids = new Set(existing.map((r) => r.id));
  const added = incoming.filter((r) => !ids.has(r.id));
  return {
    records: existing.concat(added),
    added: added.length,
    kept: existing.length,
    skipped: incoming.length - added.length,
  };
}

/** A file name for the backup: the date only, nothing about the documents. */
export function backupFileName(date = new Date()) {
  return `tax-koleksi-pribadi-${date.toISOString().slice(0, 10)}.json`;
}
