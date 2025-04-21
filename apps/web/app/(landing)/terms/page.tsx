import type { Metadata } from "next";
import { TermsContent } from "@/app/(landing)/terms/content";

export const metadata: Metadata = {
  title: "Terms of Service - UIP Control",
  description: "Terms of Service - UIP Control",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return <TermsContent />;
}
