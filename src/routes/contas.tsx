import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRightLeft,
  Banknote,
  Landmark,
  PiggyBank,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, Money, PageHeader } from "@/components/app-shell";
import { parseMoney } from "@/lib/money";
import {
  ACCOUNT_LABEL,
  accountBalance,
  brl,
  fmtDate,
  today,
  totalBalance,
  uid,
  update,
  replaceAll,
  useFinance,
  type AccountType,
} from "@/lib/finance";

export const Route = createFileRoute("/contas")({
  head: () => ({
    meta: [
      { title: "Contas — Saldo" },
      { name: "description", content: "Gerencie suas contas e transfira valores entre elas." },
      { property: "og:title", content: "Contas — Saldo" },
      {
        property: "og:description",
        content: "Gerencie suas contas e transfira valores entre elas.",
      },
    ],
  }),
  component: Page,
});

const icons = {
  corrente: Landmark,
  poupanca: PiggyBank,
  dinheiro: Banknote,
  investimentos: TrendingUp,
};
const num = parseMoney;

function Page() {
  const s = useFinance();
  const [open, setOpen] = useState(false);
  const [tOpen, setTOpen] = useState(false);
  const [a, setA] = useState({ name: "", type: "corrente" as AccountType, balance: "" });
  const [tr, setTr] = useState({ fromId: "", toId: "", amount: "", date: today(), note: "" });

  function addAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!a.name.trim() || a.name.length > 60) {
      toast.error("Informe um nome.");
      return;
    }
    const b = num(a.balance || "0");
    if (Number.isNaN(b)) {
      toast.error("Saldo inválido.");
      return;
    }
    update((st) => ({
      ...st,
      accounts: [
        ...st.accounts,
        { id: uid(), name: a.name.trim(), type: a.type, initialBalance: b },
      ],
    }));
    setA({ name: "", type: "corrente", balance: "" });
    setOpen(false);
    toast.success("Conta criada");
  }
  function transfer(e: React.FormEvent) {
    e.preventDefault();
    const amount = num(tr.amount);
    if (!tr.fromId || !tr.toId || tr.fromId === tr.toId) {
      toast.error("Escolha contas diferentes.");
      return;
    }
    if (!(amount > 0)) {
      toast.error("Valor inválido.");
      return;
    }
    update((st) => ({
      ...st,
      transfers: [
        ...st.transfers,
        {
          id: uid(),
          fromId: tr.fromId,
          toId: tr.toId,
          amount,
          date: tr.date,
          note: tr.note.slice(0, 100),
        },
      ],
    }));
    setTOpen(false);
    setTr({ fromId: "", toId: "", amount: "", date: today(), note: "" });
    toast.success("Transferência registrada");
  }
  function remove(id: string) {
    const used =
      s.transactions.some((t) => t.accountId === id) ||
      s.transfers.some((t) => t.fromId === id || t.toId === id);
    if (
      !confirm(
        used
          ? "Excluir esta conta apaga o saldo e todas as movimentações ligadas a ela. Dá para desfazer em seguida."
          : "Excluir esta conta? Dá para desfazer em seguida.",
      )
    )
      return;
    const snapshot = s;
    update((st) => ({
      ...st,
      accounts: st.accounts.filter((x) => x.id !== id),
      transactions: st.transactions.filter((t) => t.accountId !== id),
      transfers: st.transfers.filter((t) => t.fromId !== id && t.toId !== id),
    }));
    toast("Conta excluída", {
      duration: 8000,
      action: { label: "Desfazer", onClick: () => replaceAll(snapshot) },
    });
  }
  const name = (id: string) =>
    id.startsWith("card:")
      ? `Fatura ${s.cards.find((c) => `card:${c.id}` === id)?.name ?? ""}`
      : id.startsWith("investment:")
        ? `Aporte ${s.investments.find((i) => `investment:${i.id}` === id)?.name ?? ""}`
        : (s.accounts.find((x) => x.id === id)?.name ?? "—");

  return (
    <>
      <PageHeader title="Contas" subtitle={`Saldo consolidado: ${brl(totalBalance(s))}`}>
        <Dialog open={tOpen} onOpenChange={setTOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={s.accounts.length < 2}>
              <ArrowRightLeft className="h-4 w-4" />
              Transferir
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transferência entre contas</DialogTitle>
            </DialogHeader>
            <form onSubmit={transfer} className="grid gap-4">
              <p className="text-sm text-muted-foreground">
                Transferências não contam como receita nem despesa.
              </p>
              {(["fromId", "toId"] as const).map((k) => (
                <div key={k} className="grid gap-1.5">
                  <Label>{k === "fromId" ? "De" : "Para"}</Label>
                  <Select value={tr[k]} onValueChange={(v) => setTr({ ...tr, [k]: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent>
                      {s.accounts.map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.name} · {brl(accountBalance(s, x.id))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Valor</Label>
                  <Input
                    inputMode="decimal"
                    value={tr.amount}
                    onChange={(e) => setTr({ ...tr, amount: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={tr.date}
                    onChange={(e) => setTr({ ...tr, date: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit">Transferir</Button>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Nova conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova conta</DialogTitle>
            </DialogHeader>
            <form onSubmit={addAccount} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Nome</Label>
                <Input
                  value={a.name}
                  maxLength={60}
                  onChange={(e) => setA({ ...a, name: e.target.value })}
                  placeholder="Ex.: Nubank"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select
                  value={a.type}
                  onValueChange={(v) => setA({ ...a, type: v as AccountType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCOUNT_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Saldo atual (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={a.balance}
                  onChange={(e) => setA({ ...a, balance: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <Button type="submit">Criar conta</Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {s.accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Nenhuma conta"
          text="Cadastre suas contas para acompanhar o saldo de cada uma."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {s.accounts.map((x) => {
            const I = icons[x.type];
            return (
              <div key={x.id} className="panel panel-glow fade-up group p-5">
                <div className="flex items-start justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary">
                    <I className="h-5 w-5" />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => remove(x.id)}
                    aria-label="Excluir conta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-4 font-medium">{x.name}</p>
                <p className="text-xs text-muted-foreground">{ACCOUNT_LABEL[x.type]}</p>
                <p className="mt-3 font-display text-2xl font-semibold tabular-nums">
                  {brl(accountBalance(s, x.id))}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {s.transfers.length > 0 && (
        <div className="panel mt-6 overflow-hidden">
          <h3 className="p-5 font-semibold">Transferências, aportes e faturas</h3>
          <ul className="divide-y divide-border">
            {[...s.transfers]
              .sort((x, y) => y.date.localeCompare(x.date))
              .map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">
                    {name(t.fromId)} → {name(t.toId)}
                  </span>
                  <span className="text-muted-foreground">{fmtDate(t.date)}</span>
                  <Money value={t.amount} className="font-semibold" />
                  {!t.toId.startsWith("card:") && !t.toId.startsWith("investment:") && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        update((st) => ({
                          ...st,
                          transfers: st.transfers.filter((y) => y.id !== t.id),
                        }))
                      }
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </>
  );
}
