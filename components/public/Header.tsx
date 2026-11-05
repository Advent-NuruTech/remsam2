"use client";

// components/Header.jsx (smart navbar for light/dark heroes)
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart } from "@/components/providers/CartProvider";
import type { ProductCategory, ResourceTaxonomy } from "@/lib/types";
import { getPublicProductCategories, getPublicTaxonomy } from "@/lib/public-settings-client";
import {
  Menu,
  X,
  ShoppingCart,
  LogOut,
  LayoutDashboard,
  ChevronDown,
  UserRound,
} from "lucide-react";
const logo = "/assets/logo.png";

type NavLinkProps = Omit<React.ComponentProps<typeof Link>, "className"> & {
  className?: string | ((state: { isActive: boolean }) => string);
};

function NavLink({ href, className, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const target = typeof href === "string" ? href.split("?")[0] : href.pathname;
  const isActive = target === "/" ? pathname === "/" : pathname.startsWith(target ?? "");
  return (
    <Link
      href={href}
      className={typeof className === "function" ? className({ isActive }) : className}
      {...props}
    />
  );
}

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<"resources" | "shop" | null>(null);
  const desktopNavRef = useRef<HTMLDivElement>(null);
  const [resourceTaxonomy, setResourceTaxonomy] = useState<ResourceTaxonomy>({ majors: [], subcategories: [] });
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { itemCount: cartItemsCount } = useCart();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPublicTaxonomy().then((taxonomy) => { if (!cancelled) setResourceTaxonomy(taxonomy); }).catch(() => undefined);
    getPublicProductCategories().then((categories) => { if (!cancelled) setProductCategories(categories); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  useEffect(() => {
    if (!openDropdown) return;
    const dismiss = (event: PointerEvent) => {
      if (!desktopNavRef.current?.contains(event.target as Node)) setOpenDropdown(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        desktopNavRef.current?.querySelector<HTMLButtonElement>(`[aria-controls="${openDropdown}-dropdown"]`)?.focus();
        setOpenDropdown(null);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [openDropdown]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      } else if (event.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), summary',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const media = window.matchMedia("(min-width: 768px)");
    const handleResize = () => {
      if (media.matches) setIsMobileMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    media.addEventListener("change", handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      media.removeEventListener("change", handleResize);
      menuButtonRef.current?.focus();
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
    setIsMobileMenuOpen(false);
  };

  const categoryItems = resourceTaxonomy.majors.flatMap((major) => {
    const basePath = major.id === "study-library" ? "/study-materials" : `/articles?major=${encodeURIComponent(major.id)}`;
    return [
      { name: major.name, path: basePath, major: true },
      ...resourceTaxonomy.subcategories.filter((item) => item.parentId === major.id).map((item) => ({
        name: item.name,
        path: `${basePath}${basePath.includes("?") ? "&" : "?"}category=${encodeURIComponent(item.id)}`,
        major: false,
      })),
    ];
  });
  const resourcesItems = [
    ...(categoryItems.length ? categoryItems : [
      { name: "Articles & Blogs", path: "/articles", major: true },
      { name: "Study Library", path: "/study-materials", major: true },
    ]),
    { name: "Videos", path: "/videos", major: true },
  ];
  const shopItems = productCategories.length
    ? productCategories.map((item) => ({ name: item.name, path: `/products?category=${encodeURIComponent(item.id)}` }))
    : [{ name: "All Products", path: "/products" }];

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Practical Life", path: "/practical-christianity" },
    { name: "About", path: "/about" },
    { name: "Contact", path: "/contact" },
  ];

  // ========== SMART TEXT COLOR BASED ON PAGE ==========
  const lightHeroPages = [
    "/videos",
    "/articles",
    "/about",
    "/contact",
    "/products",
    "/cart",
    "/checkout",
    "/account",
    "/order-confirmation",
    "/rst/admin/login",
    "/rst/admin/dashboard",
    "/rst/admin/products",
    "/rst/admin/orders",
    "/rst/admin/articles",
    "/rst/admin/users",
    "/rst/admin/settings",
    "/rst/admin/analytics",
    "/terms",
    "/privacy",
    "/cookie-policy",
    "/donate",
    "/faith",
  ];
  const articleListing = ["/articles", "/faith", "/recipes", "/agriculture", "/homeschooling"].includes(pathname);
  const isLightHeroPage = !articleListing && lightHeroPages.some((path) =>
    pathname.startsWith(path),
  );
  const defaultTextColor = isLightHeroPage ? "text-gray-800" : "text-white";
  const linkColor = isScrolled ? "text-gray-700" : defaultTextColor;
  const linkHoverBg = isScrolled
    ? "hover:bg-gray-100"
    : isLightHeroPage
      ? "hover:bg-gray-100"
      : "hover:bg-white/10";
  const buttonBg = isScrolled
    ? "bg-emerald-600 text-white hover:bg-emerald-700"
    : isLightHeroPage
      ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
      : "bg-white/20 backdrop-blur-sm text-white border border-white/30 hover:bg-white/30";

  const logoVariants: Variants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { type: "spring", stiffness: 100 },
    },
  };

  const hideForStudyScroll = (pathname === "/study-materials" || articleListing) && isScrolled;

  if (pathname === "/products") return null;

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: hideForStudyScroll ? "-100%" : 0 }}
      aria-hidden={hideForStudyScroll}
      inert={hideForStudyScroll}
      transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-sm shadow-md py-2"
          : "bg-transparent py-4"
      }`}
    >
      <nav className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.div
            variants={logoVariants}
            initial="hidden"
            animate="visible"
          >
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src={logo}
                alt="RemSam Homestead Logo"
                width={48}
                height={48}
                priority
                className="bg-white rounded-full w-10 h-10 md:w-12 md:h-12 object-contain"
              />
              <div className="hidden md:flex flex-col">
                <span
                  className={`text-lg font-semibold ${isScrolled ? "text-gray-900" : isLightHeroPage ? "text-gray-900" : "text-white"}`}
                >
                  RemSam Homestead
                </span>
                <span
                  className={`text-xs ${isScrolled ? "text-gray-500" : isLightHeroPage ? "text-gray-500" : "text-gray-200"}`}
                >
                  Faith • Family • Farming
                </span>
              </div>
            </Link>
          </motion.div>

          {/* Desktop Navigation */}
          <div ref={desktopNavRef} className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                href={item.path}
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                    isActive
                      ? isScrolled
                        ? "text-emerald-600 bg-emerald-50"
                        : isLightHeroPage
                          ? "text-emerald-600 bg-emerald-50"
                          : "text-emerald-300 bg-white/10"
                      : `${linkColor} ${linkHoverBg}`
                  }`
                }
              >
                {item.name}
              </NavLink>
            ))}

            {/* Desktop dropdowns */}
            {([
              { id: "resources" as const, label: "Resources", items: resourcesItems },
              { id: "shop" as const, label: "Shop", items: shopItems },
            ]).map((section) => (
              <div key={section.id} className="relative">
                <button
                  type="button"
                  aria-expanded={openDropdown === section.id}
                  aria-controls={`${section.id}-dropdown`}
                  onClick={() => setOpenDropdown((current) => current === section.id ? null : section.id)}
                  className={`inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${linkColor} ${linkHoverBg}`}
                >
                  {section.label}
                  <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${openDropdown === section.id ? "rotate-180" : ""}`} />
                </button>
                {openDropdown === section.id && (
                  <div id={`${section.id}-dropdown`} className="absolute left-0 top-full z-50 pt-2">
                    <div className={`max-h-[min(70vh,calc(100dvh-6rem))] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-xl border p-2 shadow-xl ${isScrolled || isLightHeroPage ? "border-gray-200 bg-white" : "border-white/10 bg-gray-800"}`}>
                      {section.items.map((item) => (
                        <NavLink
                          key={`${item.path}-${item.name}`}
                          href={item.path}
                          onClick={() => setOpenDropdown(null)}
                          className={({ isActive }) =>
                            `block rounded-lg px-4 py-2.5 text-sm leading-5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-500 ${"major" in item && item.major ? "font-semibold" : section.id === "resources" ? "pl-7" : ""} ${
                              isActive
                                ? isScrolled || isLightHeroPage ? "bg-emerald-50 text-emerald-700" : "bg-white/10 text-emerald-300"
                                : isScrolled || isLightHeroPage ? "text-gray-700 hover:bg-gray-50" : "text-gray-200 hover:bg-white/10"
                            }`
                          }
                        >
                          {item.name}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Donate Button */}
            <NavLink
              href="/donate"
              className={({ isActive }) =>
                `px-5 py-2 rounded-lg font-medium text-sm transition-all ${
                  isActive ? "bg-emerald-700 text-white" : buttonBg
                }`
              }
            >
              Donate
            </NavLink>
          </div>

          {/* Right side icons - Cart and Admin (only if logged in) */}
          <div className="flex items-center gap-3">
            <Link href="/account" aria-label={user ? "Your account" : "Sign in or create an account"} className={`rounded-lg p-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${isScrolled || isLightHeroPage ? "text-gray-700 hover:text-emerald-600" : "text-white hover:text-emerald-300"}`}><UserRound className="h-5 w-5" /></Link>
            {/* Cart */}
            <Link
              href="/cart"
              className={`relative p-2 transition-colors ${isScrolled ? "text-gray-700 hover:text-emerald-600" : isLightHeroPage ? "text-gray-700 hover:text-emerald-600" : "text-white hover:text-emerald-300"}`}
            >
              <ShoppingCart className="w-5 h-5" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-lg">
                  {cartItemsCount}
                </span>
              )}
            </Link>

            {/* Admin Section – ONLY when admin is logged in */}
            {user?.role === "admin" && (
              <div className="hidden items-center gap-2 md:flex">
                <Link
                  href="/rst/admin/dashboard"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isScrolled || isLightHeroPage
                      ? "text-gray-700 hover:bg-gray-100"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden md:inline">Dashboard</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isScrolled || isLightHeroPage
                      ? "text-gray-700 hover:bg-gray-100"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
              className={`md:hidden p-2 transition-colors ${isScrolled ? "text-gray-700" : isLightHeroPage ? "text-gray-700" : "text-white"}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-[9999] md:hidden">
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm"
              />
              <motion.div
                ref={drawerRef}
                id="mobile-navigation"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "tween", duration: 0.25 }}
                className="absolute inset-y-0 left-0 flex h-[100dvh] w-[min(85vw,22rem)] flex-col bg-white shadow-2xl"
              >
                <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
                  <span className="text-base font-semibold text-gray-900">RemSam Homestead</span>
                  <button
                    type="button"
                    aria-label="Close navigation menu"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))]"
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a")) setIsMobileMenuOpen(false);
                  }}
                >
                  <div className="space-y-1">
                    {navItems.map((item) => (
                      <NavLink
                        key={item.name}
                        href={item.path}
                        className={({ isActive }) =>
                          `block rounded-lg px-4 py-3 font-medium ${isActive ? "bg-emerald-50 text-emerald-700" : "text-gray-800 hover:bg-gray-50"}`
                        }
                      >
                        {item.name}
                      </NavLink>
                    ))}
                    <NavLink
                      href="/newsletter"
                      className={({ isActive }) =>
                        `block rounded-lg px-4 py-3 font-medium ${isActive ? "bg-emerald-50 text-emerald-700" : "text-gray-800 hover:bg-gray-50"}`
                      }
                    >
                      Newsletter
                    </NavLink>
                    {[
                      { name: "Resources", items: resourcesItems },
                      { name: "Shop", items: shopItems },
                    ].map((section) => (
                      <details key={section.name} className="group">
                        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-4 py-3 font-medium text-gray-800 transition-colors hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                          {section.name}
                          <ChevronDown className="h-5 w-5 text-gray-500 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="ml-4 border-l border-gray-200 pl-2">
                          {section.items.map((item) => (
                            <NavLink key={`${item.path}-${item.name}`} href={item.path} className={`block rounded-lg px-4 py-3 text-gray-700 hover:bg-gray-50 ${"major" in item && item.major ? "font-semibold" : "ml-3 text-sm"}`}>
                              {item.name}
                            </NavLink>
                          ))}
                        </div>
                      </details>
                    ))}
                    <div className="pt-4">
                      <NavLink href="/donate" className="block rounded-lg bg-emerald-600 px-4 py-3 text-center font-semibold text-white hover:bg-emerald-700">
                        Donate
                      </NavLink>
                    </div>
                  </div>
                </div>
                {user?.role === "admin" && (
                  <div className="shrink-0 border-t border-gray-100 bg-white px-4 pt-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
                    <Link href="/rst/admin/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 font-medium text-emerald-700 hover:bg-emerald-50">
                      <LayoutDashboard className="h-5 w-5" /> Dashboard
                    </Link>
                    <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-gray-700 hover:bg-gray-50">
                      <LogOut className="h-5 w-5" /> Logout
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>, document.body)}
      </nav>
    </motion.header>
  );
};

export default Header;
