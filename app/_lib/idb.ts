// Wrapper mínimo de IndexedDB (§16: não usar localStorage para dados complexos).
// Sem dependência externa — a API nativa resolve com ~50 linhas. Duas stores,
// ambas com keyPath "id": a fila de sync e as execuções locais.

const DB_NAME = "enky-atleta";
const DB_VERSION = 2;
export const STORE_QUEUE = "sync-queue";
export const STORE_EXECUTIONS = "executions";
export const STORE_WORKOUTS = "workouts";
const STORES = [STORE_QUEUE, STORE_EXECUTIONS, STORE_WORKOUTS] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function idbPut<T>(store: StoreName, value: T): Promise<void> {
  return run<IDBValidKey>(store, "readwrite", (s) => s.put(value)).then(() => undefined);
}

export function idbGet<T>(store: StoreName, id: string): Promise<T | undefined> {
  return run<T | undefined>(store, "readonly", (s) => s.get(id));
}

export function idbGetAll<T>(store: StoreName): Promise<T[]> {
  return run<T[]>(store, "readonly", (s) => s.getAll());
}

export function idbDelete(store: StoreName, id: string): Promise<void> {
  return run<undefined>(store, "readwrite", (s) => s.delete(id)).then(() => undefined);
}

// Usado no logout (§35): apaga todo o dado offline do atleta neste aparelho.
export function idbDeleteDatabase(): Promise<void> {
  dbPromise = null;
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve(); // best-effort
    req.onblocked = () => resolve();
  });
}
