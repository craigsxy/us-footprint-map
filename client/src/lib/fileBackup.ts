/**
 * fileBackup — mirror footprint data to a JSON file on disk (File System Access API).
 * Chrome/Edge only. The file handle is kept in IndexedDB so the next visit only
 * needs one click to re-grant permission. localStorage stays the first-level store.
 */
import { FootprintData, parseFootprintData } from "@/lib/footprintData";

type FSHandle = any;

const DB_NAME = "us-footprint-map-backup";
const STORE = "handles";
const KEY = "backup-file";

export const fsSupported =
  typeof window !== "undefined" &&
  "showSaveFilePicker" in window &&
  "showOpenFilePicker" in window;

const JSON_TYPES = [
  { description: "Footprint backup", accept: { "application/json": [".json"] } },
];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<FSHandle | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const r = db.transaction(STORE).objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet(handle: FSHandle | null): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      if (handle) tx.objectStore(STORE).put(handle, KEY);
      else tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export function serialize(data: FootprintData): string {
  return JSON.stringify(
    { app: "us-footprint-map", version: 1, savedAt: new Date().toISOString(), data },
    null,
    2
  );
}

export async function writeHandle(handle: FSHandle, data: FootprintData) {
  const w = await handle.createWritable();
  await w.write(serialize(data));
  await w.close();
}

export async function readHandle(handle: FSHandle): Promise<FootprintData | null> {
  const file = await handle.getFile();
  return parseFootprintData(await file.text());
}

export async function getSavedHandle(): Promise<FSHandle | null> {
  return fsSupported ? idbGet() : null;
}

export async function hasPermission(handle: FSHandle): Promise<boolean> {
  return (await handle.queryPermission({ mode: "readwrite" })) === "granted";
}

export async function requestPermission(handle: FSHandle): Promise<boolean> {
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

/** Choose/create a backup file and write the current data into it. */
export async function createBackupFile(data: FootprintData): Promise<FSHandle> {
  const handle = await (window as any).showSaveFilePicker({
    suggestedName: "footprint.json",
    types: JSON_TYPES,
  });
  await writeHandle(handle, data);
  await idbSet(handle);
  return handle;
}

/** Choose an existing backup file; returns its handle and contents. */
export async function openBackupFile(): Promise<{
  handle: FSHandle;
  data: FootprintData;
}> {
  const [handle] = await (window as any).showOpenFilePicker({
    types: JSON_TYPES,
    multiple: false,
  });
  await requestPermission(handle);
  const data = await readHandle(handle);
  if (!data) throw new Error("Not a valid footprint file");
  await idbSet(handle);
  return { handle, data };
}

export async function forgetBackupFile() {
  await idbSet(null);
}

/** Fallback for any browser: download a JSON copy. */
export function downloadBackup(data: FootprintData) {
  const blob = new Blob([serialize(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "footprint.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
