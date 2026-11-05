"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Leaf, LockKeyhole, ShoppingBag } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { api, ApiError } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700";

function friendlyError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/invalid-credential": "The email or password is incorrect. Please try again.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/email-already-in-use": "An account already uses this email. Try signing in instead.",
    "auth/weak-password": "Choose a stronger password.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed. Please try again.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow pop-ups and try again.",
    "auth/cancelled-popup-request": "The Google sign-in request was cancelled. Please try again.",
    "auth/account-exists-with-different-credential": "An account already uses this email. Sign in using your original method.",
    "auth/unauthorized-domain": "Google sign-in is not configured for this website. Please contact us for help.",
    "auth/operation-not-allowed": "This sign-in method is unavailable. Please contact us for help.",
    "auth/network-request-failed": "Check your internet connection and try again.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
  };
  return messages[code] || (error instanceof Error && !code ? error.message : "Something went wrong. Please try again.");
}

/* function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.04H12v3.86h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.33 2.98-7.34Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.59-4.13H3.06v2.58A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.91A6.01 6.01 0 0 1 6.1 12c0-.66.11-1.3.31-1.91V7.51H3.06a10 10 0 0 0 0 8.98l3.35-2.58Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.78.51 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.51l3.35 2.58C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>;
} */

export default function CustomerAuthPage({ mode, returnTo }: { mode: "sign-in" | "sign-up"; returnTo: string }) {
  const creating = mode === "sign-up";
  const router = useRouter();
  const { firebaseUser, user, loading, error, signIn, register, /* signInWithGoogle, */ refreshProfile, logout } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const otherHref = `${creating ? "/sign-in" : "/sign-up"}?returnTo=${encodeURIComponent(returnTo)}`;

  useEffect(() => { if (!loading && user && !busy) router.replace(returnTo); }, [loading, user, busy, returnTo, router]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setFailure(""); setNotice("");
    try { await action(); } catch (err) { setFailure(friendlyError(err)); } finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => { if (creating) { if (!name.trim()) throw new Error("Enter your name to create an account."); await register(name.trim(), email.trim(), password); } else await signIn(email.trim(), password); });
  }
  async function recoverProfile() {
    try { await refreshProfile(); } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401 || !firebaseUser) throw err;
      await api.post("/api/auth/register", { name: name.trim() || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Customer" });
      await refreshProfile();
    }
  }

  return <main className="min-h-screen bg-[#f6f8f3] text-stone-900 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
    <aside className="relative hidden min-h-screen overflow-hidden bg-emerald-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <Image src="/assets/farm1.jpeg" alt="" fill priority sizes="50vw" className="object-cover opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/65 via-emerald-950/40 to-emerald-950/95" />
      <Link href="/" className={`relative z-10 flex w-fit items-center gap-3 ${focusClass}`}><span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white"><Image src="/assets/logo.png" alt="" width={46} height={46} className="object-contain" /></span><span className="text-lg font-bold tracking-tight">RemSam Homestead</span></Link>
      <div className="relative z-10 max-w-lg"><p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Welcome to our homestead</p><h2 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">A little closer to the things that matter.</h2><p className="mt-5 max-w-md text-lg leading-relaxed text-emerald-50/85">Sign in to keep your orders and account details close at hand.</p><div className="mt-10 flex flex-wrap gap-5 text-sm font-medium text-emerald-50"><span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" aria-hidden="true" /> Your orders in one place</span><span className="flex items-center gap-2"><Leaf className="h-4 w-4" aria-hidden="true" /> From our homestead to yours</span></div></div>
      <p className="relative z-10 text-sm text-emerald-100/75">Faith · Family · Farming</p>
    </aside>
    <div className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-12 xl:px-20">
      <div className="flex items-center justify-between gap-4"><Link href="/" className={`flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-emerald-700 ${focusClass}`}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home</Link><Link href="/" aria-label="RemSam Homestead home" className={`lg:hidden ${focusClass}`}><Image src="/assets/logo.png" alt="" width={48} height={48} className="h-12 w-12 rounded-xl object-contain" /></Link></div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">RemSam Homestead</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{creating ? "Create your account" : "Welcome back"}</h1><p className="mt-3 leading-relaxed text-stone-600">{creating ? "Join us to keep track of your orders and account." : "Sign in to see your orders and manage your account."}</p>
        {loading || (user && !busy) ? <p role="status" className="mt-8 text-stone-600">Loading your account…</p> : firebaseUser && !busy ? <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p role="alert" className="text-sm text-amber-950">{failure || error || "Your account profile could not be loaded. Please try again."}</p><div className="mt-4 flex gap-5 text-sm font-semibold"><button type="button" onClick={() => void run(recoverProfile)} className={`text-emerald-800 underline ${focusClass}`}>Try again</button><button type="button" onClick={() => void run(logout)} className={`text-emerald-800 underline ${focusClass}`}>Sign out</button></div></div> : <>
          {/* <button type="button" disabled={busy} onClick={() => void run(async () => { await signInWithGoogle(); })} className={`mt-8 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-stone-300 bg-white px-4 font-semibold text-stone-800 shadow-sm transition hover:bg-stone-50 disabled:cursor-wait disabled:opacity-60 ${focusClass}`}><GoogleMark /> Continue with Google</button>
          <div className="my-6 flex items-center gap-4 text-xs font-medium uppercase tracking-wider text-stone-400"><span className="h-px flex-1 bg-stone-200" /> or continue with email <span className="h-px flex-1 bg-stone-200" /></div>
          */}
          <form onSubmit={submit} className="mt-8 space-y-4">
            {creating && <label className="block text-sm font-semibold text-stone-700">Full name<input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} required placeholder="Your name" /></label>}
            <label className="block text-sm font-semibold text-stone-700">Email address<input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" /></label>
            <label className="block text-sm font-semibold text-stone-700">Password<span className="relative block"><input className={`${inputClass} pr-12`} type={visible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={creating ? "new-password" : "current-password"} minLength={creating ? 6 : undefined} required placeholder={creating ? "At least 6 characters" : "Your password"} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} className={`absolute bottom-0 right-0 flex h-12 w-12 items-center justify-center text-stone-500 hover:text-emerald-700 ${focusClass}`}>{visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></span></label>
            {!creating && <div className="text-right"><button type="button" disabled={busy} onClick={() => void run(async () => { if (!email.trim()) throw new Error("Enter your email address first, then select Forgot password."); await sendPasswordResetEmail(firebaseAuth(), email.trim()); setNotice("If an account exists for that address, a password reset email has been sent."); })} className={`text-sm font-semibold text-emerald-700 hover:underline ${focusClass}`}>Forgot password?</button></div>}
            {failure && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{failure}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
            <button disabled={busy} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60 ${focusClass}`}>{busy ? "Please wait…" : creating ? "Create account" : "Sign in"}<ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
          </form>
          <p className="mt-6 text-center text-sm text-stone-600">{creating ? "Already have an account? " : "New to RemSam? "}<Link href={otherHref} className={`font-semibold text-emerald-700 underline underline-offset-4 ${focusClass}`}>{creating ? "Sign in" : "Create an account"}</Link></p>
        </>}
        <p className="mt-8 flex gap-2 text-xs leading-relaxed text-stone-500"><LockKeyhole aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span>By continuing, you agree to our <Link href="/terms-of-service" className="underline hover:text-emerald-700">Terms of Service</Link> and acknowledge our <Link href="/privacy-policy" className="underline hover:text-emerald-700">Privacy Policy</Link>.</span></p>
      </div>
    </div>
  </main>;
}
