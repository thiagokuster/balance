import { passwordStrength } from "@/lib/password";

const LABELS = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"] as const;

export function PasswordMeter({ value }: { value: string }) {
  const score = passwordStrength(value);
  const tone = score <= 1 ? "bg-expense" : score === 2 ? "bg-warning" : "bg-income";
  return (
    <div className="grid gap-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone}`} style={{ width: `${(score / 4) * 100}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {value
          ? LABELS[score]
          : "Use 12 caracteres ou mais. Sequências, repetições e senhas comuns são recusadas."}
      </p>
    </div>
  );
}
