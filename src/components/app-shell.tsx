import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Calendar,
  CreditCard,
  FileText,
  Landmark,
  LayoutDashboard,
  Menu,
  Moon,
  Sun,
  Target,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { lockSession, useVaultStatus } from "@/lib/finance";
import { LockScreen, PrivacyButton } from "@/components/privacy-lock";

const groups = [
  {
    label: "Visão geral",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
      { to: "/calendario", label: "Calendário", icon: Calendar },
    ],
  },
  {
    label: "Gerenciar",
    items: [
      { to: "/contas", label: "Contas", icon: Landmark },
      { to: "/cartoes", label: "Cartões", icon: CreditCard },
      { to: "/investimentos", label: "Investimentos", icon: TrendingUp },
    ],
  },
  {
    label: "Planejar",
    items: [
      { to: "/planejamento", label: "Planejamento", icon: Target },
      { to: "/relatorios", label: "Relatórios", icon: FileText },
    ],
  },
] as const;

function useTheme() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    setDark(localStorage.getItem("theme") !== "light");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark] as const;
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useTheme();
  const status = useVaultStatus();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (status !== "open") return;
    const idleMs = 15 * 60 * 1000;
    let timer = window.setTimeout(lockSession, idleMs);
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lockSession, idleMs);
    };
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [status]);
  useEffect(() => {
    const onPersistError = () =>
      toast.error(
        "Não foi possível salvar neste navegador. O armazenamento pode estar cheio ou bloqueado.",
      );
    window.addEventListener("saldo-persist-error", onPersistError);
    return () => window.removeEventListener("saldo-persist-error", onPersistError);
  }, []);

  const nav = (
    <nav className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center gap-2.5 px-2 pt-1">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Wallet className="h-5 w-5" />
        </div>
        <span className="font-display text-lg font-semibold">Saldo</span>
      </div>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 px-3 text-xs font-medium text-muted-foreground">{g.label}</p>
            {g.items.map((it) => {
              const active = it.to === "/" ? path === "/" : path.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-semibold text-sidebar-primary shadow-[inset_3px_0_0_var(--sidebar-primary)]"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                  )}
                >
                  <it.icon className="h-4 w-4 shrink-0" />
                  {it.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <PrivacyButton />
      <button
        onClick={() => setDark(!dark)}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {dark ? "Tema claro" : "Tema escuro"}
      </button>
    </nav>
  );

  if (status === "locked") return <LockScreen />;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="fade-up absolute inset-y-0 left-0 w-64 border-r border-sidebar-border bg-sidebar">
            <button
              className="absolute right-3 top-4 p-1"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display font-semibold">Saldo</span>
        </div>
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: typeof Wallet;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-2 font-display font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function Money({
  value,
  type,
  className,
}: {
  value: number;
  type?: "receita" | "despesa";
  className?: string;
}) {
  const sign = type === "receita" ? "+" : type === "despesa" ? "−" : "";
  return (
    <span
      className={cn(
        "tabular-nums",
        type === "receita" && "text-income",
        type === "despesa" && "text-expense",
        className,
      )}
    >
      {sign}
      {Math.abs(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
    </span>
  );
}
