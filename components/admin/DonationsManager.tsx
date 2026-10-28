"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, HandHeart, RefreshCw, Search, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { PublicDonation } from "@/lib/types";
import { errorMessage, formatDate, formatMoney } from "@/components/admin/admin-utils";

type DonationsResponse = { donations: PublicDonation[]; totalSuccessfulKes: number; paymentRecordsChecked: boolean };

function Status({ value }: { value: PublicDonation["status"] }) {
  const failed = value === "failed" || value === "refunded";
  const style = value === "succeeded" ? "bg-emerald-100 text-emerald-800" : failed ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900";
  const Icon = value === "succeeded" ? CheckCircle2 : failed ? XCircle : Clock3;
  const label = value === "succeeded" ? "Successful" : value.charAt(0).toUpperCase() + value.slice(1);
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${style}`}><Icon size={14} />{label}</span>;
}

export default function DonationsManager() {
  const [donations, setDonations] = useState<PublicDonation[]>([]);
  const [total, setTotal] = useState(0);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await api.get<DonationsResponse>("/api/admin/donations"); setDonations(data.donations); setTotal(data.totalSuccessfulKes); setChecked(data.paymentRecordsChecked); }
    catch (reason) { setError(errorMessage(reason, "Donations could not be loaded.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => { const value = query.trim().toLowerCase(); return value ? donations.filter((donation) => [donation.name, donation.email, donation.purpose, donation.reference, donation.paystack?.reference, donation.status].filter(Boolean).some((item) => String(item).toLowerCase().includes(value))) : donations; }, [donations, query]);
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Giving</p><h1 className="mt-1 text-3xl font-bold text-slate-950">Donations</h1><p className="mt-2 max-w-2xl text-slate-600">Official amounts and totals are in KES. Successful payments only are included in the total.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><RefreshCw size={18} className={loading ? "animate-spin" : ""} />Refresh & reconcile</button></div>
    <section className="mt-7 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-emerald-900 p-5 text-white shadow-sm"><p className="text-sm font-medium text-emerald-100">Successful donations</p><p className="mt-2 text-3xl font-bold">{formatMoney(total)}</p><p className="mt-2 text-sm text-emerald-100">{donations.filter((donation) => donation.status === "succeeded").length} confirmed payment(s)</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-900">Payment reconciliation</p><p className="mt-2 text-sm leading-6 text-slate-600">{checked ? "Paystack payment records were checked alongside saved donation entries." : "Saved donation entries are shown. Paystack reconciliation was unavailable on the last refresh."}</p></div></section>
    {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error} <button type="button" onClick={() => void load()} className="font-semibold underline">Try again</button></div>}
    <div className="mt-7 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 shadow-sm"><Search size={19} className="text-slate-400" /><label className="sr-only" htmlFor="donation-search">Search donations</label><input id="donation-search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-12 w-full bg-transparent text-sm outline-none" placeholder="Search name, email, purpose, reference, or status" /></div>
    <section aria-label="Donation records" className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Donor</th><th className="px-5 py-3">Purpose</th><th className="px-5 py-3">Amount (KES)</th><th className="px-5 py-3">Method</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((donation) => <tr key={donation.id} className="align-top hover:bg-slate-50"><td className="px-5 py-4"><p className="font-semibold text-slate-900">{donation.name || "Anonymous"}</p><p className="mt-0.5 text-slate-500">{donation.email || "—"}</p></td><td className="max-w-56 px-5 py-4 text-slate-600">{donation.purpose || "—"}{donation.originalCurrency === "USD" && <p className="mt-1 text-xs text-slate-500">USD ${donation.originalAmount} @ {donation.conversionRate?.toFixed(2)} KES</p>}</td><td className="px-5 py-4 font-bold text-slate-900">{formatMoney(donation.amountKes)}</td><td className="px-5 py-4 capitalize text-slate-700">{donation.paymentMethod}</td><td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(donation.createdAt)}</td><td className="max-w-48 break-all px-5 py-4 font-mono text-xs text-slate-600">{donation.reference || donation.paystack?.reference || "—"}</td><td className="px-5 py-4"><Status value={donation.status} /></td></tr>)}</tbody></table></div><div className="divide-y divide-slate-100 md:hidden">{filtered.map((donation) => <article key={donation.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{donation.name || "Anonymous"}</p><p className="text-sm text-slate-500">{donation.email || "—"}</p></div><Status value={donation.status} /></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm"><div><dt className="text-slate-500">Amount</dt><dd className="font-bold text-slate-900">{formatMoney(donation.amountKes)}</dd></div><div><dt className="text-slate-500">Date</dt><dd className="text-slate-800">{formatDate(donation.createdAt)}</dd></div><div><dt className="text-slate-500">Purpose</dt><dd className="text-slate-800">{donation.purpose || "—"}</dd></div><div><dt className="text-slate-500">Method</dt><dd className="capitalize text-slate-800">{donation.paymentMethod}</dd></div></dl><p className="mt-3 break-all font-mono text-xs text-slate-500">{donation.reference || donation.paystack?.reference || "—"}</p>{donation.originalCurrency === "USD" && <p className="mt-2 text-xs text-slate-500">USD ${donation.originalAmount} @ {donation.conversionRate?.toFixed(2)} KES</p>}</article>)}</div>{loading && <p role="status" className="p-10 text-center text-slate-500">Loading and reconciling donations…</p>}{!loading && filtered.length === 0 && <p className="p-10 text-center text-slate-500">No donations match your search.</p>}</section>
  </main>;
}
