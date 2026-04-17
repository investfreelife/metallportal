"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Search, Edit2, RefreshCw, Download, CheckSquare, Square, Upload, Layers, Image as ImageIcon, Loader2 } from "lucide-react";

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

function compressImage(file: File, maxPx: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error("canvas failed")); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
      }, "image/webp", quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupUploading, setGroupUploading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const groupInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(prev => prev.size === products.length ? new Set() : new Set(products.map(p => p.id)));

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { alert("❌ Только JPG, PNG или WebP"); return null; }
    if (file.size > 8 * 1024 * 1024) { alert("❌ Файл больше 8 МБ"); return null; }
    let uploadFile = file;
    try { uploadFile = await compressImage(file, 1200, 0.85); } catch {}
    const fd = new FormData();
    fd.append("file", uploadFile); fd.append("folder", "products");
    const res = await fetch("/api/admin/upload-image", { method: "POST", body: fd });
    const { url } = await res.json();
    return url || null;
  };

  const handleRowPhoto = async (product: Product, file: File) => {
    setPhotoUploading(product.id);
    const url = await uploadPhoto(file);
    if (url) { await supabase.from("products").update({ image_url: url }).eq("id", product.id); load(); }
    setPhotoUploading(null);
  };

  const handleGroupUpload = async (file: File) => {
    if (selected.size === 0) return;
    setGroupUploading(true);
    const url = await uploadPhoto(file);
    if (url) {
      await supabase.from("products").update({ image_url: url }).in("id", Array.from(selected));
      setSelected(new Set()); load();
    }
    setGroupUploading(false);
  };

  const handleEditPhoto = async (file: File) => {
    if (!editing) return;
    setUploadingPhoto(true);
    const url = await uploadPhoto(file);
    if (url) setEditing(s => s ? { ...s, image_url: url } : s);
    setUploadingPhoto(false);
  };

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

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-4 bg-[#E8B86D]/10 border border-[#E8B86D]/30 rounded-xl">
          <Layers size={16} className="text-[#E8B86D] flex-shrink-0" />
          <span className="text-[#E8B86D] text-sm font-medium flex-1">Выбрано: {selected.size} товаров</span>
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm cursor-pointer ${
            groupUploading ? "bg-white/10 text-white/40" : "bg-[#E8B86D] text-black hover:bg-yellow-400"
          }`}>
            {groupUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {groupUploading ? "Загружаю..." : "Одно фото для всех выбранных"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              disabled={groupUploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleGroupUpload(f); }} />
          </label>
          <button onClick={() => setSelected(new Set())} className="text-white/40 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-white/5">Сбросить</button>
        </div>
      )}

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
                <th className="px-4 py-3 w-8">
                  <button onClick={toggleAll} className="text-[#E8B86D]">
                    {selected.size === products.length && products.length > 0 ? <CheckSquare size={14} /> : <Square size={14} className="text-white/30" />}
                  </button>
                </th>
                <th className="px-4 py-3 w-12">Фото</th>
                <th className="text-left px-4 py-3">Название</th>
                <th className="text-left px-4 py-3">Категория</th>
                <th className="text-left px-4 py-3">ГОСТ</th>
                <th className="text-left px-4 py-3">Ед.</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                  selected.has(p.id) ? "bg-[#E8B86D]/5" : ""
                }`}>
                  <td className="px-4 py-2.5">
                    <button onClick={() => toggleSelect(p.id)} className="text-[#E8B86D]">
                      {selected.has(p.id) ? <CheckSquare size={14} /> : <Square size={14} className="text-white/20 hover:text-[#E8B86D]" />}
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    <label className="relative cursor-pointer block w-10 h-10 rounded overflow-hidden bg-white/5 flex-shrink-0 group">
                      {p.image_url
                        ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-white/20"><ImageIcon size={14} /></div>}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        {photoUploading === p.id ? <Loader2 size={10} className="text-white animate-spin" /> : <Upload size={10} className="text-white" />}
                      </div>
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                        disabled={photoUploading === p.id}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleRowPhoto(p, f); }} />
                    </label>
                  </td>
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
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider block mb-2">Фото товара</label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  {editing.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editing.image_url} alt="" className="w-20 h-14 object-cover rounded border border-white/20 flex-shrink-0" />
                  )}
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-all ${
                    uploadingPhoto ? "border-white/10 text-white/30" : "border-[#E8B86D]/40 text-[#E8B86D] hover:bg-[#E8B86D]/10"
                  }`}>
                    {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploadingPhoto ? "Загрузка..." : editing.image_url ? "Заменить фото" : "Загрузить фото"}
                  </div>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    disabled={uploadingPhoto} onChange={e => { const f = e.target.files?.[0]; if (f) handleEditPhoto(f); }} />
                </label>
              </div>
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
