"use client";

import PageQuickActions from "@/components/admin/PageQuickActions";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { AuthorProfile } from "@/lib/types";
import { errorMessage } from "@/components/admin/admin-utils";
import RichTextEditor from "@/components/admin/rich-text-editor";
import { richTextToPlainText } from "@/lib/rich-text";

export default function AuthorManager() {
  const [authors, setAuthors] = useState<AuthorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<AuthorProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setAuthors(await api.get<AuthorProfile[]>("/api/authors")); }
    catch (reason) { setError(errorMessage(reason, "Authors could not be loaded.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  function start(author?: AuthorProfile) { setEditing(author ?? null); setName(author?.name ?? ""); setBio(author?.bio ?? ""); setError(""); setNotice(""); setOpen(true); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (editing) await api.put(`/api/authors/${encodeURIComponent(editing.id)}`, { name, bio });
      else await api.post("/api/authors", { name, bio });
      setOpen(false); await load(); setNotice(editing ? "Author updated." : "Author created. You can now select them when creating a resource.");
    } catch (reason) { setError(errorMessage(reason, "The author could not be saved.")); }
    finally { setSaving(false); }
  }
  async function remove(author: AuthorProfile) {
    if (!window.confirm(`Delete ${author.name}? Authors assigned to resources cannot be deleted until those resources are reassigned.`)) return;
    setSaving(true); setError(""); setNotice("");
    try { await api.delete(`/api/authors/${encodeURIComponent(author.id)}`); await load(); setNotice("Author deleted."); }
    catch (reason) { setError(errorMessage(reason, "The author could not be deleted.")); }
    finally { setSaving(false); }
  }
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold text-gray-900">Authors</h1><p className="mt-2 text-gray-600">Manage the names and biographies shown on resources.</p></div></div>
    <PageQuickActions actions={[
      { label: "Add author", icon: <Plus size={18} />, onClick: () => start() },
      { label: "View authors", icon: <Users size={18} />, href: "#author-profiles" },
      { label: "Refresh authors", icon: <RefreshCw size={18} />, onClick: () => void load(), disabled: loading },
    ]} />
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
    {open && <form onSubmit={save} className="mt-6 space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold">{editing ? "Edit author" : "New author"}</h2><label className="block text-sm font-medium text-gray-800">Name <span aria-hidden="true">*</span><input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="input-field mt-2" /></label><div><span className="mb-2 block text-sm font-medium text-gray-800">About the author</span><RichTextEditor label="About the author" placeholder="Write a short biography..." value={bio} maxTextLength={5000} onChange={setBio} /></div><div className="flex flex-wrap gap-3"><button disabled={saving} className="rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{saving ? "Saving…" : "Save author"}</button><button type="button" disabled={saving} onClick={() => setOpen(false)} className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button></div></form>}
    <section id="author-profiles" aria-label="Author profiles" className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {loading ? <p role="status" className="p-6 text-gray-500">Loading authors…</p> : authors.length === 0 ? <div className="p-8 text-center text-gray-500"><Users className="mx-auto mb-3 text-gray-400" /><p>No authors yet. Add one to select them for a resource.</p></div> : <ul className="divide-y divide-gray-100">{authors.map((author) => <li key={author.id} className="flex flex-wrap items-start justify-between gap-4 p-5"><div className="min-w-0 flex-1"><h2 className="break-words font-semibold text-gray-900">{author.name}</h2><p className="mt-1 line-clamp-2 break-words text-sm text-gray-600">{richTextToPlainText(author.bio) || "No biography added yet."}</p></div><div className="flex gap-2"><button type="button" onClick={() => start(author)} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50" aria-label={`Edit ${author.name}`}><Pencil size={15} /> Edit</button><button type="button" onClick={() => void remove(author)} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50" aria-label={`Delete ${author.name}`}><Trash2 size={15} /> Delete</button></div></li>)}</ul>}
    </section>
  </main>;
}
