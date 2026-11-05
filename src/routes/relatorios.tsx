import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app-shell";
import { addMonths, brl, endOfMonth, expensesByCategory, lastMonths, monthKey, monthLabel, monthTotals, netWorth, totalBalance, useFinance } from "@/lib/finance";
import { exportCsv, exportPdf } from "@/lib/export";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [
    { title: "Relatórios — Saldo" },
    { name: "description", content: "Resumo mensal e anual, com exportação em CSV e PDF." },
    { property: "og:title", content: "Relatórios — Saldo" },
    { property: "og:description", content: "Resumo mensal e anual, com exportação em CSV e PDF." },
  ] }),
  component: Page,
});

type Mode = "mes" | "ano" | "periodo";
const axis = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false };

function Page() {
  const s = useFinance();
  const now = monthKey(new Date());
  const [mode, setMode] = useState<Mode>("mes");
  const [month, setMonth] = useState(now);
  const [year, setYear] = useState(now.slice(0, 4));
  const [from, setFrom] = useState(addMonths(now, -5));
  const [to, setTo] = useState(now);

  const range = mode === "mes" ? [month] : mode === "ano" ? lastMonths(12, `${year}-12`) : monthsBetween(from, to);
  const start = range[0] ? `${range[0]}-01` : `${now}-01`;
  const end = range.at(-1) ? endOfMonth(range.at(-1)!) : endOfMonth(now);
  const summary = range.reduce((acc, k) => { const t = monthTotals(s, k); return { income: acc.income + t.income, expense: acc.expense + t.expense, net: acc.net + t.net }; }, { income: 0, expense: 0, net: 0 });
  const categories = expensesByCategory(s, range[0] ?? now, range.at(-1) ?? now);
  const flow = range.map((k) => ({ name: monthLabel(k), ...monthTotals(s, k), patrimonio: netWorth(s, endOfMonth(k)) }));

  function exportBoth(kind: "csv" | "pdf") {
    if (!range.length) { toast.error("Escolha um período válido."); return; }
    if (kind === "csv") exportCsv(s, start, end);
    else exportPdf(s, start, end, summary, categories);
  }

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Tudo calculado a partir das movimentações que você cadastrou.">
        <Button variant="outline" onClick={() => exportBoth("csv")}><FileText className="h-4 w-4" />CSV</Button>
        <Button onClick={() => exportBoth("pdf")}>PDF</Button>
      </PageHeader>
      <div className="panel mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="flex rounded-xl bg-muted p-1">
          {([["mes", "Mês"], ["ano", "Ano"], ["periodo", "Período"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setMode(id)} className={`rounded-lg px-3 py-1.5 text-sm ${mode === id ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>{label}</button>
          ))}
        </div>
        {mode === "mes" && <Field label="Mês"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>}
        {mode === "ano" && <Field label="Ano"><Input type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} /></Field>}
        {mode === "periodo" && (
          <>
            <Field label="De"><Input type="month" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Até"><Input type="month" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Receitas" value={summary.income} tone="text-income" />
        <Summary label="Despesas" value={summary.expense} tone="text-expense" />
        <Summary label="Resultado" value={summary.net} tone={summary.net >= 0 ? "text-income" : "text-expense"} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Saldo disponível hoje: {brl(totalBalance(s))} · Patrimônio no fim do período: {brl(netWorth(s, end))}</p>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="panel p-5">
          <h3 className="mb-4 font-semibold">Fluxo de caixa</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={flow}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" {...axis} /><YAxis {...axis} width={48} />
              <Tooltip formatter={(v) => brl(Number(v))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Bar dataKey="income" name="Receitas" fill="var(--income)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Despesas" fill="var(--expense)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel p-5">
          <h3 className="mb-4 font-semibold">Evolução do patrimônio</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={flow}>
              <XAxis dataKey="name" {...axis} /><YAxis {...axis} width={48} />
              <Tooltip formatter={(v) => brl(Number(v))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Line dataKey="patrimonio" name="Patrimônio" stroke="var(--chart-4)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel mt-4 overflow-hidden">
        <h3 className="p-5 font-semibold">Gastos por categoria</h3>
        {categories.length === 0 ? <p className="px-5 pb-6 text-sm text-muted-foreground">Nenhuma despesa neste período.</p> : (
          <ul className="divide-y divide-border">
            {categories.map((c) => (
              <li key={c.name} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="flex-1">{c.name}</span>
                <span className="text-muted-foreground">{summary.expense ? `${((c.value / summary.expense) * 100).toFixed(0)}%` : ""}</span>
                <span className="font-semibold tabular-nums text-expense">{brl(c.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="panel mt-4 overflow-x-auto">
        <h3 className="p-5 font-semibold">Mês a mês</h3>
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="border-y border-border text-left text-xs text-muted-foreground">{["Mês", "Receitas", "Despesas", "Resultado"].map((h) => <th key={h} className="px-5 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {flow.map((f) => (
              <tr key={f.name} className="border-b border-border">
                <td className="px-5 py-2">{f.name}</td>
                <td className="px-5 py-2 text-income">{brl(f.income)}</td>
                <td className="px-5 py-2 text-expense">{brl(f.expense)}</td>
                <td className="px-5 py-2">{brl(f.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function monthsBetween(from: string, to: string) {
  if (!from || !to || from > to) return [];
  const out: string[] = [];
  let k = from;
  while (k <= to && out.length < 36) { out.push(k); k = addMonths(k, 1); }
  return out;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1"><Label>{label}</Label>{children}</div>;
}
function Summary({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="panel p-5"><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-2 font-display text-2xl font-semibold tabular-nums ${tone}`}>{brl(value)}</p></div>;
}
