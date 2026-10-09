// Offline pages (K-082). The build itself checks that every page rendered from the offline data is
// byte-identical to the published one; these tests cover the pieces that check relies on.
import assert from "node:assert/strict";
import test from "node:test";
import { listPasalIds, loadIndex } from "../../src/lib/corpus.js";
import { esc, fillShell, SHELL_BODY, SHELL_DESCRIPTION, SHELL_TITLE } from "../../src/lib/render/html.js";
import { renderDocumentPage } from "../../src/lib/render/pages.js";
import { documentOfPasal, shardOf, SHARDS } from "../../src/lib/render/shards.js";
import { documentView, unitView } from "../../src/lib/render/views.js";

test("every pasal id names its document, so the service worker finds the right data file", () => {
  const ids = new Set(loadIndex().map((entry) => entry.id));
  for (const id of ids) assert.ok(!id.includes("--"), id);
  for (const pasal of listPasalIds()) assert.ok(ids.has(documentOfPasal(pasal)), pasal);
});

test("data files are chosen from the id alone and spread over all files", () => {
  const counts = new Array(SHARDS).fill(0);
  for (const entry of loadIndex()) {
    const n = shardOf(entry.id);
    assert.equal(n, shardOf(entry.id));
    counts[n] += 1;
  }
  assert.ok(Math.min(...counts) > 0, "every data file holds documents");
  assert.ok(Math.max(...counts) < 3 * (loadIndex().length / SHARDS), "no data file holds far more than its share");
});

test("the shell is filled the way the layout escapes title and description", () => {
  const shell = `<title>${SHELL_TITLE}</title><meta name="description" content="${SHELL_DESCRIPTION}">${SHELL_BODY}`;
  const page = fillShell(shell, { title: `A & B <C> "D" 'E' $&`, description: `x & "y" <z>`, body: "<p>isi $1</p>" });
  assert.equal(
    page,
    `<title>A &amp; B &lt;C&gt; &quot;D&quot; &#39;E&#39; $&amp;</title><meta name="description" content="x &#38; &#34;y&#34; <z>"><p>isi $1</p>`
  );
});

test("text from the sources is escaped in the page", () => {
  assert.equal(esc(`<script>"'&`), "&lt;script&gt;&quot;&#39;&amp;");
  const id = loadIndex().find((entry) => entry.text_available).id;
  const doc = { ...documentView(id), title: "<img src=x onerror=alert(1)>" };
  const { body } = renderDocumentPage(doc, doc.pasal_ids.map(unitView), "/tax/");
  assert.ok(!body.includes("<img"));
  assert.ok(body.includes("&lt;img src=x onerror=alert(1)&gt;"));
});

test("the document page keeps what the invariants require", () => {
  const index = loadIndex();
  const withClaims = index.map((e) => documentView(e.id)).find((d) => d.status_claims.length > 1 && d.relations.revokes.some((r) => r.quote));
  const { body } = renderDocumentPage(withClaims, withClaims.pasal_ids.map(unitView), "/tax/");
  for (const claim of withClaims.status_claims) assert.ok(body.includes(esc(claim.url)), "status claim links its source");
  assert.ok(/diambil \d+ \w+ \d{4}/.test(body), "claims carry their retrieval date");
  assert.ok(body.includes("<blockquote>"), "relations carry their quote");
  const bare = documentView(index.find((e) => !e.text_available).id);
  assert.ok(renderDocumentPage(bare, [], "/tax/").body.includes("Yang bisa ditampilkan hanya metadata"), "a document without text says so");
});
