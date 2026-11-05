import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Money } from "@/components/app-shell";
import { addMonths, calendarEvents, monthKey, monthLabel, useFinance, type CalKind } from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendario")({
  head: () => ({ meta: [
    { title: "Calendário — Saldo" },
    { name: "description", content: "Contas a pagar e a receber, vencimentos e lançamentos recorrentes." },
    { property: "og:title", content: "Calendário — Saldo" },
    { property: "og:description", content: "Contas a pagar e a receber, vencimentos e lançamentos recorrentes." },
  ] }),
  component: Page,
});

const WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const kindLabel: Record<CalKind, string> = { pagar: "A pagar", receber: "A receber", cartao: "Cartão", recorrente: "Despesa recorrente", prevista: "Receita prevista" };
const kindDot: Record<CalKind, string> = { pagar: "bg-expense", receber: "bg-income", cartao: "bg-warning", recorrente: "bg-chart-5", prevista: "bg-primary" };

function Page() {
  const s = useFinance();
  const [month, setMonth] = useState(monthKey(new Date()));
  const [selected, setSelected] = useState<string | undefined>();
  const events = calendarEvents(s, month);
  const cells = monthCells(month);
  const dayEvents = events.filter((e) => e.date === selected);

  return (
    <>
      <PageHeader title="Calendário" subtitle="Pendências, vencimentos de cartão e o que se repete todo mês.">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => { setMonth(addMonths(month, -1)); setSelected(undefined); }}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-24 text-center font-medium">{monthLabel(month)}</span>
          <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => { setMonth(addMonths(month, 1)); setSelected(undefined); }}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(Object.keys(kindLabel) as CalKind[]).map((k) => <span key={k} className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", kindDot[k])} />{kindLabel[k]}</span>)}
      </div>
      <div className="panel overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border text-center text-xs text-muted-foreground">
          {WEEK.map((d) => <div key={d} className="px-1 py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const date = day ? `${month}-${String(day).padStart(2, "0")}` : "";
            const list = day ? events.filter((e) => e.date === date) : [];
            return (
              <button key={i} type="button" disabled={!day} onClick={() => day && setSelected(date)} className={cn("min-h-16 border-b border-r border-border p-1.5 text-left md:min-h-24", selected === date && "bg-accent", !day && "bg-muted/30")}>
                {day && <span className="text-xs font-medium">{day}</span>}
                <span className="mt-1 flex flex-wrap gap-1">
                  {[...new Set(list.map((e) => e.kind))].slice(0, 4).map((k) => <span key={k} className={cn("h-1.5 w-1.5 rounded-full", kindDot[k])} />)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="panel mt-4 p-5">
        <h3 className="font-semibold">{selected ? selected.split("-").reverse().join("/") : "Selecione um dia"}</h3>
        {!selected ? <p className="mt-2 text-sm text-muted-foreground">Os pontos mostram o que acontece em cada dia.</p> : dayEvents.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nada previsto neste dia.</p> : (
          <ul className="mt-3 divide-y divide-border">
            {dayEvents.map((e, i) => (
              <li key={`${e.kind}-${e.title}-${i}`} className="flex items-center gap-3 py-3 text-sm">
                <span className={cn("h-2 w-2 rounded-full", kindDot[e.kind])} />
                <span className="flex-1">{e.title}<span className="block text-xs text-muted-foreground">{kindLabel[e.kind]}</span></span>
                {e.amount !== undefined && <Money value={e.amount} type={e.kind === "receber" || e.kind === "prevista" ? "receita" : "despesa"} className="font-semibold" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function monthCells(month: string) {
  const [y = 0, m = 1] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const pad = (first.getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const cells: (number | null)[] = [...Array(pad).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return cells;
}
