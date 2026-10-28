import Link from "next/link";
import type { ReactNode } from "react";

/** A focused layout keeps giving separate from shopping and other public pages. */
export default function DonationLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-50"><header className="border-b border-emerald-950/10 bg-white"><div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6"><Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><img src="/logo.png" alt="RemSam Homestead" className="h-11 w-11 rounded-xl object-contain" /><span className="font-bold tracking-tight text-emerald-950">RemSam Homestead</span></Link><Link href="/" className="rounded-lg px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Return to site</Link></div></header>{children}</div>;
}
