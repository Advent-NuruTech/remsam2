"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { ArrowRight, Lock, Mail, Shield, Sparkles } from "@/components/ui/icons";

export default function AdminLogin() {
  const router = useRouter();
  const { userInfo, loading: authLoading, signIn } = useLegacyAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (userInfo?.role === "admin") router.replace("/rst/admin/dashboard");
    else if (userInfo) router.replace("/");
  }, [router, userInfo]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const profile = await signIn(formData.email, formData.password);
      if (profile.role !== "admin") {
        router.replace("/");
        return;
      }
      router.replace("/rst/admin/dashboard");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  const loading = authLoading || submitting;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #10b981 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        <div className="absolute top-20 -right-20 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
        <div className="absolute bottom-20 -left-20 w-96 h-96 bg-teal-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
        <div className="absolute top-40 right-40 text-emerald-500/10 hidden lg:block"><Shield size={80} /></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="relative">
              <img src="/logo.png" alt="RemSam Homestead Logo" className="w-12 h-12 object-contain rounded-full bg-white" />
              <div className="absolute inset-0 rounded-full" />
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-transparent bg-clip-text">RemSam Homestead</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-block mb-4"><div className="w-16 h-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 p-3 shadow-md"><Shield className="w-full h-full text-white" /></div></div>
            <h2 className="text-2xl font-bold text-gray-800">Admin Login</h2>
            <p className="text-gray-500 mt-2">Secure access to your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                <input id="email" name="email" type="email" autoComplete="email" required value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField(null)} className="w-full bg-white border border-gray-200 rounded-lg pl-12 pr-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 transition-all" placeholder="admin@samiministry.org" />
                {focusedField === "email" && <div className="absolute -right-2 -top-2"><Sparkles className="w-4 h-4 text-emerald-500" /></div>}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                <input id="password" name="password" type="password" autoComplete="current-password" required value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} onFocus={() => setFocusedField("password")} onBlur={() => setFocusedField(null)} className="w-full bg-white border border-gray-200 rounded-lg pl-12 pr-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 transition-all" placeholder="••••••••" />
                {focusedField === "password" && <div className="absolute -right-2 -top-2"><Sparkles className="w-4 h-4 text-emerald-500" /></div>}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0" /><span className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">Remember me</span></label>
              <a href="#" className="text-sm text-emerald-500 hover:text-emerald-600 transition-colors">Forgot password?</a>
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:bg-emerald-700 transition">
              {loading ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Signing in...</span></> : <span className="relative z-10 flex items-center gap-2">Sign In <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></span>}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            Need an admin account?{" "}
            <Link href="/rst/admin/signup" className="font-semibold text-emerald-600 hover:text-emerald-700">
              Sign up with access code
            </Link>
          </p>
          <div className="mt-6 p-3 bg-emerald-50 rounded-lg border border-emerald-100"><p className="text-xs text-gray-600 text-center flex items-center justify-center gap-2"><Shield size={14} className="text-emerald-500" />This area is restricted to authorized personnel only</p></div>
          <div className="mt-6 text-center"><Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 transition-colors group"><ArrowRight size={14} className="rotate-180 group-hover:-translate-x-1 transition-transform" />Back to Website</Link></div>
        </div>
        <p className="text-center mt-8 text-sm text-gray-400">© {new Date().getFullYear()} RemSam Homestead. All rights reserved.</p>
      </div>
    </div>
  );
}

function useLegacyAuth() {
  const { user, loading, signIn } = useAuth();
  return { userInfo: user, loading, signIn };
}
