import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { EXPENSE_CATEGORIES, brl, expensesByCategory, fmtDate, monthKey, monthTotals, spendingAlerts, uid, update, useFinance, type Goal } from "@/lib/finance";

export const Route = createFileRoute("/planejamento")({
  head: () => ({ meta: [
    { title: "Planejamento — Saldo" },
    { name: "description", content: "Orçamento, limites por categoria, metas e reserva de emergência." },
    { property: "og:title", content: "Planejamento — Saldo" },
    { property: "og:description", content: "Orçamento, limites por categoria, metas e reserva de emergência." },
  ] }),
  component: Page,
});

const num = (v: string) => {
  const t = v.trim();
  if (!t) return Number.NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};
const kindLabel: Record<Goal["kind"], string> = { meta: "Meta de economia", reserva: "Reserva de emergência", compra: "Compra futura" };

function Page() {
  const s = useFinance();
  const month = monthKey(new Date());
  const spent = expensesByCategory(s, month, month);
  const totals = monthTotals(s, month);
  const alerts = spendingAlerts(s, month);
  const [budget, setBudget] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, string> | null>(null);
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState({ name: "", kind: "meta" as Goal["kind"], target: "", current: "", deadline: "" });

  const budgetValue = budget ?? (s.monthlyBudget ? String(s.monthlyBudget).replace(".", ",") : "");
  const limitValues: Record<string, string> = limits ?? Object.fromEntries(Object.entries(s.categoryLimits).map(([k, v]) => [k, String(v).replace(".", ",")]));

  function savePlan(e: React.FormEvent) {
    e.preventDefault();
    const monthlyBudget = budgetValue.trim() === "" ? 0 : num(budgetValue);
    if (Number.isNaN(monthlyBudget) || monthlyBudget < 0) { toast.error("Orçamento inválido."); return; }
    const categoryLimits: Record<string, number> = {};
    for (const cat of EXPENSE_CATEGORIES) {
      const raw = limitValues[cat]?.trim() ?? "";
      if (!raw) continue;
      const value = num(raw);
      if (!(value > 0) || Number.isNaN(value)) { toast.error(`Limite inválido em ${cat}.`); return; }
      categoryLimits[cat] = value;
    }
    update((st) => ({ ...st, monthlyBudget, categoryLimits }));
    toast.success("Planejamento salvo");
  }

  function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const target = num(goal.target);
    const current = goal.current.trim() === "" ? 0 : num(goal.current);
    if (!goal.name.trim()) { toast.error("Dê um nome para a meta."); return; }
    if (!(target > 0) || Number.isNaN(target) || Number.isNaN(current) || current < 0) { toast.error("Informe valores válidos."); return; }
    update((st) => ({ ...st, goals: [...st.goals, { id: uid(), name: goal.name.trim(), kind: goal.kind, target, current, ...(goal.deadline ? { deadline: goal.deadline } : {}) }] }));
    setGoal({ name: "", kind: "meta", target: "", current: "", deadline: "" });
    setOpen(false);
    toast.success("Meta criada");
  }

  const budgetPct = s.monthlyBudget > 0 ? (totals.expense / s.monthlyBudget) * 100 : 0;

  return (
    <>
      <PageHeader title="Planejamento" subtitle="Orçamento do mês, limites e metas. Os alertas aparecem a partir de 80% do limite." />
      {alerts.length > 0 && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-medium">Atenção aos limites</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {alerts.map((a) => <li key={a.name}>{a.name}: {brl(a.spent)} de {brl(a.limit)} ({Math.round((a.spent / a.limit) * 100)}%)</li>)}
          </ul>
        </div>
      )}

      <form onSubmit={savePlan} className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-1">
          <h2 className="font-semibold">Orçamento mensal</h2>
          <p className="mt-1 text-xs text-muted-foreground">Gastos deste mês: {brl(totals.expense)}</p>
          <Label className="mt-4 block">Teto de gastos (R$)</Label>
          <Input className="mt-1.5" inputMode="decimal" value={budgetValue} onChange={(e) => setBudget(e.target.value)} placeholder="0,00" />
          {s.monthlyBudget > 0 && (
            <div className="mt-4">
              <Progress value={Math.min(100, budgetPct)} />
              <p className={`mt-2 text-xs ${budgetPct >= 100 ? "text-expense" : "text-muted-foreground"}`}>{budgetPct.toFixed(0)}% do orçamento</p>
            </div>
          )}
        </div>
        <div className="panel p-5 lg:col-span-2">
          <h2 className="font-semibold">Limites por categoria</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {EXPENSE_CATEGORIES.map((cat) => {
              const used = spent.find((c) => c.name === cat)?.value ?? 0;
              const limit = s.categoryLimits[cat] ?? 0;
              const pct = limit > 0 ? (used / limit) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{cat}</span>
                    <span className="text-xs text-muted-foreground">{limit > 0 ? `${brl(used)} / ${brl(limit)}` : brl(used)}</span>
                  </div>
                  <Input inputMode="decimal" value={limitValues[cat] ?? ""} placeholder="Sem limite" onChange={(e) => setLimits({ ...limitValues, [cat]: e.target.value })} />
                  {limit > 0 && <Progress className="mt-2" value={Math.min(100, pct)} />}
                </div>
              );
            })}
          </div>
          <Button className="mt-4" type="submit">Salvar orçamento</Button>
        </div>
      </form>

      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Metas</h2>
          <p className="text-sm text-muted-foreground">Economia, reserva de emergência e compras futuras.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Nova meta</Button>
      </div>
      {s.goals.length === 0 ? <div className="mt-4"><EmptyState icon={Target} title="Nenhuma meta" text="Crie uma meta de economia, uma reserva de emergência ou o valor de uma compra que você quer planejar." /></div> : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {s.goals.map((g) => {
            const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
            return (
              <div key={g.id} className="panel p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{kindLabel[g.kind]}</p>
                    <p className="font-medium">{g.name}</p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label="Excluir meta" onClick={() => update((st) => ({ ...st, goals: st.goals.filter((x) => x.id !== g.id) }))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <p className="mt-3 font-display text-2xl font-semibold tabular-nums">{brl(g.current)}</p>
                <p className="text-xs text-muted-foreground">de {brl(g.target)}{g.deadline ? ` · até ${fmtDate(g.deadline)}` : ""}</p>
                <Progress className="mt-3" value={Math.min(100, pct)} />
                <p className="mt-2 text-xs text-muted-foreground">{pct.toFixed(0)}%</p>
                <GoalProgress id={g.id} />
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova meta</DialogTitle></DialogHeader>
          <form onSubmit={addGoal} className="grid gap-4">
            <div className="grid gap-1.5"><Label>Nome</Label><Input value={goal.name} maxLength={80} onChange={(e) => setGoal({ ...goal, name: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Tipo</Label>
              <Select value={goal.kind} onValueChange={(v) => setGoal({ ...goal, kind: v as Goal["kind"] })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(kindLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Valor alvo</Label><Input inputMode="decimal" value={goal.target} onChange={(e) => setGoal({ ...goal, target: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Já guardado</Label><Input inputMode="decimal" value={goal.current} onChange={(e) => setGoal({ ...goal, current: e.target.value })} placeholder="0" /></div>
            </div>
            <div className="grid gap-1.5"><Label>Prazo (opcional)</Label><Input type="date" value={goal.deadline} onChange={(e) => setGoal({ ...goal, deadline: e.target.value })} /></div>
            <Button type="submit">Criar meta</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GoalProgress({ id }: { id: string }) {
  const [value, setValue] = useState("");
  function add(e: React.FormEvent) {
    e.preventDefault();
    const amount = num(value);
    if (!amount || Number.isNaN(amount)) { toast.error("Informe um valor."); return; }
    update((st) => ({ ...st, goals: st.goals.map((g) => g.id === id ? { ...g, current: Math.max(0, Math.round((g.current + amount) * 100) / 100) } : g) }));
    setValue("");
  }
  return (
    <form onSubmit={add} className="mt-3 flex gap-2">
      <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Guardar ou tirar (−)" />
      <Button type="submit" variant="outline">Lançar</Button>
    </form>
  );
}
