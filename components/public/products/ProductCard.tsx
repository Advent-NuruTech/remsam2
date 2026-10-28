"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ImageOff, Share2 } from "lucide-react";
import toast from "react-hot-toast";
import { richTextToPlainText } from "@/lib/rich-text";
import type { PublicProduct } from "@/lib/types";
import { wholesaleMinimumQuantity } from "@/lib/wholesale";

export default function ProductCard({ product, index, compact = false }: { product: PublicProduct; index: number; compact?: boolean }) {
  const discount = !product.variants?.length && product.originalPrice && product.originalPrice > product.price ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;
  const description = richTextToPlainText(product.description || "").replace(/\s+/g, " ").trim();
  const share = async () => {
    const url = new URL(`/products/${product.slug}`, window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied to clipboard"); }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) toast.error("Unable to share this link. Please try again.");
    }
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.3) }} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/products/${product.slug}`} className="flex flex-1 flex-col focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700">
        <div className="relative aspect-square overflow-hidden bg-white">
          {product.images?.[0] ? <img src={product.images[0]} alt="" loading="lazy" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center bg-gray-50 text-gray-400"><ImageOff aria-hidden="true" size={32} /></div>}
          {discount > 0 && <span className="absolute right-2 top-2 rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">{discount}% OFF</span>}
          {!product.inStock && <span className="absolute bottom-2 left-2 rounded bg-gray-900/80 px-2 py-1 text-xs font-semibold text-white">Out of stock</span>}
          {product.saleType === "wholesale" && <span className="absolute left-2 top-2 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white shadow-sm">Wholesale</span>}
        </div>
        <div className={compact ? "flex flex-1 flex-col gap-1 p-2 sm:p-3" : "flex flex-1 flex-col gap-2 p-3 sm:p-4"}>
          <h3 className={compact ? "line-clamp-2 text-xs font-medium leading-snug text-gray-900 sm:text-sm" : "line-clamp-2 text-sm font-medium leading-snug text-gray-900 sm:text-base"}>{product.name}</h3>
          {description && <p className="line-clamp-2 text-xs leading-relaxed text-gray-600 sm:text-sm">{description}</p>}
        </div>
      </Link>
      <div className={compact ? "flex items-end justify-between gap-1 px-2 pb-2 sm:px-3 sm:pb-3" : "flex items-end justify-between gap-1 px-3 pb-3 sm:px-4 sm:pb-4"}>
        <div className="min-w-0"><p className={compact ? "text-sm font-bold text-emerald-700 sm:text-base" : "text-base font-bold text-emerald-700 sm:text-lg"}>{product.saleType === "wholesale" || product.variants?.length ? <span className="mr-1 text-xs font-medium">From</span> : null}KES {product.price.toLocaleString()}</p>{product.saleType === "wholesale" && <p className="mt-0.5 text-xs text-gray-500">per unit · min. {wholesaleMinimumQuantity(product)}</p>}
        {discount > 0 && <p className="text-xs text-gray-500 line-through">KES {product.originalPrice!.toLocaleString()}</p>}</div>
        <button type="button" onClick={share} aria-label={`Share ${product.name}`} title="Share" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-emerald-700"><Share2 size={18} aria-hidden="true" /></button>
      </div>
    </motion.div>
  );
}
