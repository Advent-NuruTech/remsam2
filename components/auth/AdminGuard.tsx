"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { firebaseUser, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace("/rst/admin/login");
    else if (user?.role !== "admin") router.replace("/");
  }, [firebaseUser, loading, router, user]);

  if (loading || !firebaseUser || user?.role !== "admin") return null;
  return <>{children}</>;
}
