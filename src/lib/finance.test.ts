import { describe, expect, it } from "vitest";
import {
  accountBalance,
  addMonths,
  applyContribution,
  applyInvoicePayment,
  calendarEvents,
  cardInvoices,
  investmentValue,
  invoiceMonth,
  monthTotals,
  netWorth,
  spendingAlerts,
  today,
  type FinanceState,
  type Investment,
} from "./finance";

const base: FinanceState = {
  accounts: [
    { id: "a", name: "C", type: "corrente", initialBalance: 1000 },
    { id: "b", name: "P", type: "poupanca", initialBalance: 0 },
  ],
  transactions: [
    {
      id: "1",
      description: "s",
      amount: 500,
      type: "receita",
      category: "Salário",
      accountId: "a",
      date: "2026-10-05",
      paymentMethod: "Pix",
      status: "recebido",
    },
    {
      id: "2",
      description: "d",
      amount: 200,
      type: "despesa",
      category: "Lazer",
      accountId: "a",
      date: "2026-10-06",
      paymentMethod: "Pix",
      status: "pendente",
    },
  ],
  transfers: [{ id: "t", fromId: "a", toId: "b", amount: 300, date: "2026-10-07" }],
  cards: [],
  goals: [],
  investments: [],
  monthlyBudget: 0,
  categoryLimits: {},
};

describe("finance rules", () => {
  it("transfers move balance but are not income or expense", () => {
    expect(accountBalance(base, "a")).toBe(1200);
    expect(accountBalance(base, "b")).toBe(300);
    expect(monthTotals(base, "2026-10")).toEqual({ income: 500, expense: 200, net: 300 });
  });
  it("card purchase after closing day goes to next invoice", () => {
    expect(
      invoiceMonth({ id: "c", name: "x", limit: 1, closingDay: 10, dueDay: 20 }, "2026-10-11"),
    ).toBe("2026-11");
    expect(
      invoiceMonth({ id: "c", name: "x", limit: 1, closingDay: 10, dueDay: 20 }, "2026-10-10"),
    ).toBe("2026-10");
  });
  it("paying an invoice clears the card debt without creating another expense", () => {
    const card = { id: "c", name: "Visa", limit: 1000, closingDay: 10, dueDay: 20 };
    const state: FinanceState = {
      ...base,
      cards: [card],
      transactions: [
        ...base.transactions,
        {
          id: "card",
          description: "compra",
          amount: 80,
          type: "despesa",
          category: "Compras",
          accountId: "",
          cardId: "c",
          date: "2026-10-05",
          paymentMethod: "Cartão de crédito",
          status: "pendente",
        },
      ],
    };
    const next = applyInvoicePayment(state, "c", "2026-10", "a", "2026-10-20");
    expect(next.transactions.find((t) => t.id === "card")?.status).toBe("pago");
    expect(next.transfers.at(-1)?.amount).toBe(80);
    expect(monthTotals(next, "2026-10").expense).toBe(monthTotals(state, "2026-10").expense);
    expect(accountBalance(next, "a")).toBe(accountBalance(state, "a") - 80);
  });
  it("keeps later contributions on top of the last valuation", () => {
    const inv: Investment = {
      id: "i",
      name: "CDB",
      kind: "fixa",
      contributions: [
        { date: "2026-01-01", amount: 100 },
        { date: "2026-03-01", amount: 50 },
      ],
      history: [{ date: "2026-02-01", value: 110 }],
    };
    expect(investmentValue(inv)).toBe(160);
  });
  it("warns when a category reaches 80% of its limit and projects recurring items", () => {
    const state: FinanceState = { ...base, categoryLimits: { Lazer: 100 }, monthlyBudget: 0 };
    expect(spendingAlerts(state, "2026-10").map((a) => a.name)).toContain("Lazer");
    const withRecurring: FinanceState = {
      ...base,
      transactions: [
        ...base.transactions,
        {
          id: "r",
          description: "Aluguel",
          amount: 900,
          type: "despesa",
          category: "Moradia",
          accountId: "a",
          date: "2026-09-05",
          paymentMethod: "Pix",
          status: "pago",
          recurring: true,
        },
      ],
      cards: [{ id: "c", name: "Visa", limit: 1, closingDay: 1, dueDay: 12 }],
    };
    const october = calendarEvents(withRecurring, "2026-10");
    expect(
      october.some(
        (e) => e.kind === "recorrente" && e.title === "Aluguel" && e.date === "2026-10-05",
      ),
    ).toBe(true);
    expect(october.some((e) => e.kind === "cartao" && e.date === "2026-10-12")).toBe(true);
  });
  it("adds money in cents", () => {
    const state: FinanceState = {
      ...base,
      accounts: [{ id: "a", name: "C", type: "corrente", initialBalance: 0.1 }],
      transactions: [
        {
          id: "1",
          description: "s",
          amount: 0.2,
          type: "receita",
          category: "Salário",
          accountId: "a",
          date: "2026-10-05",
          paymentMethod: "Pix",
          status: "recebido",
        },
      ],
      transfers: [],
    };
    expect(accountBalance(state, "a")).toBe(0.3);
  });
  it("debits the source account when a contribution names one", () => {
    const state: FinanceState = {
      ...base,
      investments: [{ id: "i", name: "CDB", kind: "fixa", contributions: [], history: [] }],
    };
    const funded = applyContribution(state, "i", 500, "2026-11-05", "a");
    expect(accountBalance(funded, "a")).toBe(accountBalance(state, "a") - 500);
    expect(investmentValue(funded.investments[0]!)).toBe(500);
    expect(netWorth(funded)).toBe(netWorth(state));
    const outside = applyContribution(state, "i", 500, "2026-11-05");
    expect(accountBalance(outside, "a")).toBe(accountBalance(state, "a"));
    expect(netWorth(outside)).toBe(netWorth(state) + 500);
  });
  it("labels invoices that have not closed yet as future", () => {
    const card = { id: "c", name: "Visa", limit: 1000, closingDay: 28, dueDay: 8 };
    const open = invoiceMonth(card, today());
    const future = addMonths(open, 2);
    const past = addMonths(open, -2);
    const purchase = (id: string, month: string, status: "pendente" | "pago") => ({
      id,
      description: id,
      amount: 40,
      type: "despesa" as const,
      category: "Compras",
      accountId: "",
      cardId: "c",
      date: `${month}-01`,
      paymentMethod: "Cartão de crédito",
      status,
    });
    const state: FinanceState = {
      ...base,
      cards: [card],
      transactions: [
        purchase("past", past, "pendente"),
        purchase("open", open, "pendente"),
        purchase("future", future, "pendente"),
        purchase("paid", addMonths(open, -3), "pago"),
      ],
    };
    const byMonth = new Map(
      cardInvoices(state, card).map((invoice) => [invoice.month, invoice.status]),
    );
    expect(byMonth.get(past)).toBe("fechada");
    expect(byMonth.get(open)).toBe("aberta");
    expect(byMonth.get(future)).toBe("futura");
    expect(byMonth.get(addMonths(open, -3))).toBe("paga");
  });
});
