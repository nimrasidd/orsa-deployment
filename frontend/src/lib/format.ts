/** Locale and ISO currency code for monetary amounts shown in the UI. */
const DISPLAY_LOCALE = "en-US";
const DISPLAY_CURRENCY = "USD";

let _currencyFormatter: Intl.NumberFormat | null = null;

function currencyFormatter(): Intl.NumberFormat {
  if (!_currencyFormatter) {
    _currencyFormatter = new Intl.NumberFormat(DISPLAY_LOCALE, {
      style: "currency",
      currency: DISPLAY_CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return _currencyFormatter;
}

/**
 * Formats a number as currency (grouping commas + symbol), e.g. $1,234.56.
 * Non-finite or non-numeric input is returned as a string for display.
 */
export function formatCurrencyValue(v: string | number | null | undefined): string {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return currencyFormatter().format(n);
}

/**
 * Same as {@link formatCurrencyValue} — kept for existing imports across the app.
 */
export function formatValueToSigFigs(v: string | number | null | undefined, _sigFigs?: number): string {
  return formatCurrencyValue(v);
}
