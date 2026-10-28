import type { Metadata } from "next";
import PaystackVerificationPage from "@/components/public/pages/PaystackVerificationPage";

export const metadata: Metadata = { title: "Verifying payment", robots: { index: false, follow: false } };

export default function Page() {
  return <PaystackVerificationPage />;
}
