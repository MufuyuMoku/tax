// The search box and filters on the list page. Runs in the browser.
//
// With an empty query the filters act on the full list that is already on the page. With a query
// the list is replaced by ranked results from the worker. The query and filters live in the URL
// fragment (#q=...&jenis=...), so a search can be bookmarked or sent to a colleague without the
// query ever reaching a server.
import { statusLabel, typeLabel } from "../labels.js";
import { kindLabel, UNVERIFIED } from "../collection/records.js";

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
  let privateShown = 0;
  let privateTotal = 0;
  let collectionSize = 0;

  const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  let nextId = 1;
  let current = 0;
  let shown = 0;
  let total = 0;
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
      return;
    }
    all.hidden = true;
    results.hidden = false;
    if (!loaded) state.textContent = "Memuat data pencarian…";
    await ready;
    const reply = await ask({ type: "search", query, filters: filters(), limit: PAGE });
    if (reply.id < current) return;
    current = reply.id;
    total = reply.summary ? reply.summary.total : 0;
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

  function describe(summary, query) {
    const parts = [`${summary.total.toLocaleString("id-ID")} dokumen untuk “${query}”`];
    if (summary.number) {
      const types = summary.number.codes ? summary.number.codes.map(typeLabel).join(" atau ") : "jenis apa pun";
      parts.push(`dibaca sebagai nomor ${summary.number.serial} tahun ${summary.number.year} (${types})`);
    }
    const terms = summary.concepts.filter((c) => c.forms && c.kind === "term");
    if (terms.length) {
      parts.push(`istilah dicari dalam semua bentuknya: ${terms.map((c) => c.forms.join(" = ")).join("; ")}`);
    }
    const synonyms = summary.concepts.filter((c) => c.forms && c.kind === "padanan");
    if (synonyms.length) {
      const list = synonyms.map((c) => `${c.label} → ${c.forms.filter((f) => f.toLowerCase() !== c.label).join(", ")}`);
      parts.push(`juga dicari padanannya, dengan bobot lebih rendah: ${list.join("; ")}`);
    }
    if (summary.ignored.length) parts.push(`kata umum diabaikan: ${summary.ignored.join(", ")}`);
    summaryLine.textContent = parts.join(" · ") + ".";
    state.textContent = `Dicari di perangkat ini dalam ${summary.took} md.`;
    if (summary.total === 0) {
      const empty = document.createElement("li");
      empty.className = "kartu";
      empty.textContent =
        "Tidak ada dokumen yang cocok. Coba kata lain, singkatan resmi (misalnya PPh, PTKP), atau longgarkan saringan.";
      resultList.append(empty);
    }
  }

  function append(items) {
    for (const item of items) resultList.append(card(item));
    shown += items.length;
    more.hidden = shown >= total;
    more.textContent = `Tampilkan ${Math.min(PAGE, total - shown)} lagi (${(total - shown).toLocaleString("id-ID")} tersisa)`;
  }

  more.addEventListener("click", async () => {
    const reply = await ask({ type: "more", offset: shown, limit: PAGE });
    append(reply.results);
  });

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
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
    if (item.categoryNote) li.append(el("p", "kartu-asal", item.categoryNote));

    const tags = el("p", "kartu-tanda");
    tags.append(el("span", `tanda status-${item.status}`, statusLabel(item.status, true)));
    tags.append(el("span", "tanda netral", item.year || "Tahun tidak terbaca"));
    tags.append(
      item.hasText ? el("span", "tanda netral", `${item.pasal} pasal`) : el("span", "tanda tanpa-teks", "Tanpa teks di situs ini")
    );
    if (item.reasons.includes("nomor")) tags.append(el("span", "tanda alasan", "Cocok nomor"));
    if (item.reasons.includes("menyebut")) tags.append(el("span", "tanda netral", "Menyebut nomor ini"));
    if (item.reasons.includes("judul")) tags.append(el("span", "tanda netral", "Cocok di judul"));
    li.append(tags);

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
    tags.append(el("span", "tanda pribadi", "Koleksi pribadi"), el("span", "tanda belum-verifikasi", UNVERIFIED));
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
    run();
  });

  // A #q= link opened while the page is already showing (replaceState does not fire this).
  window.addEventListener("hashchange", () => {
    readUrl();
    run();
  });

  readUrl();
  if (input.value.trim() || Object.values(selects).some((s) => s.value)) run();
}
