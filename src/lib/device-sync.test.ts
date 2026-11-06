import { describe, expect, it } from "vitest";
import { decideLinkedWrite, envelopeFromStorage, syncIsNewer } from "./device-sync";
import { readBackup } from "./export";

const blank = {
  accounts: [],
  transactions: [],
  transfers: [],
  cards: [],
  goals: [],
  investments: [],
  monthlyBudget: 0,
  categoryLimits: {},
};

const sealed = {
  v: 1,
  alg: "AES-GCM",
  kdf: "PBKDF2-SHA256",
  iter: 1000,
  salt: "aa",
  iv: "bb",
  ct: "cc",
};

describe("arquivo de sincronização", () => {
  it("trata o arquivo mais novo como a cópia a trazer", () => {
    expect(syncIsNewer("2026-11-06T12:00:00.000Z", "2026-11-06T11:00:00.000Z")).toBe(true);
    expect(syncIsNewer("2026-11-06T11:00:00.000Z", "2026-11-06T12:00:00.000Z")).toBe(false);
    expect(syncIsNewer("", "2026-11-06T12:00:00.000Z")).toBe(false);
    expect(syncIsNewer("2026-11-06T12:00:00.000Z", "")).toBe(true);
  });

  it("não gera arquivo quando os dados estão sem senha", () => {
    expect(envelopeFromStorage(JSON.stringify(blank), "2026-11-06T12:00:00.000Z")).toBeNull();
    expect(decideLinkedWrite(JSON.stringify(blank), "", "", "2026-11-06T12:00:00.000Z")).toBe(
      "skip",
    );
  });

  it("grava a hora da exportação só no arquivo criptografado", () => {
    const raw = envelopeFromStorage(JSON.stringify(sealed), "2026-11-06T12:00:00.000Z");
    const opened = raw ? readBackup(raw) : null;
    expect(opened?.kind).toBe("sealed");
    expect(opened?.exportedAt).toBe("2026-11-06T12:00:00.000Z");
    expect(raw).not.toContain('"state"');
  });

  it("não grava por cima quando o arquivo não é a versão que este navegador viu", () => {
    const raw = JSON.stringify(sealed);
    const seen = "2026-11-06T12:00:00.000Z";
    const current = envelopeFromStorage(raw, seen);
    expect(current).toBeTruthy();
    expect(decideLinkedWrite(raw, current ?? "", seen, "2026-11-06T13:00:00.000Z")).toEqual({
      body: envelopeFromStorage(raw, "2026-11-06T13:00:00.000Z"),
    });
    const other = envelopeFromStorage(raw, "2026-11-06T18:00:00.000Z");
    expect(decideLinkedWrite(raw, other ?? "", seen, "2026-11-06T13:00:00.000Z")).toBe("conflict");
    expect(decideLinkedWrite(raw, "", "", "2026-11-06T13:00:00.000Z")).toEqual({
      body: envelopeFromStorage(raw, "2026-11-06T13:00:00.000Z"),
    });
  });
});
