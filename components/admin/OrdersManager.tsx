"use client";

import PageQuickActions from "@/components/admin/PageQuickActions";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, GripVertical, CheckCircle2, Clock, Eye, PackageCheck, Search, ShoppingBag, Sparkles, Truck, X, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import type { Order, PublicOrder } from "@/lib/types";
import { errorMessage, formatDate, formatMoney } from "@/components/admin/admin-utils";

type OrdersResponse = { orders: PublicOrder[]; total: number };

export default function OrdersManager() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<PublicOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [paymentStatus, setPaymentStatus] = useState(searchParams.get("paymentStatus") ?? "");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PublicOrder | null>(null);
  const [updating, setUpdating] = useState(false);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [draftStatuses, setDraftStatuses] = useState<string[]>([]);
  const [newStatus, setNewStatus] = useState("");
  const [savingStatuses, setSavingStatuses] = useState(false);
  const [draggedStatus, setDraggedStatus] = useState<number | null>(null);
  useEffect(() => { api.get<{ statuses: string[] }>("/api/order-statuses").then(({ statuses }) => { setStatuses(statuses); setDraftStatuses(statuses); }).catch(() => toast.error("Could not load order statuses")); }, []);
  async function saveStatuses() {
    setSavingStatuses(true);
    try { const result = await api.put<{ statuses: string[] }>("/api/order-statuses", { statuses: draftStatuses }); setStatuses(result.statuses); setDraftStatuses(result.statuses); setStatus((current) => current && !result.statuses.includes(current) ? "" : current); toast.success("Order stages saved"); }
    catch (error) { toast.error(errorMessage(error, "Could not save order stages")); }
    finally { setSavingStatuses(false); }
  }
  function reorderStatus(from: number, to: number) { setDraftStatuses((current) => { const next = [...current]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }); }
  function moveStatus(index: number, direction: number) { setDraftStatuses((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; }); }

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ limit: "100" });
    if (status) params.set("status", status);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    try { const response = await api.get<OrdersResponse>(`/api/orders?${params}`); setOrders(response.orders ?? []); }
    catch (nextError) { setError(errorMessage(nextError, "Orders could not be loaded")); }
    finally { setLoading(false); }
  }, [paymentStatus, status]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => orders.filter((order) => !query || `${order.orderNumber} ${order.customer.name} ${order.customer.email} ${order.customer.phone}`.toLowerCase().includes(query.toLowerCase())), [orders, query]);
  const totals = useMemo(() => ({ revenue: orders.filter((order) => order.paymentStatus === "paid").reduce((sum, order) => sum + order.total, 0), pending: orders.filter((order) => order.orderStatus === "pending").length, delivered: orders.filter((order) => order.orderStatus === "delivered").length }), [orders]);

  async function updateOrder(order: PublicOrder, changes: Partial<Pick<Order, "orderStatus" | "paymentStatus">>) {
    setUpdating(true);
    try {
      const updated = await api.put<PublicOrder>(`/api/orders/${order.id}/status`, changes);
      setOrders((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelected((current) => current?.id === updated.id ? updated : current);
      toast.success("Order status updated");
    } catch (nextError) { toast.error(errorMessage(nextError, "Order status could not be updated")); }
    finally { setUpdating(false); }
  }

  return <main className="pb-16 pt-10"><div className="container mx-auto px-4">
    <div className="mb-8 flex items-center justify-between"><div><h1 className="text-4xl font-bold"><span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Order Management</span></h1><p className="mt-2 text-gray-600">Review customer orders and update fulfillment and payment states.</p></div><motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="hidden md:block"><Sparkles size={32} className="text-emerald-400/50" /></motion.div></div>
    <PageQuickActions actions={[
      { label: "All orders", icon: <ShoppingBag size={18} />, pressed: !status && !paymentStatus && !query, onClick: () => { setStatus(""); setPaymentStatus(""); setQuery(""); } },
      { label: "Pending orders", icon: <Clock size={18} />, pressed: status === "pending" && !paymentStatus && !query, onClick: () => { setStatus("pending"); setPaymentStatus(""); setQuery(""); } },
      { label: "Processing orders", icon: <PackageCheck size={18} />, pressed: status === "processing" && !paymentStatus && !query, onClick: () => { setStatus("processing"); setPaymentStatus(""); setQuery(""); } },
      { label: "Shipped orders", icon: <Truck size={18} />, pressed: status === "shipped" && !paymentStatus && !query, onClick: () => { setStatus("shipped"); setPaymentStatus(""); setQuery(""); } },
    ]} />
    <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"><MiniStat label="Orders shown" value={String(orders.length)} icon={<ShoppingBag />} /><MiniStat label="Paid revenue" value={formatMoney(totals.revenue)} icon={<CheckCircle2 />} /><MiniStat label="Pending" value={String(totals.pending)} icon={<Clock />} /><MiniStat label="Delivered" value={String(totals.delivered)} icon={<PackageCheck />} /></div>
    {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error} <button onClick={() => void load()} className="ml-2 font-semibold underline">Retry</button></div>}
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Order tracking stages</h2><p className="mt-1 text-sm text-gray-600">Drag stages to arrange them, or use the arrow buttons. Save changes to update customer tracking. Pending is required; move orders before removing a stage in use.</p><ol className="mt-4 space-y-2">{draftStatuses.map((stage, index) => <li key={`${stage}-${index}`} draggable onDragStart={(event) => { setDraggedStatus(index); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedStatus !== null && draggedStatus !== index) reorderStatus(draggedStatus, index); setDraggedStatus(null); }} onDragEnd={() => setDraggedStatus(null)} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2"><GripVertical size={18} className="cursor-grab text-gray-400" aria-hidden="true" /><span className="min-w-0 flex-1 px-2 capitalize">{stage}</span><button type="button" disabled={index === 0} onClick={() => moveStatus(index, -1)} className="rounded border px-3 py-1 disabled:opacity-40" aria-label={`Move ${stage} up`}><ArrowUp size={16} /></button><button type="button" disabled={index === draftStatuses.length - 1} onClick={() => moveStatus(index, 1)} className="rounded border px-3 py-1 disabled:opacity-40" aria-label={`Move ${stage} down`}><ArrowDown size={16} /></button><button type="button" disabled={stage === "pending"} onClick={() => setDraftStatuses((current) => current.filter((_, i) => i !== index))} className="rounded border px-3 py-1 text-red-700 disabled:opacity-40" aria-label={`Remove ${stage}`}>Remove</button></li>)}</ol><div className="mt-4 flex flex-wrap gap-2"><input value={newStatus} onChange={(e) => setNewStatus(e.target.value)} maxLength={100} placeholder="New stage name" aria-label="New stage name" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2" /><button type="button" onClick={() => { const name = newStatus.trim().toLowerCase(); if (!name || draftStatuses.includes(name)) { toast.error("Enter a unique stage name"); return; } setDraftStatuses((current) => [...current, name]); setNewStatus(""); }} className="rounded-lg border px-4 py-2 font-medium">Add stage</button><button type="button" disabled={savingStatuses || !draftStatuses.length} onClick={() => void saveStatuses()} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{savingStatuses ? "Saving?" : "Save stages"}</button></div></section>
    <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"><div className="grid gap-3 border-b border-gray-100 p-5 lg:grid-cols-[1fr_auto_auto]"><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order number or customer…" className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-3 outline-none focus:border-emerald-500" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-gray-200 px-3"><option value="">All order statuses</option>{statuses.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select><select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className="rounded-lg border border-gray-200 px-3"><option value="">All payment statuses</option><option value="pending">Pending payment</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Payment</th><th className="px-5 py-3">Fulfillment</th><th className="px-5 py-3">Date</th><th className="px-5 py-3 text-right">Details</th></tr></thead><tbody className="divide-y divide-gray-100">{filtered.map((order) => <tr key={order.id} className="hover:bg-gray-50"><td className="px-5 py-4"><p className="font-semibold text-gray-900">{order.orderNumber}</p><p className="text-xs text-gray-500">{order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)</p></td><td className="px-5 py-4"><p className="font-medium text-gray-900">{order.customer.name}</p><p className="text-sm text-gray-500">{order.customer.email}</p></td><td className="px-5 py-4 font-semibold">{formatMoney(order.total)}</td><td className="px-5 py-4"><StatusBadge value={order.paymentStatus} /></td><td className="px-5 py-4"><select aria-label={`Status for ${order.orderNumber}`} value={order.orderStatus} disabled={updating} onChange={(event) => void updateOrder(order, { orderStatus: event.target.value as Order["orderStatus"] })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm capitalize">{statuses.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></td><td className="px-5 py-4 text-sm text-gray-500">{formatDate(order.createdAt)}</td><td className="px-5 py-4 text-right"><button onClick={() => setSelected(order)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50" aria-label={`View ${order.orderNumber}`}><Eye size={19} /></button></td></tr>)}</tbody></table></div>{loading && <p className="p-10 text-center text-gray-500">Loading orders…</p>}{!loading && filtered.length === 0 && <p className="p-10 text-center text-gray-500">No orders match your filters.</p>}
    </section>
  </div>
  <AnimatePresence>{selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-gray-200 p-5"><div><h2 className="text-2xl font-bold">Order {selected.orderNumber}</h2><p className="text-sm text-gray-500">Placed {formatDate(selected.createdAt)}</p></div><button onClick={() => setSelected(null)} className="rounded-lg p-2 hover:bg-gray-100"><X /></button></div><div className="max-h-[70vh] space-y-6 overflow-y-auto p-6">
    <div className="grid gap-4 sm:grid-cols-2"><DetailCard title="Customer"><p className="font-semibold">{selected.customer.name}</p><p>{selected.customer.email}</p><p>{selected.customer.phone}</p></DetailCard><DetailCard title="Delivery address"><p>{selected.customer.address?.street}</p><p>{selected.customer.address?.city}, {selected.customer.address?.county}</p><p>{selected.customer.address?.country}</p></DetailCard></div>
    <section><h3 className="mb-3 font-bold">Items</h3><div className="divide-y divide-gray-100 rounded-xl border border-gray-200">{selected.items.map((item, index) => <div key={`${item.product}-${index}`} className="flex items-center gap-3 p-3"><img src={item.image || "/logo.png"} alt="" className="h-12 w-12 rounded-lg object-cover" /><div className="flex-1"><p className="font-medium">{item.name}</p><p className="text-sm text-gray-500">{item.variantName && `${item.variantName} - `}{item.quantity} × {formatMoney(item.price)}</p></div><p className="font-semibold">{formatMoney(item.quantity * item.price)}</p></div>)}</div></section>
    <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1 block text-sm font-medium">Fulfillment status</span><select value={selected.orderStatus} disabled={updating} onChange={(event) => void updateOrder(selected, { orderStatus: event.target.value as Order["orderStatus"] })} className="input-field">{statuses.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></label><label><span className="mb-1 block text-sm font-medium">Payment status</span><select value={selected.paymentStatus} disabled={updating || selected.paymentMethod === "paystack"} onChange={(event) => void updateOrder(selected, { paymentStatus: event.target.value as Order["paymentStatus"] })} className="input-field"><option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select>{selected.paymentMethod === "paystack" && <span className="mt-1 block text-xs text-gray-500">Paystack updates this status after a verified transaction.</span>}</label></div>
    <div className="rounded-xl bg-gray-50 p-4"><div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatMoney(selected.subtotal)}</span></div><div className="mt-2 flex justify-between text-sm"><span>Shipping {selected.deliveryFeePending ? "" : `(${selected.shippingMethod})`}</span><span>{selected.deliveryFeePending ? "To be confirmed" : formatMoney(selected.shipping)}</span></div><div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-lg font-bold"><span>Total</span><span>{formatMoney(selected.total)}</span></div></div>
    {selected.notes && <DetailCard title="Customer notes"><p>{selected.notes}</p></DetailCard>}
  </div></motion.div></div>}</AnimatePresence>
  </main>;
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-5"><div className="min-w-0"><p className="text-sm text-gray-500">{label}</p><p className="mt-1 break-words text-xl font-bold sm:text-2xl">{value}</p></div><div className="shrink-0 rounded-lg bg-orange-100 p-2 text-orange-700 sm:p-3">{icon}</div></div>; }
function StatusBadge({ value }: { value: string }) { const Icon = value === "paid" ? CheckCircle2 : value === "failed" || value === "refunded" ? XCircle : Clock; const style = value === "paid" ? "bg-green-100 text-green-700" : value === "failed" ? "bg-red-100 text-red-700" : value === "refunded" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"; return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${style}`}><Icon size={13} />{value}</span>; }
function DetailCard({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600"><h3 className="mb-2 font-bold text-gray-900">{title}</h3>{children}</section>; }
