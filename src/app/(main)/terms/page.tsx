import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { TERMS } from "@/content/legal/terms";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function Page() {
  return <LegalPage doc={TERMS} />;
}
