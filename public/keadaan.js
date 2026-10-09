// The line under the navigation on every page (M6, K-082): which data version this device keeps,
// whether it is online, and, when a new version has been downloaded, the offer to switch to it.
// Also registers the service worker, asks again for persistent storage once the site is installed,
// and, while offline, turns links to other sites (PDF attachments, source pages) into plain text
// that says it needs the internet, instead of links that look openable but cannot open.
//
// A plain file in public/, loaded by the layout with one <script> tag. Processed by the build it
// was inlined into each of the 21,000 pages, doubling the size of the published site.

const $ = (id) => document.getElementById(id);
const mb = (bytes) => `${(bytes / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 0 })} MB`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const date = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
};

/** Ask a service worker for its version; null if it does not answer. */
function info(worker) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 3000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data);
    };
    worker.postMessage({ type: "info" }, [channel.port2]);
  });
}

// ---------- links that need the internet ----------
const external = (a) => {
  try {
    return new URL(a.getAttribute("href"), location.href).origin !== location.origin;
  } catch {
    return false;
  }
};

const within = (root, selector) => [...(root.matches && root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];

function markLinks(root, offline) {
  if (offline) {
    for (const a of within(root, "a[href]")) {
      if (!external(a)) continue;
      a.dataset.hrefLuar = a.getAttribute("href");
      a.removeAttribute("href");
      a.classList.add("luar-luring");
      a.title = "Butuh internet";
    }
  } else {
    for (const a of within(root, "a[data-href-luar]")) {
      a.setAttribute("href", a.dataset.hrefLuar);
      delete a.dataset.hrefLuar;
      a.classList.remove("luar-luring");
      a.removeAttribute("title");
    }
  }
}

// Search results and collection views are drawn after load; mark their links too while offline.
const observer = new MutationObserver((changes) => {
  for (const change of changes) for (const node of change.addedNodes) if (node.nodeType === 1) markLinks(node, true);
});

function showNetwork() {
  const offline = !navigator.onLine;
  document.documentElement.classList.toggle("luring", offline);
  $("keadaan-jaringan").textContent = offline
    ? "Luring: lampiran PDF dan halaman sumber asli butuh internet."
    : "Daring.";
  markLinks(document, offline);
  if (offline) observer.observe(document.body, { childList: true, subtree: true });
  else observer.disconnect();
}

// ---------- persistent storage ----------
async function persistence() {
  if (!navigator.storage || !navigator.storage.persisted) return "";
  const installed = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  let persisted = await navigator.storage.persisted();
  let refused = false;
  // Promised in M4 (K-047): once the site is installed, browsers usually grant it; ask again then.
  if (!persisted && installed && navigator.storage.persist) {
    persisted = await navigator.storage.persist();
    refused = !persisted;
  }
  if (persisted) return " Penyimpanan permanen.";
  if (refused) return " Penyimpanan belum permanen (permintaan ditolak browser).";
  return " Penyimpanan belum permanen (biasanya diberikan setelah situs dipasang).";
}

// ---------- the service worker ----------
async function startOfflineStatus(base) {
  showNetwork();
  window.addEventListener("online", showNetwork);
  window.addEventListener("offline", showNetwork);

  const saved = $("keadaan-simpan");
  if (!("serviceWorker" in navigator)) {
    saved.textContent = "Browser ini tidak bisa menyimpan situs untuk dipakai luring.";
    return;
  }

  let switching = false;
  async function showStored() {
    const current = navigator.serviceWorker.controller && (await info(navigator.serviceWorker.controller));
    if (!current) return;
    saved.textContent =
      `Tersimpan di perangkat: data versi ${current.data.version.slice(0, 8)} (${mb(current.bytes)}).` +
      (await persistence());
  }

  async function offer(worker) {
    if (!navigator.serviceWorker.controller) return; // first install: nothing to switch from
    const [next, current] = await Promise.all([info(worker), info(navigator.serviceWorker.controller)]);
    if (!next) return;
    const sameData = current && current.data.version === next.data.version;
    $("tawaran-teks").textContent = sameData
      ? "Versi baru situs sudah diunduh (data sama). Halaman ini tidak berubah sampai Anda memuatnya."
      : `Data baru sudah diunduh: versi ${next.data.version.slice(0, 8)}, data sumber diambil sampai ` +
        `${date(next.data.date)}. Halaman ini tidak berubah sampai Anda memuatnya.`;
    $("muat-baru").textContent = sameData ? "Muat versi baru" : "Muat data baru";
    $("muat-baru").onclick = () => {
      switching = true;
      $("muat-baru").disabled = true;
      worker.postMessage({ type: "pakai" });
    };
    $("tawaran-baru").hidden = false;
  }

  function watch(worker) {
    if (!worker) return;
    if (worker.state === "installed") offer(worker);
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") offer(worker);
    });
  }

  navigator.serviceWorker.addEventListener("message", (event) => {
    const message = event.data || {};
    if (message.type === "kemajuan" && !navigator.serviceWorker.controller) {
      saved.textContent = `Menyimpan untuk dipakai luring: ${message.done} dari ${message.total} berkas.`;
    }
    if (message.type === "gagal" && !navigator.serviceWorker.controller) {
      saved.textContent = "Penyimpanan untuk luring terhenti; dicoba lagi saat halaman dibuka berikutnya.";
    }
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (switching) location.reload();
    else showStored();
  });

  let registration;
  try {
    registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
  } catch {
    saved.textContent = "Situs belum tersimpan untuk dipakai luring.";
    return;
  }
  if (navigator.serviceWorker.controller) showStored();
  else saved.textContent = "Belum tersimpan untuk dipakai luring.";
  watch(registration.waiting);
  watch(registration.installing);
  registration.addEventListener("updatefound", () => watch(registration.installing));

  // Look for a new version when the page opens and when the connection comes back. Only files
  // whose content changed are downloaded (see src/sw/sw.js).
  const check = () => navigator.onLine && registration.update().catch(() => {});
  check();
  window.addEventListener("online", check);
}

// This file sits at the site root, so its own address gives the base path (/tax/).
startOfflineStatus(new URL(".", import.meta.url).pathname);
