/** Shared (client + server) bank-account helpers for withdrawals. */

export const MAX_BANKS = 3;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** First four letters of an IFSC identify the bank. Used to auto-fill the bank and catch mismatches. */
export const BANKS: { name: string; prefix: string }[] = [
  { name: "State Bank of India", prefix: "SBIN" },
  { name: "HDFC Bank", prefix: "HDFC" },
  { name: "ICICI Bank", prefix: "ICIC" },
  { name: "Axis Bank", prefix: "UTIB" },
  { name: "Kotak Mahindra Bank", prefix: "KKBK" },
  { name: "Punjab National Bank", prefix: "PUNB" },
  { name: "Bank of Baroda", prefix: "BARB" },
  { name: "Canara Bank", prefix: "CNRB" },
  { name: "Union Bank of India", prefix: "UBIN" },
  { name: "Bank of India", prefix: "BKID" },
  { name: "Indian Bank", prefix: "IDIB" },
  { name: "Central Bank of India", prefix: "CBIN" },
  { name: "Indian Overseas Bank", prefix: "IOBA" },
  { name: "UCO Bank", prefix: "UCBA" },
  { name: "Bank of Maharashtra", prefix: "MAHB" },
  { name: "Punjab & Sind Bank", prefix: "PSIB" },
  { name: "IDBI Bank", prefix: "IBKL" },
  { name: "Yes Bank", prefix: "YESB" },
  { name: "IndusInd Bank", prefix: "INDB" },
  { name: "IDFC FIRST Bank", prefix: "IDFB" },
  { name: "Federal Bank", prefix: "FDRL" },
  { name: "RBL Bank", prefix: "RATN" },
  { name: "South Indian Bank", prefix: "SIBL" },
  { name: "Karnataka Bank", prefix: "KARB" },
  { name: "Karur Vysya Bank", prefix: "KVBL" },
  { name: "City Union Bank", prefix: "CIUB" },
  { name: "Bandhan Bank", prefix: "BDBL" },
  { name: "Jammu & Kashmir Bank", prefix: "JAKA" },
  { name: "AU Small Finance Bank", prefix: "AUBL" },
  { name: "Equitas Small Finance Bank", prefix: "ESFB" },
  { name: "Ujjivan Small Finance Bank", prefix: "UJVN" },
  { name: "Paytm Payments Bank", prefix: "PYTM" },
  { name: "Airtel Payments Bank", prefix: "AIRP" },
  { name: "India Post Payments Bank", prefix: "IPOS" },
  { name: "Standard Chartered Bank", prefix: "SCBL" },
  { name: "HSBC Bank", prefix: "HSBC" },
  { name: "DBS Bank India", prefix: "DBSS" },
];

export const OTHER_BANK = "Other bank";

export function bankFromIfsc(ifsc: string): string | null {
  const prefix = ifsc.slice(0, 4).toUpperCase();
  return BANKS.find((b) => b.prefix === prefix)?.name ?? null;
}
