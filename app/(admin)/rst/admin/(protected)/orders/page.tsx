import { Suspense } from "react";
import OrdersManager from "@/components/admin/OrdersManager";

export default function AdminOrdersPage() {
  return <Suspense fallback={null}><OrdersManager /></Suspense>;
}
