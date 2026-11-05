"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QuickActions from "@/components/admin/QuickActions";
import { motion } from "framer-motion";
import { Clock, FileText, Package, RefreshCw, ShoppingCart, Sparkles, Star, TrendingUp, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { PublicArticle, PublicOrder, ResourceTaxonomy } from "@/lib/types";
import { errorMessage, formatDate, formatMoney } from "@/components/admin/admin-utils";

type ProductsResponse = { total: number; active: number };
type ArticlesResponse = { articles: PublicArticle[]; resourceCategories: ResourceTaxonomy };
type OrdersResponse = { orders: PublicOrder[] };
type EmailActivity = { id: string; subject: string; kind: "newsletter" | "meeting"; sent?: number; failed?: number; sentAt?: unknown };

function emailDate(value: unknown) {
  let date: Date;
  if (typeof value === "string") date = new Date(value);
  else if (typeof value === "object" && value !== null && "_seconds" in value) date = new Date(Number(value._seconds) * 1000);
  else if (typeof value === "object" && value !== null && "seconds" in value) date = new Date(Number(value.seconds) * 1000);
  else return "Date unavailable";
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

const colorStyles = {
  emerald: "bg-emerald-100 text-emerald-700",
  blue: "bg-blue-100 text-blue-700",
  orange: "bg-orange-100 text-orange-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
} as const;

function StatCard({ title, value, icon: Icon, color, href }: { title: string; value: string | number; icon: typeof Package; color: keyof typeof colorStyles; href?: string }) {
  const card = (
    <motion.div whileHover={{ y: -3 }} className="h-full rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-6">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0"><p className="text-sm text-gray-500">{title}</p><p className="mt-2 break-words text-xl font-bold text-gray-900 sm:text-2xl">{value}</p></div>
        <div className={`shrink-0 rounded-xl p-2 sm:p-3 ${colorStyles[color]}`}><Icon size={24} /></div>
      </div>
    </motion.div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

export default function AdminDashboard() {
  const [products, setProducts] = useState<ProductsResponse>({ total: 0, active: 0 });
  const [articles, setArticles] = useState<PublicArticle[]>([]);
  const [resourceCategories, setResourceCategories] = useState<ResourceTaxonomy>({ majors: [], subcategories: [] });
  const [orders, setOrders] = useState<PublicOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emailActivity, setEmailActivity] = useState<EmailActivity[]>([]);
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailError, setEmailError] = useState("");

  const loadEmailActivity = useCallback(async () => {
    setEmailLoading(true);
    setEmailError("");
    try {
      const data = await api.get<{ history: EmailActivity[] }>("/api/mailing");
      setEmailActivity((data.history ?? []).slice(0, 2));
    } catch (reason) {
      setEmailError(errorMessage(reason, "Email activity could not be loaded"));
    } finally {
      setEmailLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productData, articleData, orderData] = await Promise.all([
        api.get<ProductsResponse>("/api/products?scope=admin&stats=true"),
        api.get<ArticlesResponse>("/api/articles?scope=admin&limit=100"),
        api.get<OrdersResponse>("/api/orders?limit=100"),
      ]);
      setProducts(productData);
      setArticles(articleData.articles ?? []);
      setResourceCategories(articleData.resourceCategories ?? { majors: [], subcategories: [] });
      setOrders(orderData.orders ?? []);
    } catch (nextError) {
      setError(errorMessage(nextError, "Dashboard data could not be loaded"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); void loadEmailActivity(); }, [load, loadEmailActivity]);

  const stats = useMemo(() => ({
    activeProducts: products.active,
    publishedArticles: articles.filter((article) => article.published).length,
    draftArticles: articles.filter((article) => !article.published).length,
    pendingOrders: orders.filter((order) => order.orderStatus === "pending").length,
    revenue: orders.filter((order) => order.paymentStatus === "paid").reduce((sum, order) => sum + order.total, 0),
    customers: new Set(orders.map((order) => order.userId).filter(Boolean)).size,
    paymentRate: orders.length ? Math.round((orders.filter((order) => order.paymentStatus === "paid").length / orders.length) * 100) : 0,
  }), [articles, orders, products]);

  const articleCategoryStats = useMemo(() => resourceCategories.majors.flatMap((major) => [
    { id: major.id, name: major.name, count: major.count },
    ...resourceCategories.subcategories.filter((item) => item.parentId === major.id).map((item) => ({ id: item.id, name: `${major.name} / ${item.name}`, count: item.count })),
  ]), [resourceCategories]);

  return (
    <main className="pb-16 pt-10">
      <div className="container mx-auto px-4">
        
    <div className="mb-8 flex items-center justify-between gap-4">
          <div><p className="mt-2 text-gray-600">Manage your store, publishing, and customer orders.</p></div>
          <div className="flex items-center gap-3">
            <button onClick={() => { void load(); void loadEmailActivity(); }} disabled={loading || emailLoading} aria-label="Refresh dashboard" className="rounded-lg border border-gray-200 bg-white p-3 text-gray-600 hover:text-emerald-600 disabled:opacity-50"><RefreshCw size={20} className={loading || emailLoading ? "animate-spin" : ""} /></button>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="hidden md:block"><Sparkles size={32} className="text-emerald-400/50" /></motion.div>
          </div>
          


        </div>

<QuickActions />

        {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          <StatCard title="Total Products" value={products.total} icon={Package} color="emerald" href="/rst/admin/products" />
          <StatCard title="Active Products" value={stats.activeProducts} icon={Star} color="emerald" />
          <StatCard title="Published Resources" value={stats.publishedArticles} icon={FileText} color="blue" href="/rst/admin/articles" />
          <StatCard title="Total Orders" value={orders.length} icon={ShoppingCart} color="orange" href="/rst/admin/orders" />
          <StatCard title="Draft Resources" value={stats.draftArticles} icon={Clock} color="yellow" />
          <StatCard title="Paid Revenue" value={formatMoney(stats.revenue)} icon={TrendingUp} color="emerald" />
          <StatCard title="Pending Orders" value={stats.pendingOrders} icon={Clock} color="red" href="/rst/admin/orders?status=pending" />
          <StatCard title="Customers" value={stats.customers} icon={Users} color="blue" />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          
          <section className="self-start rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3"><div className="rounded-lg bg-emerald-100 p-2 text-emerald-700"><TrendingUp /></div><div><p className="text-sm text-gray-500">Order payment rate</p><p className="text-2xl font-bold text-gray-900">{stats.paymentRate}%</p></div></div>
            <div className="mb-2 flex justify-between text-sm text-gray-600"><span>Paid orders</span><span>{orders.filter((order) => order.paymentStatus === "paid").length} / {orders.length}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100"><motion.div initial={{ width: 0 }} animate={{ width: `${stats.paymentRate}%` }} transition={{ duration: .8 }} className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" /></div>
            <p className="mt-5 border-t border-gray-100 pt-4 text-sm text-gray-500">Calculated from Firestore-backed order and payment states.</p>
          </section>
          <section aria-labelledby="email-activity-heading" className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 p-5">
              <div><h2 id="email-activity-heading" className="text-xl font-bold text-gray-900">Latest Email Activity</h2><p className="mt-1 text-sm text-gray-500">The  most recent email deliveries</p></div>
              <Link href="/rst/admin/mailing" className="shrink-0 text-sm font-medium text-emerald-600 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">View all</Link>
            </div>
            {emailLoading ? <p role="status" className="p-6 text-sm text-gray-500">Loading email activity...</p> : emailError ? <div role="alert" className="p-6 text-sm text-red-700">{emailError} <button onClick={() => void loadEmailActivity()} className="ml-2 font-medium underline">Try again</button></div> : emailActivity.length === 0 ? <p className="p-6 text-sm text-gray-500">No email activity yet.</p> : <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">{emailActivity.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3"><div className="min-w-0"><p className="break-words font-medium text-gray-900">{item.subject || "Untitled email"}</p><p className="text-sm text-gray-500">{item.kind === "meeting" ? "Meeting" : "Newsletter"} · {emailDate(item.sentAt)}</p></div><p className="text-sm text-gray-600">{item.sent ?? 0} sent{(item.failed ?? 0) > 0 && <span className="text-red-700"> · {item.failed} failed</span>}</p></li>)}</ul>}
          </section>
        </div>

        

        <section className="mt-8 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 p-5"><h2 className="text-xl font-bold text-gray-900">Recent Orders</h2><Link href="/rst/admin/orders" className="text-sm font-medium text-emerald-600">View all</Link></div>
          <div className="divide-y divide-gray-100">{orders.slice(0, 5).map((order) => <div key={order.id} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="font-semibold text-gray-900">{order.orderNumber}</p><p className="truncate text-sm text-gray-500">{order.customer.name} · {formatDate(order.createdAt)}</p></div><div className="text-right"><p className="font-semibold text-gray-900">{formatMoney(order.total)}</p><p className="text-xs capitalize text-gray-500">{order.orderStatus}</p></div></div>)}{!loading && orders.length === 0 && <p className="p-6 text-center text-gray-500">No orders yet.</p>}</div>
        </section>
      </div>
    </main>
  );
}
