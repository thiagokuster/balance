import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyRemoteStorage,
  enableVault,
  flushVaultWrites,
  lockSession,
  peekFinance,
  resetFinanceStore,
  toCSV,
  unlockVault,
  update,
} from "./finance";
import { parseFinanceState } from "./finance-schema";
import { readBackup } from "./export";
import { securityHeaders } from "./security-headers";
import { createSession, legacyPasswordMatches, openState, sealState } from "./vault";

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

afterEach(() => {
  localStorage.clear();
  resetFinanceStore();
});

describe("dados gravados no navegador", () => {
  it("rejeita um arquivo local com formato inesperado", () => {
    expect(parseFinanceState(blank)?.accounts).toEqual([]);
    expect(parseFinanceState({ ...blank, accounts: [{ id: "x" }] })).toBeNull();
    const parsed = parseFinanceState({ ...blank, extra: "ignored" });
    expect(parsed).not.toBeNull();
    expect(parsed && "extra" in parsed).toBe(false);
  });

  it("aceita um backup e recusa arquivo inválido", () => {
    const raw = JSON.stringify({ app: "saldo", version: 1, state: blank });
    const opened = readBackup(`\uFEFF${raw}`);
    expect(opened?.kind).toBe("plain");
    if (opened?.kind === "plain") expect(opened.state.accounts).toEqual([]);
    expect(readBackup("{")).toBeNull();
    expect(
      readBackup(JSON.stringify({ app: "saldo", state: { accounts: [{ id: "x" }] } })),
    ).toBeNull();
  });

  it("criptografa o estado e recusa a senha errada", async () => {
    const session = await createSession("senha-forte", 10_000);
    const sealed = await sealState(
      {
        ...blank,
        accounts: [{ id: "a1", name: "Nubank", type: "corrente", initialBalance: 10 }],
      },
      session,
    );
    expect(JSON.stringify(sealed)).not.toContain("Nubank");
    const opened = await openState(sealed, "senha-forte");
    expect(opened.state.accounts[0]?.name).toBe("Nubank");
    await expect(openState(sealed, "senha-errada")).rejects.toThrow("vault-auth");
  });

  it("não grava a descrição em texto puro depois da senha", async () => {
    update((s) => ({
      ...s,
      transactions: [
        ...s.transactions,
        {
          id: "t1",
          description: "Mercado secreto",
          amount: 10,
          type: "despesa",
          category: "Alimentação",
          accountId: "a1",
          date: "2026-11-03",
          paymentMethod: "Pix",
          status: "pago",
        },
      ],
    }));
    await enableVault("senha-forte-ok", 10_000);
    const stored = localStorage.getItem("financas-pessoais-v1") ?? "";
    expect(stored).not.toContain("Mercado secreto");
    resetFinanceStore();
    expect(peekFinance().transactions).toEqual([]);
    expect(await unlockVault("outra-senha")).toBe(false);
    expect(await unlockVault("senha-forte-ok")).toBe(true);
    expect(peekFinance().transactions[0]?.description).toBe("Mercado secreto");
    lockSession();
    const sealed = localStorage.getItem("financas-pessoais-v1");
    update((s) => ({ ...s, monthlyBudget: 999 }));
    await flushVaultWrites();
    expect(localStorage.getItem("financas-pessoais-v1")).toBe(sealed);
    expect(peekFinance().monthlyBudget).toBe(0);
  });

  it("avisa quando o navegador recusa a gravação", async () => {
    await enableVault("senha-forte-ok", 1_000);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    let failed = false;
    window.addEventListener("saldo-persist-error", () => {
      failed = true;
    });
    try {
      update((s) => ({ ...s, monthlyBudget: 15 }));
      await flushVaultWrites().catch(() => undefined);
      expect(failed).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("aplica a cópia gravada por outra aba", async () => {
    update((s) => ({ ...s, monthlyBudget: 10 }));
    await enableVault("senha-forte-ok", 1_000);
    await flushVaultWrites();
    const otherTab = localStorage.getItem("financas-pessoais-v1");
    update((s) => ({ ...s, monthlyBudget: 80 }));
    await flushVaultWrites();
    await applyRemoteStorage(otherTab);
    expect(peekFinance().monthlyBudget).toBe(10);
  });

  it("troca o hash antigo por um cofre na primeira abertura", async () => {
    const password = "senha-antiga";
    localStorage.setItem(
      "financas-pessoais-v1",
      JSON.stringify({
        ...blank,
        accounts: [{ id: "a1", name: "Carteira", type: "dinheiro", initialBalance: 20 }],
      }),
    );
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`saldo:${password}`),
    );
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem("financas-pin-hash", hex);
    expect(await legacyPasswordMatches(password, hex)).toBe(true);
    resetFinanceStore();
    expect(peekFinance().accounts).toEqual([]);
    expect(await unlockVault(password, 1_000)).toBe(true);
    expect(peekFinance().accounts[0]?.name).toBe("Carteira");
    expect(localStorage.getItem("financas-pin-hash")).toBeNull();
    expect(localStorage.getItem("financas-pessoais-v1")).not.toContain("Carteira");
  });
});

describe("saída e cabeçalhos", () => {
  it("impede fórmula de planilha no CSV", () => {
    expect(toCSV([["=1+1", "ok"]])).toBe(`"'=1+1";"ok"`);
  });

  it("envia a política de conteúdo e o HSTS só em https", () => {
    const https = securityHeaders("https://saldo.local/", true);
    const http = securityHeaders("http://127.0.0.1:5173/", false);
    expect(https["Content-Security-Policy"]).toContain("script-src 'self'");
    expect(https["Content-Security-Policy"]).not.toContain("unsafe-eval");
    expect(https["Content-Security-Policy"]).not.toContain("fonts.googleapis.com");
    expect(https["X-Content-Type-Options"]).toBe("nosniff");
    expect(https["X-Frame-Options"]).toBe("DENY");
    expect(https["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(http["Strict-Transport-Security"]).toBeUndefined();
    expect(http["Content-Security-Policy"]).toContain("unsafe-eval");
  });
});
