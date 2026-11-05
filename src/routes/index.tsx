import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Landmark, PiggyBank, Plus, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Money, PageHeader } from "@/components/app-shell";
import { TransactionDialog } from "@/components/transaction-dialog";
import { brl, endOfMonth, expensesByCategory, fmtDate, lastMonths, monthKey, monthLabel, monthTotals, netWorth, spendingAlerts, totalBalance, totalInvested, useFinance, addMonths } from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Dashboard — Saldo" },
    { name: "description", content: "Visão geral do seu saldo, receitas, despesas e patrimônio." },
    { property: "og:title", content: "Dashboard — Saldo" },
    { property: "og:description", content: "Visão geral do seu saldo, receitas, despesas e patrimônio." },
  ] }),
  component: Dashboard,
});

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];
export const tooltipStyle = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--popover-foreground)" }, formatter: (v: unknown) => brl(Number(v)) };
const axis = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false };
const compact = (v: number) => v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function pct(cur: number, prev: number) { if (!prev) return null; return ((cur - prev) / Math.abs(prev)) * 100; }

function Stat({ label, value, delta, icon: Icon, tone, good = "up" }: { label: string; value: number; delta: number | null; icon: typeof Wallet; tone: string; good?: "up" | "down" }) {
  const positive = delta !== null && (good === "up" ? delta >= 0 : delta <= 0);
  return (
    <div className={cn("panel panel-glow fade-up p-5")}>
      <div className="flex items-center justify-between text-sm text-muted-foreground">{label}<Icon className={cn("h-4 w-4", tone)} /></div>
      <p className="mt-3 font-display text-2xl font-semibold tabular-nums">{brl(value)}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {delta === null ? "Sem dados do mês anterior" : (
          <><span className={cn("mr-1 rounded-md px-1.5 py-0.5 font-medium", positive ? "bg-income/15 text-income" : "bg-expense/15 text-expense")}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}%</span>vs. mês anterior</>
        )}
      </p>
    </div>
  );
}

function Dashboard() {
  const s = useFinance();
  const cur = monthKey(new Date());
  const prev = addMonths(cur, -1);
  const t = monthTotals(s, cur), p = monthTotals(s, prev);
  const months = lastMonths(6);
  const flow = months.map((k) => ({ name: monthLabel(k), ...monthTotals(s, k), saldo: totalBalance(s, endOfMonth(k)), patrimonio: netWorth(s, endOfMonth(k)) }));
  const cats = expensesByCategory(s, cur, cur);
  const recent = [...s.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const savingsRate = t.income ? (t.net / t.income) * 100 : 0;
  const balance = totalBalance(s), invested = totalInvested(s);
  const alerts = spendingAlerts(s, cur);

  if (!s.accounts.length && !s.transactions.length) {
    return (
      <>
        <PageHeader title="Bem-vindo ao Saldo" subtitle="Seus dados ficam salvos só neste navegador." />
        <EmptyState icon={Wallet} title="Comece cadastrando uma conta" text="Adicione sua conta corrente, poupança ou carteira com o saldo atual. Depois registre receitas e despesas e o painel se atualiza sozinho.">
          <Button asChild><Link to="/contas"><Plus className="h-4 w-4" />Adicionar conta</Link></Button>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Resumo de ${monthLabel(cur)}`}>
        <TransactionDialog trigger={<Button><Plus className="h-4 w-4" />Nova movimentação</Button>} />
      </PageHeader>

      {alerts.length > 0 && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-medium">Gastos perto do limite</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {alerts.map((a) => <li key={a.name}>{a.name}: {brl(a.spent)} de {brl(a.limit)} ({Math.round((a.spent / a.limit) * 100)}%)</li>)}
          </ul>
          <Button variant="link" className="mt-1 h-auto px-0" asChild><Link to="/planejamento">Ver planejamento</Link></Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="panel fade-up relative overflow-hidden bg-primary p-5 text-primary-foreground sm:col-span-2 xl:col-span-1 xl:row-span-2">
          <p className="text-sm opacity-80">Saldo total disponível</p>
          <p className="mt-2 font-display text-4xl font-semibold tabular-nums">{brl(balance)}</p>
          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div><p className="opacity-70">Saldo do mês</p><p className="font-display text-lg font-semibold">{brl(t.net)}</p></div>
            <div><p className="opacity-70">Economia</p><p className="font-display text-lg font-semibold">{savingsRate.toFixed(0)}%</p></div>
            <div><p className="opacity-70">Investido</p><p className="font-display text-lg font-semibold">{brl(invested)}</p></div>
            <div><p className="opacity-70">Patrimônio</p><p className="font-display text-lg font-semibold">{brl(netWorth(s))}</p></div>
          </div>
          <Wallet className="absolute -bottom-6 -right-6 h-32 w-32 opacity-10" />
        </div>
        <Stat label="Receitas do mês" value={t.income} delta={pct(t.income, p.income)} icon={ArrowUpRight} tone="text-income" />
        <Stat label="Despesas do mês" value={t.expense} delta={pct(t.expense, p.expense)} icon={ArrowDownRight} tone="text-expense" good="down" />
        <Stat label="Economia mensal" value={t.net} delta={pct(t.net, p.net)} icon={PiggyBank} tone="text-primary" />
        <Stat label="Total investido" value={invested} delta={pct(invested, totalInvested(s, endOfMonth(prev)))} icon={TrendingUp} tone="text-warning" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="panel p-5 xl:col-span-2">
          <h3 className="mb-4 font-semibold">Receitas × Despesas</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={flow} barGap={4}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" {...axis} /><YAxis {...axis} tickFormatter={compact} width={48} />
              <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="income" name="Receitas" fill="var(--income)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Despesas" fill="var(--expense)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel p-5">
          <h3 className="mb-2 font-semibold">Despesas por categoria</h3>
          {cats.length ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart><Pie data={cats} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={3} stroke="none">
                  {cats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]!} />)}
                </Pie><Tooltip {...tooltipStyle} /></PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 space-y-1.5 text-sm">
                {cats.slice(0, 5).map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="flex-1">{c.name}</span><span className="text-muted-foreground">{((c.value / t.expense) * 100).toFixed(0)}%</span></li>
                ))}
              </ul>
            </>
          ) : <p className="py-16 text-center text-sm text-muted-foreground">Nenhuma despesa neste mês.</p>}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="panel p-5">
          <h3 className="mb-4 font-semibold">Evolução do saldo</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={flow}>
              <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
              <XAxis dataKey="name" {...axis} /><YAxis {...axis} tickFormatter={compact} width={48} />
              <Tooltip {...tooltipStyle} /><Area dataKey="saldo" name="Saldo" stroke="var(--primary)" strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="panel p-5">
          <h3 className="mb-4 font-semibold">Fluxo de caixa mensal</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={flow}>
              <XAxis dataKey="name" {...axis} /><YAxis {...axis} tickFormatter={compact} width={48} />
              <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="net" name="Resultado" radius={[6, 6, 6, 6]}>{flow.map((f, i) => <Cell key={i} fill={f.net >= 0 ? "var(--income)" : "var(--expense)"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel p-5">
          <h3 className="mb-4 font-semibold">Evolução patrimonial</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={flow}>
              <XAxis dataKey="name" {...axis} /><YAxis {...axis} tickFormatter={compact} width={48} />
              <Tooltip {...tooltipStyle} /><Line dataKey="patrimonio" name="Patrimônio" stroke="var(--chart-4)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel mt-4 overflow-hidden">
        <div className="flex items-center justify-between p-5"><h3 className="font-semibold">Movimentações recentes</h3>
          <Button variant="outline" size="sm" asChild><Link to="/movimentacoes">Ver todas</Link></Button></div>
        {recent.length ? (
          <ul className="divide-y divide-border">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", r.type === "receita" ? "bg-income/15 text-income" : "bg-expense/15 text-expense")}>
                  {r.type === "receita" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{r.description}{r.installment && <span className="text-muted-foreground"> ({r.installment})</span>}</p>
                  <p className="text-xs text-muted-foreground">{r.category} · {fmtDate(r.date)}</p></div>
                <Money value={r.amount} type={r.type} className="text-sm font-semibold" />
              </li>
            ))}
          </ul>
        ) : <p className="px-5 pb-6 text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>}
      </div>
      {!s.accounts.length && <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Landmark className="h-4 w-4" />Cadastre uma conta para registrar movimentações.</p>}
    </>
  );
}
