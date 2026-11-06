import { parseFinanceState } from "./finance-schema";
import type { FinanceState } from "./finance";

/** OWASP password-storage guidance for PBKDF2-HMAC-SHA-256. */
export const VAULT_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 12;
const MIN_ITERATIONS = 1_000;
const MAX_ITERATIONS = 2_000_000;

export interface VaultPayload {
  v: 1;
  alg: "AES-GCM";
  kdf: "PBKDF2-SHA256";
  iter: number;
  salt: string;
  iv: string;
  ct: string;
}

export interface VaultSession {
  key: CryptoKey;
  salt: string;
  iter: number;
}

export function isEncryptedVault(value: unknown): value is VaultPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<VaultPayload>;
  return (
    v.v === 1 &&
    v.alg === "AES-GCM" &&
    v.kdf === "PBKDF2-SHA256" &&
    typeof v.salt === "string" &&
    typeof v.iv === "string" &&
    typeof v.ct === "string" &&
    typeof v.iter === "number" &&
    Number.isInteger(v.iter) &&
    v.iter >= MIN_ITERATIONS &&
    v.iter <= MAX_ITERATIONS
  );
}

export async function sealState(state: FinanceState, session: VaultSession): Promise<VaultPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(state));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, session.key, encoded);
  return {
    v: 1,
    alg: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iter: session.iter,
    salt: session.salt,
    iv: bytesToB64(iv),
    ct: bytesToB64(new Uint8Array(ct)),
  };
}

export async function openState(
  payload: VaultPayload,
  password: string,
): Promise<{ state: FinanceState; session: VaultSession }> {
  if (
    !Number.isInteger(payload.iter) ||
    payload.iter < MIN_ITERATIONS ||
    payload.iter > MAX_ITERATIONS
  ) {
    throw new Error("vault-iterations");
  }
  const key = await deriveKey(password, b64ToBytes(payload.salt), payload.iter);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(payload.iv) },
      key,
      b64ToBytes(payload.ct),
    );
  } catch {
    throw new Error("vault-auth");
  }
  const state = parseFinanceState(JSON.parse(new TextDecoder().decode(plain)));
  if (!state) throw new Error("vault-format");
  return { state, session: { key, salt: payload.salt, iter: payload.iter } };
}

export async function readSealed(
  payload: VaultPayload,
  current: VaultSession,
): Promise<FinanceState> {
  if (payload.salt !== current.salt || payload.iter !== current.iter) throw new Error("vault-auth");
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(payload.iv) },
      current.key,
      b64ToBytes(payload.ct),
    );
  } catch {
    throw new Error("vault-auth");
  }
  const state = parseFinanceState(JSON.parse(new TextDecoder().decode(plain)));
  if (!state) throw new Error("vault-format");
  return state;
}

export async function createSession(
  password: string,
  iterations = VAULT_ITERATIONS,
): Promise<VaultSession> {
  if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS)
    throw new Error("vault-iterations");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt, iterations);
  return { key, salt: bytesToB64(salt), iter: iterations };
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function legacyPasswordMatches(password: string, storedHex: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`saldo:${password}`),
  );
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hex, storedHex);
}

function timingSafeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

function bytesToB64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
