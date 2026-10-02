// The search box and filters on the list page. Runs in the browser.
//
// With an empty query the filters act on the full list that is already on the page. With a query
// the list is replaced by ranked results from the worker. The query and filters live in the URL
// (?q=...&jenis=...), so a search can be bookmarked or sent to a colleague.
import { statusLabel, typeLabel } from "../labels.js";

const PAGE = 30;

export function startSearch({ base }) {
  const form = document.getElementById("cari");
  const input = document.getElementById("q");
  const selects = {
    jenis: document.getElementById("jenis"),
    dari: document.getElementById("dari"),
    sampai: document.getElementById("sampai"),
    status: document.getElementById("status"),
  };
  const state = document.getElementById("keadaan");
  const all = document.getElementById("semua");
  const cards = Array.from(document.querySelectorAll("#daftar > li"));
  const results = document.getElementById("hasil");
  const summaryLine = document.getElementById("hasil-ringkas");
  const resultList = document.getElementById("hasil-daftar");
  const more = document.getElementById("lagi");

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
      if (!input.value.trim()) {
        state.textContent =
          `Siap: ${reply.info.documents.toLocaleString("id-ID")} dokumen dan ` +
          `${reply.info.units.toLocaleString("id-ID")} pasal dimuat dalam ` +
          `${((Date.now() - loadStarted) / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} detik. ` +
          "Mengetik tidak mengirim apa pun ke mana pun.";
      }
    },
    (error) => {
      state.textContent = `Pencarian tidak bisa dipakai: ${error.message}. Daftar dan saringan tetap berfungsi.`;
      throw error;
    }
  );

  function filters() {
    return {
      codes: selects.jenis.value ? [selects.jenis.value] : null,
      statuses: selects.status.value ? [selects.status.value] : null,
      from: Number(selects.dari.value) || null,
      to: Number(selects.sampai.value) || null,
    };
  }

  function writeUrl() {
    const params = new URLSearchParams();
    if (input.value.trim()) params.set("q", input.value.trim());
    for (const [name, select] of Object.entries(selects)) if (select.value) params.set(name, select.value);
    const query = params.toString();
    history.replaceState(null, "", query ? `?${query}` : location.pathname);
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    input.value = params.get("q") || "";
    for (const [name, select] of Object.entries(selects)) select.value = params.get(name) || "";
  }

  /** Empty query: show the full list, hiding cards the filters exclude. No worker needed. */
  function filterList() {
    const f = filters();
    let visible = 0;
    for (const card of cards) {
      const year = Number(card.dataset.tahun);
      const show =
        (!f.codes || f.codes.includes(card.dataset.code)) &&
        (!f.statuses || f.statuses.includes(card.dataset.statusValue)) &&
        (!f.from || year >= f.from) &&
        (!f.to || year <= f.to);
      card.hidden = !show;
      if (show) visible++;
    }
    results.hidden = true;
    all.hidden = false;
    const filtered = Object.values(f).some(Boolean);
    if (filtered) state.textContent = `${visible.toLocaleString("id-ID")} dokumen sesuai saringan.`;
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
    total = reply.summary.total;
    shown = 0;
    resultList.replaceChildren();
    describe(reply.summary, query);
    append(reply.results);
  }

  function describe(summary, query) {
    const parts = [`${summary.total.toLocaleString("id-ID")} dokumen untuk “${query}”`];
    if (summary.number) {
      const types = summary.number.codes ? summary.number.codes.map(typeLabel).join(" atau ") : "jenis apa pun";
      parts.push(`dibaca sebagai nomor ${summary.number.serial} tahun ${summary.number.year} (${types})`);
    }
    const terms = summary.concepts.filter((c) => c.forms);
    if (terms.length) {
      parts.push(`istilah dicari dalam semua bentuknya: ${terms.map((c) => c.forms.join(" = ")).join("; ")}`);
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

    const tags = el("p", "kartu-tanda");
    tags.append(el("span", `tanda status-${item.status}`, statusLabel(item.status, true)));
    tags.append(el("span", "tanda netral", item.year || "Tahun tidak terbaca"));
    tags.append(
      item.hasText ? el("span", "tanda netral", `${item.pasal} pasal`) : el("span", "tanda tanpa-teks", "Teks tidak tersedia di sumber")
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

  readUrl();
  if (input.value.trim() || Object.values(selects).some((s) => s.value)) run();
}
