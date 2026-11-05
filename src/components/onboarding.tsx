import { useState } from "react";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordMeter } from "@/components/password-meter";
import { declineProtection, enableVault } from "@/lib/finance";
import { passwordIssue } from "@/lib/password";

export function Onboarding() {
  const [secret, setSecret] = useState("");
  const [again, setAgain] = useState("");
  const [risk, setRisk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const issue = passwordIssue(secret);
    if (issue) {
      toast.error(issue);
      return;
    }
    if (secret !== again) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      await enableVault(secret);
      sessionStorage.setItem("saldo-pedir-backup", "1");
      toast.success("Senha criada. Faça um backup: se esquecê-la, não há recuperação.");
    } catch {
      toast.error("Não foi possível criar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="panel panel-glow w-full max-w-md p-6">
        <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Shield className="h-5 w-5" />
        </div>
        <h1 className="font-display text-2xl font-semibold">Proteja o Saldo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A senha criptografa receitas, despesas e saldos neste navegador. Ela não é enviada para
          lugar nenhum. Se você esquecer, não existe “esqueci minha senha”: os dados deste
          computador se perdem. Depois de entrar, faça um backup.
        </p>
        {risk ? (
          <div className="mt-5 grid gap-3">
            <p className="text-sm">
              Sem senha, qualquer pessoa com acesso a este navegador lê os lançamentos. Os dados
              continuam só neste computador, mas ficam sem criptografia.
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                declineProtection();
                toast.message("Os dados deste navegador ficam sem senha.");
              }}
            >
              Entendi o risco e quero continuar
            </Button>
            <Button type="button" variant="outline" onClick={() => setRisk(false)}>
              Voltar e criar senha
            </Button>
          </div>
        ) : (
          <form onSubmit={save} className="mt-5 grid gap-3">
            <div className="grid gap-1.5">
              <Label>Nova senha</Label>
              <Input
                type="password"
                autoFocus
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="new-password"
              />
              <PasswordMeter value={secret} />
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
            <Button type="submit" disabled={busy}>
              Criar senha e criptografar
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setRisk(true)}
            >
              Continuar sem senha
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
