import { useSyncExternalStore } from "react";
import { parseFinanceState } from "./finance-schema";
import { createSession, isEncryptedVault, legacyPasswordMatches, openState, sealState, VAULT_ITERATIONS, type VaultSession } from "./vault";

export type TxType = "receita" | "despesa";
export type TxStatus = "pago" | "pendente" | "recebido";
export type AccountType = "corrente" | "poupanca" | "dinheiro" | "investimentos";

export interface Account { id: string; name: string; type: AccountType; initialBalance: number }
export interface Transaction {
  id: string; description: string; amount: number; type: TxType; category: string;
  accountId: string; cardId?: string; date: string; paymentMethod: string; status: TxStatus;
  notes?: string; recurring?: boolean; installment?: string; groupId?: string;
}
export interface Transfer { id: string; fromId: string; toId: string; amount: number; date: string; note?: string }
export interface Card { id: string; name: string; limit: number; closingDay: number; dueDay: number }
export interface Goal { id: string; name: string; kind: "meta" | "reserva" | "compra"; target: number; current: number; deadline?: string }
export interface Investment {
  id: string; name: string; kind: "fixa" | "variavel";
  contributions: { date: string; amount: number }[];
  history: { date: string; value: number }[];
}
export interface FinanceState {
  accounts: Account[]; transactions: Transaction[]; transfers: Transfer[]; cards: Card[];
  goals: Goal[]; investments: Investment[];
  monthlyBudget: number; categoryLimits: Record<string, number>;
}

export const INCOME_CATEGORIES = ["Salário", "Freelance", "Rendimentos", "Vendas", "Presente", "Outros"];
export const EXPENSE_CATEGORIES = ["Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Compras", "Assinaturas", "Contas", "Viagem", "Outros"];
export const PAYMENT_METHODS = ["Pix", "Débito", "Dinheiro", "Boleto", "Transferência", "Cartão de crédito"];
export const ACCOUNT_LABEL: Record<AccountType, string> = { corrente: "Conta corrente", poupanca: "Poupança", dinheiro: "Carteira", investimentos: "Investimentos" };

const KEY = "financas-pessoais-v1";
const LEGACY_HASH_KEY = "financas-pin-hash";
const empty: FinanceState = { accounts: [], transactions: [], transfers: [], cards: [], goals: [], investments: [], monthlyBudget: 0, categoryLimits: {} };

let state: FinanceState = empty;
let loaded = false;
let protectedAtRest = false;
let session: VaultSession | null = null;
let pendingPlain: FinanceState | null = null;
let writeQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

export type VaultStatus = "off" | "locked" | "open";

function notify() { listeners.forEach((l) => l()); }

function vaultStatus(): VaultStatus {
  load();
  if (!protectedAtRest) return "off";
  return session ? "open" : "locked";
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const json: unknown = JSON.parse(raw);
    if (isEncryptedVault(json)) {
      protectedAtRest = true;
      state = empty;
      return;
    }
    const parsed = parseFinanceState(json);
    if (!parsed) return;
    if (localStorage.getItem(LEGACY_HASH_KEY)) {
      protectedAtRest = true;
      pendingPlain = parsed;
      state = empty;
      return;
    }
    state = parsed;
  } catch { /* keep the previous copy; never replace it with an empty file */ }
}

function subscribe(l: () => void) { load(); listeners.add(l); return () => listeners.delete(l); }

function persist(snapshot: FinanceState): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const current = session;
  const job = writeQueue.then(async () => {
    if (current) {
      localStorage.setItem(KEY, JSON.stringify(await sealState(snapshot, current)));
      localStorage.removeItem(LEGACY_HASH_KEY);
      return;
    }
    if (!protectedAtRest) localStorage.setItem(KEY, JSON.stringify(snapshot));
  });
  writeQueue = job.catch(() => undefined);
  return job;
}

export function update(fn: (s: FinanceState) => FinanceState) {
  load();
  if (protectedAtRest && !session) return;
  state = fn(state);
  void persist(state);
  notify();
}
export function replaceAll(s: FinanceState) {
  const parsed = parseFinanceState(s);
  update(() => parsed ?? empty);
}
export function useFinance() {
  return useSyncExternalStore(subscribe, () => { load(); return state; }, () => empty);
}
export function useVaultStatus() {
  return useSyncExternalStore(subscribe, vaultStatus, () => "off" as const);
}

export async function unlockVault(password: string, iterations = VAULT_ITERATIONS) {
  load();
  const raw = typeof window === "undefined" ? null : localStorage.getItem(KEY);
  if (raw) {
    try {
      const json: unknown = JSON.parse(raw);
      if (isEncryptedVault(json)) {
        const opened = await openState(json, password);
        session = opened.session;
        state = opened.state;
        pendingPlain = null;
        protectedAtRest = true;
        notify();
        return true;
      }
    } catch (error) {
      if (error instanceof Error && (error.message === "vault-auth" || error.message === "vault-format")) return false;
      return false;
    }
  }
  const legacy = typeof window === "undefined" ? null : localStorage.getItem(LEGACY_HASH_KEY);
  if (pendingPlain && legacy && await legacyPasswordMatches(password, legacy)) {
    session = await createSession(password, iterations);
    state = pendingPlain;
    pendingPlain = null;
    protectedAtRest = true;
    await persist(state);
    notify();
    return true;
  }
  return false;
}

export async function enableVault(password: string, iterations = VAULT_ITERATIONS) {
  load();
  if (protectedAtRest) return;
  if (password.length < 8 || password.length > 128) throw new Error("vault-password");
  await writeQueue;
  session = await createSession(password, iterations);
  protectedAtRest = true;
  await persist(state);
  notify();
}

export async function disableVault(password: string) {
  load();
  if (!protectedAtRest) return true;
  await writeQueue;
  const legacy = typeof window === "undefined" ? null : localStorage.getItem(LEGACY_HASH_KEY);
  if (pendingPlain && legacy && await legacyPasswordMatches(password, legacy)) {
    session = null;
    protectedAtRest = false;
    state = pendingPlain;
    pendingPlain = null;
    localStorage.removeItem(LEGACY_HASH_KEY);
    localStorage.setItem(KEY, JSON.stringify(state));
    notify();
    return true;
  }
  const raw = typeof window === "undefined" ? null : localStorage.getItem(KEY);
  if (!raw) return false;
  let confirmed: FinanceState;
  try {
    const json: unknown = JSON.parse(raw);
    if (!isEncryptedVault(json)) return false;
    confirmed = (await openState(json, password)).state;
  } catch {
    return false;
  }
  session = null;
  protectedAtRest = false;
  state = confirmed;
  localStorage.removeItem(LEGACY_HASH_KEY);
  localStorage.setItem(KEY, JSON.stringify(state));
  notify();
  return true;
}

export function lockSession() {
  load();
  if (!protectedAtRest) return;
  session = null;
  state = empty;
  notify();
}

export function peekFinance() {
  load();
  return state;
}

export function flushVaultWrites() {
  return writeQueue;
}

export function resetFinanceStore() {
  state = empty;
  loaded = false;
  protectedAtRest = false;
  session = null;
  pendingPlain = null;
  writeQueue = Promise.resolve();
}

export const uid = () => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("") + Date.now().toString(36);
};
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const monthKey = (d: string | Date) => (typeof d === "string" ? d.slice(0, 7) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
export const today = () => { const d = new Date(); return `${monthKey(d)}-${String(d.getDate()).padStart(2, "0")}`; };
export const fmtDate = (d: string) => d.split("-").reverse().join("/");
export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const monthLabel = (k: string) => `${MONTHS[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`;
export function addMonths(k: string, n: number) {
  const [y = 0, m = 1] = k.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return monthKey(d);
}
export function lastMonths(n: number, end = monthKey(new Date())) {
  return Array.from({ length: n }, (_, i) => addMonths(end, i - n + 1));
}

const settled = (t: Transaction) => t.status !== "pendente";

/** Balance of an account up to (and including) a date. Card purchases do not hit accounts; invoice payments are transfers. */
export function accountBalance(s: FinanceState, id: string, until = "9999-12-31") {
  const a = s.accounts.find((x) => x.id === id); if (!a) return 0;
  let b = a.initialBalance;
  for (const t of s.transactions) {
    if (t.accountId !== id || t.cardId || !settled(t) || t.date > until) continue;
    b += t.type === "receita" ? t.amount : -t.amount;
  }
  for (const tr of s.transfers) {
    if (tr.date > until) continue;
    if (tr.fromId === id) b -= tr.amount;
    if (tr.toId === id) b += tr.amount;
  }
  return b;
}
export const totalBalance = (s: FinanceState, until?: string) => s.accounts.reduce((acc, a) => acc + accountBalance(s, a.id, until), 0);

/** Latest manual valuation, plus aportes made after that snapshot. */
export function investmentValue(inv: Investment, until = "9999-12-31") {
  const history = inv.history.filter((x) => x.date <= until).sort((a, b) => a.date.localeCompare(b.date));
  const contributions = inv.contributions.filter((c) => c.date <= until);
  if (!history.length) return contributions.reduce((a, c) => a + c.amount, 0);
  const last = history[history.length - 1]!;
  const later = contributions.filter((c) => c.date > last.date).reduce((a, c) => a + c.amount, 0);
  return last.value + later;
}
export const investedTotal = (inv: Investment) => inv.contributions.reduce((a, c) => a + c.amount, 0);
export const totalInvested = (s: FinanceState, until?: string) => s.investments.reduce((a, i) => a + investmentValue(i, until), 0);

export function monthTotals(s: FinanceState, k: string) {
  let income = 0, expense = 0;
  for (const t of s.transactions) {
    if (monthKey(t.date) !== k) continue;
    if (t.type === "receita") income += t.amount; else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}
export function expensesByCategory(s: FinanceState, from: string, to: string) {
  const map: Record<string, number> = {};
  for (const t of s.transactions) if (t.type === "despesa" && monthKey(t.date) >= from && monthKey(t.date) <= to) map[t.category] = (map[t.category] ?? 0) + t.amount;
  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
export const endOfMonth = (k: string) => { const [y = 0, m = 1] = k.split("-").map(Number); return `${k}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`; };
export const netWorth = (s: FinanceState, until?: string) => totalBalance(s, until) + totalInvested(s, until) - cardDebt(s, until);

/** Invoice month a card purchase belongs to: purchases after closing day go to next month's invoice. */
export function invoiceMonth(card: Card, date: string) {
  const day = Number(date.slice(8, 10));
  return day > card.closingDay ? addMonths(monthKey(date), 1) : monthKey(date);
}
export function cardDebt(s: FinanceState, until = "9999-12-31") {
  return s.transactions.filter((t) => t.cardId && t.status === "pendente" && t.date <= until).reduce((a, t) => a + t.amount, 0);
}
export function cardAvailable(s: FinanceState, card: Card) {
  const used = s.transactions.filter((t) => t.cardId === card.id && t.status === "pendente").reduce((a, t) => a + t.amount, 0);
  return card.limit - used;
}

export interface CardInvoice {
  month: string;
  txs: Transaction[];
  total: number;
  pending: number;
  status: "aberta" | "fechada" | "paga";
}

export function cardInvoices(s: FinanceState, card: Card): CardInvoice[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of s.transactions) {
    if (t.cardId !== card.id) continue;
    const month = invoiceMonth(card, t.date);
    const list = groups.get(month) ?? [];
    list.push(t);
    groups.set(month, list);
  }
  const open = invoiceMonth(card, today());
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, txs]) => {
      const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date));
      const total = sorted.reduce((a, t) => a + t.amount, 0);
      const pending = sorted.filter((t) => t.status === "pendente").reduce((a, t) => a + t.amount, 0);
      const status = month === open ? "aberta" : pending > 0 ? "fechada" : "paga";
      return { month, txs: sorted, total, pending, status };
    });
}

/** Paying a bill is a transfer: it lowers the account and does not count again as an expense. */
export function applyInvoicePayment(s: FinanceState, cardId: string, month: string, accountId: string, date: string): FinanceState {
  const card = s.cards.find((c) => c.id === cardId);
  if (!card || !s.accounts.some((a) => a.id === accountId)) return s;
  let amount = 0;
  const transactions = s.transactions.map((t) => {
    if (t.cardId === cardId && t.status === "pendente" && invoiceMonth(card, t.date) === month) {
      amount = Math.round((amount + t.amount) * 100) / 100;
      return { ...t, status: "pago" as const };
    }
    return t;
  });
  if (amount <= 0) return s;
  return {
    ...s,
    transactions,
    transfers: [...s.transfers, { id: uid(), fromId: accountId, toId: `card:${cardId}`, amount, date, note: `Fatura ${monthLabel(month)}` }],
  };
}

export function payInvoice(cardId: string, month: string, accountId: string, date: string) {
  let applied = false;
  update((s) => {
    const next = applyInvoicePayment(s, cardId, month, accountId, date);
    applied = next !== s;
    return next;
  });
  return applied;
}

export interface SpendingAlert { name: string; spent: number; limit: number }

export function spendingAlerts(s: FinanceState, k = monthKey(new Date())): SpendingAlert[] {
  const alerts: SpendingAlert[] = [];
  const spentByCategory = expensesByCategory(s, k, k);
  const expense = monthTotals(s, k).expense;
  if (s.monthlyBudget > 0 && expense >= s.monthlyBudget * 0.8) alerts.push({ name: "Orçamento mensal", spent: expense, limit: s.monthlyBudget });
  for (const [name, limit] of Object.entries(s.categoryLimits)) {
    if (!(limit > 0)) continue;
    const spent = spentByCategory.find((c) => c.name === name)?.value ?? 0;
    if (spent >= limit * 0.8) alerts.push({ name, spent, limit });
  }
  return alerts;
}

export type CalKind = "pagar" | "receber" | "cartao" | "recorrente" | "prevista";
export interface CalEvent { date: string; title: string; kind: CalKind; amount?: number }

function dayInMonth(month: string, day: number) {
  const last = Number(endOfMonth(month).slice(8, 10));
  return `${month}-${String(Math.min(Math.max(day, 1), last)).padStart(2, "0")}`;
}

export function calendarEvents(s: FinanceState, month: string): CalEvent[] {
  const events: CalEvent[] = [];
  for (const t of s.transactions) {
    if (monthKey(t.date) !== month) continue;
    if (t.status === "pendente") {
      events.push({ date: t.date, title: t.recurring ? `${t.description} · recorrente` : t.description, kind: t.type === "despesa" ? "pagar" : "receber", amount: t.amount });
    } else if (t.recurring) {
      events.push({ date: t.date, title: t.description, kind: t.type === "despesa" ? "recorrente" : "prevista", amount: t.amount });
    }
  }
  const projected = new Set<string>();
  for (const t of s.transactions) {
    if (!t.recurring || monthKey(t.date) >= month) continue;
    const key = `${t.type}|${t.description}|${t.category}`;
    if (projected.has(key)) continue;
    if (s.transactions.some((x) => x.recurring && x.type === t.type && x.description === t.description && monthKey(x.date) === month)) continue;
    projected.add(key);
    events.push({ date: dayInMonth(month, Number(t.date.slice(8, 10))), title: t.description, kind: t.type === "despesa" ? "recorrente" : "prevista", amount: t.amount });
  }
  for (const c of s.cards) events.push({ date: dayInMonth(month, c.dueDay), title: `Vencimento ${c.name}`, kind: "cartao" });
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/** Creates transactions; card purchases with N installments are split month by month. */
export function addTransaction(t: Omit<Transaction, "id">, installments = 1) {
  update((s) => {
    if (t.cardId && installments > 1) {
      const groupId = uid();
      const per = Math.round((t.amount / installments) * 100) / 100;
      const list: Transaction[] = Array.from({ length: installments }, (_, i) => {
        const k = addMonths(monthKey(t.date), i);
        const day = Math.min(Number(t.date.slice(8, 10)), Number(endOfMonth(k).slice(8, 10)));
        const amount = i === installments - 1 ? Math.round((t.amount - per * (installments - 1)) * 100) / 100 : per;
        return { ...t, id: uid(), amount, date: `${k}-${String(day).padStart(2, "0")}`, installment: `${i + 1}/${installments}`, groupId };
      });
      return { ...s, transactions: [...s.transactions, ...list] };
    }
    return { ...s, transactions: [...s.transactions, { ...t, id: uid() }] };
  });
}

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function toCSV(rows: (string | number)[][]) {
  return rows.map((r) => r.map(csvCell).join(";")).join("\n");
}
export function download(name: string, content: string, type = "text/csv;charset=utf-8") {
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "saldo.csv";
  const blob = new Blob(["\ufeff" + content], { type });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = safeName; a.click();
  URL.revokeObjectURL(a.href);
}
