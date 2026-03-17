/** Format a numeric value to 6 significant digits. Non-numeric values are returned as-is. */
export function formatValueToSigFigs(v: string | number | null | undefined, sigFigs = 6): string {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (n === 0) return "0";
  return Number(n.toPrecision(sigFigs)).toString();
}
