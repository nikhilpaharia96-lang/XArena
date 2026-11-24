import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { PRIVACY } from "@/content/legal/privacy";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return <LegalPage doc={PRIVACY} />;
}
