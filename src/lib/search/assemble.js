// The public search data in parts (K-099): cari/data.json holds what changes with any update (the
// document list, the pasal list, the vocabulary, the term lists, the definitions), and
// cari/teks/NN.json the pasal texts and their token ids, split by document id like the offline page
// data (K-082). A small update then changes the head and one or two parts, not 36 MB.
//
// This puts the parts back into the one payload the engine has always taken. It runs in the search
// worker and in Node (the tests go through it), so it has no dependencies of its own.
import { SHARDS, shardOf } from "../render/shards.js";
import { decodeVarints } from "./textindex.js";

export const FORMAT = 3;

/** For every part, the indexes of its units in the head's unit list, in that list's order. */
export function partMembers(docs, units) {
  const members = Array.from({ length: SHARDS }, () => []);
  units.forEach((unit, i) => members[shardOf(docs[unit.doc].id)].push(i));
  return members;
}

/** Where part `n` is fetched from: its hash in the address, so no cache can hand out another build's. */
export function partUrl(dataUrl, n, hash) {
  return new URL(`teks/${String(n).padStart(2, "0")}.json?v=${hash}`, dataUrl).href;
}

/** The payload the engine takes, from the head and its parts (parsed JSON, in part order). */
export function assemblePayload(head, parts) {
  if (head.format !== FORMAT) throw new Error(`format data pencarian ${head.format} tidak dikenali (seharusnya ${FORMAT})`);
  if (head.parts.length !== SHARDS || parts.length !== SHARDS) throw new Error("jumlah bagian data pencarian tidak cocok");
  const n = head.units.length;
  const members = partMembers(head.docs, head.units);
  const texts = new Array(n);
  const counts = new Uint32Array(n);
  const decoded = [];
  let total = 0;
  parts.forEach((part, s) => {
    const own = members[s];
    // A part of another build would put texts under the wrong pasal; refuse rather than mix.
    if (!part || part.units !== own.length) throw new Error(`bagian data pencarian ${s} tidak cocok dengan daftar pasalnya`);
    const partCounts = decodeVarints(part.counts, own.length);
    let sum = 0;
    for (const c of partCounts) sum += c;
    decoded.push({ own, partCounts, ids: decodeVarints(part.ids, sum) });
    own.forEach((i, k) => {
      texts[i] = part.texts[k];
      counts[i] = partCounts[k];
    });
    total += sum;
  });
  const start = new Uint32Array(n + 1);
  for (let i = 0; i < n; i++) start[i + 1] = start[i] + counts[i];
  const ids = new Uint32Array(total);
  for (const { own, partCounts, ids: partIds } of decoded) {
    let at = 0;
    own.forEach((i, k) => {
      ids.set(partIds.subarray(at, at + partCounts[k]), start[i]);
      at += partCounts[k];
    });
  }
  const { vocab, parts: _hashes, ...rest } = head;
  return { ...rest, texts, index: { vocab, total, ids, counts } };
}
