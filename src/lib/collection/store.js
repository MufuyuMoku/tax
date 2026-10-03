// IndexedDB storage for the personal collection. Works in the page and in the search worker.
// Everything stays in this browser profile on this device (SPEC invariant 7).

const DB_NAME = "tax-koleksi-pribadi";
const STORE = "dokumen";
const VERSION = 1;

function promised(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let opening = null;
function open() {
  if (!opening) {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    opening = promised(request);
  }
  return opening;
}

async function run(mode, work) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let result;
    Promise.resolve(work(tx.objectStore(STORE))).then((value) => {
      result = value;
    }, reject);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("transaksi dibatalkan"));
  });
}

export function allRecords() {
  return run("readonly", (store) => promised(store.getAll()));
}

export function getRecord(id) {
  return run("readonly", (store) => promised(store.get(id)));
}

export function putRecord(record) {
  return run("readwrite", (store) => promised(store.put(record)));
}

export function deleteRecord(id) {
  return run("readwrite", (store) => promised(store.delete(id)));
}

export function clearRecords() {
  return run("readwrite", (store) => promised(store.clear()));
}

/** Replace the whole collection in one transaction: either all of it lands, or none. */
export function replaceRecords(records) {
  return run("readwrite", (store) => {
    store.clear();
    for (const record of records) store.put(record);
  });
}

/** Whether the browser keeps the data under storage pressure, and how much space is used. */
export async function storageInfo() {
  if (!navigator.storage) return { supported: false };
  const [persisted, estimate] = await Promise.all([
    navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(null),
    navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null),
  ]);
  return { supported: true, persisted, usage: estimate && estimate.usage, quota: estimate && estimate.quota };
}

export async function requestPersistence() {
  if (!navigator.storage || !navigator.storage.persist) return null;
  return navigator.storage.persist();
}
