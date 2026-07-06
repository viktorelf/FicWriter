const DB_NAME = "ficwriter-board";
const STORE_NAME = "snapshots";
const KEY = "interactive-board:v2";
const LEGACY_KEY = "ficwriter:interactive-board:v1";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> {
  const db = await openDb();

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);

    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("IndexedDB transaction failed"));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    };

    run(store, resolve, reject);
  });
}

export async function loadBoardSnapshot(): Promise<string | null> {
  const fromDb = await withStore<string | null>("readonly", (store, resolve, reject) => {
    const request = store.get(KEY);
    request.onsuccess = () => resolve((request.result as string | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });

  if (fromDb) return fromDb;

  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return null;

  await saveBoardSnapshot(legacy);
  localStorage.removeItem(LEGACY_KEY);
  return legacy;
}

export async function saveBoardSnapshot(payload: string): Promise<void> {
  await withStore<void>("readwrite", (store, resolve, reject) => {
    const request = store.put(payload, KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
