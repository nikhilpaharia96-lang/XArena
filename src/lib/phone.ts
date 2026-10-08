/** Country dial codes offered on signup. `len` = allowed national-number digit lengths. */
export const COUNTRY_CODES = [
  { iso: "IN", dial: "+91", label: "IN (+91)", min: 10, max: 10 },
  { iso: "NP", dial: "+977", label: "NP (+977)", min: 10, max: 10 },
  { iso: "BD", dial: "+880", label: "BD (+880)", min: 10, max: 10 },
  { iso: "PK", dial: "+92", label: "PK (+92)", min: 10, max: 10 },
  { iso: "LK", dial: "+94", label: "LK (+94)", min: 9, max: 9 },
  { iso: "AE", dial: "+971", label: "AE (+971)", min: 9, max: 9 },
  { iso: "GB", dial: "+44", label: "GB (+44)", min: 10, max: 10 },
  { iso: "US", dial: "+1", label: "US (+1)", min: 10, max: 10 },
] as const;

export const DIAL_CODES = COUNTRY_CODES.map((c) => c.dial) as [string, ...string[]];

/** Returns an error message, or null when the number is valid for the dial code. */
export function validatePhone(dial: string, phone: string): string | null {
  const c = COUNTRY_CODES.find((x) => x.dial === dial);
  if (!c) return "Select a country code";
  if (!/^\d+$/.test(phone)) return "Digits only";
  if (phone.length < c.min || phone.length > c.max) return `Enter a valid ${c.min}-digit number`;
  if (c.iso === "IN" && !/^[6-9]/.test(phone)) return "Indian numbers start with 6, 7, 8 or 9";
  return null;
}
