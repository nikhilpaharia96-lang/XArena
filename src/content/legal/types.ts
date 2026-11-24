export interface LegalSection {
  title: string;
  /** Plain paragraphs, rendered in order. */
  paras?: string[];
  /** Bullet list rendered after the paragraphs. */
  bullets?: string[];
  /** Paragraphs rendered after the bullets. */
  after?: string[];
}

export interface LegalDoc {
  slug: "terms" | "privacy" | "refund";
  title: string;
  intro: string;
  sections: LegalSection[];
}

/** Bump when any policy text changes in a way users should know about. */
export const LEGAL_LAST_UPDATED = "25 November 2026";
