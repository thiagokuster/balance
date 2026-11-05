import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { brl, download, fmtDate, toCSV, type FinanceState, type Transaction } from "./finance";

function accountName(s: FinanceState, t: Transaction) {
  if (t.cardId) return s.cards.find((c) => c.id === t.cardId)?.name ?? "Cartão";
  return s.accounts.find((a) => a.id === t.accountId)?.name ?? "";
}

export function transactionsInRange(s: FinanceState, from: string, to: string) {
  return s.transactions.filter((t) => t.date >= from && t.date <= to).sort((a, b) => a.date.localeCompare(b.date));
}

export function exportCsv(s: FinanceState, from: string, to: string) {
  const rows: (string | number)[][] = [["Data", "Tipo", "Descrição", "Categoria", "Conta", "Pagamento", "Status", "Valor"]];
  for (const t of transactionsInRange(s, from, to)) {
    rows.push([fmtDate(t.date), t.type, t.description, t.category, accountName(s, t), t.paymentMethod, t.status, t.amount.toFixed(2).replace(".", ",")]);
  }
  for (const tr of s.transfers.filter((t) => t.date >= from && t.date <= to)) {
    const fromName = s.accounts.find((a) => a.id === tr.fromId)?.name ?? tr.fromId;
    const toName = tr.toId.startsWith("card:") ? `Fatura ${s.cards.find((c) => `card:${c.id}` === tr.toId)?.name ?? ""}` : s.accounts.find((a) => a.id === tr.toId)?.name ?? tr.toId;
    rows.push([fmtDate(tr.date), "transferência", `${fromName} → ${toName}`, "", "", "", "", tr.amount.toFixed(2).replace(".", ",")]);
  }
  download(`saldo-${from}-a-${to}.csv`, toCSV(rows));
}

export function exportPdf(s: FinanceState, from: string, to: string, summary: { income: number; expense: number; net: number }, categories: { name: string; value: number }[]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Saldo — Relatório financeiro", 14, 18);
  doc.setFontSize(10);
  doc.text(`Período: ${fmtDate(from)} a ${fmtDate(to)}`, 14, 26);
  doc.text(`Receitas ${brl(summary.income)}    Despesas ${brl(summary.expense)}    Resultado ${brl(summary.net)}`, 14, 32);
  autoTable(doc, {
    startY: 38,
    head: [["Categoria", "Gastos"]],
    body: categories.length ? categories.map((c) => [c.name, brl(c.value)]) : [["Sem despesas no período", "—"]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 30, 30] },
  });
  const txs = transactionsInRange(s, from, to).slice(0, 400);
  autoTable(doc, {
    head: [["Data", "Tipo", "Descrição", "Categoria", "Valor"]],
    body: txs.map((t) => [fmtDate(t.date), t.type, t.description, t.category, brl(t.type === "despesa" ? -t.amount : t.amount)]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 30, 30] },
  });
  if (transactionsInRange(s, from, to).length > txs.length) {
    const y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 280;
    doc.text("Lista limitada às 400 primeiras movimentações. O CSV traz a lista completa.", 14, Math.min(y + 8, 290));
  }
  doc.save(`saldo-${from}-a-${to}.pdf`);
}
