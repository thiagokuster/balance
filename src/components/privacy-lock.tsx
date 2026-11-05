import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
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
import { disableVault, enableVault, lockSession, unlockVault, useVaultStatus } from "@/lib/finance";

export function LockScreen() {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [failures, setFailures] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (wait > 0) return;
    setBusy(true);
    const ok = await unlockVault(secret);
    setBusy(false);
    setSecret("");
    if (ok) {
      setFailures(0);
      return;
    }
    const next = failures + 1;
    setFailures(next);
    setWait(Math.min(60, 2 ** (next - 1)));
    toast.error("Senha incorreta.");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <form onSubmit={submit} className="panel panel-glow w-full max-w-sm p-6">
        <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Shield className="h-5 w-5" />
        </div>
        <h1 className="font-display text-2xl font-semibold">Saldo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A senha abre os dados criptografados neste navegador. Ela não sai daqui.
        </p>
        <Label className="mt-5 block">Senha</Label>
        <Input
          className="mt-1.5"
          type="password"
          autoFocus
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoComplete="current-password"
        />
        <Button
          className="mt-4 w-full"
          type="submit"
          disabled={busy || wait > 0 || secret.length < 1}
        >
          {wait > 0 ? `Aguarde ${wait}s` : "Entrar"}
        </Button>
      </form>
    </div>
  );
}

export function PrivacyButton() {
  const status = useVaultStatus();
  const enabled = status !== "off";
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [again, setAgain] = useState("");
  const [current, setCurrent] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (secret.length < 12 || secret.length > 128) {
      toast.error("Use uma senha de 12 a 128 caracteres.");
      return;
    }
    if (secret !== again) {
      toast.error("As senhas não coincidem.");
      return;
    }
    try {
      await enableVault(secret);
      setSecret("");
      setAgain("");
      setOpen(false);
      toast.success("Dados criptografados neste navegador");
    } catch {
      toast.error("Não foi possível ativar a senha.");
    }
  }

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!(await disableVault(current))) {
      toast.error("Senha incorreta.");
      return;
    }
    setCurrent("");
    setOpen(false);
    toast.success("Criptografia removida. Os dados ficam só neste navegador.");
  }

  return (
    <div className="grid gap-1">
      {status === "open" && (
        <button
          type="button"
          onClick={() => lockSession()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground hover:bg-sidebar-accent/60"
        >
          <Shield className="h-4 w-4" />
          Bloquear agora
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground hover:bg-sidebar-accent/60">
            <Shield className="h-4 w-4" />
            {enabled ? "Senha ativa" : "Proteger com senha"}
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{enabled ? "Remover criptografia" : "Senha deste navegador"}</DialogTitle>
          </DialogHeader>
          {enabled ? (
            <form onSubmit={remove} className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                Sem a senha, qualquer pessoa com acesso a este navegador consegue ler os
                lançamentos.
              </p>
              <div className="grid gap-1.5">
                <Label>Senha atual</Label>
                <Input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" variant="destructive">
                Remover senha
              </Button>
            </form>
          ) : (
            <form onSubmit={save} className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                A senha criptografa receitas, despesas e saldos antes de gravar. Ela não é enviada
                para lugar nenhum.
              </p>
              <div className="grid gap-1.5">
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Repetir</Label>
                <Input
                  type="password"
                  value={again}
                  onChange={(e) => setAgain(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit">Criptografar dados</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
