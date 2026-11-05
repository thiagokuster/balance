import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
import {
  applyContribution,
  applyRedemption,
  brl,
  fmtDate,
  hasUnlinkedContributions,
  investedTotal,
  investmentValue,
  today,
  totalInvested,
  uid,
  update,
  replaceAll,
  useFinance,
  type Investment,
} from "@/lib/finance";

export const Route = createFileRoute("/investimentos")({
  head: () => ({
    meta: [
      { title: "Investimentos — Saldo" },
      {
        name: "description",
        content: "Acompanhe renda fixa, renda variável, aportes e rendimento.",
      },
      { property: "og:title", content: "Investimentos — Saldo" },
      {
        property: "og:description",
        content: "Acompanhe renda fixa, renda variável, aportes e rendimento.",
      },
    ],
  }),
  component: Page,
});

const num = parseMoney;

function Page() {
  const s = useFinance();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Investment["kind"]>("fixa");
  const [aporte, setAporte] = useState<
    { id: string; amount: string; date: string; accountId: string } | undefined
  >();
  const [resgate, setResgate] = useState<
    { id: string; amount: string; date: string; accountId: string } | undefined
  >();
  const [valor, setValor] = useState<{ id: string; amount: string; date: string } | undefined>();

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    update((st) => ({
      ...st,
      investments: [
        ...st.investments,
        { id: uid(), name: name.trim(), kind, contributions: [], history: [] },
      ],
    }));
    setName("");
    setKind("fixa");
    setOpen(false);
    toast.success("Investimento cadastrado");
  }
  function addAporte(e: React.FormEvent) {
    e.preventDefault();
    if (!aporte) return;
    const amount = num(aporte.amount);
    if (!(amount > 0)) {
      toast.error("Informe o valor do aporte.");
      return;
    }
    update((st) =>
      applyContribution(st, aporte.id, amount, aporte.date, aporte.accountId || undefined),
    );
    const fromAccount = Boolean(aporte.accountId);
    setAporte(undefined);
    toast.success(
      fromAccount
        ? "Aporte registrado. O valor saiu da conta."
        : "Aporte registrado. Nenhuma conta foi debitada, então o patrimônio subiu.",
    );
  }
  function addResgate(e: React.FormEvent) {
    e.preventDefault();
    if (!resgate) return;
    const amount = num(resgate.amount);
    const investment = s.investments.find((item) => item.id === resgate.id);
    if (!(amount > 0)) {
      toast.error("Informe o valor do resgate.");
      return;
    }
    if (!resgate.accountId) {
      toast.error("Escolha a conta que vai receber o resgate.");
      return;
    }
    if (!investment || amount > investmentValue(investment)) {
      toast.error("O resgate não pode passar do valor do investimento.");
      return;
    }
    update((st) => applyRedemption(st, resgate.id, amount, resgate.date, resgate.accountId));
    setResgate(undefined);
    toast.success("Resgate registrado. O valor entrou na conta e saiu do investimento.");
  }
  function addValor(e: React.FormEvent) {
    e.preventDefault();
    if (!valor) return;
    const value = num(valor.amount);
    if (!(value >= 0) || Number.isNaN(value)) {
      toast.error("Informe o valor atual.");
      return;
    }
    update((st) => ({
      ...st,
      investments: st.investments.map((i) =>
        i.id === valor.id
          ? {
              ...i,
              history: [
                ...i.history.filter((h) => h.date !== valor.date),
                { date: valor.date, value },
              ].sort((a, b) => a.date.localeCompare(b.date)),
            }
          : i,
      ),
    }));
    setValor(undefined);
    toast.success("Valor atualizado");
  }
  function remove(id: string) {
    if (
      !confirm(
        "Excluir este investimento apaga aportes e resgates e desfaz esses movimentos nas contas. Dá para desfazer em seguida.",
      )
    )
      return;
    const snapshot = s;
    update((st) => ({
      ...st,
      investments: st.investments.filter((i) => i.id !== id),
      transfers: st.transfers.filter(
        (t) => t.toId !== `investment:${id}` && t.fromId !== `investment:${id}`,
      ),
    }));
    toast("Investimento excluído", {
      duration: 8000,
      action: { label: "Desfazer", onClick: () => replaceAll(snapshot) },
    });
  }

  return (
    <>
      <PageHeader
        title="Investimentos"
        subtitle={`Patrimônio investido: ${brl(totalInvested(s))}. Os valores são os que você informar.`}
      >
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo investimento
        </Button>
      </PageHeader>
      {hasUnlinkedContributions(s) && (
        <p className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          Há aportes sem conta de origem. Esse dinheiro não saiu de nenhuma conta, então o
          patrimônio continua maior do que o saldo. Aportes novos podem debitar uma conta, e o
          resgate devolve o valor.
        </p>
      )}
      {s.investments.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhum investimento"
          text="Cadastre renda fixa ou variável e atualize o saldo quando quiser. Nada é buscado na internet."
        />
      ) : (
        <div className="grid gap-4">
          {s.investments.map((inv) => {
            const value = investmentValue(inv);
            const contributed = investedTotal(inv);
            const gain = value - contributed;
            const series = [...inv.history]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((h) => ({ name: fmtDate(h.date), valor: h.value }));
            return (
              <div key={inv.id} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{inv.name}</p>
                      <Badge variant="secondary">
                        {inv.kind === "fixa" ? "Renda fixa" : "Renda variável"}
                      </Badge>
                    </div>
                    <p className="mt-3 font-display text-3xl font-semibold tabular-nums">
                      {brl(value)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Aplicado {brl(contributed)} · rendimento{" "}
                      <Money value={gain} type={gain >= 0 ? "receita" : "despesa"} />
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setAporte({
                          id: inv.id,
                          amount: "",
                          date: today(),
                          accountId: s.accounts[0]?.id ?? "",
                        })
                      }
                    >
                      Aporte
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setResgate({
                          id: inv.id,
                          amount: "",
                          date: today(),
                          accountId: s.accounts[0]?.id ?? "",
                        })
                      }
                    >
                      Resgatar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setValor({ id: inv.id, amount: "", date: today() })}
                    >
                      Atualizar valor
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir investimento"
                      onClick={() => remove(inv.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {series.length > 1 && (
                  <div className="mt-4 h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series}>
                        <XAxis
                          dataKey="name"
                          stroke="var(--muted-foreground)"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis hide />
                        <Tooltip
                          formatter={(v) => brl(Number(v))}
                          contentStyle={{
                            background: "var(--popover)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                          }}
                        />
                        <Line
                          dataKey="valor"
                          name="Valor"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {(() => {
                  const movements = [
                    ...inv.contributions.map((item) => ({ ...item, kind: "Aporte" as const })),
                    ...(inv.redemptions ?? []).map((item) => ({
                      ...item,
                      kind: "Resgate" as const,
                    })),
                  ].sort((a, b) => b.date.localeCompare(a.date));
                  if (!movements.length) return null;
                  return (
                    <ul className="mt-4 divide-y divide-border text-sm">
                      {movements.map((item, index) => (
                        <li
                          key={`${item.kind}-${item.date}-${index}`}
                          className="flex justify-between py-2"
                        >
                          <span className="text-muted-foreground">
                            {item.kind} · {fmtDate(item.date)}
                          </span>
                          <span className="font-medium">{brl(item.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
                <p className="mt-3 text-xs text-muted-foreground">
                  O saldo usa a última atualização. Aportes e resgates feitos depois entram no valor
                  até você lançar uma nova cotação.
                </p>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo investimento</DialogTitle>
          </DialogHeader>
          <form onSubmit={add} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Nome</Label>
              <Input
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Tesouro Selic"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Investment["kind"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixa">Renda fixa</SelectItem>
                  <SelectItem value="variavel">Renda variável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Cadastrar</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!aporte} onOpenChange={(o) => !o && setAporte(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo aporte</DialogTitle>
          </DialogHeader>
          <form onSubmit={addAporte} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Valor</Label>
              <Input
                inputMode="decimal"
                value={aporte?.amount ?? ""}
                onChange={(e) => aporte && setAporte({ ...aporte, amount: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={aporte?.date ?? today()}
                onChange={(e) => aporte && setAporte({ ...aporte, date: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Sai da conta</Label>
              <Select
                value={aporte?.accountId || "none"}
                onValueChange={(value) =>
                  aporte && setAporte({ ...aporte, accountId: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não debitar nenhuma conta</SelectItem>
                  {s.accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              {aporte?.accountId
                ? "O valor sai desta conta. O patrimônio total não muda."
                : "Sem conta de origem, o valor entra no investimento e não sai de nenhuma conta. O patrimônio sobe."}
            </p>
            <Button type="submit">Registrar aporte</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!resgate} onOpenChange={(o) => !o && setResgate(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resgatar para a conta</DialogTitle>
          </DialogHeader>
          <form onSubmit={addResgate} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Valor</Label>
              <Input
                inputMode="decimal"
                value={resgate?.amount ?? ""}
                onChange={(e) => resgate && setResgate({ ...resgate, amount: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={resgate?.date ?? today()}
                onChange={(e) => resgate && setResgate({ ...resgate, date: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Entra na conta</Label>
              <Select
                value={resgate?.accountId ?? ""}
                onValueChange={(value) => resgate && setResgate({ ...resgate, accountId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a conta" />
                </SelectTrigger>
                <SelectContent>
                  {s.accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              O valor sai do investimento e entra na conta. O patrimônio total não muda.
            </p>
            <Button type="submit" disabled={s.accounts.length === 0}>
              Registrar resgate
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!valor} onOpenChange={(o) => !o && setValor(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar valor</DialogTitle>
          </DialogHeader>
          <form onSubmit={addValor} className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Informe quanto essa posição vale hoje. O rendimento é a diferença para o que ainda
              está aplicado, já descontando os resgates.
            </p>
            <div className="grid gap-1.5">
              <Label>Valor atual</Label>
              <Input
                inputMode="decimal"
                value={valor?.amount ?? ""}
                onChange={(e) => valor && setValor({ ...valor, amount: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={valor?.date ?? today()}
                onChange={(e) => valor && setValor({ ...valor, date: e.target.value })}
              />
            </div>
            <Button type="submit">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
