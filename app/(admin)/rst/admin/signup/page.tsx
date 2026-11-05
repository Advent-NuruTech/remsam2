"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { ArrowRight, Lock, Mail, Shield } from "@/components/ui/icons";

export default function AdminSignup() {
  const router = useRouter();
  const { user, loading: authLoading, registerAdmin } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    signupCode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role === "admin") router.replace("/rst/admin/dashboard");
    else if (user) router.replace("/");
  }, [router, user]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await registerAdmin(
        formData.name.trim(),
        formData.email.trim(),
        formData.password,
        formData.signupCode,
      );
      router.replace("/rst/admin/dashboard");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Admin signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  const loading = authLoading || submitting;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #10b981 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        <div className="absolute -right-20 top-20 h-96 w-96 rounded-full bg-emerald-500 opacity-20 blur-3xl mix-blend-multiply" />
        <div className="absolute -left-20 bottom-20 h-96 w-96 rounded-full bg-teal-500 opacity-20 blur-3xl mix-blend-multiply" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <img src="/logo.png" alt="RemSam Homestead Logo" className="h-12 w-12 rounded-full bg-white object-contain" />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-3xl font-bold text-transparent">RemSam Homestead</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-block rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 p-3 shadow-md"><Shield className="h-10 w-10 text-white" /></div>
            <h1 className="text-2xl font-bold text-gray-800">Admin Signup</h1>
            <p className="mt-2 text-gray-500">Create an account with your private access code</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Full Name" name="name" type="text" autoComplete="name" placeholder="Your name" value={formData.name} onChange={(value) => setFormData({ ...formData, name: value })} />
            <Field label="Email Address" name="email" type="email" autoComplete="email" placeholder="admin@example.com" value={formData.email} onChange={(value) => setFormData({ ...formData, email: value })} icon="mail" />
            <Field label="Password" name="password" type="password" autoComplete="new-password" placeholder="At least 6 characters" value={formData.password} onChange={(value) => setFormData({ ...formData, password: value })} minLength={6} icon="lock" />
            <Field label="Confirm Password" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Repeat your password" value={formData.confirmPassword} onChange={(value) => setFormData({ ...formData, confirmPassword: value })} minLength={6} icon="lock" />
            <Field label="Admin Signup Code" name="signupCode" type="password" autoComplete="off" placeholder="Enter the private code" value={formData.signupCode} onChange={(value) => setFormData({ ...formData, signupCode: value })} icon="lock" />

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-lg font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <><span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /><span>Creating account...</span></> : <span className="flex items-center gap-2">Create Admin Account <ArrowRight className="h-5 w-5" /></span>}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an admin account?{" "}
            <Link href="/rst/admin/login" className="font-semibold text-emerald-600 hover:text-emerald-700">Sign in</Link>
          </p>
          <div className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50 p-3"><p className="flex items-center justify-center gap-2 text-center text-xs text-gray-600"><Shield size={14} className="text-emerald-500" />The access code is checked securely on the server</p></div>
        </div>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  icon?: "mail" | "lock";
};

function Field({ label, name, type, autoComplete, placeholder, value, onChange, minLength, icon }: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        {icon === "mail" && <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />}
        {icon === "lock" && <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />}
        <input
          id={name}
          name={name}
          type={type}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full rounded-lg border border-gray-200 bg-white py-3 pr-4 text-gray-800 placeholder-gray-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${icon ? "pl-12" : "pl-4"}`}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
