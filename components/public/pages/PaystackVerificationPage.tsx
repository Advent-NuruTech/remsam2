"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart } from "@/components/providers/CartProvider";
import { api } from "@/lib/api";

type OrderVerifyResponse = { state: "paid" | "pending" | "failed"; orderNumber: string };
type DonationVerifyResponse = { state: "succeeded" | "pending" | "failed" };
type State = "loading" | "success" | "pending" | "failed";

export default function PaystackVerificationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebaseUser, loading: authLoading } = useAuth();
  const { clearCart } = useCart();
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("Confirming your secure payment…");
  const reference = searchParams.get("reference") ?? "";
  const isDonation = /^RD-[A-Za-z0-9_-]{16,100}$/.test(reference);

  const verify = useCallback(async () => {
    if (!reference) { setState("failed"); setMessage("We did not receive a payment reference from Paystack."); return; }
    setState("loading"); setMessage("Confirming your secure payment…");
    try {
      if (isDonation) {
        const result = await api.post<DonationVerifyResponse>("/api/donations/paystack/verify", { reference });
        if (result.state === "succeeded") { setState("success"); setMessage("Thank you. Your donation was received successfully."); return; }
        if (result.state === "pending") { setState("pending"); setMessage("Your donation is still being confirmed. You can check again in a moment."); return; }
        setState("failed"); setMessage("Paystack did not confirm this donation. No payment was accepted."); return;
      }
      const result = await api.post<OrderVerifyResponse>("/api/payments/paystack/verify", { reference });
      if (result.state === "paid") { clearCart(); router.replace(`/order-confirmation/${encodeURIComponent(result.orderNumber)}`); return; }
      if (result.state === "pending") { setState("pending"); setMessage("Your payment is still being confirmed. You can check again in a moment."); return; }
      setState("failed"); setMessage("Paystack did not confirm this payment. No payment was accepted for this order.");
    } catch (error) { setState("failed"); setMessage(error instanceof Error ? error.message : "We could not verify this payment."); }
  }, [clearCart, isDonation, reference, router]);

  useEffect(() => { if (isDonation || (!authLoading && firebaseUser)) void verify(); }, [authLoading, firebaseUser, isDonation, verify]);
  if (!isDonation && !authLoading && !firebaseUser) return <main className="min-h-screen bg-slate-50 px-4 pt-28"><section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><ShieldCheck className="mx-auto h-11 w-11 text-emerald-700" /><h1 className="mt-4 text-2xl font-bold text-slate-900">Sign in to confirm payment</h1><p className="mt-2 text-slate-600">Use the same account you used at checkout so we can securely verify this Paystack payment.</p><Link href={`/sign-in?returnTo=${encodeURIComponent(`/payment/verify?reference=${reference}`)}`} className="mt-6 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">Sign in</Link></section></main>;
  const icon = state === "loading" ? <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-emerald-700" /> : state === "success" ? <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-700" /> : state === "pending" ? <ShieldCheck className="mx-auto h-12 w-12 text-amber-600" /> : <XCircle className="mx-auto h-12 w-12 text-red-600" />;
  return <main className="min-h-screen bg-slate-50 px-4 pt-28"><section aria-live="polite" className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">{icon}<h1 className="mt-4 text-2xl font-bold text-slate-900">{state === "loading" ? "Verifying payment" : state === "success" ? "Donation received" : state === "pending" ? "Payment confirmation pending" : "Payment not confirmed"}</h1><p className="mt-3 text-slate-600">{message}</p>{state === "pending" && <button type="button" onClick={() => void verify()} className="mt-6 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">Check payment again</button>}{state === "success" && isDonation && <Link href="/donate" className="mt-6 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">Give again</Link>}{state === "failed" && <Link href={isDonation ? "/donate" : "/checkout"} className="mt-6 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">{isDonation ? "Return to donations" : "Return to checkout"}</Link>}<p className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500"><CheckCircle2 size={16} className="text-emerald-700" /> Payment details are verified securely with Paystack.</p></section></main>;
}
