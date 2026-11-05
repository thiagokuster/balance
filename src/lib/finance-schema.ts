import { z } from "zod";
import type { FinanceState } from "./finance";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().finite().min(-1e12).max(1e12);
const id = z.string().min(1).max(40);
const label = z.string().trim().min(1).max(120);

const account = z.object({
  id,
  name: label,
  type: z.enum(["corrente", "poupanca", "dinheiro", "investimentos"]),
  initialBalance: money,
});

const transaction = z.object({
  id,
  description: label,
  amount: z.number().finite().positive().max(1e12),
  type: z.enum(["receita", "despesa"]),
  category: z.string().trim().min(1).max(40),
  accountId: z.string().max(40),
  cardId: z.string().min(1).max(40).optional(),
  date,
  paymentMethod: z.string().trim().min(1).max(40),
  status: z.enum(["pago", "pendente", "recebido"]),
  notes: z.string().max(500).optional(),
  recurring: z.boolean().optional(),
  installment: z.string().max(12).optional(),
  groupId: z.string().min(1).max(40).optional(),
});

const transfer = z.object({
  id,
  fromId: z.string().min(1).max(80),
  toId: z.string().min(1).max(80),
  amount: z.number().finite().positive().max(1e12),
  date,
  note: z.string().max(100).optional(),
});

const card = z.object({
  id,
  name: label,
  limit: z.number().finite().positive().max(1e12),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
});

const goal = z.object({
  id,
  name: label,
  kind: z.enum(["meta", "reserva", "compra"]),
  target: z.number().finite().positive().max(1e12),
  current: z.number().finite().min(0).max(1e12),
  deadline: date.optional(),
});

const investment = z.object({
  id,
  name: label,
  kind: z.enum(["fixa", "variavel"]),
  contributions: z.array(z.object({ date, amount: z.number().finite().positive().max(1e12) })).max(5000),
  history: z.array(z.object({ date, value: z.number().finite().min(0).max(1e12) })).max(5000),
});

const financeStateSchema = z.object({
  accounts: z.array(account).max(200),
  transactions: z.array(transaction).max(20000),
  transfers: z.array(transfer).max(20000),
  cards: z.array(card).max(50),
  goals: z.array(goal).max(200),
  investments: z.array(investment).max(200),
  monthlyBudget: z.number().finite().min(0).max(1e12),
  categoryLimits: z.record(z.string().min(1).max(40), z.number().finite().min(0).max(1e12)),
});

/** Rejects unexpected shapes from localStorage instead of spreading them into state. */
export function parseFinanceState(value: unknown): FinanceState | null {
  const parsed = financeStateSchema.safeParse(value);
  if (!parsed.success) return null;
  return JSON.parse(JSON.stringify(parsed.data)) as FinanceState;
}
