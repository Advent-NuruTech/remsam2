"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Clock3, HeartHandshake, RefreshCw, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/components/providers/AuthProvider";
import type { DonationCurrency } from "@/lib/donation-options";
import { api } from "@/lib/api";

type Quote = { quoteId: string; amountKes: number; conversionRate: number; expiresAt: string };
type Checkout = { state: "pending" | "succeeded"; donationId: string; authorizationUrl?: string };

const formatKes = (value: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value);

export default function DonatePage() {
  const { user } = useAuth();
  const [currency, setCurrency] = useState<DonationCurrency>("KES");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { if (user) { setName((value) => value || user.name || ""); setEmail((value) => value || user.email || ""); } }, [user]);
  useEffect(() => { if (!quote) return; const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, [quote]);

  const value = Number(amount);
  const validAmount = Number.isFinite(value) && value >= 1 && (currency === "KES" ? Number.isInteger(value) && value <= 10_000_000 : Math.round(value * 100) === value * 100 && value <= 100_000);
  const secondsRemaining = quote ? Math.max(0, Math.ceil((new Date(quote.expiresAt).getTime() - now) / 1_000)) : 0;
  const activeQuote = quote && secondsRemaining > 0 ? quote : null;
  const chosenKes = currency === "KES" && validAmount ? value : activeQuote?.amountKes;

  function chooseCurrency(next: DonationCurrency) { setCurrency(next); setQuote(null); }
  async function getQuote() {
    if (!validAmount) return void toast.error("Enter a valid USD amount before getting a quote.");
    setQuoteLoading(true);
    try { setQuote(await api.post<Quote>("/api/donations/quote", { currency: "USD", amount: value })); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not get a current KES quote."); }
    finally { setQuoteLoading(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) return void toast.error("Enter a valid email so Paystack can process your donation.");
    if (!validAmount) return void toast.error(currency === "KES" ? "Enter a whole KES amount." : "Enter a valid USD amount with up to two decimal places.");
    if (currency === "USD" && !activeQuote) return void toast.error("Get a current KES quote before continuing.");
    setSubmitting(true);
    try {
      const checkout = await api.post<Checkout>("/api/donations/paystack/initialize", { currency, amount: value, name, email, purpose, ...(activeQuote ? { quoteId: activeQuote.quoteId } : {}), idempotencyKey: crypto.randomUUID() });
      if (checkout.state === "succeeded") { toast.success("This donation has already been confirmed. Thank you."); return; }
      if (!checkout.authorizationUrl) throw new Error("Secure donation checkout could not be started. Please try again.");
      window.location.assign(checkout.authorizationUrl);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not start secure donation checkout."); }
    finally { setSubmitting(false); }
  }

  const redButton = "min-h-12 flex-1 rounded-xl bg-red-600 px-6 py-3 font-bold text-white transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50";
  return <main className="min-h-screen bg-slate-50 px-4 py-10 pb-32 sm:py-12 sm:pb-28">
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
      <section className="rounded-2xl bg-emerald-950 p-7 text-white shadow-xl shadow-emerald-950/15 sm:p-10 lg:sticky lg:top-8">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-amber-300"><HeartHandshake size={27} /></span>
        <p className="mt-7 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">Give with confidence</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Support our work.</h1>
        <p className="mt-5 max-w-lg text-lg leading-8 text-emerald-50/85">Your gift helps share faith, provide study resources, and strengthen practical ministry in the community.</p>
        <ul className="mt-8 space-y-4 text-sm text-emerald-50/90"><li className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-amber-300" size={19} />Every donation is securely charged and recorded in Kenyan shillings.</li><li className="flex gap-3"><Check className="mt-0.5 shrink-0 text-amber-300" size={19} />USD gifts receive a live KES quote before you proceed.</li><li className="flex gap-3"><Check className="mt-0.5 shrink-0 text-amber-300" size={19} />Enter an amount that is right for you.</li></ul>
      </section>
      <form id="donation-checkout" className="space-y-5" onSubmit={submit}>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Donation checkout</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Choose your gift</h2><p className="mt-2 text-sm leading-6 text-slate-600">Payment is processed by Paystack. The final charge is always in KES.</p></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><fieldset><legend className="text-lg font-bold text-slate-900">Currency you are giving from</legend><div className="mt-4 grid grid-cols-2 gap-3">{(["KES", "USD"] as const).map((item) => <button key={item} type="button" onClick={() => chooseCurrency(item)} aria-pressed={currency === item} className={"rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 " + (currency === item ? "border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700" : "border-slate-200 hover:border-emerald-300")}><span className="block font-bold text-slate-900">{item}</span><span className="mt-1 block text-sm text-slate-600">{item === "KES" ? "Charge the amount entered" : "Convert to KES first"}</span></button>)}</div></fieldset></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><label htmlFor="donation-amount" className="block text-lg font-bold text-slate-900">Donation amount <span aria-hidden="true">*</span><span className="ml-2 text-sm font-normal text-slate-500">({currency})</span></label><p className="mt-1 text-sm text-slate-500">{currency === "KES" ? "Enter a whole amount in Kenyan shillings." : "Enter the USD amount you would like to give. You will receive a KES quote before payment."}</p><div className="relative mt-4"><span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 font-semibold text-slate-500">{currency === "KES" ? "KES" : "$"}</span><input id="donation-amount" required type="number" inputMode="decimal" min="1" max={currency === "KES" ? 10_000_000 : 100_000} step={currency === "KES" ? "1" : "0.01"} value={amount} onChange={(event) => { setAmount(event.target.value); setQuote(null); }} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-16 pr-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200" placeholder={currency === "KES" ? "1000" : "10.00"} /></div><p className="mt-2 text-xs text-slate-500">{currency === "KES" ? "This exact KES amount will be charged." : "USD is converted to KES; Paystack charges only the quoted KES total."}</p></section>
        {currency === "USD" && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-amber-950">Live USD → KES conversion</p>{activeQuote ? <><p className="mt-1 text-lg font-bold text-amber-950"><span>$</span>{amount} = {formatKes(activeQuote.amountKes)}</p><p className="mt-1 text-sm text-amber-900">Rate: 1 USD = {activeQuote.conversionRate.toFixed(2)} KES · Quote held for <span className="font-semibold tabular-nums">{Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, "0")}</span></p></> : <p className="mt-1 text-sm text-amber-900">Get the current KES amount before opening secure checkout.</p>}</div><button type="button" onClick={() => void getQuote()} disabled={quoteLoading || !validAmount} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-60"><RefreshCw size={16} className={quoteLoading ? "animate-spin" : ""} />{activeQuote ? "Refresh quote" : "Get KES quote"}</button></div></section>}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Donor details</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Name <span className="font-normal text-slate-500">(optional)</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="name" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200" placeholder="Anonymous if left blank" /></label><label className="block text-sm font-medium text-slate-700">Email <span aria-hidden="true">*</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200" placeholder="you@example.com" /></label></div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><label className="block text-lg font-bold text-slate-900">Donation purpose <span className="text-sm font-normal text-slate-500">(optional)</span><textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} maxLength={300} rows={3} className="mt-3 w-full resize-y rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200" placeholder="For example: study materials or community outreach" /></label></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Secure payment</h2><p className="mt-2 text-sm text-slate-600">You will complete payment on Paystack&apos;s secure checkout. RemSam never receives your card or mobile-money details.</p><div className="mt-5 rounded-xl bg-slate-950 p-5 text-white"><p className="text-sm text-slate-300">Amount to be charged</p><p className="mt-1 text-3xl font-bold">{chosenKes ? formatKes(chosenKes) : currency === "USD" ? "Get a KES quote" : "Enter a KES amount"}</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-300"><Clock3 size={16} className="text-emerald-300" />{currency === "USD" ? "The quoted KES total is the only amount Paystack will charge." : "This exact KES amount will be charged."}</p></div></section>
      </form>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur"><div className="mx-auto flex max-w-3xl items-center gap-3"><p className="hidden text-sm font-medium text-slate-600 sm:block">Secure Paystack payment</p><button form="donation-checkout" type="submit" disabled={submitting || !validAmount || (currency === "USD" && !activeQuote)} className={redButton}><span className="inline-flex items-center gap-2"><ShieldCheck size={19} />{submitting ? "Connecting to secure environment…" : "Continue to secure payment"}</span></button></div></div>
  </main>;
}
