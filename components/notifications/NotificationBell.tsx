"use client";

import Link from "next/link";
import { Bell, CheckCheck, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import type { AppNotification } from "@/lib/types";

type NotificationsResponse = { notifications: AppNotification[]; unreadCount: number };
type NotificationBellProps = {
  dark?: boolean;
  placement?: "above" | "below";
  alignment?: "left" | "right";
  viewportPanel?: boolean;
};

function timeLabel(value?: string) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`;
  return date.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

export default function NotificationBell({
  dark = false,
  placement = "below",
  alignment = "right",
  viewportPanel = false,
}: NotificationBellProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.get<NotificationsResponse>("/api/notifications");
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // A transient notification failure should not interfere with navigation.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { setNotifications([]); setUnreadCount(0); return; }
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const interval = window.setInterval(() => void load(), 45_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load, user]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (panel.current && !panel.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  if (!user) return null;
  const markRead = async (ids: string[]) => {
    const unreadIds = ids.filter((id) => notifications.some((notification) => notification.id === id && !notification.readAt));
    if (!unreadIds.length) return;
    setNotifications((current) => current.map((notification) => unreadIds.includes(notification.id) ? { ...notification, readAt: new Date().toISOString() } : notification));
    setUnreadCount((current) => Math.max(0, current - unreadIds.length));
    try { await api.patch("/api/notifications", { ids: unreadIds }); } catch { void load(); }
  };
  const buttonColor = dark ? "text-emerald-100 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700";

  return <div ref={panel} className="relative">
    <button type="button" onClick={() => { setOpen((current) => !current); if (!open) void load(); }} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={open} aria-haspopup="dialog" className={`relative grid h-10 w-10 place-items-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${buttonColor}`}>
      <Bell size={20} aria-hidden="true" />
      {unreadCount > 0 && <span className="absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <section role="dialog" aria-label="Notifications" className={`${viewportPanel ? `fixed inset-x-4 z-[70] w-auto ${placement === "above" ? "bottom-4" : "top-20"}` : `absolute z-[70] w-[min(24rem,calc(100vw-2rem))] ${alignment === "left" ? "left-0" : "right-0"} ${placement === "above" ? "bottom-full mb-2" : "mt-2"}`} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><h2 className="font-bold text-slate-900">Notifications</h2><p className="text-xs text-slate-500">{unreadCount ? `${unreadCount} unread` : "You’re all caught up"}</p></div>{unreadCount > 0 && <button type="button" onClick={() => void markRead(notifications.map((notification) => notification.id))} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"><CheckCheck size={15} /> Mark all read</button>}</div>
      <div className="max-h-[min(65vh,32rem)] overflow-y-auto">{loading && notifications.length === 0 ? <p role="status" className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18} /> Loading notifications…</p> : notifications.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">New account and order updates will appear here.</p> : <ul>{notifications.map((notification) => <li key={notification.id} className={`border-b border-slate-100 last:border-0 ${notification.readAt ? "bg-white" : "bg-emerald-50/70"}`}>{notification.href ? <Link href={notification.href} onClick={() => { void markRead([notification.id]); setOpen(false); }} className="block px-4 py-3 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-600">{notificationContent(notification)}</Link> : <button type="button" onClick={() => void markRead([notification.id])} className="block w-full px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-600">{notificationContent(notification)}</button>}</li>)}</ul>}</div>
    </section>}
  </div>;
}

function notificationContent(notification: AppNotification) {
  return <><div className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? "bg-transparent" : "bg-emerald-600"}`} aria-hidden="true" /><div className="min-w-0"><p className="font-semibold text-slate-900">{notification.title}</p><p className="mt-0.5 text-sm leading-5 text-slate-600">{notification.body}</p><p className="mt-1 text-xs text-slate-400">{timeLabel(notification.createdAt)}</p></div></div></>;
}
