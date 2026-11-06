import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import {
  brl,
  download,
  fmtDate,
  toCSV,
  transferPartyName,
  type FinanceState,
  type Transaction,
} from "./finance";
import { parseFinanceState } from "./finance-schema";
import { isEncryptedVault, type VaultPayload } from "./vault";

function accountName(s: FinanceState, t: Transaction) {
  if (t.cardId) return s.cards.find((c) => c.id === t.cardId)?.name ?? "Cartão";
  return s.accounts.find((a) => a.id === t.accountId)?.name ?? "";
}

export function transactionsInRange(s: FinanceState, from: string, to: string) {
  return s.transactions
    .filter((t) => t.date >= from && t.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function exportCsv(s: FinanceState, from: string, to: string) {
  const rows: (string | number)[][] = [
    ["Data", "Tipo", "Descrição", "Categoria", "Conta", "Pagamento", "Status", "Valor"],
  ];
  for (const t of transactionsInRange(s, from, to)) {
    rows.push([
      fmtDate(t.date),
      t.type,
      t.description,
      t.category,
      accountName(s, t),
      t.paymentMethod,
      t.status,
      t.amount.toFixed(2).replace(".", ","),
    ]);
  }
  for (const tr of s.transfers.filter((t) => t.date >= from && t.date <= to)) {
    const fromName = transferPartyName(s, tr.fromId, "from");
    const toName = transferPartyName(s, tr.toId, "to");
    rows.push([
      fmtDate(tr.date),
      "transferência",
      `${fromName} → ${toName}`,
      "",
      "",
      "",
      "",
      tr.amount.toFixed(2).replace(".", ","),
    ]);
  }
  download(`saldo-${from}-a-${to}.csv`, toCSV(rows));
}

export function exportPdf(
  s: FinanceState,
  from: string,
  to: string,
  summary: { income: number; expense: number; net: number },
  categories: { name: string; value: number }[],
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Saldo — Relatório financeiro", 14, 18);
  doc.setFontSize(10);
  doc.text(`Período: ${fmtDate(from)} a ${fmtDate(to)}`, 14, 26);
  doc.text(
    `Receitas ${brl(summary.income)}    Despesas ${brl(summary.expense)}    Resultado ${brl(summary.net)}`,
    14,
    32,
  );
  autoTable(doc, {
    startY: 38,
    head: [["Categoria", "Gastos"]],
    body: categories.length
      ? categories.map((c) => [c.name, brl(c.value)])
      : [["Sem despesas no período", "—"]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 30, 30] },
  });
  const txs = transactionsInRange(s, from, to).slice(0, 400);
  autoTable(doc, {
    head: [["Data", "Tipo", "Descrição", "Categoria", "Valor"]],
    body: txs.map((t) => [
      fmtDate(t.date),
      t.type,
      t.description,
      t.category,
      brl(t.type === "despesa" ? -t.amount : t.amount),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 30, 30] },
  });
  if (transactionsInRange(s, from, to).length > txs.length) {
    const y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 280;
    doc.text(
      "Lista limitada às 400 primeiras movimentações. O CSV traz a lista completa.",
      14,
      Math.min(y + 8, 290),
    );
  }
  doc.save(`saldo-${from}-a-${to}.pdf`);
}

export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

export type BackupContents = { exportedAt?: string } & (
  { kind: "plain"; state: FinanceState } | { kind: "sealed"; payload: VaultPayload }
);

function exportedAtOf(record: object) {
  const value = (record as { exportedAt?: unknown }).exportedAt;
  return typeof value === "string" && value.length <= 40 ? value : undefined;
}

export function readBackup(text: string): BackupContents | null {
  if (text.length > MAX_BACKUP_BYTES) return null;
  try {
    const json: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
    if (typeof json !== "object" || json === null) return null;
    const record = json as { app?: unknown; state?: unknown; sealed?: unknown };
    const exportedAt = exportedAtOf(record);
    if (record.app === "saldo" && isEncryptedVault(record.sealed)) {
      return exportedAt
        ? { kind: "sealed", payload: record.sealed, exportedAt }
        : { kind: "sealed", payload: record.sealed };
    }
    const plain = parseFinanceState(record.app === "saldo" ? record.state : json);
    if (!plain) return null;
    return exportedAt
      ? { kind: "plain", state: plain, exportedAt }
      : { kind: "plain", state: plain };
  } catch {
    return null;
  }
}
