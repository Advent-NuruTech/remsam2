import { Suspense } from "react";
import ProductManager from "@/components/admin/ProductManager";

export default function AdminProductsPage() {
  return <Suspense fallback={null}><ProductManager /></Suspense>;
}
