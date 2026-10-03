// The personal collection page: import, storage, list, document view, backup and restore.
// Runs in the browser. Nothing on this page sends a document, a document's text, or a document
// id anywhere (SPEC invariant 7): records go to IndexedDB, backups go to a file the user saves,
// and the document view is addressed by the URL fragment, which browsers never send.
import { decodeTextFile, extractPdf, extractPlain } from "./extract.js";
import { kindLabel, makeRecord, newId, UNVERIFIED } from "./records.js";
import { backupFileName, exportBackup, mergeRecords, parseBackup } from "./backup.js";
import {
  allRecords,
  clearRecords,
  deleteRecord,
  getRecord,
  putRecord,
  replaceRecords,
  requestPersistence,
  storageInfo,
} from "./store.js";

const $ = (id) => document.getElementById(id);

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

function size(bytes) {
  if (bytes == null) return "tidak diketahui";
  if (bytes < 1024) return `${bytes} byte`;
  if (bytes < 1048576) return `${(bytes / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1048576).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
}

export function startCollection({ base }) {
  // The search worker gives the public document list, to match references in imported text.
  const worker = new Worker(new URL("../search/worker.js", import.meta.url), { type: "module" });
  let nextId = 1;
  const pending = new Map();
  const ask = (message) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...message, id });
    });
  worker.onmessage = (event) => {
    const waiting = pending.get(event.data.id);
    if (!waiting) return;
    pending.delete(event.data.id);
    if (event.data.type === "error") waiting.reject(new Error(event.data.message));
    else waiting.resolve(event.data);
  };
  const ready = ask({ type: "load", url: `${base}cari/data.json` });

  // ---------- storage ----------
  async function showStorage(requested = null) {
    const info = await storageInfo();
    if (!info.supported) {
      $("info-simpan").textContent = "Browser ini tidak memberi keterangan penyimpanan.";
      return;
    }
    const persisted = info.persisted
      ? "permanen: browser tidak akan menghapusnya sendiri saat ruang penyimpanan menipis"
      : "belum permanen: browser bisa menghapusnya saat ruang penyimpanan menipis";
    const asked = requested === null ? "" : requested ? " Permintaan penyimpanan permanen dikabulkan." : " Permintaan penyimpanan permanen ditolak browser.";
    $("info-simpan").textContent =
      `Penyimpanan ${persisted}. Terpakai ${size(info.usage)} dari kuota ${size(info.quota)} untuk situs ini.${asked}`;
    $("minta-permanen").hidden = Boolean(info.persisted);
  }
  $("minta-permanen").addEventListener("click", async () => showStorage(await requestPersistence()));

  // ---------- import ----------
  let incoming = null; // { source, file, extracted }

  function startForm(source, file, extracted) {
    incoming = { source, file, extracted };
    $("hasil-baca").hidden = false;
    $("peringatan-pindai").hidden = extracted.hasTextLayer;
    $("pesan-impor").textContent = "";
    const what = file ? `"${file.name}" (${size(file.bytes.byteLength)})` : "Teks tempel";
    $("ringkas-baca").textContent = extracted.hasTextLayer
      ? `${what}: ${extracted.text.length.toLocaleString("id-ID")} karakter teks terbaca` +
        (extracted.pages ? ` dari ${extracted.pages} halaman.` : ".") +
        " Isinya akan ikut tercari."
      : `${what}: tidak ada teks yang bisa dibaca.`;
  }

  $("berkas").addEventListener("change", async () => {
    const chosen = $("berkas").files[0];
    if (!chosen) return;
    const bytes = await chosen.arrayBuffer();
    const isPdf = chosen.type === "application/pdf" || /\.pdf$/i.test(chosen.name);
    $("ringkas-baca").textContent = "Membaca berkas…";
    $("hasil-baca").hidden = false;
    try {
      let extracted;
      if (isPdf) {
        const { pdfjs, pdfWorker } = await import("./pdf-browser.js");
        extracted = await extractPdf(bytes, pdfjs, { worker: pdfWorker() });
      } else {
        extracted = extractPlain(decodeTextFile(bytes));
      }
      startForm(isPdf ? "pdf" : "txt", { name: chosen.name, type: chosen.type || (isPdf ? "application/pdf" : "text/plain"), bytes }, extracted);
    } catch (error) {
      $("ringkas-baca").textContent = `Berkas tidak bisa dibaca: ${error.message}`;
      incoming = null;
    }
  });

  $("baca").addEventListener("click", () => {
    const extracted = extractPlain($("tempel").value);
    if (!extracted.hasTextLayer) {
      $("hasil-baca").hidden = false;
      $("ringkas-baca").textContent = "Kotak teks masih kosong.";
      incoming = null;
      return;
    }
    $("berkas").value = "";
    startForm("tempel", null, extracted);
  });

  $("simpan").addEventListener("click", async () => {
    if (!incoming) return;
    const meta = {
      kind: $("isi-jenis").value,
      number: $("isi-nomor").value,
      date: $("isi-tanggal").value,
      subject: $("isi-perihal").value,
      note: $("isi-catatan").value,
    };
    if (!incoming.extracted.hasTextLayer && !meta.number.trim() && !meta.subject.trim()) {
      $("pesan-impor").textContent = "Dokumen tanpa teks hanya bisa ditemukan lewat isian ini: isi nomor atau perihal.";
      return;
    }
    $("pesan-impor").textContent = "Menyimpan…";
    await ready;
    const { references } = incoming.extracted.hasTextLayer
      ? await ask({ type: "rujukan", text: incoming.extracted.text, own: meta.number })
      : { references: [] };
    const record = await makeRecord({
      id: newId(),
      meta,
      source: incoming.source,
      file: incoming.file,
      extracted: incoming.extracted,
      references,
      importedAt: new Date().toISOString(),
    });
    await putRecord(record);
    const first = (await allRecords()).length === 1;
    incoming = null;
    for (const id of ["berkas", "tempel", "isi-nomor", "isi-tanggal", "isi-perihal", "isi-catatan"]) $(id).value = "";
    $("hasil-baca").hidden = true;
    await refreshList();
    // Ask to keep the data the first time something worth keeping is stored.
    await showStorage(first ? await requestPersistence() : null);
    $("pesan-impor").textContent = "";
  });

  // ---------- list ----------
  function card(record) {
    const li = el("li", "kartu pribadi");
    const head = el("p", "kartu-nomor");
    head.append(link(`#dok=${record.id}`, [kindLabel(record.kind), record.number].filter(Boolean).join(" ") || "Tanpa nomor"));
    li.append(head);
    if (record.subject) li.append(el("p", "kartu-judul", record.subject));
    const tags = el("p", "kartu-tanda");
    tags.append(el("span", "tanda pribadi", "Koleksi pribadi"), el("span", "tanda belum-verifikasi", UNVERIFIED));
    if (!record.hasText) tags.append(el("span", "tanda tanpa-teks", "Isi tidak tercari"));
    if (record.date) tags.append(el("span", "tanda netral", record.date));
    li.append(tags);
    return li;
  }

  async function refreshList() {
    const records = (await allRecords()).sort((a, b) => (a.importedAt < b.importedAt ? 1 : -1));
    $("daftar-koleksi").replaceChildren(...records.map(card));
    $("kosong").hidden = records.length > 0;
    return records;
  }

  // ---------- document view (#dok=<id>) ----------
  let openUrl = null;

  async function showDocument(id) {
    const view = $("tampilan-dokumen");
    const record = await getRecord(id);
    view.replaceChildren();
    if (openUrl) URL.revokeObjectURL(openUrl);
    openUrl = null;
    if (!record) {
      view.append(el("p", "peringatan-blok", "Dokumen ini tidak ada di koleksi perangkat ini."), link("#", "Kembali ke koleksi"));
      return;
    }
    view.append(link("#", "Kembali ke koleksi"));
    view.append(el("h2", null, [kindLabel(record.kind), record.number].filter(Boolean).join(" ") || "Tanpa nomor"));
    if (record.subject) view.append(el("p", "judul-dokumen", record.subject));
    const tags = el("p", "kartu-tanda");
    tags.append(el("span", "tanda pribadi", "Koleksi pribadi"), el("span", "tanda belum-verifikasi", UNVERIFIED));
    if (!record.hasText) tags.append(el("span", "tanda tanpa-teks", "Isi tidak tercari"));
    view.append(tags);
    view.append(
      el(
        "p",
        "hint",
        "Belum terverifikasi: dokumen ini diimpor dari perangkat Anda. Situs ini tidak memeriksa keasliannya, keberlakuannya, maupun kebenaran isian di bawah."
      )
    );

    const facts = el("ul", "klaim");
    const fact = (label, value) => {
      if (!value) return;
      const li = el("li");
      li.append(el("span", "klaim-sumber", label), el("span", null, value));
      facts.append(li);
    };
    fact("Jenis", kindLabel(record.kind));
    fact("Nomor", record.number);
    fact("Tanggal", record.date);
    fact("Catatan", record.note);
    fact("Diimpor", new Date(record.importedAt).toLocaleString("id-ID"));
    if (record.file) fact("Berkas", `${record.file.name} · ${size(record.file.size)} · SHA-256 ${record.file.sha256.slice(0, 16)}…`);
    view.append(facts);

    if (record.file) {
      openUrl = URL.createObjectURL(new Blob([record.file.bytes], { type: record.file.type || "application/octet-stream" }));
      const open = link(openUrl, record.source === "pdf" ? "Buka PDF asli" : "Buka berkas asli");
      open.target = "_blank";
      open.rel = "noopener";
      const line = el("p");
      line.append(open);
      view.append(line);
    }

    view.append(el("h3", null, "Rujukan ke peraturan publik"));
    if (!record.hasText) {
      view.append(el("p", "hint", "Dokumen tanpa teks: rujukannya tidak bisa dibaca otomatis."));
    } else if (!record.references.length) {
      view.append(el("p", "hint", "Tidak ada nomor peraturan yang terbaca di teks dokumen ini."));
    } else {
      view.append(
        el(
          "div",
          "notice",
          "Ini petunjuk, bukan kepastian. Nomor dibaca otomatis dari teks dokumen dan dicocokkan dengan peraturan di situs ini; kalimat sumbernya disertakan supaya bisa dinilai sendiri."
        )
      );
      const list = el("ul", "relasi");
      for (const ref of record.references) {
        const li = el("li");
        const target = el("p", "relasi-sasaran");
        if (ref.matches.length) {
          ref.matches.forEach((m, i) => {
            if (i) target.append(", ");
            target.append(link(`${base}dokumen/${m.id}/`, m.label));
          });
          target.append(el("span", "hint", ` — ditulis "${ref.written}"`));
        } else {
          target.append(el("span", null, ref.written), el("span", "hint", " — tidak ada di korpus PPh situs ini"));
        }
        li.append(target, el("blockquote", null, `“${ref.sentence}”`));
        list.append(li);
      }
      view.append(list);
    }

    view.append(el("h3", null, "Isi dokumen"));
    if (record.hasText) {
      view.append(el("div", "teks-pasal", record.text));
    } else {
      view.append(
        el(
          "p",
          "peringatan-blok",
          "PDF ini tidak punya lapisan teks, jadi isinya tidak tercari dan tidak ditampilkan sebagai teks. Buka PDF aslinya untuk membacanya."
        )
      );
    }

    const remove = el("button", "tombol-bahaya", "Hapus dokumen ini dari perangkat");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      if (!confirm("Hapus dokumen ini dari koleksi di perangkat ini? Tindakan ini tidak bisa dibatalkan.")) return;
      await deleteRecord(record.id);
      location.hash = "";
    });
    view.append(remove);
  }

  async function route() {
    const params = new URLSearchParams(location.hash.slice(1));
    const id = params.get("dok");
    $("tampilan-dokumen").hidden = !id;
    $("halaman-koleksi").hidden = Boolean(id);
    if (id) await showDocument(id);
    else await refreshList();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  // ---------- backup ----------
  $("ekspor").addEventListener("click", async () => {
    const records = await allRecords();
    if (!records.length) {
      $("pesan-cadangan").textContent = "Koleksi masih kosong; tidak ada yang dicadangkan.";
      return;
    }
    const bytes = exportBackup(records);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/json" }));
    const a = link(url, "");
    a.download = backupFileName();
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("pesan-cadangan").textContent = `Cadangan berisi ${records.length} dokumen (${size(bytes.byteLength)}) dibuat di perangkat ini.`;
  });

  let restoring = null;
  $("pulihkan").addEventListener("change", async () => {
    const chosen = $("pulihkan").files[0];
    if (!chosen) return;
    try {
      restoring = await parseBackup(await chosen.arrayBuffer());
      const current = await allRecords();
      $("ringkas-pulih").textContent =
        `Cadangan berisi ${restoring.length} dokumen; koleksi sekarang berisi ${current.length}. ` +
        "Gabungkan (dokumen yang sudah ada dibiarkan) atau ganti seluruh koleksi dengan isi cadangan?";
      $("pilihan-pulih").hidden = false;
      $("pesan-cadangan").textContent = "";
    } catch (error) {
      restoring = null;
      $("pilihan-pulih").hidden = true;
      $("pesan-cadangan").textContent = `Cadangan tidak dipulihkan: ${error.message}.`;
    }
  });

  async function restore(mode) {
    if (!restoring) return;
    const result = mergeRecords(await allRecords(), restoring, mode);
    await replaceRecords(result.records);
    $("pesan-cadangan").textContent =
      mode === "ganti"
        ? `Koleksi diganti dengan ${result.added} dokumen dari cadangan.`
        : `${result.added} dokumen ditambahkan; ${result.skipped} sudah ada dan dibiarkan.`;
    restoring = null;
    $("pilihan-pulih").hidden = true;
    $("pulihkan").value = "";
    await refreshList();
    await showStorage();
  }
  $("pulih-gabung").addEventListener("click", () => restore("gabung"));
  $("pulih-ganti").addEventListener("click", () => restore("ganti"));

  $("hapus-semua").addEventListener("click", async () => {
    if (!confirm("Hapus seluruh koleksi dari perangkat ini? Ekspor cadangan dulu bila masih diperlukan.")) return;
    await clearRecords();
    await refreshList();
    await showStorage();
    $("pesan-cadangan").textContent = "Seluruh koleksi dihapus dari perangkat ini.";
  });

  showStorage();
  route();
}
