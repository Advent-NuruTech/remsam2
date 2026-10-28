"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Clock3, HeartHandshake, RefreshCw, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/components/providers/AuthProvider";
import { DONATION_AMOUNTS, type DonationCurrency } from "@/lib/donation-options";
import { api } from "@/lib/api";

type Quote = { quoteId: string; amountKes: number; conversionRate: number; expiresAt: string };
type Checkout = { state: "pending" | "succeeded"; donationId: string; authorizationUrl?: string };

function kes(value: number) { return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value); }

export default function DonatePage() {
  const { user } = useAuth();
  const [currency, setCurrency] = useState<DonationCurrency>("KES");
  const [amount, setAmount] = useState<number>(DONATION_AMOUNTS.KES[1]);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [purpose, setPurpose] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null); const [quoteLoading, setQuoteLoading] = useState(false); const [submitting, setSubmitting] = useState(false); const [now, setNow] = useState(Date.now());
  useEffect(() => { if (user) { setName((value) => value || user.name || ""); setEmail((value) => value || user.email || ""); } }, [user]);
  useEffect(() => { if (!quote) return; const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, [quote]);
  const quoteExpiresIn = quote ? Math.max(0, Math.ceil((new Date(quote.expiresAt).getTime() - now) / 1_000)) : 0;
  const activeQuote = quote && quoteExpiresIn > 0 ? quote : null;
  const minutes = Math.floor(quoteExpiresIn / 60); const seconds = String(quoteExpiresIn % 60).padStart(2, "0");
  function chooseCurrency(next: DonationCurrency) { setCurrency(next); setAmount(DONATION_AMOUNTS[next][1]); setQuote(null); }
  async function getQuote() { setQuoteLoading(true); try { setQuote(await api.post<Quote>("/api/donations/quote", { currency: "USD", amount })); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not get a current KES quote."); } finally { setQuoteLoading(false); } }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) return void toast.error("Enter a valid email so Paystack can process your donation.");
    if (currency === "USD" && !activeQuote) return void toast.error("Get a current KES quote before continuing.");
    setSubmitting(true);
    try {
      const checkout = await api.post<Checkout>("/api/donations/paystack/initialize", { currency, amount, name, email, purpose, ...(activeQuote ? { quoteId: activeQuote.quoteId } : {}), idempotencyKey: crypto.randomUUID() });
      if (checkout.state === "succeeded") { toast.success("This donation has already been confirmed. Thank you."); return; }
      if (!checkout.authorizationUrl) throw new Error("Secure donation checkout could not be started. Please try again.");
      window.location.assign(checkout.authorizationUrl);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not start secure donation checkout."); } finally { setSubmitting(false); }
  }
  const chosenKes = useMemo(() => currency === "KES" ? amount : activeQuote?.amountKes, [activeQuote?.amountKes, amount, currency]);
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfdf5,_#f8fafc_48%,_#f0fdf4)] px-4 py-10 sm:py-16"><div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
    <section className="rounded-3xl bg-emerald-950 p-7 text-white shadow-xl shadow-emerald-950/15 sm:p-10 lg:sticky lg:top-8"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-amber-300"><HeartHandshake size={27} /></span><p className="mt-7 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">Give with confidence</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Support our work.</h1><p className="mt-5 max-w-lg text-lg leading-8 text-emerald-50/85">Your gift helps share faith, provide study resources, and strengthen practical ministry in the community.</p><ul className="mt-8 space-y-4 text-sm text-emerald-50/90"><li className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-amber-300" size={19} />Every donation is securely charged and recorded in Kenyan shillings.</li><li className="flex gap-3"><Check className="mt-0.5 shrink-0 text-amber-300" size={19} />USD gifts receive a live KES quote before you proceed.</li><li className="flex gap-3"><Check className="mt-0.5 shrink-0 text-amber-300" size={19} />Choose a preset amount—there is no custom amount field.</li></ul></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/5 sm:p-8"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Donation checkout</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Choose your gift</h2><p className="mt-2 text-sm leading-6 text-slate-600">Payment is processed by Paystack. The final charge is always in KES.</p></div><form className="mt-8 space-y-7" onSubmit={submit}>
      <fieldset><legend className="text-sm font-semibold text-slate-800">Currency you are giving from</legend><div className="mt-3 grid grid-cols-2 gap-3">{(["KES", "USD"] as const).map((item) => <button key={item} type="button" onClick={() => chooseCurrency(item)} aria-pressed={currency === item} className={`rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${currency === item ? "border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700" : "border-slate-200 hover:border-emerald-300"}`}><span className="block font-bold text-slate-900">{item}</span><span className="mt-1 block text-sm text-slate-600">{item === "KES" ? "Charge the selected amount" : "Convert to KES first"}</span></button>)}</div></fieldset>
      <fieldset><legend className="text-sm font-semibold text-slate-800">Select an amount</legend><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{DONATION_AMOUNTS[currency].map((option) => <button key={option} type="button" onClick={() => { setAmount(option); setQuote(null); }} aria-pressed={amount === option} className={`min-h-14 rounded-xl border px-3 font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${amount === option ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 text-slate-800 hover:border-emerald-300 hover:bg-emerald-50"}`}>{currency === "KES" ? kes(option) : `$${option}`}</button>)}</div></fieldset>
      {currency === "USD" && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-amber-950">Live USD → KES conversion</p>{activeQuote ? <><p className="mt-1 text-lg font-bold text-amber-950">${amount} = {kes(activeQuote.amountKes)}</p><p className="mt-1 text-sm text-amber-900">Rate: 1 USD = {activeQuote.conversionRate.toFixed(2)} KES · Quote held for <span className="font-semibold tabular-nums">{minutes}:{seconds}</span></p></> : <p className="mt-1 text-sm text-amber-900">Get the current KES amount before opening secure checkout.</p>}</div><button type="button" onClick={() => void getQuote()} disabled={quoteLoading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-60"><RefreshCw size={16} className={quoteLoading ? "animate-spin" : ""} />{activeQuote ? "Refresh quote" : "Get KES quote"}</button></div></div>}
      <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-800">Name <span className="font-normal text-slate-500">(optional)</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="name" className="input-field mt-2" placeholder="Anonymous if left blank" /></label><label className="block text-sm font-semibold text-slate-800">Email <span aria-hidden="true">*</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" className="input-field mt-2" placeholder="you@example.com" /></label></div>
      <label className="block text-sm font-semibold text-slate-800">Purpose <span className="font-normal text-slate-500">(optional)</span><textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} maxLength={300} rows={3} className="input-field mt-2 resize-y" placeholder="For example: study materials or community outreach" /></label><div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-sm text-slate-300">Amount to be charged</p><p className="mt-1 text-3xl font-bold">{chosenKes ? kes(chosenKes) : "Get a KES quote"}</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-300"><Clock3 size={16} className="text-emerald-300" />{currency === "USD" ? "The quoted KES total is the only amount Paystack will charge." : "This exact KES amount will be charged."}</p></div><button disabled={submitting || (currency === "USD" && !activeQuote)} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><ShieldCheck size={19} />{submitting ? "Opening secure checkout…" : "Continue to secure payment"}</button><p className="text-center text-xs leading-5 text-slate-500">By continuing, you will complete payment with Paystack. A pending donation entry is created before payment is opened.</p>
    </form></section>
  </div></main>;
}
