// Minimal promise-based IndexedDB wrapper. No external dependency, no
// server: this is the entire "banco de dados" for Phase 1. The interface is
// intentionally narrow (get/getAll/getAllByIndex/put/delete) so a future
// Tauri+SQLite backend can implement the same shape in `repository.ts`
// without the UI layer knowing the difference.

const DB_NAME = "rpg-world-canvas";
const DB_VERSION = 1;

export const STORES = {
  campaigns: "campaigns",
  entities: "entities",
  relations: "relations",
  views: "views",
  universeLinks: "universeLinks",
  backups: "backups",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.campaigns)) {
        db.createObjectStore(STORES.campaigns, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.entities)) {
        const store = db.createObjectStore(STORES.entities, { keyPath: "id" });
        store.createIndex("campaignId", "campaignId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.relations)) {
        const store = db.createObjectStore(STORES.relations, { keyPath: "id" });
        store.createIndex("campaignId", "campaignId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.views)) {
        const store = db.createObjectStore(STORES.views, { keyPath: "id" });
        store.createIndex("campaignId", "campaignId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.universeLinks)) {
        db.createObjectStore(STORES.universeLinks, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.backups)) {
        const store = db.createObjectStore(STORES.backups, { keyPath: "id" });
        store.createIndex("campaignId", "campaignId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir o banco local."));
  });
  return dbPromise;
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha na operação do banco local."));
  });
}

export async function dbGet<T>(store: string, id: string): Promise<T | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(store, "readonly");
  return wrap(tx.objectStore(store).get(id)) as Promise<T | undefined>;
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDatabase();
  const tx = db.transaction(store, "readonly");
  return wrap(tx.objectStore(store).getAll()) as Promise<T[]>;
}

export async function dbGetAllByIndex<T>(store: string, index: string, value: string): Promise<T[]> {
  const db = await openDatabase();
  const tx = db.transaction(store, "readonly");
  return wrap(tx.objectStore(store).index(index).getAll(value)) as Promise<T[]>;
}

export async function dbPut<T>(store: string, value: T): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  await wrap(tx.objectStore(store).count());
}

export async function dbPutMany<T>(store: string, values: T[]): Promise<void> {
  if (!values.length) return;
  const db = await openDatabase();
  const tx = db.transaction(store, "readwrite");
  const objectStore = tx.objectStore(store);
  for (const value of values) objectStore.put(value);
  await wrap(objectStore.count());
}

export async function dbDelete(store: string, id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(id);
  await wrap(tx.objectStore(store).count());
}

export async function dbDeleteMany(store: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDatabase();
  const tx = db.transaction(store, "readwrite");
  const objectStore = tx.objectStore(store);
  for (const id of ids) objectStore.delete(id);
  await wrap(objectStore.count());
}

/** Test-only: closes and forgets the cached connection so a fresh
 * `openDatabase()` reopens against whatever fake-indexeddb instance the
 * next test installed. */
export function resetDatabaseForTests(): void {
  dbPromise = null;
}
