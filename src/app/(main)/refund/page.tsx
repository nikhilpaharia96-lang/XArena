import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { REFUND } from "@/content/legal/refund";

export const metadata: Metadata = { title: "Refund Policy" };

export default function Page() {
  return <LegalPage doc={REFUND} />;
}
