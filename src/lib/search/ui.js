// The search box and filters on the list page. Runs in the browser.
//
// With an empty query the filters act on the full list that is already on the page. With a query
// the list is replaced by ranked results from the worker. The query and filters live in the URL
// fragment (#q=...&jenis=...), so a search can be bookmarked or sent to a colleague without the
// query ever reaching a server.
import { LOCAL_TAX_NOTE, plainReason, typeLabel } from "../labels.js";
import { statusChips } from "../render/chips.js";
import { kindLabel, UNVERIFIED } from "../collection/records.js";
import { addSearch, clearSearchHistory, searchHistory } from "../personal.js";

const PAGE = 30;

// `listing` is the regulation list, a page at a time (K-074); its filter sees every card, shown or not.
export function startSearch({ base, listing }) {
  const form = document.getElementById("cari");
  const input = document.getElementById("q");
  const selects = {
    jenis: document.getElementById("jenis"),
    kategori: document.getElementById("kategori"),
    dari: document.getElementById("dari"),
    sampai: document.getElementById("sampai"),
    status: document.getElementById("status"),
    sumber: document.getElementById("sumber"),
    koleksi: document.getElementById("jenis-koleksi"),
  };
  const state = document.getElementById("keadaan");
  const all = document.getElementById("semua");
  const results = document.getElementById("hasil");
  const summaryLine = document.getElementById("hasil-ringkas");
  const howBlock = document.getElementById("cara-cari");
  const howText = document.getElementById("cara-cari-isi");
  const resultList = document.getElementById("hasil-daftar");
  const groupBlock = document.getElementById("hasil-kategori");
  const groupList = document.getElementById("kategori-grup");
  const publicBlock = document.getElementById("hasil-publik");
  const localTaxNote = document.getElementById("catatan-daerah");
  const more = document.getElementById("lagi");
  const privateBlock = document.getElementById("hasil-pribadi");
  const privateSummaryLine = document.getElementById("hasil-pribadi-ringkas");
  const privateList = document.getElementById("hasil-pribadi-daftar");
  const privateMore = document.getElementById("lagi-pribadi");
  const definitionBlock = document.getElementById("definisi");
  const definitionList = document.getElementById("definisi-daftar");
  const definitionNote = document.getElementById("definisi-catatan");
  const historyBlock = document.getElementById("riwayat");
  const historyList = document.getElementById("riwayat-daftar");
  const articleBlock = document.getElementById("kotak-pasal");
  const articleTitle = document.getElementById("judul-pasal");
  const articleBody = document.getElementById("kotak-pasal-isi");
  const articleMissing = document.getElementById("pasal-tidak-ada");
  const moreOther = document.getElementById("lagi-lain");
  let privateShown = 0;
  let privateTotal = 0;
  let collectionSize = 0;

  const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  let nextId = 1;
  let current = 0;
  let shown = 0;
  let total = 0;
  // For an article reference (K-101), results stop after the documents citing it in so many words
  // until "Tampilkan juga hasil lain" is pressed.
  let limit = 0;
  let article = null;
  let loaded = false;
  const pending = new Map();

  function ask(message) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...message, id });
    }).then((reply) => ({ ...reply, id }));
  }
  worker.onmessage = (event) => {
    const waiting = pending.get(event.data.id);
    if (!waiting) return;
    pending.delete(event.data.id);
    if (event.data.type === "error") waiting.reject(new Error(event.data.message));
    else waiting.resolve(event.data);
  };

  const loadStarted = Date.now();
  const ready = ask({ type: "load", url: `${base}cari/data.json` }).then(
    (reply) => {
      loaded = true;
      // The first-open progress (public/keadaan.js) says searching already works.
      document.documentElement.dataset.cariSiap = "1";
      document.dispatchEvent(new Event("tax:cari-siap"));
      const seconds = ((Date.now() - loadStarted) / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 });
      // The personal collection is read from this device's IndexedDB, inside the worker.
      return ask({ type: "koleksi" }).then((collection) => {
        collectionSize = collection.count;
        if (!input.value.trim()) {
          state.textContent =
            `Siap: ${reply.info.documents.toLocaleString("id-ID")} dokumen dan ` +
            `${reply.info.units.toLocaleString("id-ID")} pasal dimuat dalam ${seconds} detik` +
            (collectionSize ? `, ditambah ${collectionSize} dokumen koleksi pribadi dari perangkat ini` : "") +
            ". Mengetik tidak mengirim apa pun ke mana pun.";
        }
      });
    },
    (error) => {
      state.textContent = `Pencarian tidak bisa dipakai: ${error.message}. Daftar dan saringan tetap berfungsi.`;
      throw error;
    }
  );

  function filters() {
    return {
      codes: selects.jenis.value ? [selects.jenis.value] : null,
      category: selects.kategori.value || null,
      statuses: selects.status.value ? [selects.status.value] : null,
      from: Number(selects.dari.value) || null,
      to: Number(selects.sampai.value) || null,
      source: selects.sumber.value || null,
      collectionKind: selects.koleksi.value || null,
    };
  }

  // The search lives in the fragment (#q=...), which browsers never send to the server: a reload
  // or a shared link does not put the query in any request or server log (K-028).
  function writeUrl() {
    const params = new URLSearchParams();
    if (input.value.trim()) params.set("q", input.value.trim());
    for (const [name, select] of Object.entries(selects)) if (select.value) params.set(name, select.value);
    const state = params.toString();
    history.replaceState(null, "", location.pathname + (state ? `#${state}` : ""));
  }

  function readUrl() {
    // Links from before K-028 carry the search in ?q=...; read them once, then move it to the
    // fragment so the next reload no longer sends it.
    const legacy = new URLSearchParams(location.search);
    const params = legacy.toString() ? legacy : new URLSearchParams(location.hash.slice(1));
    input.value = params.get("q") || "";
    for (const [name, select] of Object.entries(selects)) select.value = params.get(name) || "";
    if (legacy.toString()) writeUrl();
  }

  /** Empty query: show the full list, hiding cards the filters exclude. No worker needed. */
  function filterList() {
    const f = filters();
    const visible = listing.filter((card) => {
      const year = Number(card.dataset.tahun);
      return (
        f.source !== "pribadi" &&
        (!f.codes || f.codes.includes(card.dataset.code)) &&
        (!f.category || card.dataset.kategori.split(" ").includes(f.category)) &&
        (!f.statuses || f.statuses.includes(card.dataset.statusValue)) &&
        (!f.from || year >= f.from) &&
        (!f.to || year <= f.to)
      );
    });
    results.hidden = true;
    all.hidden = false;
    const filtered = Object.values(f).some(Boolean);
    if (f.source === "pribadi") {
      state.textContent =
        "Tanpa kata kunci, koleksi pribadi ditampilkan di halaman Koleksi pribadi. Ketik kata kunci untuk mencarinya di sini.";
    } else if (filtered) {
      state.textContent = `${visible.toLocaleString("id-ID")} dokumen sesuai saringan.`;
    }
  }

  async function run() {
    writeUrl();
    const query = input.value.trim();
    if (!query) {
      current = nextId; // drop any search still in flight
      filterList();
      showHistory();
      return;
    }
    all.hidden = true;
    results.hidden = false;
    historyBlock.hidden = true;
    if (!loaded) state.textContent = "Memuat data pencarian…";
    await ready;
    const reply = await ask({ type: "search", query, filters: filters(), limit: PAGE });
    if (reply.id < current) return;
    current = reply.id;
    total = reply.summary ? reply.summary.total : 0;
    article = reply.summary && reply.summary.article ? reply.summary.article : null;
    limit = article && article.exact ? article.exact : total;
    shown = 0;
    resultList.replaceChildren();
    privateList.replaceChildren();
    privateShown = 0;
    privateTotal = reply.privateSummary ? reply.privateSummary.total : 0;
    privateBlock.hidden = !reply.privateSummary;
    if (reply.privateSummary) {
      privateSummaryLine.textContent =
        `${privateTotal.toLocaleString("id-ID")} dokumen dari koleksi pribadi di perangkat ini. ` +
        "Semuanya belum terverifikasi dan tidak pernah dikirim ke mana pun.";
      appendPrivate(reply.privateResults);
    }
    showLocalTax(reply.summary ? reply.summary.localTax : []);
    showArticle(article, reply.articleBox || null);
    showDefinitions(reply.definitions);
    publicBlock.hidden = !reply.summary;
    showGroups(reply.groups || []);
    if (reply.summary) {
      describe(reply.summary, query);
      append(reply.results);
    } else {
      state.textContent = `Dicari di perangkat ini dalam ${reply.privateSummary ? reply.privateSummary.took : 0} md.`;
    }
  }

  /** "Teratas per kategori" (K-079): each card says where it stands in the combined results. */
  function showGroups(groups) {
    groupList.replaceChildren();
    groupBlock.hidden = !groups.length;
    for (const group of groups) {
      const section = el("section", "grup-kategori");
      const head = el("h3", null, group.category);
      if (group.named) head.append(el("span", "tanda netral", "disebut di kueri"));
      section.append(head);
      const list = el("ol", "daftar");
      for (const item of group.items) {
        // A compact card: the matching pasal are on the same card in the combined results. A note
        // on a document without text stays (invariant 3).
        const li = card(item);
        li.classList.add("kartu-ringkas");
        for (const node of li.querySelectorAll(".cocok-pasal, .hint")) node.remove();
        li.prepend(el("p", "kartu-urutan", `Urutan ${item.rank.toLocaleString("id-ID")} di hasil gabungan`));
        list.append(li);
      }
      section.append(list);
      groupList.append(section);
    }
  }

  function showLocalTax(notes) {
    localTaxNote.replaceChildren();
    localTaxNote.hidden = !notes || !notes.length;
    for (const note of notes || []) {
      const p = el("p");
      p.append(el("strong", null, "Pajak daerah. "), note.message);
      localTaxNote.append(p);
    }
  }

  function appendPrivate(items) {
    for (const item of items) privateList.append(privateCard(item));
    privateShown += items.length;
    privateMore.hidden = privateShown >= privateTotal;
    privateMore.textContent = `Tampilkan ${Math.min(PAGE, privateTotal - privateShown)} lagi dari koleksi pribadi`;
  }

  privateMore.addEventListener("click", async () => {
    const reply = await ask({ type: "more", which: "pribadi", offset: privateShown, limit: PAGE });
    appendPrivate(reply.results);
  });

  /** The article box (K-101): each place quoted as the source writes it, with its own status. */
  function showArticle(summary, groups) {
    articleBody.replaceChildren();
    articleMissing.replaceChildren();
    articleMissing.hidden = !summary || summary.found;
    if (summary && !summary.found) {
      articleMissing.append(
        el("strong", null, `${summary.label} tidak ada di undang-undang pajak yang dimuat situs ini. `),
        "Hasil di bawah adalah pencarian biasa atas yang Anda ketik."
      );
    }
    articleBlock.hidden = !groups || !groups.length;
    if (!groups || !groups.length) return;
    articleTitle.textContent = groups.length === 1 ? groups[0].label : `${summary.place} di ${groups.length} undang-undang pajak`;
    groups.forEach((group, index) => {
      // Several laws have this article: the one the results cite first is open, the rest folded.
      const holder = groups.length === 1 ? el("div") : el("details", "pasal-uu");
      if (groups.length > 1) {
        if (index === 0) holder.open = true;
        const summaryLine = el("summary", null, group.label);
        summaryLine.append(el("span", "hint", ` · disebut ${group.cited.toLocaleString("id-ID")} dokumen`));
        holder.append(summaryLine);
      }
      const list = el("ol", "pasal-tempat");
      group.places.forEach((place, k) => {
        const li = articlePlace(place);
        // The first three places show; the others wait behind one button.
        if (k >= 3) li.hidden = true;
        list.append(li);
      });
      holder.append(list);
      if (group.places.length > 3) {
        const rest = el("button", "tombol-teks", `Tampilkan ${group.places.length - 3} undang-undang lain yang memuat pasal ini`);
        rest.type = "button";
        rest.addEventListener("click", () => {
          for (const li of list.children) li.hidden = false;
          rest.remove();
        });
        holder.append(rest);
      }
      articleBody.append(holder);
    });
  }

  const KIND = { induk: "Undang-undang asal", pengubah: "Undang-undang pengubah" };
  const ACTION = { diubah: "Diubah", disisipkan: "Disisipkan", dihapus: "Dihapus" };
  const EXCERPT = 600;

  function articlePlace(place) {
    const li = el("li", "pasal-tempat-item");
    const head = el("p", "kartu-nomor");
    head.append(link(`${base}dokumen/${place.docId}/`, place.docLabel), el("span", "jenis", KIND[place.kind]));
    li.append(head, el("p", "kartu-judul", place.title));
    const status = el("p", "kartu-status");
    status.innerHTML = statusChips(place.claims);
    status.append(info("status", "Arti status menurut sumber"));
    li.append(status);
    if (place.status === "tidak_pasti") {
      li.append(el("p", "kartu-catatan konflik", `⚠ Perlu dicek: ${place.statusReasons.map(plainReason).join("; ")}.`));
    }
    for (const part of place.parts) {
      if (part.instruction) {
        const line = el("p", "pasal-perintah");
        if (part.action) line.append(el("span", "tanda netral", ACTION[part.action]), " ");
        line.append(part.instruction);
        li.append(line);
      }
      if (part.text) {
        const quote = el("blockquote", "pasal-bunyi");
        const long = part.text.length > EXCERPT;
        const cut = long ? part.text.lastIndexOf(" ", EXCERPT) : -1;
        quote.textContent = long ? `${part.text.slice(0, cut > EXCERPT / 2 ? cut : EXCERPT)} …` : part.text;
        li.append(quote);
        if (long) {
          const whole = el("button", "tombol-teks", "Tampilkan seluruh bunyi");
          whole.type = "button";
          whole.addEventListener("click", () => {
            quote.textContent = part.text;
            whole.remove();
          });
          li.append(whole);
        }
      }
    }
    // Inside a long "Pasal I", the text fragment scrolls to the item.
    const where = el("p", "definisi-sumber");
    const seen = new Set();
    for (const part of place.parts) {
      if (seen.has(part.unitId)) continue;
      if (seen.size) where.append(" · ");
      seen.add(part.unitId);
      where.append(link(fragmentHref(`${base}pasal/${part.unitId}/`, part.instruction || null), `Buka ${part.unitLabel}`));
    }
    if (place.explanationId) where.append(" · ", link(`${base}pasal/${place.explanationId}/`, "Penjelasan pasal ini"));
    li.append(where);
    return li;
  }

  function describe(summary, query) {
    const parts = [`${summary.total.toLocaleString("id-ID")} dokumen untuk “${query}”`];
    if (summary.article && summary.article.exact) {
      parts[0] = `${summary.article.exact.toLocaleString("id-ID")} dokumen menyebut ${citedLabel(summary.article)}`;
      if (summary.article.other) parts.push(`${summary.article.other.toLocaleString("id-ID")} hasil lain hanya cocok sebagian`);
    }
    if (summary.number) {
      const types = summary.number.codes ? summary.number.codes.map(typeLabel).join(" atau ") : "jenis apa pun";
      parts.push(`dibaca sebagai nomor ${summary.number.serial} tahun ${summary.number.year} (${types})`);
    }
    summaryLine.textContent = parts.join(" · ") + ".";
    // How the words were read: useful, but technical; folded under one line (K-083).
    const how = [];
    const terms = summary.concepts.filter((c) => c.forms && c.kind === "term");
    if (terms.length) {
      how.push(`Singkatan dan istilah dicari dalam semua bentuknya: ${terms.map((c) => c.forms.join(" = ")).join("; ")}.`);
    }
    const synonyms = summary.concepts.filter((c) => c.forms && c.kind === "padanan");
    if (synonyms.length) {
      const list = synonyms.map((c) => `${c.label} → ${c.forms.filter((f) => f.toLowerCase() !== c.label).join(", ")}`);
      how.push(`Kata sehari-hari juga dicari dengan istilah resminya, dengan bobot lebih rendah: ${list.join("; ")}.`);
    }
    if (summary.ignored.length) how.push(`Kata umum tidak dihitung: ${summary.ignored.join(", ")}.`);
    if (summary.article && summary.article.found) {
      how.push(
        `Dibaca sebagai rujukan pasal: ${summary.article.label}. Di atas hanya dokumen yang menulisnya lengkap dengan undang-undangnya, misalnya “${summary.article.place} Undang-Undang …”, ` +
          "atau yang memuat pasal itu sendiri. Dokumen yang hanya memuat angka atau huruf yang sama ada di balik tombol Tampilkan juga hasil lain. Kata lain di kueri menentukan urutan."
      );
    }
    howBlock.hidden = !how.length;
    howText.replaceChildren(...how.map((line) => el("p", null, line)));
    state.textContent = `Dicari di perangkat ini dalam ${summary.took} md.`;
    if (summary.total === 0) resultList.append(emptyState(query, summary));
  }

  /** Nothing found (K-096): what to try next, instead of an empty page. */
  function emptyState(query, summary) {
    const li = el("li", "kartu kosong");
    li.append(el("h2", null, `Tidak ada peraturan yang cocok untuk “${query}”`));
    const tips = el("ul");
    const filtered = Object.entries(filters()).some(([name, value]) => value && name !== "source");
    tips.append(
      el("li", null, "Periksa ejaannya. Pencarian mencocokkan kata dan awal kata, tetapi tidak menebak salah ketik."),
      el("li", null, "Coba kata lain atau singkatan resminya, misalnya PPh, PPN, PTKP, atau “faktur pajak”."),
      el("li", null, "Pakai lebih sedikit kata: kata yang tidak ada di peraturan mana pun membuat hasil kosong."),
      el("li", null, "Untuk nomor peraturan, tulis jenis dan nomornya, misalnya PMK 168/2023 atau PER-11/PJ/2025.")
    );
    if (filtered) {
      const item = el("li", null, "Saringan sedang aktif dan bisa menyembunyikan hasil. ");
      const clear = el("button", "tombol-teks", "Hapus semua saringan");
      clear.type = "button";
      clear.addEventListener("click", () => {
        for (const select of Object.values(selects)) select.value = "";
        run();
      });
      item.append(clear);
      tips.append(item);
    }
    if (summary.localTax && summary.localTax.length) {
      tips.append(
        el("li", null, "Pajak daerah (PBB rumah dan tanah, BPHTB, pajak kendaraan, dan lainnya) diatur peraturan daerah, yang tidak dimuat di sini; lihat keterangan di atas.")
      );
    }
    li.append(tips);
    const examples = el("p", "contoh");
    examples.append(el("span", "contoh-judul", "Contoh pencarian:"));
    for (const a of document.querySelectorAll(".cari .contoh a.contoh-q")) {
      const copy = a.cloneNode(true);
      copy.classList.remove("lebar-saja");
      examples.append(copy);
    }
    li.append(examples);
    return li;
  }

  /** The definition box (K-096): quoted as written, with the status each source gives. */
  function showDefinitions(definitions) {
    definitionList.replaceChildren();
    definitionBlock.hidden = !definitions;
    if (!definitions) return;
    for (const d of definitions.items) {
      const li = el("li", "definisi");
      li.append(el("blockquote", "definisi-kutipan", d.text));
      const source = el("p", "definisi-sumber");
      source.append(link(`${base}dokumen/${d.docId}/`, d.docLabel), " · ", link(`${base}pasal/${d.unitId}/`, d.place));
      li.append(source);
      const status = el("p", "kartu-status");
      status.innerHTML = statusChips(d.claims);
      status.append(info("status", "Arti status menurut sumber"));
      li.append(status);
      if (d.status === "tidak_pasti") {
        li.append(el("p", "kartu-catatan konflik", `⚠ Perlu dicek: ${d.statusReasons.map(plainReason).join("; ")}.`));
      }
      if (d.alsoIn) li.append(el("p", "hint", `Rumusan yang sama juga ada di ${d.alsoIn.toLocaleString("id-ID")} peraturan lain.`));
      definitionList.append(li);
    }
    definitionNote.textContent = definitions.disputedOnly
      ? "Tidak ada definisi dari peraturan yang dicatat berlaku oleh sumbernya; yang tampil berasal dari peraturan yang statusnya berbeda antar sumber. Periksa statusnya sebelum memakai. Urutan hasil di bawah tidak berubah."
      : "Dikutip apa adanya dari pasal definisi peraturan yang dicatat berlaku oleh sumbernya. Bunyi definisi bisa berbeda antar peraturan; rujuk peraturan yang mengatur kasus Anda. Urutan hasil di bawah tidak berubah.";
  }

  /** The last ten searches under the box (K-096), while the box is empty. */
  function showHistory() {
    const items = searchHistory();
    historyBlock.hidden = !items.length;
    historyList.replaceChildren(el("span", "contoh-judul", "Terakhir dicari:"));
    for (const q of items) {
      const a = link(`#q=${encodeURIComponent(q)}`, q);
      a.className = "contoh-q";
      historyList.append(a);
    }
  }

  document.getElementById("hapus-riwayat").addEventListener("click", () => {
    clearSearchHistory();
    showHistory();
    input.focus();
  });

  // A search counts for the history when it is sent (Enter, "Cari", an example or a history link)
  // or when one of its results is opened; not every half-typed word.
  const remember = () => input.value.trim() && addSearch(input.value);
  results.addEventListener("click", (event) => {
    if (event.target.closest("a[href]")) remember();
  });

  function citedLabel(summary) {
    return summary.laws ? summary.label : `${summary.place} lengkap dengan undang-undangnya`;
  }

  function append(items) {
    for (const item of items) resultList.append(card(item));
    shown += items.length;
    more.hidden = shown >= limit;
    more.textContent = `Tampilkan ${Math.min(PAGE, limit - shown)} lagi (${(limit - shown).toLocaleString("id-ID")} tersisa)`;
    moreOther.hidden = !(shown >= limit && limit < total);
    moreOther.textContent = `Tampilkan juga hasil lain (${(total - limit).toLocaleString("id-ID")})`;
  }

  more.addEventListener("click", async () => {
    const reply = await ask({ type: "more", offset: shown, limit: Math.min(PAGE, limit - shown) });
    append(reply.results);
  });

  // The documents that only share the number or letter (K-101), under their own heading.
  moreOther.addEventListener("click", async () => {
    moreOther.hidden = true;
    const asked = current;
    const reply = await ask({ type: "more", offset: shown, limit: PAGE });
    if (asked !== current) return;
    const divider = el("li", "hasil-lain-judul");
    divider.append(
      el("h2", null, "Hasil lain"),
      el("p", "hint", `Memuat ${article.place} atau “${article.place.replace(/^Pasal /, "")}” tanpa menyebut undang-undang yang dimaksud, atau hanya cocok sebagian dengan kata yang Anda ketik.`)
    );
    resultList.append(divider);
    limit = total;
    append(reply.results);
  });

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function info(anchor, label) {
    const a = link(`${base}cara-pakai/#${anchor}`, "ⓘ");
    a.className = "info";
    a.setAttribute("aria-label", label);
    return a;
  }

  function link(href, text) {
    const a = el("a", null, text);
    a.href = href;
    return a;
  }

  // Text fragments scroll the pasal page to the match in browsers that support them; others ignore it.
  function fragmentHref(href, text) {
    if (!text) return href;
    const encode = (s) => encodeURIComponent(s).replace(/-/g, "%2D");
    return `${href}#:~:text=${encode(text.slice(0, 80))}`;
  }

  function card(item) {
    const li = el("li", "kartu");

    const head = el("p", "kartu-nomor");
    head.append(link(`${base}dokumen/${item.id}/`, item.label), el("span", "jenis", typeLabel(item.code)));
    li.append(head, el("p", "kartu-judul", item.title));

    // Status per source, as on the list cards (K-083); never one status for the document.
    const status = el("p", "kartu-status");
    status.innerHTML = statusChips(item.claims);
    status.append(info("status", "Arti status menurut sumber"));
    li.append(status);
    if (item.status === "tidak_pasti") {
      li.append(el("p", "kartu-catatan konflik", `⚠ Perlu dicek: ${item.statusReasons.map(plainReason).join("; ")}.`));
    }

    const meta = el("p", "kartu-meta", [item.year || "Tahun tidak terbaca", item.hasText ? `${item.pasal} pasal` : null, item.categoryNote || null].filter(Boolean).join(" · "));
    if (!item.hasText) meta.append(" ", el("span", "tanda tanpa-teks", "Tanpa teks di situs ini"));
    if (item.reasons.includes("nomor")) meta.append(" ", el("span", "tanda alasan", "Cocok nomor"));
    if (item.reasons.includes("menyebut")) meta.append(" ", el("span", "tanda netral", "Menyebut nomor ini"));
    if (item.reasons.includes("judul")) meta.append(" ", el("span", "tanda netral", "Cocok di judul"));
    for (const cited of item.citesArticle || []) meta.append(" ", el("span", "tanda alasan", `Menyebut ${cited}`));
    li.append(meta);

    if (item.conceptCount > 1 && item.missing.length) {
      li.append(el("p", "hint", `Cocok: ${item.matched.join(", ")} · tidak ditemukan: ${item.missing.join(", ")}`));
    }

    if (item.units.length) {
      const list = el("ul", "cocok-pasal");
      for (const unit of item.units) {
        const row = el("li");
        row.append(link(fragmentHref(`${base}pasal/${unit.id}/`, unit.fragment), unit.label), document.createTextNode(" "));
        const quote = el("span", "cuplikan");
        if (unit.before) quote.append("…");
        for (const segment of unit.segments) quote.append(segment.mark ? el("mark", null, segment.text) : segment.text);
        if (unit.after) quote.append("…");
        row.append(quote);
        list.append(row);
      }
      li.append(list);
      if (item.unitCount > item.units.length) {
        const rest = el("p", "hint");
        rest.append(
          `dan ${item.unitCount - item.units.length} pasal lain cocok · `,
          link(`${base}dokumen/${item.id}/`, "lihat dokumen")
        );
        li.append(rest);
      }
    }

    if (item.localTaxNote) li.append(el("p", "kartu-catatan daerah", LOCAL_TAX_NOTE[item.localTaxNote]));

    if (!item.hasText) {
      const note = el("p", "kartu-catatan", `${item.noTextReason}. Dokumen ini ditemukan lewat judul atau nomornya. Buka di sumbernya: `);
      item.sources.forEach((source, i) => {
        if (i) note.append(" · ");
        note.append(link(source.url, source.source));
      });
      li.append(note);
    }

    if (item.twins.length) {
      const note = el("p", "kartu-catatan konflik", "Dicatat juga oleh sumber lain dengan jenis berbeda: ");
      item.twins.forEach((twin, i) => {
        if (i) note.append(", ");
        note.append(link(`${base}dokumen/${twin.id}/`, twin.label));
      });
      li.append(note);
    }
    return li;
  }

  // A document from the personal collection looks different from a public regulation, and always
  // says it is unverified. It links to its own page by fragment, so its id stays on the device.
  function privateCard(item) {
    const li = el("li", "kartu pribadi");
    const head = el("p", "kartu-nomor");
    head.append(link(`${base}koleksi/#dok=${item.id}`, item.label), el("span", "jenis", kindLabel(item.kind)));
    li.append(head);
    const tags = el("p", "kartu-tanda");
    tags.append(el("span", "tanda pribadi", "Koleksi pribadi"), el("span", "tanda belum-verifikasi", UNVERIFIED), info("koleksi", "Arti belum terverifikasi"));
    if (!item.hasText) tags.append(el("span", "tanda tanpa-teks", "Isi tidak tercari"));
    li.append(tags);
    if (item.conceptCount > 1 && item.missing.length) {
      li.append(el("p", "hint", `Cocok: ${item.matched.join(", ")} · tidak ditemukan: ${item.missing.join(", ")}`));
    }
    if (item.units.length) {
      const quote = el("p", "cuplikan");
      const unit = item.units[0];
      if (unit.before) quote.append("…");
      for (const segment of unit.segments) quote.append(segment.mark ? el("mark", null, segment.text) : segment.text);
      if (unit.after) quote.append("…");
      li.append(quote);
    } else {
      li.append(
        el("p", "kartu-catatan", "PDF tanpa lapisan teks: hanya jenis, nomor, tanggal, perihal, dan catatan yang Anda isi yang tercari.")
      );
    }
    return li;
  }

  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  });
  for (const select of Object.values(selects)) select.addEventListener("change", run);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearTimeout(timer);
    remember();
    run();
  });

  // A #q= link opened while the page is already showing (replaceState does not fire this).
  window.addEventListener("hashchange", () => {
    readUrl();
    remember();
    run();
  });

  readUrl();
  if (input.value.trim() || Object.values(selects).some((s) => s.value)) run();
  else showHistory();
}
