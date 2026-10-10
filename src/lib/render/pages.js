// The document page and the pasal page, as HTML strings (K-082). Used by the Astro pages at build
// time and by the service worker when the phone is offline, so both routes show the same thing,
// including everything the invariants require: each source's status claim with its date, source
// URLs, relations with their quotes, the note for documents without text, the category labels.
//
// Input is a document "view" (src/lib/render/views.js): the corpus document plus the few facts
// that need other documents (which relation targets exist, which twin has text), and its units.
import { categoryNote, flagNote, formatDate, plainReason, regulationLabel, STRUCTURE_NOTE, typeLabel, yearLabel } from "../labels.js";
import { APP_NAME } from "../brand.js";
import { compactClaims, statusChips } from "./chips.js";
import { esc, h, thousands } from "./html.js";

const RELATIONS = [
  ["revokes", "Mencabut"],
  ["amends", "Mengubah"],
  ["revoked_by", "Dicabut oleh"],
  ["amended_by", "Diubah oleh"],
];

const fileType = (url) => (url.split(".").pop() || "").toUpperCase();
const link = (href, text) => `<a href="${esc(href)}" rel="noopener">${text}</a>`;
const flagList = (flags) =>
  `<ul>${flags
    .map((flag) => {
      const info = flagNote(flag);
      return `<li>${esc(info.note)}${info.detail ? esc(` (${info.detail})`) : ""}</li>`;
    })
    .join("")}</ul>`;

const fact = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
const info = (base, anchor, label) => `<a class="info" href="${base}cara-pakai/#${anchor}" aria-label="${label}">ⓘ</a>`;

/** The pipeline's note on how many sources were compared, in plain words. */
function plainNote(note) {
  if (note === "disepakati JDIH & DJP") return "DJP dan JDIH mencatat hal yang sama.";
  const single = note.match(/^klaim (\w+) saja; belum dibandingkan dengan sumber lain$/);
  if (single) return `Hanya ${single[1]} yang mencatat statusnya; belum ada sumber lain untuk dibandingkan.`;
  return note;
}

export function documentNumber(doc) {
  const numberAsWritten = doc.source_records.find((r) => r.number_as_written)?.number_as_written;
  return regulationLabel(doc.identity, numberAsWritten);
}

/** { title, description, body } for /dokumen/<id>/. `units` are the document's units in order. */
export function renderDocumentPage(doc, units, base) {
  const numberAsWritten = doc.source_records.find((r) => r.number_as_written)?.number_as_written;
  const number = documentNumber(doc);
  const body = units.filter((u) => u.section === "batang_tubuh");
  const explanation = units.filter((u) => u.section === "penjelasan");
  const known = new Set(doc.known_targets);
  const relations = RELATIONS.map(([kind, label]) => ({ kind, label, items: doc.relations[kind] })).filter(
    (group) => group.items.length > 0
  );
  // Files fetched from JDIH whose text is not shown: linked unless JDIH answered 404 for them.
  const openableFiles = (doc.original_files || []).filter((file) => !file.missing);
  const heldBack = (doc.original_files || []).some((file) => /belum dimasukkan/.test(file.reason));
  // One source: say whose claim it is and when it was taken, nothing about the other source.
  const singleSource = new Set(doc.status_claims.map((c) => c.source)).size === 1;
  const statusNote = doc.status.note
    ? doc.status.note +
      (singleSource ? `, diambil ${formatDate(doc.status_claims.map((c) => c.retrieved_at).sort().at(-1))}` : "")
    : "";
  const categories = doc.categories || [];
  const mismatched = doc.attachments.filter((a) => a.match === "tidak_cocok").length;

  const html = h(
    `<p class="breadcrumb"><a href="${base}">← Daftar peraturan</a></p>`,
    `<h1>${esc(number)}</h1>`,
    `<p class="judul-dokumen">${esc(doc.title)}</p>`,
    // Summary first (K-083): kind, number, year, status per source, category, text.
    `<dl class="ringkasan">`,
    fact("Jenis", esc(typeLabel(doc.identity.code)) + (doc.identity.variant ? ` (${esc(doc.identity.variant)})` : "")),
    fact("Nomor", esc(numberAsWritten || number)),
    fact("Tahun", esc(yearLabel(doc.identity.year))),
    fact(
      `Status menurut sumber ${info(base, "status", "Arti status menurut sumber")}`,
      `<span class="chips">${statusChips(compactClaims(doc.status_claims), { dated: true })}</span>` +
        (doc.status.note ? `<span class="hint">${esc(plainNote(doc.status.note))}</span>` : "")
    ),
    categories.length > 0 && fact(`Kategori ${info(base, "kategori", "Arti label kategori")}`, esc(categoryNote(categories))),
    fact(
      "Sumber",
      [...new Map(doc.source_records.map((r) => [r.url, r])).values()]
        .map((record, i, all) => {
          const twice = all.filter((r) => r.source === record.source).length > 1;
          const label = twice ? `${record.source} (${record.number_as_written || i + 1})` : record.source;
          return link(record.url, `halaman ${esc(label)}`);
        })
        .join(" · ")
    ),
    fact(
      "Teks",
      doc.text.available
        ? `<a href="#isi">${body.length} ${doc.structure === "diktum" ? "diktum" : "pasal"}</a>${explanation.length ? ` dan ${explanation.length} penjelasan` : ""}`
        : "Tanpa teks di situs ini (lihat di bawah)"
    ),
    `</dl>`,
    doc.status.value === "tidak_pasti" &&
      h(
        `<div class="notice"><p><strong>⚠ Perlu dicek: sumber resmi berbeda pendapat tentang statusnya.</strong></p>`,
        `<ul>${doc.status.reasons.map((reason) => `<li>${esc(plainReason(reason))}</li>`).join("")}</ul>`,
        `<p class="hint">Situs ini tidak memilih salah satu. Catatan tiap sumber ada di atas dan di `,
        `“Rincian status dan sumber”, beserta tanggal pengambilannya.</p></div>`
      ),

    doc.identity_conflicts.length > 0 &&
      h(
        `<div class="notice"><p><strong>Dicatat berbeda oleh dua sumber.</strong> Peraturan ini juga muncul sebagai `,
        doc.identity_conflicts.map((c, i) =>
          h(
            i > 0 && ", ",
            `<a href="${base}dokumen/${esc(c.id)}/">`,
            esc(regulationLabel([c.code, doc.identity.number, doc.identity.year, doc.identity.variant])),
            `</a> (${esc(typeLabel(c.code))})`
          )
        ),
        `, dengan nomor, tahun, dan judul yang sama tetapi jenis yang berbeda. Keduanya sengaja tidak `,
        `digabungkan: menggabungkan berarti memilih salah satu sumber sebagai yang benar.</p></div>`
      ),

    `<h2 id="isi">Isi peraturan</h2>`,
    !doc.text.available
      ? h(
          `<div class="notice"><p><strong>${heldBack ? "Teks belum dimuat di situs ini." : "Teks tidak tersedia di sumber."}</strong> `,
          esc(doc.text.unavailable_reason),
          `. Yang bisa ditampilkan hanya metadata di atas. Buka halaman sumbernya untuk memastikan sendiri.</p>`,
          openableFiles.length > 0 &&
            h(
              `<p>Berkas aslinya: `,
              openableFiles.map((file, i) =>
                h(
                  i > 0 && " · ",
                  link(file.url, `buka berkas ${esc(fileType(file.url))} di JDIH`),
                  `<span class="hint"> (diambil ${esc(formatDate(file.retrieved_at))})</span>`
                )
              ),
              `</p>`
            ),
          doc.twins_with_text.length > 0 &&
            h(
              `<p><strong>Teksnya ada pada catatan kembarannya.</strong> Peraturan dengan nomor, tahun, dan `,
              `judul yang sama dicatat sumber lain dengan jenis berbeda, dan catatan itu berteks: `,
              doc.twins_with_text.map((twin, i) =>
                h(
                  i > 0 && ", ",
                  `<a href="${base}dokumen/${esc(twin.id)}/">${esc(twin.label)}</a>`,
                  esc(` (${twin.sources.join(", ")}, ${twin.body_count} pasal)`)
                )
              ),
              `. Situs ini tidak memastikan bahwa keduanya peraturan yang sama; bandingkan sendiri.</p>`
            ),
          `</div>`
        )
      : h(
          doc.quality_flags.length > 0 &&
            h(
              `<div class="notice"><p><strong>Penomoran pasal di teks sumber janggal.</strong></p>`,
              flagList(doc.quality_flags),
              `<p class="hint">Label pasal dibiarkan persis seperti di sumber, tidak diperbaiki otomatis.</p></div>`
            ),
          STRUCTURE_NOTE[doc.structure] && `<p class="hint">${esc(STRUCTURE_NOTE[doc.structure])}</p>`,
          `<ol class="pasal-daftar">`,
          body.map((unit) =>
            h(
              `<li><a href="${base}pasal/${esc(unit.id)}/">`,
              esc(unit.structure === "diktum" ? unit.label : `Pasal ${unit.label}`),
              `</a><span class="hint"> ${thousands(unit.chars)} karakter</span></li>`
            )
          ),
          `</ol>`,
          explanation.length > 0 &&
            `<p class="hint">Teks sumber juga memuat ${explanation.length} bagian penjelasan, tertaut dari tiap halaman pasal.</p>`,
          `<p class="hint">Teks diambil dari `,
          link(doc.text.url, esc(doc.text.source)),
          ` pada ${esc(formatDate(doc.text.retrieved_at))}.`,
          doc.text.other_postings.length > 0 &&
            h(
              ` Sumber juga memuat dokumen ini di ${doc.text.other_postings.length} alamat lain`,
              doc.text.other_postings.some((p) => p.differs_from_chosen) ? ", dan isinya tidak sama persis." : "."
            ),
          `</p>`
        ),

    `<details class="lipat"><summary><h2>Rincian status dan sumber</h2></summary>`,
    `<h3>Status yang dicatat tiap sumber</h3>`,
    `<ul class="klaim">`,
    doc.status_claims.map((claim) =>
      h(
        `<li><span class="klaim-sumber">${esc(claim.source)}</span>`,
        `<span class="klaim-nilai">${esc(claim.value_verbatim || "(kosong)")}</span>`,
        `<span class="hint">diambil ${esc(formatDate(claim.retrieved_at))}</span>`,
        link(claim.url, "halaman sumber"),
        `</li>`
      )
    ),
    `</ul>`,

    `<h3>Catatan tiap sumber</h3><ul class="klaim">`,
    doc.source_records.map((record) =>
      h(
        `<li><span class="klaim-sumber">${esc(record.source)}</span>`,
        `<span>${esc(record.number_as_written)}</span>`,
        `<span class="hint">`,
        esc(
          h(
            record.type_as_written,
            record.date_as_written ? ` · ${formatDate(record.date_as_written)}` : "",
            ` · diambil ${formatDate(record.retrieved_at)}`,
            record.validity_as_written &&
              ` · masa berlaku di halaman JDIH: ${record.validity_as_written} (diambil ${formatDate(record.page_retrieved_at)})`
          )
        ),
        `</span>`,
        link(record.url, "buka"),
        `</li>`
      )
    ),
    `</ul>`,

    `</details>`,

    (relations.length > 0 || doc.relations.source_listed_related.length > 0) &&
      h(
        `<details class="lipat"><summary><h2>Relasi dengan peraturan lain `,
        `<span class="jumlah">(${relations.reduce((n, g) => n + g.items.length, 0) + doc.relations.source_listed_related.length})</span></h2></summary>`,
    relations.length > 0 &&
      h(
        `<div class="notice"><p><strong>Ini petunjuk, bukan kepastian.</strong> Relasi dibaca otomatis `,
        `dari kalimat di teks peraturan. Uji manual pada 20 contoh memberi 16 benar, 2 sebenarnya `,
        `pencabutan sebagian yang tercatat sebagai pencabutan penuh, dan 2 perlu diperiksa manusia. `,
        `Kutipan kalimat sumbernya disertakan supaya bisa dinilai sendiri.</p></div>`,
        relations.map((group) =>
          h(
            `<h3>${group.label}</h3><ul class="relasi">`,
            group.items.map((item) => relationItem(item, group.kind, known, base)),
            `</ul>`
          )
        )
      ),

    doc.relations.source_listed_related.length > 0 &&
      h(
        `<h3>Disebut terkait oleh sumber</h3><ul class="relasi">`,
        doc.relations.source_listed_related.map((item) =>
          h(
            `<li><p class="relasi-sasaran">`,
            item.url ? link(item.url, esc(item.text)) : esc(item.text),
            `</p><p class="hint">${esc(item.note)}</p></li>`
          )
        ),
        `</ul>`
      ),
        `</details>`
      ),

    doc.attachments.length > 0 &&
      h(
        `<details class="lipat"><summary><h2>Lampiran <span class="jumlah">(${doc.attachments.length})</span>`,
        mismatched > 0 && ` <span class="tanda peringatan">⚠ ${mismatched} tidak cocok</span>`,
        `</h2></summary>`,
        `<p class="hint">Lampiran dibuka sebagai PDF asli di situs sumber. Isinya tidak diubah menjadi `,
        `teks, karena sebagian lampiran berupa hasil pindaian yang OCR-nya merusak angka pada tabel tarif.</p>`,
        `<ul class="lampiran">`,
        doc.attachments.map((attachment) =>
          h(
            `<li>`,
            link(attachment.url, esc(attachment.file_name)),
            attachment.match === "tidak_cocok" &&
              h(
                `<p class="peringatan-blok"><strong>Nomor lampiran tidak cocok.</strong> ${esc(attachment.note)}. `,
                `Lampiran ini mungkin milik peraturan lain, jadi periksa dulu sebelum dipakai.</p>`
              ),
            attachment.match === "tidak_terverifikasi" &&
              `<p class="hint">Nomor peraturan tidak terbaca dari nama berkas, jadi kecocokannya belum terverifikasi.</p>`,
            `</li>`
          )
        ),
        `</ul>`,
        `</details>`
      )
  );
  return { title: `${number} — ${APP_NAME}`, description: doc.title, body: html };
}

function relationItem(item, kind, known, base) {
  const targetId = item.target_id || item.id;
  const label = regulationLabel(item.key);
  return h(
    `<li><p class="relasi-sasaran">`,
    known.has(targetId)
      ? `<a href="${base}dokumen/${esc(targetId)}/">${esc(label)}</a>`
      : `<span>${esc(label)}</span><span class="hint"> — di luar korpus situs ini, tidak ada halamannya di sini</span>`,
    item.title && `<span class="hint"> — ${esc(item.title)}</span>`,
    `</p>`,
    item.quote
      ? h(
          `<blockquote>“${esc(item.quote)}”</blockquote>`,
          item.quote_excerpt &&
            h(
              `<p class="hint">Kalimat aslinya panjang. Bagian yang tidak menyangkut peraturan ini diganti `,
              `tanda “…”; kalimat utuhnya ada di teks `,
              kind === "revoked_by" || kind === "amended_by"
                ? `<a href="${base}dokumen/${esc(item.id)}/">${esc(regulationLabel(item.key))}</a>`
                : "peraturan ini",
              `.</p>`
            ),
          item.quote_note && `<p class="hint">Catatan: ${esc(item.quote_note)}.</p>`
        )
      : h(
          `<p class="peringatan-blok"><strong>Kalimat sumbernya tidak bisa diambil.</strong> ${esc(item.quote_unavailable)}. `,
          `Periksa sendiri teks peraturannya sebelum memakai relasi ini.</p>`
        ),
    `<p class="hint">dibaca dari teks ${esc(item.source_of_reading || "peraturan")}`,
    item.rejected ? esc(` · diabaikan: ${item.rejected}`) : "",
    `</p></li>`
  );
}

/** { title, description, body } for /pasal/<id>/. */
export function renderPasalPage(doc, unit, base) {
  const siblings = doc.pasal_ids;
  const position = siblings.indexOf(unit.id);
  const previous = position > 0 ? siblings[position - 1] : null;
  const next = position < siblings.length - 1 ? siblings[position + 1] : null;
  const heading = unit.structure === "diktum" ? unit.label : `Pasal ${unit.label}`;
  // The unit text starts with its own heading line; drop it so the page does not print it twice.
  const bodyText = unit.text
    .replace(/^[ \t]*(?:PASAL|Pasal|pasal)[ \t]+\S+[ \t]*\n/, "")
    .replace(/^[A-Z ]+\n/, (m) => (unit.structure === "diktum" ? "" : m));

  const section = unit.section === "penjelasan" ? "Penjelasan" : "Batang tubuh";
  // What "Salin kutipan" puts first: regulation, pasal, and title (the page link is added on copy).
  const quoteTitle = `${documentNumber(doc)} ${unit.section === "penjelasan" ? "Penjelasan " : ""}${heading} — ${doc.title}`;

  const html = h(
    `<p class="breadcrumb"><a href="${base}">Daftar peraturan</a> · `,
    `<a href="${base}dokumen/${esc(doc.id)}/">${esc(documentNumber(doc))}</a></p>`,
    `<h1>${esc(heading)}</h1>`,
    `<p class="judul-dokumen">${esc(doc.title)}</p>`,
    `<p class="kartu-status">${statusChips(compactClaims(doc.status_claims))}`,
    info(base, "status", "Arti status menurut sumber"),
    `<span class="tanda netral">${section}</span></p>`,
    doc.status.value === "tidak_pasti" &&
      h(
        `<div class="notice"><p><strong>⚠ Perlu dicek: sumber resmi berbeda pendapat tentang status peraturan ini.</strong> `,
        esc(doc.status.reasons.map(plainReason).join("; ")),
        `. <a href="${base}dokumen/${esc(doc.id)}/">Lihat catatan tiap sumber</a> sebelum memakai pasal ini.</p></div>`
      ),
    doc.quality_flags.length > 0 &&
      h(
        `<details class="peringatan-lipat"><summary>⚠ Penomoran pasal di teks sumber janggal</summary>`,
        flagList(doc.quality_flags),
        `<p class="hint">Label pasal ini ditulis persis seperti di sumber.</p></details>`
      ),
    `<div class="teks-pasal" id="teks-pasal">${esc(bodyText)}</div>`,
    unit.amendment_items &&
      unit.amendment_items.length > 0 &&
      h(
        `<h2>Butir perubahan</h2>`,
        `<p class="hint">Pasal ini memuat ketentuan peraturan lain yang diubah. Judul "Pasal N" di dalamnya `,
        `milik peraturan yang diubah, bukan peraturan ini.</p><ol class="butir">`,
        unit.amendment_items.map((item) =>
          h(
            `<li>Angka ${esc(item.number)}`,
            item.action ? esc(` — ${item.action}`) : "",
            item.target_pasal.length > 0 && `<span class="hint"> (menyasar Pasal ${esc(item.target_pasal.join(", "))})</span>`,
            `</li>`
          )
        ),
        `</ol>`
      ),
    // One bar within thumb reach on phones: previous, copy, next (K-083). The copy button needs
    // JavaScript, so it starts hidden and public/keadaan.js shows it.
    `<nav class="nav-pasal" aria-label="Pasal sebelum dan sesudahnya">`,
    previous ? `<a href="${base}pasal/${esc(previous)}/" rel="prev" aria-label="Sebelumnya">← <span class="nav-kata">Sebelumnya</span></a>` : `<span></span>`,
    `<button type="button" class="salin" data-salin="teks-pasal" data-judul="${esc(quoteTitle)}" hidden>Salin kutipan</button>`,
    next ? `<a href="${base}pasal/${esc(next)}/" rel="next" aria-label="Berikutnya"><span class="nav-kata">Berikutnya</span> →</a>` : `<span></span>`,
    `</nav>`,
    `<p class="hint">Teks diambil dari `,
    link(unit.text_source.url, esc(unit.text_source.source)),
    ` pada ${esc(formatDate(unit.text_source.retrieved_at))}. Untuk kepastian hukum, rujuk naskah resmi di sumbernya.</p>`
  );
  return { title: `${heading} — ${unit.document_number || doc.title} — ${APP_NAME}`, description: doc.title, body: html };
}
