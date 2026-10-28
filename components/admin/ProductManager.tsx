"use client";

import PageQuickActions from "@/components/admin/PageQuickActions";

import { managedImageIdFromUrl } from "@/lib/managed-images";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Edit3, Eye, Folder, FolderPlus, ImagePlus, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import type { Product, ProductCategory, PublicProduct } from "@/lib/types";
import { errorMessage, formatDate, formatMoney } from "@/components/admin/admin-utils";
import RichTextEditor from "@/components/admin/rich-text-editor";

type ProductsResponse = { products: PublicProduct[]; hasMore: boolean; nextCursor: string };
type CategoriesResponse = { categories: ProductCategory[] };
type UploadResponse = { url: string; public_id: string };
type ProductForm = {
  name: string; description: string; features: string; category: string;
  price: string; originalPrice: string; stockQuantity: string; inStock: boolean;
  featured: boolean; status: Product["status"]; images: string[]; brand: string;
  model: string; organicCertified: boolean; seedType: string;
  variants: { id: string; name: string; price: string; stockQuantity: string; image: string }[];
};

const emptyForm: ProductForm = {
  name: "", description: "", features: "", category: "", price: "", originalPrice: "",
  stockQuantity: "0", inStock: true, featured: false, status: "active", images: [], brand: "",
  model: "", organicCertified: false, seedType: "", variants: [],
};

function formFromProduct(product?: PublicProduct | null, fallbackCategory = ""): ProductForm {
  if (!product) return { ...emptyForm, category: fallbackCategory, images: [] };
  return {
    name: product.name, description: product.description, features: product.features ?? "", category: product.category,
    price: String(product.price), originalPrice: product.originalPrice == null ? "" : String(product.originalPrice),
    stockQuantity: String(product.stockQuantity ?? 0), inStock: product.inStock, featured: product.featured,
    status: product.status, images: [...(product.images ?? [])], brand: product.brand ?? "", model: product.model ?? "",
    organicCertified: product.organicCertified ?? false, seedType: product.seedType ?? "",
    variants: (product.variants ?? []).map((v) => ({ ...v, price: String(v.price), stockQuantity: String(v.stockQuantity), image: v.image ?? "" })),
  };
}

export default function ProductManager() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<string[]>([""]);
  const [hasMore, setHasMore] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PublicProduct | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newUploads, setNewUploads] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await api.get<CategoriesResponse>("/api/product-categories?scope=admin&light=true");
      setCategories(response.categories ?? []); setError("");
      setReloadVersion((version) => version + 1);
    } catch (nextError) { setError(errorMessage(nextError, "Categories could not be loaded")); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (searchParams.get("action") === "new" && categories.length) { openEditor(); router.replace("/admin/products", { scroll: false }); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, categories.length]);
  useEffect(() => { setPage(1); setCursors([""]); }, [query, status, categoryFilter]);
  useEffect(() => {
    if (!listOpen) return;
    let active = true; setLoading(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ scope: "admin", paged: "true", limit: "20", cursor: cursors[page - 1] ?? "", category: categoryFilter, status, search: query });
      api.get<ProductsResponse>(`/api/products?${params}`).then((response) => {
        if (!active) return;
        setProducts(response.products); setHasMore(response.hasMore);
        setCursors((current) => [...current.slice(0, page), response.nextCursor]); setError("");
      }).catch((nextError) => { if (active) setError(errorMessage(nextError, "Products could not be loaded")); })
        .finally(() => { if (active) setLoading(false); });
    }, query ? 350 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [listOpen, page, cursors[page - 1], categoryFilter, status, query, reloadVersion]);
  const categoryNames = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const filtered = loading ? [] : products;

  function openEditor(product?: PublicProduct) {
    setEditing(product ?? null); setForm(formFromProduct(product, categories[0]?.id ?? ""));
    setNewUploads([]); setEditorOpen(true);
  }
  async function closeEditor() {
    if (saving) return;
    await Promise.allSettled(newUploads.map((publicId) => api.delete("/api/upload", { publicId })));
    setEditorOpen(false); setEditing(null); setNewUploads([]);
  }
  function setField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) { setForm((current) => ({ ...current, [key]: value })); }

  async function uploadImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    if (form.images.length + files.length > 10) { toast.error("A product can have at most 10 images"); return; }
    setUploading(true);
    try {
      const uploaded: UploadResponse[] = [];
      for (const file of files) {
        const data = new FormData(); data.append("image", file); data.append("purpose", "products");
        const item = await api.upload<UploadResponse>("/api/upload", data);
        uploaded.push(item);
        setNewUploads((current) => [...current, item.public_id]);
      }
      setForm((current) => ({ ...current, images: [...current.images, ...uploaded.map((item) => item.url)] }));
      toast.success(`${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded`);
    } catch (nextError) { toast.error(errorMessage(nextError, "Image upload failed")); }
    finally { setUploading(false); event.target.value = ""; }
  }

  async function uploadVariantImage(variantId: string, event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.append("image", file); data.append("purpose", "products");
      const uploaded = await api.upload<UploadResponse>("/api/upload", data);
      setNewUploads((current) => [...current, uploaded.public_id]);
      setForm((current) => ({ ...current, variants: current.variants.map((variant) => variant.id === variantId ? { ...variant, image: uploaded.url } : variant) }));
      toast.success("Option image uploaded");
    } catch (nextError) {
      toast.error(errorMessage(nextError, "Option image upload failed"));
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  async function removeImage(index: number) {
    const image = form.images[index];
    setForm((current) => ({ ...current, images: current.images.filter((_, itemIndex) => itemIndex !== index) }));
    const publicId = managedImageIdFromUrl(image);
    if (publicId && newUploads.includes(publicId) && !form.variants.some((variant) => variant.image === image)) {
      try { await api.delete("/api/upload", { publicId }); } catch { /* best-effort cleanup */ }
      setNewUploads((current) => current.filter((item) => item !== publicId));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.category) return void toast.error("Select a product category");
    setSaving(true);
    const payload = {
      name: form.name, description: form.description, features: form.features, category: form.category,
      price: form.variants.length ? Math.min(...form.variants.map((v) => Number(v.price))) : Number(form.price), originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
      stockQuantity: Number(form.stockQuantity), inStock: form.inStock, featured: form.featured, status: form.status,
      images: form.images, brand: form.brand, model: form.model, organicCertified: form.organicCertified,
      seedType: form.seedType,
      variants: form.variants.map((v) => ({ ...v, price: Number(v.price), stockQuantity: Number(v.stockQuantity) })),
      ...(editing ? { expectedInventory: { stockQuantity: editing.stockQuantity, variants: (editing.variants ?? []).map((v) => ({ id: v.id, stockQuantity: v.stockQuantity })) } } : {}),
    };
    try {
      if (editing) await api.put(`/api/products/${editing.id}`, payload);
      else await api.post("/api/products", payload);
      const retainedImages = new Set([...form.images, ...form.variants.map((variant) => variant.image).filter(Boolean)]);
      const retainedIds = new Set([...retainedImages].map(managedImageIdFromUrl).filter((id): id is string => Boolean(id)));
      const previousImages = [...(editing?.images ?? []), ...(editing?.variants ?? []).map((variant) => variant.image).filter((image): image is string => Boolean(image))];
      const removed = new Set([...previousImages.map(managedImageIdFromUrl).filter((id): id is string => Boolean(id)), ...newUploads].filter((id) => !retainedIds.has(id)));
      await Promise.allSettled([...removed].map((publicId) => api.delete("/api/upload", { publicId })));
      setNewUploads([]); setEditorOpen(false); setEditing(null);
      toast.success(editing ? "Product updated" : "Product created"); setReloadVersion((version) => version + 1);
    } catch (nextError) { toast.error(errorMessage(nextError, "Product could not be saved")); }
    finally { setSaving(false); }
  }

  async function remove(product: PublicProduct) {
    if (!window.confirm(`Delete “${product.name}”? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/products/${product.id}`);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setReloadVersion((version) => version + 1);
      toast.success("Product deleted");
    } catch (nextError) { toast.error(errorMessage(nextError, "Product could not be deleted")); }
  }

  async function renameCategory(category: ProductCategory) {
    const name = window.prompt("Enter the new product category name:", category.name)?.trim();
    if (!name || name === category.name) return;
    try { await api.put(`/api/product-categories/${category.id}`, { name }); toast.success("Category renamed"); await load(); }
    catch (nextError) { toast.error(errorMessage(nextError, "Category could not be renamed")); }
  }

  async function deleteCategory(category: ProductCategory) {
    const candidates = categories.filter((item) => item.id !== category.id);
    let replacementId = "";
    let count: number;
    try { count = (await api.get<{ count: number }>(`/api/product-categories?scope=admin&countFor=${encodeURIComponent(category.id)}`)).count; }
    catch (nextError) { toast.error(errorMessage(nextError, "Category usage could not be checked")); return; }
    if (count > 0) {
      if (!candidates.length) return void toast.error("Add another category before deleting this one");
      const name = window.prompt(`“${category.name}” contains ${count} product${count === 1 ? "" : "s"}. Type the exact destination category name to move them before deletion:\n\n${candidates.map((item) => item.name).join(", ")}`)?.trim();
      if (!name) return;
      replacementId = candidates.find((item) => item.name.toLowerCase() === name.toLowerCase())?.id ?? "";
      if (!replacementId) return void toast.error("That destination category was not found");
    } else if (!window.confirm(`Delete “${category.name}”?`)) return;
    try {
      await api.delete(`/api/product-categories/${category.id}`, { replacementId });
      if (categoryFilter === category.id) setCategoryFilter("");
      toast.success(count ? "Category deleted and products moved" : "Category deleted"); await load();
    } catch (nextError) { toast.error(errorMessage(nextError, "Category could not be deleted")); }
  }

  return <main className="pb-16 pt-10"><div className="container mx-auto px-4">
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-4xl font-bold"><span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Product Management</span></h1><p className="mt-2 text-gray-600">Manage products, inventory, rich content, media, and categories.</p></div><div className="flex items-center gap-4"><motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="hidden md:block"><Sparkles size={30} className="text-emerald-400/50" /></motion.div></div></div>
    <PageQuickActions actions={[
      { label: "Add product", icon: <Plus size={18} />, onClick: () => openEditor(), disabled: !categories.length },
      { label: "Add category", icon: <FolderPlus size={18} />, onClick: () => setCategoryDialogOpen(true) },
      { label: "View products", icon: <Eye size={18} />, onClick: () => { setListOpen(true); document.getElementById("product-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); } },
      { label: "Manage categories", icon: <Folder size={18} />, href: "#product-categories" },
    ]} />
    <div id="product-categories" className="scroll-mt-20"><CategoryManager categories={categories} selected={categoryFilter} onSelect={(id) => { setCategoryFilter(id); if (id) setListOpen(true); }} onAdd={() => setCategoryDialogOpen(true)} onRename={renameCategory} onDelete={deleteCategory} /></div>
    {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error} <button onClick={() => void load()} className="ml-2 font-semibold underline">Retry</button></div>}
    <section id="product-section" className="scroll-mt-20 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="text-lg font-bold">Products</h2><p className="mt-1 text-sm text-gray-500">View and manage products in pages.</p></div><button type="button" aria-expanded={listOpen} aria-controls="product-list" onClick={() => setListOpen((open) => !open)} className="rounded-lg border border-emerald-600 px-4 py-2 font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">{listOpen ? "Hide products" : "View products"}</button></div>
      {listOpen && <div id="product-list"><div className="flex flex-col gap-3 border-b border-gray-100 p-5 lg:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input aria-label="Search products" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products…" className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-3 outline-none focus:border-emerald-500" /></label><select aria-label="Product category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2.5"><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Product status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2.5"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="draft">Draft</option></select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Product</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Stock</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Created</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{filtered.map((product) => <tr key={product.id} className="hover:bg-gray-50"><td className="px-5 py-4"><div className="flex items-center gap-3"><img src={product.images?.[0] || "/logo.png"} alt="" className="h-12 w-12 rounded-lg object-cover" /><div><p className="font-semibold text-gray-900">{product.name}</p>{product.featured && <span className="text-xs text-amber-600">Featured</span>}</div></div></td><td className="px-5 py-4 text-gray-600">{categoryNames.get(product.category) ?? "Unassigned"}</td><td className="px-5 py-4 font-medium">{formatMoney(product.price)}</td><td className="px-5 py-4"><span className={product.stockQuantity <= 5 ? "font-semibold text-red-600" : "text-gray-600"}>{product.stockQuantity}</span>{Boolean(product.variants?.length) && <div className="mt-1 text-xs text-gray-500">{product.variants!.map((v) => `${v.name}: ${v.stockQuantity}`).join(", ")}</div>}</td><td className="px-5 py-4"><StatusBadge value={product.status} /></td><td className="px-5 py-4 text-sm text-gray-500">{formatDate(product.createdAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => openEditor(product)} aria-label={`Edit ${product.name}`} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"><Edit3 size={18} /></button><button onClick={() => void remove(product)} aria-label={`Delete ${product.name}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"><Trash2 size={18} /></button></div></td></tr>)}</tbody></table></div>
      {!loading && !error && filtered.length === 0 && <p className="p-10 text-center text-gray-500">No products match your filters.</p>}{loading && <p role="status" className="p-10 text-center text-gray-500">Loading products?</p>}
      {!loading && (filtered.length > 0 || page > 1) && <nav aria-label="Product pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 text-sm text-gray-600"><span aria-live="polite">Page {page}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 font-medium disabled:opacity-40">Previous</button><button type="button" disabled={!hasMore} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 font-medium disabled:opacity-40">Next</button></div></nav>}</div>}
    </section>
  </div>
  <AnimatePresence>{editorOpen && <ProductEditor editing={editing} form={form} categories={categories} saving={saving} uploading={uploading} setField={setField} onUploadImages={uploadImages} onUploadVariantImage={uploadVariantImage} onRemoveImage={removeImage} onClose={closeEditor} onSubmit={submit} />}</AnimatePresence>
  {categoryDialogOpen && <CategoryDialog onClose={() => setCategoryDialogOpen(false)} onCreated={load} />}
  </main>;
}

function ProductEditor({ editing, form, categories, saving, uploading, setField, onUploadImages, onUploadVariantImage, onRemoveImage, onClose, onSubmit }: {
  editing: PublicProduct | null; form: ProductForm; categories: ProductCategory[]; saving: boolean; uploading: boolean;
  setField: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
  onUploadImages: (event: ChangeEvent<HTMLInputElement>) => Promise<void>; onRemoveImage: (index: number) => Promise<void>;
  onUploadVariantImage: (variantId: string, event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onClose: () => Promise<void>; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return <div className="fixed inset-0 z-50 bg-white"><motion.div initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .98 }} role="dialog" aria-modal="true" aria-labelledby="product-editor-title" className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white"><div className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-6"><div><h2 id="product-editor-title" className="text-2xl font-bold text-gray-900">{editing ? "Edit Product" : "Add New Product"}</h2><p className="text-sm text-gray-500">Add the details, write the product content, and manage its images.</p></div><button type="button" aria-label="Close" disabled={saving || uploading} onClick={() => void onClose()} className="rounded-lg p-2 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50"><X /></button></div>
    <form onSubmit={(event) => void onSubmit(event)} className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-4 sm:p-6">
      <FormSection title="Product content"><div className="grid gap-4 md:grid-cols-2"><Field label="Product name *" wide><input required maxLength={160} value={form.name} onChange={(event) => setField("name", event.target.value)} className="input-field" /></Field><Field label="Category *"><select required value={form.category} onChange={(event) => setField("category", event.target.value)} className="input-field"><option value="">Select a category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><div className="min-w-0 md:col-span-2"><span className="mb-1.5 block text-sm font-medium text-gray-700">Description *</span><RichTextEditor label="Product description" placeholder="Write the product description…" value={form.description} maxTextLength={10000} allowImages onChange={(value) => setField("description", value)} /></div></div></FormSection>
      <FormSection title="Pricing and inventory"><div className="grid gap-4 md:grid-cols-3">{!form.variants.length && <><Field label="Price (KES) *"><input required min="0.01" step="0.01" type="number" value={form.price} onChange={(event) => setField("price", event.target.value)} className="input-field" /></Field><Field label="Original price"><input min="0" step="0.01" type="number" value={form.originalPrice} onChange={(event) => setField("originalPrice", event.target.value)} className="input-field" /></Field><Field label="Stock quantity"><input min="0" step="1" type="number" value={form.stockQuantity} onChange={(event) => setField("stockQuantity", event.target.value)} className="input-field" /></Field></>}<Field label="Status"><select value={form.status} onChange={(event) => setField("status", event.target.value as Product["status"])} className="input-field"><option value="active">Active</option><option value="inactive">Inactive</option><option value="draft">Draft</option></select></Field><div className="flex flex-wrap items-end gap-5 pb-3 md:col-span-2">{!form.variants.length && <Check label="In stock" checked={form.inStock} onChange={(value) => setField("inStock", value)} />}<Check label="Featured" checked={form.featured} onChange={(value) => setField("featured", value)} /><Check label="Organic certified" checked={form.organicCertified} onChange={(value) => setField("organicCertified", value)} /></div></div></FormSection>
      <FormSection title="Sizes or options"><p className="mb-4 text-sm text-gray-600">Add each size with its own price and stock, for example 150g, 300g and 500g. Leave empty for a single-price product.</p><div className="space-y-4">{form.variants.map((variant, index) => { const update = (patch: Partial<typeof variant>) => setField("variants", form.variants.map((v) => v.id === variant.id ? { ...v, ...patch } : v)); return <div key={variant.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4"><div className="mb-3 flex justify-between"><h4 className="font-semibold">Option {index + 1}</h4><button type="button" disabled={uploading} onClick={() => setField("variants", form.variants.filter((v) => v.id !== variant.id))} className="text-sm font-semibold text-red-700 underline disabled:opacity-50">Remove option</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Size or name *"><input required maxLength={100} placeholder="e.g. 150g" value={variant.name} onChange={(e) => update({ name: e.target.value })} className="input-field" /></Field><Field label="Price (KES) *"><input required type="number" min="0.01" step="0.01" value={variant.price} onChange={(e) => update({ price: e.target.value })} className="input-field" /></Field><Field label="Units in stock *"><input required type="number" min="0" step="1" value={variant.stockQuantity} onChange={(e) => update({ stockQuantity: e.target.value })} className="input-field" /></Field><div className="sm:col-span-2 lg:col-span-4"><p className="mb-2 text-sm font-medium text-gray-700">Option image</p><div className="flex flex-col gap-3 sm:flex-row sm:items-center">{variant.image && <img src={variant.image} alt={`Image for ${variant.name || `option ${index + 1}`}`} className="h-20 w-20 rounded-lg border border-gray-200 object-cover" />}<div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center"><label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-700"><ImagePlus size={17} />{uploading ? "Uploading..." : variant.image ? "Upload a different image" : "Upload an option image"}<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={uploading} aria-label={`Upload image for ${variant.name || `option ${index + 1}`}`} onChange={(event) => void onUploadVariantImage(variant.id, event)} className="sr-only" /></label><label className="min-w-0 flex-1"><span className="sr-only">Choose an existing image for {variant.name || `option ${index + 1}`}</span><select value={variant.image} disabled={uploading} onChange={(e) => update({ image: e.target.value })} className="input-field"><option value="">Use main product image</option>{variant.image && !form.images.includes(variant.image) && <option value={variant.image}>Uploaded option image</option>}{form.images.map((image, i) => <option key={image} value={image}>Product image {i + 1}</option>)}</select></label></div></div><p className="mt-2 text-xs text-gray-500">Upload an image for this option, or use the main product image. JPEG, PNG, GIF or WebP, up to 5 MB.</p></div></div></div>; })}</div><button type="button" onClick={() => setField("variants", [...form.variants, { id: crypto.randomUUID(), name: "", price: "", stockQuantity: "0", image: "" }])} className="mt-4 rounded-lg border border-emerald-600 px-4 py-2 font-semibold text-emerald-700 hover:bg-emerald-50">+ Add an option</button></FormSection>
      <FormSection title="Product images"><label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-gray-300 p-7 text-center hover:border-emerald-500 focus-within:border-emerald-500"><ImagePlus className="mb-2 text-gray-400" /><span className="font-medium text-gray-700">{uploading ? "Uploading…" : "Choose JPEG, PNG, GIF, or WebP images"}</span><span className="text-sm text-gray-500">Up to 5 MB each; maximum 10 images</span><input type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event) => void onUploadImages(event)} disabled={uploading} className="sr-only" /></label>{form.images.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{form.images.map((image, index) => <div key={`${image}-${index}`} className="group relative"><img src={image} alt={`Product preview ${index + 1}`} className="h-28 w-full rounded-lg object-cover" /><button type="button" onClick={() => void onRemoveImage(index)} aria-label={`Remove product image ${index + 1}`} className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"><X size={15} /></button></div>)}</div>}</FormSection>
    </div><div className="flex shrink-0 justify-end gap-3 border-t bg-white px-4 py-3 sm:px-6"><button type="button" disabled={saving || uploading} onClick={() => void onClose()} className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button><button disabled={saving || uploading || !form.category} className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? "Saving…" : editing ? "Update Product" : "Create Product"}</button></div></form>
  </motion.div></div>;
}

function CategoryManager({ categories, selected, onSelect, onAdd, onRename, onDelete }: {
  categories: ProductCategory[]; selected: string; onSelect: (id: string) => void; onAdd: () => void;
  onRename: (category: ProductCategory) => Promise<void>; onDelete: (category: ProductCategory) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const matching = categories.filter((category) => category.name.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(matching.length / 10));
  const currentPage = Math.min(page, pages);
  return <section className="mb-8 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Product categories</h2><p className="mt-1 text-sm text-gray-500">Choose a category to view its products, or manage it below.</p></div><button type="button" onClick={onAdd} className="flex items-center gap-2 rounded-lg border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><FolderPlus size={17} /> Add category</button></div><label className="relative mb-4 block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input aria-label="Search product categories" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search categories..." className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-3 outline-none focus:border-emerald-500" /></label><div className="space-y-2">{matching.slice((currentPage - 1) * 10, currentPage * 10).map((category) => <div key={category.id} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${selected === category.id ? "border-emerald-400 bg-emerald-50" : "border-gray-200 bg-gray-50"}`}><button type="button" onClick={() => onSelect(selected === category.id ? "" : category.id)} className="min-w-[110px] flex-1 py-2 text-left font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-emerald-700">{category.name}</button><button type="button" onClick={() => void onRename(category)} aria-label={`Rename ${category.name}`} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"><Edit3 size={17} /></button><button type="button" onClick={() => void onDelete(category)} aria-label={`Delete ${category.name}`} className="rounded-lg p-2 text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700"><Trash2 size={17} /></button></div>)}</div>{!matching.length && <p className="py-6 text-center text-sm text-gray-500">{categories.length ? "No categories match your search." : "No product categories are available. Add one before creating a product."}</p>}{matching.length > 0 && <nav aria-label="Product category pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 text-sm text-gray-600"><span aria-live="polite">Showing {(currentPage - 1) * 10 + 1} - {Math.min(currentPage * 10, matching.length)} of {matching.length} categories</span><div className="flex items-center gap-2"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button><span>Page {currentPage} of {pages}</span><button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button></div></nav>}</section>;
}

function CategoryDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const trimmed = name.trim();
    if (!trimmed) return void setError("Enter a category name.");
    setSaving(true); setError("");
    try { await api.post("/api/product-categories", { name: trimmed }); toast.success("Product category added"); await onCreated(); dialog.current?.close(); }
    catch (nextError) { setError(errorMessage(nextError, "Category could not be added")); }
    finally { setSaving(false); }
  }
  return <dialog ref={dialog} aria-labelledby="product-category-dialog-title" aria-describedby="product-category-dialog-description" onCancel={(event) => { if (saving) event.preventDefault(); }} onClose={onClose} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-gray-950/60"><form onSubmit={(event) => void submit(event)}><div className="border-b border-gray-100 p-5 sm:p-6"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><FolderPlus size={20} aria-hidden="true" /></div><h2 id="product-category-dialog-title" className="text-xl font-bold">Add product category</h2><p id="product-category-dialog-description" className="mt-1 text-sm text-gray-600">Create a category administrators can assign to products.</p></div><div className="p-5 sm:p-6"><label htmlFor="new-product-category-name" className="mb-2 block text-sm font-semibold">Category name</label><input id="new-product-category-name" autoFocus required maxLength={100} value={name} onChange={(event) => { setName(event.target.value); setError(""); }} placeholder="e.g. Farm tools" aria-invalid={Boolean(error)} aria-describedby={error ? "product-category-dialog-error" : undefined} disabled={saving} className="input-field" />{error && <p id="product-category-dialog-error" role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</div><div className="flex flex-col-reverse gap-3 border-t border-gray-100 p-5 sm:flex-row sm:justify-end sm:px-6"><button type="button" disabled={saving} onClick={() => dialog.current?.close()} className="rounded-lg border border-gray-300 px-4 py-2.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? "Adding…" : "Add category"}</button></div></form></dialog>;
}

function StatusBadge({ value }: { value: string }) { const style = value === "active" ? "bg-green-100 text-green-700" : value === "draft" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"; return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${style}`}>{value}</span>; }
function FormSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h3 className="mb-4 border-b border-gray-100 pb-2 text-lg font-bold text-gray-900">{title}</h3>{children}</section>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? "md:col-span-2" : ""}><span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>{children}</label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded text-emerald-600" />{label}</label>; }
