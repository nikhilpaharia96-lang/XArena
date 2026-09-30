/** Frontend-side formatting helpers. Mirrors src/server/lib/money.ts but this
 * copy has zero server dependencies so it's safe in client components. */

export function formatPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

/** Like formatPaise but keeps paise — for wallet balances where ₹0.11 must not display as ₹0. */
export function formatPaiseExact(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function formatDateTimeFull(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const abs = Math.abs(diffMin);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffMin, "minute");
  if (abs < 60 * 24) return rtf.format(Math.round(diffMin / 60), "hour");
  return rtf.format(Math.round(diffMin / (60 * 24)), "day");
}

export function gameModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    SOLO: "Solo",
    DUO: "Duo",
    SQUAD: "Squad",
    ONE_V_ONE: "1v1",
    TWO_V_TWO: "2v2",
    FOUR_V_FOUR: "4v4",
    CLASSIC: "Classic",
    CLASH_SQUAD: "Clash Squad",
    CUSTOM: "Custom",
  };
  return labels[mode] ?? mode;
}

export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}
