import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, Money, PageHeader } from "@/components/app-shell";
import { TransactionDialog } from "@/components/transaction-dialog";
import { categoriesFor, fmtDate, update, useFinance, type Transaction } from "@/lib/finance";

export const Route = createFileRoute("/movimentacoes")({
  head: () => ({
    meta: [
      { title: "Movimentações — Saldo" },
      { name: "description", content: "Cadastre, edite e filtre suas receitas e despesas." },
      { property: "og:title", content: "Movimentações — Saldo" },
      { property: "og:description", content: "Cadastre, edite e filtre suas receitas e despesas." },
    ],
  }),
  component: Page,
});

const ALL = "__all";
const statusLabel = { pago: "Pago", pendente: "Pendente", recebido: "Recebido" };

function Page() {
  const s = useFinance();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cat, setCat] = useState(ALL);
  const [acc, setAcc] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [editing, setEditing] = useState<Transaction | undefined>();

  const list = useMemo(
    () =>
      s.transactions
        .filter(
          (t) =>
            (!q || t.description.toLowerCase().includes(q.toLowerCase())) &&
            (!from || t.date >= from) &&
            (!to || t.date <= to) &&
            (cat === ALL || t.category === cat) &&
            (type === ALL || t.type === type) &&
            (acc === ALL || t.accountId === acc || t.cardId === acc),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [s.transactions, q, from, to, cat, acc, type],
  );

  const inc = list.filter((t) => t.type === "receita").reduce((a, t) => a + t.amount, 0);
  const exp = list.filter((t) => t.type === "despesa").reduce((a, t) => a + t.amount, 0);
  const where = (t: Transaction) =>
    t.cardId
      ? `💳 ${s.cards.find((c) => c.id === t.cardId)?.name ?? "Cartão"}`
      : (s.accounts.find((a) => a.id === t.accountId)?.name ?? "—");

  function remove(t: Transaction) {
    const group =
      t.groupId && confirm("Excluir todas as parcelas desta compra? (Cancelar exclui só esta)");
    update((st) => ({
      ...st,
      transactions: st.transactions.filter((x) =>
        group ? x.groupId !== t.groupId : x.id !== t.id,
      ),
    }));
    toast.success("Movimentação excluída");
  }
  const settle = (t: Transaction) =>
    update((st) => ({
      ...st,
      transactions: st.transactions.map((x) =>
        x.id === t.id ? { ...x, status: t.type === "receita" ? "recebido" : "pago" } : x,
      ),
    }));

  return (
    <>
      <PageHeader
        title="Movimentações"
        subtitle={`${list.length} itens · entradas ${inc.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · saídas ${exp.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
      >
        <TransactionDialog
          trigger={
            <Button>
              <Plus className="h-4 w-4" />
              Nova
            </Button>
          }
        />
      </PageHeader>
      <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <Input
          placeholder="Buscar descrição…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="lg:col-span-2"
        />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="De" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Até" />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os tipos</SelectItem>
            <SelectItem value="receita">Receitas</SelectItem>
            <SelectItem value="despesa">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas categorias</SelectItem>
            {[...new Set([...categoriesFor(s, "receita"), ...categoriesFor(s, "despesa")])].map(
              (c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Select value={acc} onValueChange={setAcc}>
          <SelectTrigger className="lg:col-span-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as contas e cartões</SelectItem>
            {s.accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.archived ? `${a.name} (arquivada)` : a.name}
              </SelectItem>
            ))}
            {s.cards.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                💳 {a.archived ? `${a.name} (arquivado)` : a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          onClick={() => {
            setQ("");
            setFrom("");
            setTo("");
            setCat(ALL);
            setAcc(ALL);
            setType(ALL);
          }}
        >
          Limpar filtros
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Nada por aqui"
          text="Nenhuma movimentação encontrada com esses filtros."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                {[
                  "Descrição",
                  "Categoria",
                  "Conta",
                  "Data",
                  "Pagamento",
                  "Status",
                  "Valor",
                  "",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((t) => (
                <tr key={t.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {t.description}
                      {t.installment && (
                        <span className="text-muted-foreground"> ({t.installment})</span>
                      )}
                    </p>
                    {t.notes && (
                      <p className="max-w-[240px] truncate text-xs text-muted-foreground">
                        {t.notes}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.category}</td>
                  <td className="px-4 py-3">{where(t)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmtDate(t.date)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.paymentMethod}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={t.status === "pendente" ? "outline" : "secondary"}
                      className={t.status === "pendente" ? "border-warning text-warning" : ""}
                    >
                      {statusLabel[t.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    <Money value={t.amount} type={t.type} />
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex justify-end gap-1">
                      {t.status === "pendente" && !t.cardId && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => settle(t)}
                          aria-label="Marcar como pago"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(t)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(t)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-expense" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <TransactionDialog
        edit={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(undefined)}
      />
    </>
  );
}
