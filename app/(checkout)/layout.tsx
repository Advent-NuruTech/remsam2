import type { ReactNode } from "react";
import Header from "@/components/public/Header";
import FloatingActions from "@/components/public/FloatingActions";
import ScrollToTop from "@/components/public/ScrollToTop";

/** Checkout intentionally omits the public-site footer to keep payment focused. */
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <main className="flex-grow">{children}</main>
      <FloatingActions />
    </div>
  );
}
