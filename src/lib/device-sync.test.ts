import { describe, expect, it } from "vitest";
import { envelopeFromStorage, syncIsNewer } from "./device-sync";
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

describe("arquivo de sincronização", () => {
  it("trata o arquivo mais novo como a cópia a trazer", () => {
    expect(syncIsNewer("2026-11-06T12:00:00.000Z", "2026-11-06T11:00:00.000Z")).toBe(true);
    expect(syncIsNewer("2026-11-06T11:00:00.000Z", "2026-11-06T12:00:00.000Z")).toBe(false);
    expect(syncIsNewer("", "2026-11-06T12:00:00.000Z")).toBe(false);
    expect(syncIsNewer("2026-11-06T12:00:00.000Z", "")).toBe(true);
  });

  it("grava a hora da exportação no arquivo", () => {
    const raw = envelopeFromStorage(JSON.stringify(blank), "2026-11-06T12:00:00.000Z");
    const opened = raw ? readBackup(raw) : null;
    expect(opened?.kind).toBe("plain");
    expect(opened?.exportedAt).toBe("2026-11-06T12:00:00.000Z");
  });
});
