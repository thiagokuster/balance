import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Money, PageHeader } from "@/components/app-shell";
import { parseMoney } from "@/lib/money";
import { TransactionDialog } from "@/components/transaction-dialog";
import {
  accountBalance,
  brl,
  cardAvailable,
  cardInvoices,
  fmtDate,
  monthLabel,
  payInvoice,
  replaceAll,
  today,
  uid,
  update,
  useFinance,
  type Card,
} from "@/lib/finance";

export const Route = createFileRoute("/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões — Saldo" },
      { name: "description", content: "Limites, faturas, parcelas e histórico dos seus cartões." },
      { property: "og:title", content: "Cartões — Saldo" },
      {
        property: "og:description",
        content: "Limites, faturas, parcelas e histórico dos seus cartões.",
      },
    ],
  }),
  component: Page,
});

const num = parseMoney;
const day = (v: string) => Math.min(31, Math.max(1, Math.round(Number(v) || 1)));

function Page() {
  const s = useFinance();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Card | undefined>();
  const [form, setForm] = useState({ name: "", limit: "", closingDay: "1", dueDay: "10" });
  const [selected, setSelected] = useState<string | undefined>();
  const [pay, setPay] = useState<{ cardId: string; month: string; amount: number } | undefined>();
  const [payAccount, setPayAccount] = useState("");
  const [payDate, setPayDate] = useState(today());

  function openNew() {
    setEdit(undefined);
    setForm({ name: "", limit: "", closingDay: "1", dueDay: "10" });
    setOpen(true);
  }
  function openEdit(card: Card) {
    setEdit(card);
    setForm({
      name: card.name,
      limit: String(card.limit),
      closingDay: String(card.closingDay),
      dueDay: String(card.dueDay),
    });
    setOpen(true);
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    const limit = num(form.limit);
    if (!form.name.trim() || form.name.length > 40) {
      toast.error("Informe o nome do cartão.");
      return;
    }
    if (!(limit > 0)) {
      toast.error("Informe o limite.");
      return;
    }
    const next = {
      name: form.name.trim(),
      limit,
      closingDay: day(form.closingDay),
      dueDay: day(form.dueDay),
    };
    update((st) => ({
      ...st,
      cards: edit
        ? st.cards.map((c) => (c.id === edit.id ? { ...c, ...next } : c))
        : [...st.cards, { id: uid(), ...next }],
    }));
    setOpen(false);
    toast.success(edit ? "Cartão atualizado" : "Cartão cadastrado");
  }
  function remove(card: Card) {
    if (
      !confirm(`Excluir ${card.name} apaga as compras lançadas nele. Dá para desfazer em seguida.`)
    )
      return;
    const snapshot = s;
    update((st) => ({
      ...st,
      cards: st.cards.filter((c) => c.id !== card.id),
      transactions: st.transactions.filter((t) => t.cardId !== card.id),
      transfers: st.transfers.filter((t) => t.toId !== `card:${card.id}`),
    }));
    if (selected === card.id) setSelected(undefined);
    toast("Cartão excluído", {
      duration: 8000,
      action: { label: "Desfazer", onClick: () => replaceAll(snapshot) },
    });
  }
  function confirmPay(e: React.FormEvent) {
    e.preventDefault();
    if (!pay) return;
    if (!payAccount) {
      toast.error("Escolha a conta que vai pagar a fatura.");
      return;
    }
    if (!payInvoice(pay.cardId, pay.month, payAccount, payDate)) {
      toast.error("Não há valor pendente nessa fatura.");
      return;
    }
    setPay(undefined);
    toast.success("Fatura paga. O valor saiu da conta e não entrou de novo como despesa.");
  }

  const card = s.cards.find((c) => c.id === selected);
  const invoices = card ? cardInvoices(s, card) : [];
  const groups = new Map<string, { description: string; txs: typeof s.transactions }>();
  for (const t of s.transactions) {
    if (!card || t.cardId !== card.id || !t.groupId) continue;
    const g = groups.get(t.groupId) ?? { description: t.description, txs: [] };
    g.txs.push(t);
    groups.set(t.groupId, g);
  }

  return (
    <>
      <PageHeader
        title="Cartões"
        subtitle="Limite, faturas e parcelas. Pagar a fatura não conta outra vez como despesa."
      >
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          Novo cartão
        </Button>
      </PageHeader>
      {s.cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum cartão"
          text="Cadastre um cartão para lançar compras, acompanhar o limite e as faturas."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {s.cards.map((c) => {
            const available = cardAvailable(s, c);
            const active = selected === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(active ? undefined : c.id)}
                className={`panel panel-glow p-5 text-left transition ${active ? "ring-2 ring-primary" : "hover:bg-muted/40"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Fecha dia {c.closingDay} · vence dia {c.dueDay}
                    </p>
                  </div>
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-4 font-display text-2xl font-semibold tabular-nums">
                  {brl(available)}
                </p>
                <p className="text-xs text-muted-foreground">disponível de {brl(c.limit)}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((c.limit - available) / c.limit) * 100))}%`,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {card && (
        <div className="mt-6 grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">{card.name}</h2>
            <div className="flex gap-2">
              <TransactionDialog
                defaults={{ paymentMethod: "Cartão de crédito", cardId: card.id }}
                trigger={
                  <Button variant="outline">
                    <Plus className="h-4 w-4" />
                    Nova compra
                  </Button>
                }
              />
              <Button variant="outline" onClick={() => openEdit(card)}>
                Editar
              </Button>
              <Button variant="ghost" onClick={() => remove(card)} aria-label="Excluir cartão">
                <Trash2 className="h-4 w-4 text-expense" />
              </Button>
            </div>
          </div>

          {groups.size > 0 && (
            <div className="panel p-5">
              <h3 className="font-semibold">Compras parceladas</h3>
              <ul className="mt-3 divide-y divide-border">
                {[...groups.values()].map((g) => {
                  const sorted = [...g.txs].sort((a, b) => a.date.localeCompare(b.date));
                  const paid = sorted.filter((t) => t.status !== "pendente").length;
                  const total = sorted.reduce((a, t) => a + t.amount, 0);
                  return (
                    <li key={sorted[0]?.groupId} className="flex items-center gap-3 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{g.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {paid} de {sorted.length} parcelas pagas
                        </p>
                      </div>
                      <Money value={total} type="despesa" className="font-semibold" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="grid gap-4">
            {invoices.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma compra neste cartão ainda.</p>
            )}
            {invoices.map((inv) => (
              <div key={inv.month} className="panel overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 p-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Fatura {monthLabel(inv.month)}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.pending > 0 ? `${brl(inv.pending)} em aberto` : "Sem valor pendente"}
                    </p>
                  </div>
                  <Badge
                    variant={inv.status === "paga" ? "secondary" : "outline"}
                    className={inv.status === "fechada" ? "border-warning text-warning" : ""}
                  >
                    {inv.status === "aberta"
                      ? "Aberta"
                      : inv.status === "fechada"
                        ? "Fechada"
                        : "Paga"}
                  </Badge>
                  <Money value={inv.total} type="despesa" className="font-semibold" />
                  {inv.pending > 0 && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setPay({ cardId: card.id, month: inv.month, amount: inv.pending });
                        setPayAccount(s.accounts[0]?.id ?? "");
                        setPayDate(today());
                      }}
                    >
                      Pagar
                    </Button>
                  )}
                </div>
                <ul className="divide-y divide-border border-t border-border">
                  {inv.txs.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {t.description}
                          {t.installment && (
                            <span className="text-muted-foreground"> ({t.installment})</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.category} · {fmtDate(t.date)} · {t.status}
                        </p>
                      </div>
                      <Money value={t.amount} type="despesa" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit ? "Editar cartão" : "Novo cartão"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Nome</Label>
              <Input
                value={form.name}
                maxLength={40}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Nubank"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Limite total (R$)</Label>
              <Input
                inputMode="decimal"
                value={form.limit}
                onChange={(e) => setForm({ ...form, limit: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Dia de fechamento</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.closingDay}
                  onChange={(e) => setForm({ ...form, closingDay: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Dia de vencimento</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dueDay}
                  onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pay} onOpenChange={(o) => !o && setPay(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar fatura</DialogTitle>
          </DialogHeader>
          <form onSubmit={confirmPay} className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Valor pendente: {brl(pay?.amount ?? 0)}. A saída entra como transferência, não como
              nova despesa.
            </p>
            <div className="grid gap-1.5">
              <Label>Conta</Label>
              <Select value={payAccount} onValueChange={setPayAccount}>
                <SelectTrigger>
                  <SelectValue placeholder={s.accounts.length ? "Escolha" : "Cadastre uma conta"} />
                </SelectTrigger>
                <SelectContent>
                  {s.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {brl(accountBalance(s, a.id))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Data do pagamento</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <Button type="submit" disabled={!s.accounts.length}>
              Confirmar pagamento
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
