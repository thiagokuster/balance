import { changedAt, storageSnapshot } from "./finance";
import { readBackup } from "./export";
import { isEncryptedVault } from "./vault";

/** A linked file is useful only when it was written after the last local change. */
export function syncIsNewer(fileAt: string, localAt: string) {
  if (!fileAt) return false;
  if (!localAt) return true;
  return fileAt > localAt;
}

export function envelopeFromStorage(raw: string, exportedAt = new Date().toISOString()) {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (isEncryptedVault(json)) {
    return JSON.stringify({ app: "saldo", version: 2, exportedAt, sealed: json });
  }
  return JSON.stringify({ app: "saldo", version: 2, exportedAt, state: json });
}

type SyncHandle = {
  queryPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  getFile(): Promise<File>;
};

type PickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<SyncHandle>;
};

const DB = "saldo-sync";
const STORE = "handles";
const HANDLE_KEY = "file";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putHandle(handle: SyncHandle) {
  const database = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}

async function getHandle() {
  const database = await openDb();
  const handle = await new Promise<SyncHandle | undefined>((resolve, reject) => {
    const request = database.transaction(STORE, "readonly").objectStore(STORE).get(HANDLE_KEY);
    request.onsuccess = () => resolve(request.result as SyncHandle | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return handle;
}

export function canLinkSyncFile() {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

async function permitted(handle: SyncHandle, ask: boolean) {
  const mode = { mode: "readwrite" as const };
  if ((await handle.queryPermission(mode)) === "granted") return true;
  if (!ask) return false;
  return (await handle.requestPermission(mode)) === "granted";
}

async function writeHandle(handle: SyncHandle) {
  const raw = storageSnapshot();
  if (!raw) return;
  const body = envelopeFromStorage(raw);
  if (!body) return;
  const writable = await handle.createWritable();
  await writable.write(body);
  await writable.close();
}

/** Remembers a JSON file, usually inside a Drive, OneDrive or Dropbox folder. */
export async function linkSyncFile() {
  const picker = window as PickerWindow;
  if (!picker.showSaveFilePicker) throw new Error("sync-unsupported");
  const handle = await picker.showSaveFilePicker({
    suggestedName: "saldo-sync.json",
    types: [{ description: "Backup do Saldo", accept: { "application/json": [".json"] } }],
  });
  await putHandle(handle);
  await writeHandle(handle);
}

/** Updates the linked file after a local save. Quiet when there is no file or no permission. */
export async function pushLinkedSync() {
  if (typeof indexedDB === "undefined") return;
  try {
    const handle = await getHandle();
    if (!handle || !(await permitted(handle, false))) return;
    await writeHandle(handle);
  } catch {
    /* the copy in this browser was already saved */
  }
}

export async function readLinkedSync() {
  const handle = await getHandle();
  if (!handle || !(await permitted(handle, true))) return null;
  return (await handle.getFile()).text();
}

export async function linkedFileIsNewer() {
  try {
    const handle = await getHandle();
    if (!handle || !(await permitted(handle, false))) return false;
    const parsed = readBackup(await (await handle.getFile()).text());
    return parsed ? syncIsNewer(parsed.exportedAt ?? "", changedAt()) : false;
  } catch {
    return false;
  }
}
