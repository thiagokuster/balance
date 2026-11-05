import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app-shell";
import {
  addMonths,
  brl,
  endOfMonth,
  expensesByCategory,
  lastMonths,
  monthKey,
  monthLabel,
  monthTotals,
  netWorth,
  downloadEncryptedBackup,
  replaceAll,
  totalBalance,
  useFinance,
  vaultIsOpen,
} from "@/lib/finance";
import { exportCsv, exportPdf, MAX_BACKUP_BYTES, readBackup } from "@/lib/export";
import { passwordIssue } from "@/lib/password";
import { PasswordMeter } from "@/components/password-meter";
import { openState, type VaultPayload } from "@/lib/vault";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Saldo" },
      { name: "description", content: "Resumo mensal e anual, com CSV, PDF e backup JSON." },
      { property: "og:title", content: "Relatórios — Saldo" },
      { property: "og:description", content: "Resumo mensal e anual, com CSV, PDF e backup JSON." },
    ],
  }),
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
  const [exportPassword, setExportPassword] = useState("");
  const [exportAgain, setExportAgain] = useState("");
  const [askExportPassword, setAskExportPassword] = useState(false);
  const [sealed, setSealed] = useState<VaultPayload | null>(null);
  const [restorePassword, setRestorePassword] = useState("");

  const range =
    mode === "mes"
      ? [month]
      : mode === "ano"
        ? lastMonths(12, `${year}-12`)
        : monthsBetween(from, to);
  const start = range[0] ? `${range[0]}-01` : `${now}-01`;
  const end = range.at(-1) ? endOfMonth(range.at(-1)!) : endOfMonth(now);
  const summary = range.reduce(
    (acc, k) => {
      const t = monthTotals(s, k);
      return {
        income: Math.round((acc.income + t.income) * 100) / 100,
        expense: Math.round((acc.expense + t.expense) * 100) / 100,
        net: Math.round((acc.net + t.net) * 100) / 100,
      };
    },
    { income: 0, expense: 0, net: 0 },
  );
  const categories = expensesByCategory(s, range[0] ?? now, range.at(-1) ?? now);
  const flow = range.map((k) => ({
    name: monthLabel(k),
    ...monthTotals(s, k),
    patrimonio: netWorth(s, endOfMonth(k)),
  }));

  function exportBoth(kind: "csv" | "pdf") {
    if (!range.length) {
      toast.error("Escolha um período válido.");
      return;
    }
    if (kind === "csv") exportCsv(s, start, end);
    else exportPdf(s, start, end, summary, categories);
    toast.message("O arquivo ficou legível na pasta de Downloads.");
  }

  async function backup() {
    try {
      if (vaultIsOpen()) {
        await downloadEncryptedBackup();
        toast.success("Backup criptografado salvo");
        return;
      }
      setAskExportPassword(true);
    } catch {
      toast.error("Não foi possível gerar o backup.");
    }
  }

  async function backupWithPassword(e: React.FormEvent) {
    e.preventDefault();
    const issue = passwordIssue(exportPassword);
    if (issue) {
      toast.error(issue);
      return;
    }
    if (exportPassword !== exportAgain) {
      toast.error("As senhas não coincidem.");
      return;
    }
    try {
      await downloadEncryptedBackup(exportPassword);
      setExportPassword("");
      setExportAgain("");
      setAskExportPassword(false);
      toast.success("Backup criptografado salvo");
    } catch {
      toast.error("Não foi possível gerar o backup.");
    }
  }

  function restore(file: File) {
    if (file.size > MAX_BACKUP_BYTES) {
      toast.error("Esse arquivo é grande demais para restaurar.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = readBackup(String(reader.result ?? ""));
      if (!parsed) {
        toast.error("Esse arquivo não é um backup do Saldo.");
        return;
      }
      if (parsed.kind === "sealed") {
        setRestorePassword("");
        setSealed(parsed.payload);
        return;
      }
      if (!window.confirm("Isso substitui contas, lançamentos e metas deste navegador.")) return;
      replaceAll(parsed.state);
      toast.success("Backup restaurado");
    };
    reader.readAsText(file);
  }

  async function restoreSealed(e: React.FormEvent) {
    e.preventDefault();
    if (!sealed) return;
    try {
      const opened = await openState(sealed, restorePassword);
      replaceAll(opened.state);
      setSealed(null);
      setRestorePassword("");
      toast.success("Backup restaurado");
    } catch {
      toast.error("Senha incorreta.");
    }
  }

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Tudo calculado a partir das movimentações que você cadastrou."
      >
        <Button variant="outline" onClick={() => exportBoth("csv")}>
          <FileText className="h-4 w-4" />
          CSV
        </Button>
        <Button variant="outline" onClick={() => exportBoth("pdf")}>
          PDF
        </Button>
        <Button variant="outline" onClick={() => void backup()}>
          Backup
        </Button>
        <Button variant="outline" asChild>
          <label className="cursor-pointer">
            <Upload className="h-4 w-4" />
            Restaurar
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) restore(file);
              }}
            />
          </label>
        </Button>
      </PageHeader>
      <Dialog open={askExportPassword} onOpenChange={setAskExportPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha do backup</DialogTitle>
          </DialogHeader>
          <form onSubmit={backupWithPassword} className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              O arquivo sai criptografado. Sem esta senha, outro computador não consegue abri-lo.
            </p>
            <div className="grid gap-1.5">
              <Label>Senha</Label>
              <Input
                type="password"
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                autoComplete="new-password"
              />
              <PasswordMeter value={exportPassword} />
            </div>
            <div className="grid gap-1.5">
              <Label>Repetir</Label>
              <Input
                type="password"
                value={exportAgain}
                onChange={(e) => setExportAgain(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit">Baixar backup</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={sealed !== null} onOpenChange={(open) => !open && setSealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir backup</DialogTitle>
          </DialogHeader>
          <form onSubmit={restoreSealed} className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              A senha do arquivo substitui os dados deste navegador.
            </p>
            <div className="grid gap-1.5">
              <Label>Senha</Label>
              <Input
                type="password"
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit">Restaurar</Button>
          </form>
        </DialogContent>
      </Dialog>
      <div className="panel mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="flex rounded-xl bg-muted p-1">
          {(
            [
              ["mes", "Mês"],
              ["ano", "Ano"],
              ["periodo", "Período"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${mode === id ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "mes" && (
          <Field label="Mês">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
        )}
        {mode === "ano" && (
          <Field label="Ano">
            <Input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </Field>
        )}
        {mode === "periodo" && (
          <>
            <Field label="De">
              <Input type="month" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Até">
              <Input type="month" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Receitas" value={summary.income} tone="text-income" />
        <Summary label="Despesas" value={summary.expense} tone="text-expense" />
        <Summary
          label="Resultado"
          value={summary.net}
          tone={summary.net >= 0 ? "text-income" : "text-expense"}
        />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Saldo disponível hoje: {brl(totalBalance(s))} · Patrimônio no fim do período:{" "}
        {brl(netWorth(s, end))}
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="panel p-5">
          <h3 className="mb-4 font-semibold">Fluxo de caixa</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={flow}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" {...axis} />
              <YAxis {...axis} width={48} />
              <Tooltip
                formatter={(v) => brl(Number(v))}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="income" name="Receitas" fill="var(--income)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Despesas" fill="var(--expense)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel p-5">
          <h3 className="mb-4 font-semibold">Evolução do patrimônio</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={flow}>
              <XAxis dataKey="name" {...axis} />
              <YAxis {...axis} width={48} />
              <Tooltip
                formatter={(v) => brl(Number(v))}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                }}
              />
              <Line
                dataKey="patrimonio"
                name="Patrimônio"
                stroke="var(--chart-4)"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel mt-4 overflow-hidden">
        <h3 className="p-5 font-semibold">Gastos por categoria</h3>
        {categories.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-muted-foreground">Nenhuma despesa neste período.</p>
        ) : (
          <ul className="divide-y divide-border">
            {categories.map((c) => (
              <li key={c.name} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="flex-1">{c.name}</span>
                <span className="text-muted-foreground">
                  {summary.expense ? `${((c.value / summary.expense) * 100).toFixed(0)}%` : ""}
                </span>
                <span className="font-semibold tabular-nums text-expense">{brl(c.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="panel mt-4 overflow-x-auto">
        <h3 className="p-5 font-semibold">Mês a mês</h3>
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-y border-border text-left text-xs text-muted-foreground">
              {["Mês", "Receitas", "Despesas", "Resultado"].map((h) => (
                <th key={h} className="px-5 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
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
  while (k <= to && out.length < 36) {
    out.push(k);
    k = addMonths(k, 1);
  }
  return out;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Summary({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="panel p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold tabular-nums ${tone}`}>
        {brl(value)}
      </p>
    </div>
  );
}
