"use client";
import { useState, useEffect, useRef } from "react";
import { Edit2, Plus, RefreshCw, Eye, EyeOff, Image, ChevronDown, ChevronRight, X } from "lucide-react";

interface Category {
  id: string; name: string; slug: string; parent_id: string | null;
  sort_order: number; is_active: boolean; image_url: string | null; icon?: string;
}

function LevelDropdown({ items, selected, onSelect, onClear, placeholder }: {
  items: Category[]; selected: Category | null;
  onSelect: (c: Category) => void; onClear: () => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative flex items-center">
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
          selected ? "bg-[#E8B86D] text-black" : "bg-[#16213e] border border-white/10 text-white/70 hover:border-[#E8B86D]/50 hover:text-white"
        }`}>
        {selected ? selected.name : placeholder}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {selected && (
        <button onClick={e => { e.stopPropagation(); onClear(); }}
          className="ml-1 p-1 rounded text-white/30 hover:text-white transition-colors">
          <X size={12} />
        </button>
      )}
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[200px] bg-[#16213e] border border-white/10 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto">
          {items.map(cat => (
            <button key={cat.id} onClick={() => { onSelect(cat); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[#E8B86D]/10 flex items-center justify-between gap-3 ${
                selected?.id === cat.id ? "text-[#E8B86D]" : "text-white"
              }`}>
              <span>{cat.name}</span>
              {!cat.is_active && <span className="text-white/20 text-xs">скрыта</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminCategories() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", slug: "", parent_id: "" });
  const [path, setPath] = useState<Category[]>([]); // drill-down path

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/categories", { cache: "no-store" });
    const data: Category[] = res.ok ? await res.json() : [];
    setCats(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const patchCategory = async (id: string, body: Partial<Category>) => {
    await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    await patchCategory(editing.id, {
      name: editing.name, slug: editing.slug,
      sort_order: editing.sort_order, is_active: editing.is_active, image_url: editing.image_url,
    });
    setSaving(false); setEditing(null); load();
  };

  const toggleActive = async (cat: Category) => {
    await patchCategory(cat.id, { is_active: !cat.is_active });
    load();
  };

  const addCategory = async () => {
    if (!newCat.name || !newCat.slug) return;
    const parentId = newCat.parent_id || (path.length > 0 ? path[path.length - 1].id : null);
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newCat.name, slug: newCat.slug,
        parent_id: parentId || null, is_active: true, sort_order: 999,
      }),
    });
    setNewCat({ name: "", slug: "", parent_id: "" });
    setShowAdd(false); load();
  };

  const generateImage = async (cat: Category) => {
    setGenLoading(cat.id);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: cat.id, productName: cat.name, category: cat.slug }),
      });
      const data = await res.json();
      if (data.imageUrl) { await patchCategory(cat.id, { image_url: data.imageUrl }); load(); }
    } catch { }
    setGenLoading(null);
  };

  const childrenOf = (id: string | null) => cats.filter(c => c.parent_id === (id ?? null));
  const hasChildren = (cat: Category) => cats.some(c => c.parent_id === cat.id);

  // Build dropdown levels: always show level 0, then each subsequent level if parent selected
  const dropdownLevels: { items: Category[]; selected: Category | null; levelIdx: number }[] = [
    { items: childrenOf(null), selected: path[0] ?? null, levelIdx: 0 },
  ];
  for (let i = 0; i < path.length; i++) {
    const children = childrenOf(path[i].id);
    if (children.length === 0) break;
    dropdownLevels.push({ items: children, selected: path[i + 1] ?? null, levelIdx: i + 1 });
  }

  const displayedItems = path.length > 0 ? childrenOf(path[path.length - 1].id) : childrenOf(null);

  const selectAtLevel = (levelIdx: number, cat: Category) => setPath(prev => [...prev.slice(0, levelIdx), cat]);
  const clearFromLevel = (levelIdx: number) => setPath(prev => prev.slice(0, levelIdx));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Категории</h1>
          {path.length > 0 && (
            <div className="flex items-center gap-1 mt-1 text-xs text-white/30">
              <button onClick={() => setPath([])} className="hover:text-white transition-colors">Корень</button>
              {path.map((cat, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight size={10} />
                  <button onClick={() => clearFromLevel(i + 1)} className="hover:text-white transition-colors">{cat.name}</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E8B86D] hover:bg-yellow-400 text-black font-bold text-sm">
          <Plus size={14} /> Добавить
        </button>
      </div>

      {/* Cascading dropdowns */}
      <div className="flex items-center gap-1 flex-wrap bg-[#16213e] rounded-xl px-4 py-3 border border-white/5 mb-6">
        <span className="text-white/30 text-xs mr-2">Уровень:</span>
        {dropdownLevels.map((level, idx) => (
          <div key={idx} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight size={13} className="text-white/20 mx-0.5" />}
            <LevelDropdown
              items={level.items}
              selected={level.selected}
              onSelect={(cat) => selectAtLevel(level.levelIdx, cat)}
              onClear={() => clearFromLevel(level.levelIdx)}
              placeholder={idx === 0 ? "Раздел 1-го уровня" : `Раздел ${idx + 1}-го уровня`}
            />
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="bg-[#16213e] rounded-xl p-5 border border-[#E8B86D]/30 mb-6">
          <h3 className="text-white font-semibold mb-4">
            Новая категория{path.length > 0 ? ` → в «${path[path.length - 1].name}»` : " (корневая)"}
          </h3>
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
      ) : displayedItems.length === 0 ? (
        <div className="text-white/20 text-center py-10 text-sm">Нет подкатегорий на этом уровне</div>
      ) : (
        <div className="space-y-1.5">
          {displayedItems.map(cat => (
            <CategoryRow key={cat.id} cat={cat} onEdit={setEditing} onToggle={toggleActive}
              onGenerate={generateImage} genLoading={genLoading}
              hasChildren={hasChildren(cat)}
              onDrillDown={hasChildren(cat) ? () => selectAtLevel(path.length, cat) : undefined}
            />
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
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider block mb-2">Фото раздела</label>
                {editing.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.image_url} alt="" className="w-full h-32 object-cover rounded-lg mb-2 border border-white/10" />
                )}
                <label className="flex items-center justify-center gap-2 w-full py-2.5 border-2 border-dashed border-white/20 hover:border-[#E8B86D]/60 rounded-lg cursor-pointer text-white/40 hover:text-[#E8B86D] text-sm transition-all">
                  <Image size={14} />
                  {uploadingPhoto ? "Загрузка..." : "Выбрать фото"}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingPhoto(true);
                      const fd = new FormData();
                      fd.append("file", file);
                      fd.append("folder", "categories");
                      const res = await fetch("/api/admin/upload-image", { method: "POST", body: fd });
                      const json = await res.json();
                      if (json.url) setEditing(s => s ? { ...s, image_url: json.url } : s);
                      setUploadingPhoto(false);
                    }}
                  />
                </label>
                {editing.image_url && (
                  <button onClick={() => setEditing(s => s ? { ...s, image_url: null } : s)}
                    className="mt-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                    Удалить фото
                  </button>
                )}
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

function CategoryRow({ cat, onEdit, onToggle, onGenerate, genLoading, hasChildren, onDrillDown }: {
  cat: Category; onEdit: (c: Category) => void; onToggle: (c: Category) => void;
  onGenerate: (c: Category) => void; genLoading: string | null;
  hasChildren?: boolean; onDrillDown?: () => void;
}) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border bg-[#16213e] border-white/10">
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
        {hasChildren && onDrillDown && (
          <button onClick={onDrillDown}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-white/30 hover:text-[#E8B86D] hover:bg-[#E8B86D]/10 transition-all border border-white/5"
            title="Войти в подкатегории">
            <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
