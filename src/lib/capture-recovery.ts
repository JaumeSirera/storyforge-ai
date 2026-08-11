/**
 * Persistencia local de los fragmentos de grabación (IndexedDB).
 *
 * El motor de grabación vive fuera de React, así que navegar entre páginas no
 * corta la grabación. Pero recargar la página (F5, cierre accidental de pestaña,
 * crash del navegador) sí destruye el MediaRecorder. Aquí guardamos cada
 * fragmento en cuanto llega, de forma que al volver a abrir la sesión podamos
 * reanudar: recuperar lo grabado y subirlo o continuar con una nueva toma.
 */

const DB_NAME = "pn-capture-recovery";
const STORE = "chunks";
const META = "meta";
const DB_VERSION = 1;

export interface RecoveryMeta {
  key: string;
  captureSessionId: string;
  participantId: string | null;
  label: string;
  startedAt: number;
  durationSec: number;
  offsetMs: number;
  mimeType: string;
  updatedAt: number;
}

function isBrowser() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isBrowser()) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { autoIncrement: true });
          store.createIndex("byKey", "key");
        }
        if (!db.objectStoreNames.contains(META)) {
          db.createObjectStore(META, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function tx<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  run: (t: IDBTransaction) => IDBRequest<T> | null,
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const t = db.transaction(stores, mode);
      const req = run(t);
      if (!req) {
        t.oncomplete = () => resolve(null);
        t.onerror = () => resolve(null);
        return;
      }
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Guarda un fragmento recién producido por el MediaRecorder. */
export async function persistChunk(key: string, kind: "camera" | "screen", blob: Blob) {
  const db = await openDb();
  if (!db) return;
  await tx(db, [STORE], "readwrite", (t) => t.objectStore(STORE).add({ key, kind, blob }) as any);
  db.close();
}

export async function persistMeta(meta: RecoveryMeta) {
  const db = await openDb();
  if (!db) return;
  await tx(db, [META], "readwrite", (t) => t.objectStore(META).put(meta) as any);
  db.close();
}

/** Metadatos de una grabación interrumpida para esta clave (si existe). */
export async function getRecoverable(key: string): Promise<RecoveryMeta | null> {
  const db = await openDb();
  if (!db) return null;
  const meta = await tx<RecoveryMeta>(db, [META], "readonly", (t) => t.objectStore(META).get(key) as any);
  db.close();
  return meta ?? null;
}

/** Fragmentos guardados agrupados por pista. */
export async function loadRecoveredBlobs(
  key: string,
): Promise<{ camera: Blob[]; screen: Blob[] }> {
  const db = await openDb();
  if (!db) return { camera: [], screen: [] };
  const rows = await tx<any[]>(db, [STORE], "readonly", (t) =>
    t.objectStore(STORE).index("byKey").getAll(key) as any,
  );
  db.close();
  const camera: Blob[] = [];
  const screen: Blob[] = [];
  (rows ?? []).forEach((r) => {
    if (r?.blob) (r.kind === "screen" ? screen : camera).push(r.blob as Blob);
  });
  return { camera, screen };
}

/** Borra todo lo guardado para una clave (al guardar bien o al descartar). */
export async function clearRecovery(key: string) {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const t = db.transaction([STORE, META], "readwrite");
      const idx = t.objectStore(STORE).index("byKey");
      const cursorReq = idx.openCursor(IDBKeyRange.only(key));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      t.objectStore(META).delete(key);
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}
