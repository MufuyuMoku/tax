// The normalised text of every pasal, computed once at build time (K-069): a vocabulary and a stream
// of token ids, varint-coded and base64 so it travels inside cari/data.json. The browser decodes it
// instead of normalising ten-odd megabytes of text itself. Shared by build (Node) and browser, so
// it has no dependencies beyond normalize.js.
import { normalizeText } from "./normalize.js";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function toBase64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : B64[c & 63];
  }
  return out;
}

const LOOKUP = new Uint8Array(128);
for (let i = 0; i < B64.length; i++) LOOKUP[B64.charCodeAt(i)] = i;

function fromBase64(text) {
  let length = (text.length / 4) * 3;
  if (text.endsWith("==")) length -= 2;
  else if (text.endsWith("=")) length -= 1;
  const bytes = new Uint8Array(length);
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    const a = LOOKUP[text.charCodeAt(i)], b = LOOKUP[text.charCodeAt(i + 1)];
    const c = LOOKUP[text.charCodeAt(i + 2)], d = LOOKUP[text.charCodeAt(i + 3)];
    bytes[o++] = (a << 2) | (b >> 4);
    if (o < length) bytes[o++] = ((b & 15) << 4) | (c >> 2);
    if (o < length) bytes[o++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

function encodeVarints(values) {
  const bytes = [];
  for (let v of values) {
    while (v >= 128) {
      bytes.push((v & 127) | 128);
      v >>>= 7;
    }
    bytes.push(v);
  }
  return toBase64(Uint8Array.from(bytes));
}

export function decodeVarints(text, count) {
  const bytes = fromBase64(text);
  const out = new Uint32Array(count);
  let v = 0, shift = 0, n = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    v |= (byte & 127) << shift;
    if (byte & 128) shift += 7;
    else {
      out[n++] = v >>> 0;
      v = 0;
      shift = 0;
    }
  }
  return out;
}

/** { vocab, ids, counts, total }: vocab sorted by frequency (then text), so frequent ids are short. */
export function buildTextIndex(texts, ocr) {
  const tokenLists = texts.map((t) => {
    const norm = normalizeText(t, ocr);
    return norm.count ? norm.text.split(" ") : [];
  });
  const freq = new Map();
  for (const list of tokenLists) for (const t of list) freq.set(t, (freq.get(t) || 0) + 1);
  const vocab = [...freq.keys()].sort((a, b) => freq.get(b) - freq.get(a) || (a < b ? -1 : a > b ? 1 : 0));
  const id = new Map(vocab.map((t, i) => [t, i]));
  const ids = [];
  for (const list of tokenLists) for (const t of list) ids.push(id.get(t));
  return {
    vocab,
    total: ids.length,
    ids: encodeVarints(ids),
    counts: encodeVarints(tokenLists.map((l) => l.length)),
  };
}
