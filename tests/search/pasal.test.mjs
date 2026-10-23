// Article references (K-101): reading them from a query, finding where each article is written,
// telling a citation of "Pasal 16D UU PPN" from a bare "16D", and the box and split they give.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildSearchPayload } from "../../src/lib/search/payload.js";
import { SearchEngine } from "../../src/lib/search/engine.js";
import { amendmentItems, citedLaw, compileLaws, parseArticleRef } from "../../src/lib/search/articles.js";

const groups = JSON.parse(fs.readFileSync("src/data/search/undang-undang.json", "utf8")).kelompok;
const DOCS = [
  { code: "UU", number: "7", year: "1983", title: "PAJAK PENGHASILAN" },
  { code: "UU", number: "8", year: "1983", title: "PAJAK PERTAMBAHAN NILAI BARANG DAN JASA" },
  { code: "UU", number: "6", year: "1983", title: "KETENTUAN UMUM DAN TATA CARA PERPAJAKAN" },
  { code: "UU", number: "42", year: "2009", title: "PERUBAHAN KETIGA ATAS UNDANG-UNDANG NOMOR 8 TAHUN 1983 TENTANG PAJAK PERTAMBAHAN NILAI" },
  { code: "PMK", number: "11", year: "2025", title: "NILAI LAIN" },
];
const compiled = compileLaws(groups, DOCS, null);
const law = (key) => compiled.laws.findIndex((l) => l.key === key);
// Articles that exist in this small world: PPN 16C, 16D; PPh 4, 21, 23, 31E; KUP 32A.
const EXISTS = { PPN: ["16C", "16D", "4"], PPh: ["4", "21", "23", "31E", "32A"], KUP: ["21", "32A"] };
const has = (article, laws) => (laws || compiled.laws.map((_, l) => l)).some((l) => (EXISTS[compiled.laws[l].key] || []).includes(article));

test("amending laws are recognised from their titles", () => {
  assert.deepEqual(compiled.laws[law("PPN")].amenders, [3]);
  assert.equal(compiled.familyOf[4], -1);
});

test("article references are read from the forms officers write", () => {
  const read = (q) => {
    const ref = parseArticleRef(q, compiled, has);
    return ref && [ref.article, ref.ayat, ref.laws && ref.laws.map((l) => compiled.laws[l].key), ref.found];
  };
  assert.deepEqual(read("16D"), ["16D", null, null, true]);
  assert.deepEqual(read("pasal 16D"), ["16D", null, null, true]);
  assert.deepEqual(read("Ps. 16D"), ["16D", null, null, true]);
  assert.deepEqual(read("PPN 16C"), ["16C", null, ["PPN"], true]);
  assert.deepEqual(read("16D PPN"), ["16D", null, ["PPN"], true]);
  assert.deepEqual(read("pasal 4 ayat (2)"), ["4", "2", null, true]);
  assert.deepEqual(read("pasal 4 ayat 2"), ["4", "2", null, true]);
  assert.deepEqual(read("4(2)"), ["4", "2", null, true]);
  assert.deepEqual(read("PPh 4(2) sewa"), ["4", "2", ["PPh"], true]);
  assert.deepEqual(read("PPh 23"), ["23", null, ["PPh"], true]);
  assert.deepEqual(read("Pasal 32A UU PPh"), ["32A", null, ["PPh"], true]);
  assert.deepEqual(read("pasal 32A UU KUP"), ["32A", null, ["KUP"], true]);
  assert.deepEqual(read("pasal 21 Undang-Undang Nomor 42 Tahun 2009"), ["21", null, ["PPN"], false]);
  assert.deepEqual(read("pasal 21 pesangon"), ["21", null, null, true]);
  // "14D" is no article here: said so, and searched as usual.
  assert.deepEqual(read("14D"), ["14D", null, null, false]);
  assert.deepEqual(read("pasal 14D"), ["14D", null, null, false]);
});

test("numbers that are not article references stay ordinary", () => {
  for (const q of ["tarif PPN 12 persen", "PPN 11%", "PPh 0,5 persen", "21", "PMK 168/2023", "PER-11/PJ/2025", "1770 SS", "PPN 12", "omzet 4,8 miliar"]) {
    assert.equal(parseArticleRef(q, compiled, has), null, q);
  }
});

test("a citation needs the law's name after the article, or the article inside the law itself", () => {
  const cite = (text, article, own) => {
    const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu);
    const at = tokens.indexOf(article.toLowerCase());
    const l = citedLaw(compiled, (i) => tokens[i], at, { article, ayat: null }, own);
    return l === -1 ? null : compiled.laws[l].key;
  };
  assert.equal(cite("sebagaimana diatur dalam Pasal 16D Undang-Undang Pajak Pertambahan Nilai", "16D"), "PPN");
  assert.equal(cite("Pasal 4 ayat (1) huruf a dan/atau Pasal 16D Undang-Undang PPN", "16D"), "PPN");
  assert.equal(cite("Pasal 16D Undang-Undang Nomor 8 Tahun 1983 tentang Pajak Pertambahan Nilai", "16D"), "PPN");
  assert.equal(cite("Pasal 21 Undang-Undang Nomor 42 Tahun 2009", "21"), "PPN");
  assert.equal(cite("dipotong Pajak Penghasilan Pasal 21 oleh pemberi kerja", "21"), "PPh");
  assert.equal(cite("SPT Masa PPh 21", "21"), "PPh");
  assert.equal(cite("Pasal 32A Undang-Undang KUP", "32A"), "KUP");
  // Its own pasal, another regulation's numbering, and a numbered list.
  assert.equal(cite("sebagaimana dimaksud dalam Pasal 16D ayat (1)", "16D"), null);
  assert.equal(cite("sebagaimana dimaksud dalam Pasal 16D", "16D", law("PPN")), "PPN");
  assert.equal(cite("Pasal 22 Undang-Undang Pajak Penghasilan. 23. Pajak Penghasilan Pasal 25", "23"), null);
  assert.equal(cite("Pasal 16D", "16D"), null);
});

test("an amending law's Pasal I is split into the articles it writes out", () => {
  const text = [
    "Pasal I",
    "16.",
    "Ketentuan Pasal 16B ayat (1) diubah sehingga Pasal 16B berbunyi sebagai berikut:",
    "Pasal 16B",
    "(1) Pajak terutang tidak dipungut.",
    "17.",
    "Ketentuan Pasal 16D diubah sehingga berbunyi sebagai berikut:",
    "Pasal 16D",
    "Pajak Pertambahan Nilai dikenakan atas penyerahan aktiva.",
    "18.",
    "Diantara Pasal 16 D dan Pasal 17 disisipkan 2 (dua) pasal, yakni Pasal 16 E dan Pasal 16 F sehingga berbunyi sebagai berikut:",
    "Pasal 16E",
    "(1) Dapat diminta kembali.",
    "Pasal 16F",
    "Penanggung pajak.",
    "Pasal 31B dihapus.",
  ].join("\n");
  const items = amendmentItems(text).map((i) => [i.article, i.action, text.slice(i.start, i.end).split("\n")[1] || ""]);
  assert.deepEqual(items, [
    ["16B", "diubah", "(1) Pajak terutang tidak dipungut."],
    ["16D", "diubah", "Pajak Pertambahan Nilai dikenakan atas penyerahan aktiva."],
    ["16E", "disisipkan", "(1) Dapat diminta kembali."],
    ["16F", "disisipkan", "Penanggung pajak."],
    ["31B", "dihapus", ""],
  ]);
});

let engine = null;
const real = () => (engine ||= new SearchEngine(buildSearchPayload().payload));

test("on the corpus, every article of the five laws is found where it is written", () => {
  const e = real();
  const register = e.articleRegister();
  const where = (key, article) =>
    register.entries
      .filter((x) => e.laws.laws[x.law].key === key && x.article === article)
      .map((x) => `${e.docs[x.doc].id}:${x.action || "induk"}`)
      .sort();
  assert.deepEqual(where("PPN", "16D"), ["uu-11-1994:disisipkan", "uu-42-2009:diubah"]);
  assert.deepEqual(where("PPh", "31E"), ["uu-36-2008:disisipkan"]);
  assert.ok(where("PPh", "4").includes("uu-7-1983:induk"));
  assert.ok(where("PPh", "4").includes("uu-7-2021:diubah"), "omnibus HPP");
  assert.ok(where("KUP", "32A").includes("uu-7-2021:disisipkan"), "HPP inserts KUP 32A");
  assert.ok(where("PPh", "32A").includes("uu-7-2021:diubah"), "and amends PPh 32A");
  // No tax law here has a Pasal 14D.
  assert.equal(register.entries.filter((x) => x.article === "14D").length, 0);
  // Every place starts with the article's own heading, or is a deleting sentence or a partial change.
  for (const x of register.entries.filter((x) => x.kind === "pengubah" && x.start > 0)) {
    const text = e.texts[x.unit].slice(x.start, x.end);
    assert.ok(/^\s*["“]?Pasal\s/.test(text) || x.action === "dihapus" || /berbunyi/.test(x.instruction), `${e.units[x.unit].id} ${x.article}`);
  }
});

test("\"16D\" shows the documents citing Pasal 16D UU PPN first, the rest behind a button", () => {
  const e = real();
  const summary = e.search("16D");
  assert.equal(summary.article.label, "Pasal 16D");
  assert.ok(summary.article.exact >= 10 && summary.article.other >= 1, JSON.stringify(summary.article));
  const front = e.page(0, summary.article.exact);
  assert.ok(front.every((r) => r.citesArticle && r.citesArticle.includes("Pasal 16D UU PPN")));
  // PMK 127/2012 numbers its own BPHTB pasal 16A to 16G: only a partial match.
  const rest = e.page(summary.article.exact, summary.total);
  assert.ok(rest.some((r) => r.id === "pmk-127-2012"));
  assert.ok(!front.some((r) => r.id === "pmk-127-2012"));
  // The box: UU PPN only, the law the sources record as in force first, its own wording.
  const box = e.articleBox();
  assert.deepEqual(box.map((g) => g.label), ["Pasal 16D UU PPN"]);
  assert.deepEqual(box[0].places.map((p) => p.docId), ["uu-42-2009", "uu-11-1994"]);
  assert.match(box[0].places[0].parts[0].text, /^Pajak Pertambahan Nilai dikenakan atas penyerahan Barang Kena Pajak berupa aktiva/);
  assert.equal(box[0].places[0].parts[0].instruction, "Ketentuan Pasal 16D diubah sehingga berbunyi sebagai berikut:");
});

test("other words rank within the documents citing the article", () => {
  const e = real();
  const alone = e.search("16D");
  const withWord = e.search("16D aktiva");
  assert.equal(withWord.article.exact, alone.article.exact);
  assert.ok(withWord.total > alone.total);
  const front = e.page(0, withWord.article.exact);
  assert.ok(front.every((r) => r.citesArticle));
  assert.ok(front[0].matched.includes("aktiva"));
});

test("a reference no law has is said plainly, and the search runs as usual", () => {
  const e = real();
  const summary = e.search("14D");
  assert.equal(summary.article.found, false);
  assert.equal(summary.article.exact, 0);
  assert.equal(e.articleBox(), null);
});

test("a named law narrows the box; an unnamed one lists every law with the article", () => {
  const e = real();
  e.search("Pasal 32A UU PPh");
  assert.deepEqual(e.articleBox().map((g) => g.law), ["UU PPh"]);
  e.search("pasal 21");
  const laws = e.articleBox().map((g) => g.law);
  assert.ok(laws.length >= 3 && laws[0] === "UU PPh", laws.join(", "));
  // "PPh 23": documents writing "Pasal 23 Undang-Undang PPh" without "PPh Pasal 23" are added.
  const summary = e.search("PPh 23");
  const added = e.last.results.slice(0, summary.article.exact).filter((r) => r.citesOnly);
  assert.ok(added.length > 0);
});
