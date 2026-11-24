/** UTRs are 12 digits for UPI; some banks/apps issue 12-22 char alphanumeric references. */
export const UTR_REGEX = /^[A-Z0-9]{12,22}$/;

export function normalizeUtr(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}
