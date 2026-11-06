import { useEffect, useState, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { parseMoney } from "@/lib/money";
import {
  PAYMENT_METHODS,
  addTransaction,
  brl,
  cardAvailable,
  categoriesFor,
  exceedsCardLimit,
  selectableAccounts,
  selectableCards,
  today,
  update,
  useFinance,
  withCustomCategory,
  type Transaction,
  type TxType,
} from "@/lib/finance";

export function TransactionDialog({
  trigger,
  edit,
  open: ctrlOpen,
  onOpenChange,
  defaults,
}: {
  trigger?: ReactNode;
  edit?: Transaction | undefined;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  defaults?: { paymentMethod?: string; cardId?: string };
}) {
  const s = useFinance();
  const [innerOpen, setInnerOpen] = useState(false);
  const open = ctrlOpen ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  const blank = {
    description: "",
    amount: "",
    type: "despesa" as TxType,
    category: "",
    accountId: "",
    cardId: "",
    date: today(),
    paymentMethod: "Pix",
    status: "pago",
    notes: "",
    recurring: false,
    installments: "1",
  };
  const [f, setF] = useState(blank);
  const [draftCategory, setDraftCategory] = useState("");

  useEffect(() => {
    if (!open) return;
    if (edit)
      setF({
        ...blank,
        ...edit,
        amount: String(edit.amount),
        cardId: edit.cardId ?? "",
        notes: edit.notes ?? "",
        recurring: !!edit.recurring,
        installments: "1",
      });
    else
      setF({
        ...blank,
        accountId: selectableAccounts(s)[0]?.id ?? "",
        paymentMethod: defaults?.paymentMethod ?? blank.paymentMethod,
        cardId: defaults?.cardId ?? "",
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, edit]);

  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const isCard = f.type === "despesa" && f.paymentMethod === "Cartão de crédito";
  const knownCategories = categoriesFor(s, f.type);
  const cats =
    f.category &&
    !knownCategories.some(
      (item) => item.toLocaleLowerCase("pt-BR") === f.category.toLocaleLowerCase("pt-BR"),
    )
      ? [...knownCategories, f.category]
      : knownCategories;
  const amountNow = parseMoney(String(f.amount));
  const selectedCard = isCard ? s.cards.find((item) => item.id === f.cardId) : undefined;
  const room = selectedCard ? cardAvailable(s, selectedCard, edit?.id) : 0;
  const overLimit = isCard && !!f.cardId && exceedsCardLimit(s, f.cardId, amountNow, edit?.id);

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    const amount = parseMoney(String(f.amount));
    if (!f.description.trim() || f.description.length > 120) {
      toast.error("Informe uma descrição (até 120 caracteres).");
      return;
    }
    if (!(amount > 0) || amount > 1e9) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!f.category) {
      toast.error("Escolha uma categoria.");
      return;
    }
    if (isCard ? !f.cardId : !f.accountId) {
      toast.error(isCard ? "Escolha o cartão." : "Escolha a conta.");
      return;
    }
    if (
      isCard &&
      exceedsCardLimit(s, f.cardId, amount, edit?.id) &&
      !confirm("Essa compra passa do limite disponível do cartão. Lançar mesmo assim?")
    )
      return;
    const status = isCard
      ? (edit?.status ?? "pendente")
      : f.type === "receita" && f.status === "pago"
        ? "recebido"
        : f.type === "despesa" && f.status === "recebido"
          ? "pago"
          : f.status;
    const tx = {
      description: f.description.trim(),
      amount,
      type: f.type,
      category: f.category,
      accountId: isCard ? "" : f.accountId,
      ...(isCard ? { cardId: f.cardId } : {}),
      date: f.date,
      paymentMethod:
        f.type === "receita" && f.paymentMethod === "Cartão de crédito" ? "Pix" : f.paymentMethod,
      status: status as Transaction["status"],
      notes: f.notes.slice(0, 500),
      recurring: f.recurring,
    };
    if (edit)
      update((st) => ({
        ...st,
        transactions: st.transactions.map((t) => (t.id === edit.id ? { ...t, ...tx } : t)),
      }));
    else addTransaction(tx, isCard ? Math.max(1, Math.min(48, Number(f.installments) || 1)) : 1);
    toast.success(edit ? "Movimentação atualizada" : "Movimentação adicionada");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{edit ? "Editar movimentação" : "Nova movimentação"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {(["despesa", "receita"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => {
                  set("type", t);
                  set("category", "");
                  set("status", t === "receita" ? "recebido" : "pago");
                }}
                className={`rounded-lg py-2 text-sm font-medium transition ${f.type === t ? (t === "receita" ? "bg-income text-primary-foreground" : "bg-expense text-destructive-foreground") : "text-muted-foreground"}`}
              >
                {t === "receita" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label>Descrição</Label>
            <Input
              value={f.description}
              maxLength={120}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Valor (R$)</Label>
              <Input
                inputMode="decimal"
                value={f.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Data</Label>
              <Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Categoria</Label>
              <Select
                value={f.category}
                onValueChange={(v) => {
                  if (v) set("category", v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  value={draftCategory}
                  maxLength={40}
                  placeholder="Nova categoria"
                  onChange={(e) => setDraftCategory(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const name = draftCategory.trim();
                    if (!name) return;
                    const next = withCustomCategory(s, f.type, name);
                    if (next !== s) update(() => next);
                    const chosen =
                      categoriesFor(next, f.type).find(
                        (item) =>
                          item.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
                      ) ?? name;
                    set("category", chosen);
                    setDraftCategory("");
                  }}
                >
                  Criar
                </Button>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={f.paymentMethod} onValueChange={(v) => set("paymentMethod", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.filter(
                    (m) => f.type === "despesa" || m !== "Cartão de crédito",
                  ).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isCard ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Cartão</Label>
                <Select value={f.cardId} onValueChange={(v) => set("cardId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={s.cards.length ? "Escolha" : "Cadastre um cartão"} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableCards(s, f.cardId).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!edit && (
                <div className="grid gap-1.5">
                  <Label>Parcelas</Label>
                  <Input
                    type="number"
                    min={1}
                    max={48}
                    value={f.installments}
                    onChange={(e) => set("installments", e.target.value)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Conta</Label>
                <Select value={f.accountId} onValueChange={(v) => set("accountId", v)}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={s.accounts.length ? "Escolha" : "Cadastre uma conta"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableAccounts(s, f.accountId).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={f.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {f.type === "receita" ? (
                      <SelectItem value="recebido">Recebido</SelectItem>
                    ) : (
                      <SelectItem value="pago">Pago</SelectItem>
                    )}
                    <SelectItem value="pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              maxLength={500}
              value={f.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">
            Repete todo mês (aparece no calendário)
            <Switch checked={f.recurring} onCheckedChange={(v) => set("recurring", v)} />
          </label>
          {overLimit && (
            <p className="text-sm text-warning">
              Essa compra passa do limite. Disponível: {brl(room)}.
            </p>
          )}
          <Button type="submit" className="w-full">
            {edit ? "Salvar" : "Adicionar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
