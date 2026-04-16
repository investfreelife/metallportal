"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Edit2, Plus, RefreshCw, Eye, EyeOff, Image } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Category {
  id: string; name: string; slug: string; parent_id: string | null;
  sort_order: number; is_active: boolean; image_url: string | null; icon?: string;
}

export default function AdminCategories() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", slug: "", parent_id: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setCats(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    await supabase.from("categories").update({
      name: editing.name, slug: editing.slug,
      sort_order: editing.sort_order, is_active: editing.is_active, image_url: editing.image_url,
    }).eq("id", editing.id);
    setSaving(false);
    setEditing(null);
    load();
  };

  const toggleActive = async (cat: Category) => {
    await supabase.from("categories").update({ is_active: !cat.is_active }).eq("id", cat.id);
    load();
  };

  const addCategory = async () => {
    if (!newCat.name || !newCat.slug) return;
    await supabase.from("categories").insert({
      name: newCat.name, slug: newCat.slug,
      parent_id: newCat.parent_id || null, is_active: true, sort_order: 999,
    });
    setNewCat({ name: "", slug: "", parent_id: "" });
    setShowAdd(false);
    load();
  };

  const generateImage = async (cat: Category) => {
    setGenLoading(cat.id);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: cat.id, productName: cat.name, category: cat.slug }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        await supabase.from("categories").update({ image_url: data.imageUrl }).eq("id", cat.id);
        load();
      }
    } catch { }
    setGenLoading(null);
  };

  const rootCats = cats.filter(c => !c.parent_id);
  const childCats = cats.filter(c => c.parent_id);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Категории</h1>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E8B86D] hover:bg-yellow-400 text-black font-bold text-sm">
          <Plus size={14} /> Добавить
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#16213e] rounded-xl p-5 border border-[#E8B86D]/30 mb-6">
          <h3 className="text-white font-semibold mb-4">Новая категория</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input value={newCat.name} onChange={e => setNewCat(s => ({ ...s, name: e.target.value }))}
              placeholder="Название" className="bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]" />
            <input value={newCat.slug} onChange={e => setNewCat(s => ({ ...s, slug: e.target.value }))}
              placeholder="slug" className="bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]" />
            <select value={newCat.parent_id} onChange={e => setNewCat(s => ({ ...s, parent_id: e.target.value }))}
              className="bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]">
              <option value="">Корневая</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={addCategory} className="px-4 py-2 bg-[#E8B86D] text-black text-sm font-bold rounded-lg">Создать</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-white/50 text-sm rounded-lg hover:text-white">Отмена</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-white/40 text-center py-10">Загрузка...</div>
      ) : (
        <div className="space-y-2">
          {rootCats.map(root => (
            <div key={root.id}>
              <CategoryRow cat={root} onEdit={setEditing} onToggle={toggleActive} onGenerate={generateImage} genLoading={genLoading} isRoot />
              {childCats.filter(c => c.parent_id === root.id).map(child => (
                <div key={child.id} className="ml-8">
                  <CategoryRow cat={child} onEdit={setEditing} onToggle={toggleActive} onGenerate={generateImage} genLoading={genLoading} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-[#16213e] rounded-xl p-6 w-full max-w-md border border-white/20" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-4">Редактировать: {editing.name}</h3>
            <div className="space-y-3">
              {[["Название", "name"], ["Slug", "slug"]].map(([label, key]) => (
                <div key={key}>
                  <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">{label}</label>
                  <input value={(editing as any)[key]} onChange={e => setEditing(s => s ? { ...s, [key]: e.target.value } : s)}
                    className="w-full bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]" />
                </div>
              ))}
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Порядок</label>
                <input type="number" value={editing.sort_order} onChange={e => setEditing(s => s ? { ...s, sort_order: Number(e.target.value) } : s)}
                  className="w-full bg-[#0d0d1a] border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]" />
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

function CategoryRow({ cat, onEdit, onToggle, onGenerate, genLoading, isRoot = false }: {
  cat: Category; onEdit: (c: Category) => void; onToggle: (c: Category) => void;
  onGenerate: (c: Category) => void; genLoading: string | null; isRoot?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 p-3 rounded-lg border mb-1 ${
      isRoot ? "bg-[#16213e] border-white/10" : "bg-[#16213e]/50 border-white/5"
    }`}>
      {cat.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cat.image_url} alt={cat.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
          <Image size={14} className="text-white/20" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white text-sm">{cat.name}</div>
        <div className="text-white/30 text-xs">{cat.slug}</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onGenerate(cat)} disabled={genLoading === cat.id}
          className="p-1.5 rounded text-white/30 hover:text-[#E8B86D] transition-colors" title="Генерировать фото AI">
          {genLoading === cat.id ? <RefreshCw size={14} className="animate-spin" /> : "✨"}
        </button>
        <button onClick={() => onToggle(cat)}
          className="p-1.5 rounded transition-colors" title={cat.is_active ? "Скрыть" : "Показать"}>
          {cat.is_active ? <Eye size={14} className="text-green-400" /> : <EyeOff size={14} className="text-white/20" />}
        </button>
        <button onClick={() => onEdit(cat)}
          className="p-1.5 rounded text-white/30 hover:text-white transition-colors">
          <Edit2 size={14} />
        </button>
      </div>
    </div>
  );
}
