/** Parses Brazilian money typed as 1.234,56, 1234,56 or 1234.56. */
export function parseMoney(value: string): number {
  const trimmed = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!trimmed || trimmed === "-" || trimmed === ",") return Number.NaN;
  const negative = trimmed.startsWith("-");
  const body = negative ? trimmed.slice(1) : trimmed;
  const normal = body.includes(",")
    ? body.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(body)
      ? body.replace(/\./g, "")
      : body;
  if (!/^\d+(\.\d+)?$/.test(normal)) return Number.NaN;
  const amount = Number(normal);
  if (!Number.isFinite(amount)) return Number.NaN;
  return negative ? -amount : amount;
}
