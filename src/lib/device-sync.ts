import { changedAt, storageSnapshot } from "./finance";
import { readBackup } from "./export";
import { isEncryptedVault } from "./vault";

export const SYNC_PASSWORD_MESSAGE = "Crie uma senha antes de vincular um arquivo";
export const SYNC_CONFLICT_MESSAGE =
  "O arquivo vinculado mudou em outro aparelho e não foi atualizado. Não há como juntar as duas versões.";

/** A linked file is useful only when it was written after the last local change. */
export function syncIsNewer(fileAt: string, localAt: string) {
  if (!fileAt) return false;
  if (!localAt) return true;
  return fileAt > localAt;
}

/** A plain finance snapshot must not become a file. Only the sealed vault does. */
export function envelopeFromStorage(raw: string, exportedAt = new Date().toISOString()) {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isEncryptedVault(json)) return null;
  return JSON.stringify({ app: "saldo", version: 2, exportedAt, sealed: json });
}

/**
 * Skip when this browser has no sealed vault. Conflict when the file's
 * exportedAt is not the revision this browser last read or wrote.
 */
export function decideLinkedWrite(
  raw: string,
  fileText: string,
  seenAt: string,
  exportedAt: string,
): "skip" | "conflict" | { body: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return "skip";
  }
  if (!isEncryptedVault(json)) return "skip";
  const fileAt = revisionOf(fileText);
  if (fileAt === null || fileAt !== seenAt) return "conflict";
  const body = envelopeFromStorage(raw, exportedAt);
  return body ? { body } : "skip";
}

function revisionOf(fileText: string) {
  if (!fileText.trim()) return "";
  const parsed = readBackup(fileText);
  if (!parsed) return null;
  return parsed.exportedAt ?? "";
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
const SEEN_KEY = "saldo-sync-visto";

function seenRevision() {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(SEEN_KEY) ?? "";
}

/** Remembers the exportedAt this browser last read or wrote. */
export function noteLinkedRevision(exportedAt: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SEEN_KEY, exportedAt);
}

function reportSyncConflict() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("saldo-sync-conflict"));
}

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
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isEncryptedVault(json)) return;
  let fileText: string;
  try {
    fileText = await (await handle.getFile()).text();
  } catch {
    throw new Error("sync-conflict");
  }
  const exportedAt = new Date().toISOString();
  const decision = decideLinkedWrite(raw, fileText, seenRevision(), exportedAt);
  if (decision === "skip") return;
  if (decision === "conflict") throw new Error("sync-conflict");
  const writable = await handle.createWritable();
  await writable.write(decision.body);
  await writable.close();
  noteLinkedRevision(exportedAt);
}

/** Remembers a JSON file, usually inside a Drive, OneDrive or Dropbox folder. */
export async function linkSyncFile() {
  const raw = storageSnapshot();
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  if (!isEncryptedVault(json)) throw new Error(SYNC_PASSWORD_MESSAGE);
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
  } catch (error) {
    if (error instanceof Error && error.message === "sync-conflict") reportSyncConflict();
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
