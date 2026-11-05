import { Suspense } from "react";
import ArticleManager from "@/components/admin/ArticleManager";

export default function AdminArticlesPage() {
  return <Suspense fallback={null}><ArticleManager /></Suspense>;
}
