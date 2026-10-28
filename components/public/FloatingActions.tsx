"use client";

// components/FloatingActions.jsx
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, ChevronUp, X } from "lucide-react";
import type { ChatSettings } from "@/lib/types";
import { getPublicChatSettings } from "@/lib/public-settings-client";

const fallbackSettings: ChatSettings = {
  directPhone: "254721627977",
  categories: [
    { id: "study-materials", label: "Study Materials", phone: "254721627977" },
    { id: "it-field", label: "IT Field", phone: "254721627977" },
    { id: "photocopiers", label: "Photocopiers", phone: "254721627977" },
    { id: "computers", label: "Computers", phone: "254721627977" },
    { id: "homeschooling", label: "Homeschooling", phone: "254746840322" },
    { id: "agriculture", label: "Agriculture", phone: "254746840322" },
    { id: "seeds", label: "Seeds", phone: "254746840322" },
    { id: "health-products", label: "Health Products", phone: "254746840322" },
  ],
};

const FloatingActions = () => {
  const pathname = usePathname();
  const productDetail = /^\/products\/[^/]+\/?$/.test(pathname);
  const hasBottomActionBar = productDetail || pathname === "/checkout";
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [chatSettings, setChatSettings] = useState<ChatSettings>(fallbackSettings);

  // Show back to top button after scrolling down
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500);
      setScrollProgress(Math.min(window.scrollY / 1000, 1));
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (pathname !== "/") {
      setIsWhatsAppOpen(false);
      return;
    }
    getPublicChatSettings()
      .then(setChatSettings)
      .catch(() => undefined);
  }, [pathname]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const openWhatsApp = (phone: string, message: string) => {
    const url = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setIsWhatsAppOpen(false);
  };

  return (
    <>
      {/* WhatsApp Button with Quick Replies */}
      {pathname === "/" && <div className="fixed bottom-6 right-6 z-50 md:bottom-8 md:right-8">
        {/* Quick reply menu */}
        <AnimatePresence>
          {isWhatsAppOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="absolute bottom-20 right-0 bg-gray-50 rounded-2xl shadow-2xl border border-gray-700 w-72 overflow-hidden mb-2"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-green-600 to-green-500 p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-gray-900 font-semibold">
                      Chat with us
                    </h3>
                    <p className="text-green-100 text-sm">
                      How can we help you today?
                    </p>
                  </div>
                  <button
                    onClick={() => setIsWhatsAppOpen(false)}
                    className="text-gray-900/80 hover:text-gray-900 bg-black/20 rounded-full p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick replies list */}
              <div className="p-2 max-h-96 overflow-y-auto">
                {chatSettings.categories.map((category, index) => (
                  <motion.button
                    key={category.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => openWhatsApp(category.phone, `Hello! I'd like to know more about ${category.label}.`)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-xl transition-colors text-left group"
                  >
                    <div className="p-2 bg-green-500/10 rounded-lg text-green-400 group-hover:bg-green-500 group-hover:text-gray-900 transition-colors">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <span className="text-gray-600 group-hover:text-gray-900 flex-1 text-sm">
                      {category.label}
                    </span>
                    <MessageCircle className="w-4 h-4 text-gray-600 group-hover:text-green-400" />
                  </motion.button>
                ))}
              </div>

              {/* Footer with direct chat option */}
              <div className="p-3 border-t border-gray-200">
                <button
                  onClick={() => openWhatsApp(chatSettings.directPhone, "Hello! I have a question.")}
                  className="w-full text-center text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  Or send direct message →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main WhatsApp button */}
        <motion.button
          onClick={() => setIsWhatsAppOpen(!isWhatsAppOpen)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className={`bg-green-500 hover:bg-green-600 text-gray-900 rounded-full p-4 shadow-lg shadow-green-500/25 relative transition-all ${
            isWhatsAppOpen ? "rotate-45 bg-green-600" : ""
          }`}
          aria-label="Chat on WhatsApp"
        >
          {isWhatsAppOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <MessageCircle className="w-6 h-6" />
          )}

          {/* Pulsing ring - only show when closed */}
          {!isWhatsAppOpen && (
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute inset-0 bg-green-500 rounded-full -z-10"
            />
          )}

          {/* Unread indicator */}
          {!isWhatsAppOpen && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white text-[10px] flex items-center justify-center text-gray-900 font-bold">
              1
            </span>
          )}
        </motion.button>
      </div>}

      {/* Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 100 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className={`fixed left-6 z-50 md:left-8 ${hasBottomActionBar ? "bottom-24 md:bottom-28" : "bottom-6 md:bottom-8"}`}
          >
            <motion.button
              onClick={scrollToTop}
              whileHover={{ scale: 1.1, y: -5 }}
              whileTap={{ scale: 0.9 }}
              className="bg-purple-600 hover:bg-purple-700 text-gray-900 rounded-full p-3 shadow-lg shadow-purple-600/25 group relative"
              aria-label="Back to top"
            >
              <ChevronUp className="w-5 h-5 md:w-6 md:h-6" />

              {/* Progress ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="18"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                  strokeDasharray="113"
                  strokeDashoffset={
                    113 - 113 * scrollProgress
                  }
                  className="transition-all duration-300"
                />
              </svg>

              {/* Tooltip */}
              <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-gray-50 text-gray-900 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-gray-700">
                Back to top
                <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-gray-50 border-l border-b border-gray-700 rotate-45" />
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingActions;
