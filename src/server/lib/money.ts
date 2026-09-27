/**
 * All monetary values in this app are stored and passed around as integer
 * paise (1 rupee = 100 paise) — never as floating point rupees. This avoids
 * an entire class of rounding bugs common in payment systems. Convert to a
 * display string only at the very edge (UI render).
 */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paiseToRupees(paise));
}
