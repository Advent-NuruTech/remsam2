"use client";

import type { ChangeEvent, FormEvent } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";

export type CheckoutFormData = {
  name: string;
  email: string;
  phone: string;
  address: { street: string; city: string; county: string; postalCode: string };
  notes: string;
};

export type SavedAddress = {
  id: string;
  street: string;
  city: string;
  county: string;
  postalCode: string;
  phone: string;
};

type Props = {
  formData: CheckoutFormData;
  errors: Record<string, string>;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  addresses: SavedAddress[];
  selectedAddress: string;
  onSelectAddress: (id: string) => void;
  saveAddress: boolean;
  onSaveAddressChange: (value: boolean) => void;
};

function PaystackLoadingOverlay() {
  return (
    <div role="status" aria-live="assertive" className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/80 p-6 text-center text-white backdrop-blur-sm">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-1 animate-pulse bg-gradient-to-r from-red-500 via-red-300 to-red-500" />
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-red-600 shadow-[0_0_0_12px_rgba(220,38,38,0.14)]">
          <LoaderCircle aria-hidden="true" className="h-10 w-10 animate-spin" />
        </div>
        <ShieldCheck aria-hidden="true" className="mx-auto mt-6 h-6 w-6 text-red-300" />
        <h2 className="mt-3 text-2xl font-bold">Connecting to Paystack</h2>
        <p className="mt-3 text-sm leading-6 text-slate-200">Please wait while we securely prepare your payment. Do not close or refresh this page.</p>
        <div className="mx-auto mt-6 h-1.5 w-36 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-red-400" />
        </div>
      </div>
    </div>
  );
}

export default function CheckoutForm({ formData, errors, onChange, onSubmit, loading, addresses, selectedAddress, onSelectAddress, saveAddress, onSaveAddressChange }: Props) {
  const field = (label: string, name: string, value: string, required = true, type = "text") => (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-medium text-slate-700">{label}{required && " *"}</label>
      <input id={name} name={name} type={type} required={required} value={value} onChange={onChange} aria-invalid={!!errors[name]} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200" />
      {errors[name] && <p className="mt-1 text-sm text-red-700">{errors[name]}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} aria-busy={loading} className="space-y-5 pb-28 sm:pb-24">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Contact details</h2>
        <p className="mb-5 mt-1 text-sm text-slate-500">We’ll use these details to contact you about your order.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("Full name", "name", formData.name)}
          {field("Email", "email", formData.email, true, "email")}
          <div className="sm:col-span-2">{field("Phone number", "phone", formData.phone, true, "tel")}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Delivery address</h2>
        <div className="mt-5 space-y-4">
          {addresses.length > 0 && <label className="block text-sm font-medium text-slate-700">Saved addresses<select value={selectedAddress} onChange={(event) => onSelectAddress(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="">Add a new address</option>{addresses.map((address) => <option key={address.id} value={address.id}>{address.street}, {address.city}, {address.county}</option>)}</select></label>}
          {field("Street address", "address.street", formData.address.street)}
          <div className="grid gap-4 sm:grid-cols-3">
            {field("City", "address.city", formData.address.city)}
            {field("County", "address.county", formData.address.county)}
            {field("Postal code", "address.postalCode", formData.address.postalCode, false)}
          </div>
          <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={saveAddress} onChange={(event) => onSaveAddressChange(event.target.checked)} className="h-4 w-4 accent-emerald-600" />{selectedAddress ? "Save changes to this address for next time" : "Save this address for next time"}</label>
        </div>
      </section>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-900"><strong className="block text-base">Delivery arrangements</strong><p className="mt-1">RemSam will contact you to confirm your details and communicate the parcel fee. The amount shown and paid today covers products only.</p></div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Secure payment</h2><p className="mt-2 text-sm text-slate-600">You will complete payment on Paystack&apos;s secure checkout. RemSam never receives your card or mobile-money details.</p></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><label htmlFor="notes" className="block text-lg font-bold">Order notes <span className="text-sm font-normal text-slate-500">(optional)</span></label><textarea id="notes" name="notes" value={formData.notes} onChange={onChange} rows={3} maxLength={2000} className="mt-3 w-full rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-emerald-200" placeholder="Anything else we should know?" /></section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <p className="hidden text-sm font-medium text-slate-600 sm:block">Secure Paystack payment</p>
          <button type="submit" disabled={loading} className="min-h-12 flex-1 rounded-xl bg-red-600 px-6 py-3 font-bold text-white transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Connecting to Paystack…" : "Continue to secure payment"}
          </button>
        </div>
      </div>

      {loading && <PaystackLoadingOverlay />}
    </form>
  );
}
