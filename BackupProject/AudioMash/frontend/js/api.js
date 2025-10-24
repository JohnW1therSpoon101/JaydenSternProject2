// frontend/js/api.js
// Very small IndexedDB wrapper to store/retrieve tracks locally (browser storage)

let db = null;
const DB_NAME = "audiomash";
const STORE = "tracks";

export async function initDB() {
  if (db) return db;
  db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: "trackId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return db;
}

export async function saveTrack(record) {
  // record: { trackId, title, genre, full, drums, bass, vocals, other }  (Blobs/Files ok)
  await initDB();
  return txWrap("readwrite", (store) => store.put(record));
}

export async function listTracks() {
  await initDB();
  return txWrap("readonly", (store) => {
    return new Promise((resolve, reject) => {
      const items = [];
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          items.push(cursor.value);
          cursor.continue();
        } else
          resolve(
            items.map(({ trackId, title, genre }) => ({
              trackId,
              title,
              genre,
            }))
          );
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function getTrack(trackId) {
  await initDB();
  return txWrap("readonly", (store) => store.get(trackId));
}

function txWrap(mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () =>
      resolve(result instanceof IDBRequest ? result.result : result);
    tx.onerror = () => reject(tx.error);
  });
}
