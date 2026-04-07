/** Locale and ISO currency code for monetary amounts shown in the UI. */
const DISPLAY_LOCALE = "en-US";
/** Currency used by {@link formatCurrencyValue} and chart axis compact labels. */
export const DISPLAY_CURRENCY_CODE = "USD";

let _currencyFormatter: Intl.NumberFormat | null = null;
let _compactCurrencyFormatter: Intl.NumberFormat | null = null;

function currencyFormatter(): Intl.NumberFormat {
  if (!_currencyFormatter) {
    _currencyFormatter = new Intl.NumberFormat(DISPLAY_LOCALE, {
      style: "currency",
      currency: DISPLAY_CURRENCY_CODE,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return _currencyFormatter;
}

function compactCurrencyFormatter(): Intl.NumberFormat {
  if (!_compactCurrencyFormatter) {
    _compactCurrencyFormatter = new Intl.NumberFormat(DISPLAY_LOCALE, {
      style: "currency",
      currency: DISPLAY_CURRENCY_CODE,
      notation: "compact",
      compactDisplay: "short",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  return _compactCurrencyFormatter;
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
 * Short currency for chart axes: $1.2M, $450K, $3.5B — avoids long runs of zeros on the Y axis.
 */
export function formatCompactCurrencyAxis(v: string | number | null | undefined): string {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return compactCurrencyFormatter().format(n);
}

/**
 * Same as {@link formatCurrencyValue} — kept for existing imports across the app.
 */
export function formatValueToSigFigs(v: string | number | null | undefined, _sigFigs?: number): string {
  return formatCurrencyValue(v);
}
