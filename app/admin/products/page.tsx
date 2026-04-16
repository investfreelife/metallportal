"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { Search, Edit2, RefreshCw, Download } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Product {
  id: string; name: string; slug: string; gost: string | null;
  steel_grade: string | null; unit: string | null; description: string | null;
  image_url: string | null; category_id: string;
  category?: { name: string; slug: string };
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("products").select("id, name, slug, gost, steel_grade, unit, description, image_url, category_id, category:categories(name, slug)")
      .order("name").range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data } = await q;
    setProducts((data as unknown as Product[]) ?? []);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    await supabase.from("products").update({
      name: editing.name, gost: editing.gost, steel_grade: editing.steel_grade,
      unit: editing.unit, description: editing.description,
    }).eq("id", editing.id);
    setSaving(false); setEditing(null); load();
  };

  const generateImage = async (product: Product) => {
    setGenLoading(product.id);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, productName: product.name, category: (product.category as any)?.slug || "" }),
      });
      const data = await res.json();
      if (data.imageUrl) load();
    } catch { }
    setGenLoading(null);
  };

  const exportExcel = () => {
    const rows = products.map(p => [p.name, p.gost || "", p.steel_grade || "", p.unit || "", (p.category as any)?.name || ""].join(","));
    const csv = ["Название,ГОСТ,Марка стали,Единица,Категория", ...rows].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "products.csv"; a.click();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Товары</h1>
        <button onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 text-white/60 hover:text-white text-sm">
          <Download size={14} /> Экспорт CSV
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Поиск по названию..."
          className="w-full bg-[#16213e] border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white outline-none focus:border-[#E8B86D]" />
      </div>

      {loading ? (
        <div className="text-white/40 text-center py-10">Загрузка...</div>
      ) : (
        <div className="bg-[#16213e] rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Название</th>
                <th className="text-left px-4 py-3">Категория</th>
                <th className="text-left px-4 py-3">ГОСТ</th>
                <th className="text-left px-4 py-3">Ед.</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="text-white font-medium line-clamp-1">{p.name}</div>
                    <div className="text-white/30 text-xs">{p.steel_grade || ""}</div>
                  </td>
                  <td className="px-4 py-2.5 text-white/40 text-xs">{(p.category as any)?.name}</td>
                  <td className="px-4 py-2.5 text-white/40 text-xs">{p.gost}</td>
                  <td className="px-4 py-2.5 text-white/40 text-xs">{p.unit}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => generateImage(p)} disabled={genLoading === p.id}
                        className="p-1.5 rounded text-white/20 hover:text-[#E8B86D] transition-colors" title="AI фото">
                        {genLoading === p.id ? <RefreshCw size={12} className="animate-spin" /> : "✨"}
                      </button>
                      <button onClick={() => setEditing(p)}
                        className="p-1.5 rounded text-white/20 hover:text-white transition-colors">
                        <Edit2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-3 mt-4 justify-center">
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
          className="px-3 py-1.5 text-sm border border-white/20 rounded text-white/60 hover:text-white disabled:opacity-30">← Пред</button>
        <span className="px-3 py-1.5 text-sm text-white/40">Стр. {page + 1}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={products.length < PAGE_SIZE}
          className="px-3 py-1.5 text-sm border border-white/20 rounded text-white/60 hover:text-white disabled:opacity-30">След →</button>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-[#16213e] rounded-xl p-6 w-full max-w-lg border border-white/20" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-4">Редактировать товар</h3>
            <div className="space-y-3">
              {[["Название", "name"], ["ГОСТ", "gost"], ["Марка стали", "steel_grade"], ["Единица", "unit"]].map(([label, key]) => (
                <div key={key}>
                  <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">{label}</label>
                  <input value={(editing as any)[key] ?? ""} onChange={e => setEditing(s => s ? { ...s, [key]: e.target.value } : s)}
                    className="w-full bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]" />
                </div>
              ))}
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Описание</label>
                <textarea value={editing.description ?? ""} onChange={e => setEditing(s => s ? { ...s, description: e.target.value } : s)}
                  rows={3} className="w-full bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D] resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 py-2 bg-[#E8B86D] text-black font-bold rounded-lg text-sm disabled:opacity-60">
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
              <button onClick={() => setEditing(null)} className="flex-1 py-2 border border-white/20 text-white/60 rounded-lg text-sm hover:text-white">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
