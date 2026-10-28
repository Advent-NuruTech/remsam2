"use client";

import { motion } from "framer-motion";
import { CheckCircle, Clock, Package } from "lucide-react";

export default function SuccessMessage({ orderNumber, createdAt }: { orderNumber: string; createdAt?: unknown }) {
  const date = typeof createdAt === "string" || typeof createdAt === "number" ? new Date(createdAt).toLocaleDateString() : "";
  return <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden text-center bg-white rounded-2xl shadow-sm p-8 border border-gray-100"><div className="relative z-10"><motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center shadow-md mx-auto mb-6"><CheckCircle size={48} className="text-white" /></motion.div><h1 className="text-3xl md:text-4xl font-bold mb-3 text-gray-800">Payment Received!</h1><p className="text-gray-600 text-lg mb-4">Your Paystack payment was confirmed. RemSam will now process your order and discuss the separate delivery fee with you.</p><div className="inline-flex flex-wrap justify-center items-center gap-3 bg-gray-50 border rounded-full px-6 py-3"><Package size={18} className="text-emerald-500" /><span className="font-medium">Order #{orderNumber}</span>{date && <><span className="w-1 h-1 bg-gray-300 rounded-full" /><Clock size={18} className="text-emerald-500" /><span className="text-gray-600">{date}</span></>}</div></div></motion.div>;
}
