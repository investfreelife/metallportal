"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Upload, CheckCircle, AlertCircle, ExternalLink, Loader2, CheckSquare, Square, Layers } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
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

function PhotoCard({
  cat, onUpdated, selected, onToggle,
}: {
  cat: Category; onUpdated: () => void; selected: boolean; onToggle: (id: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { alert("❌ Только JPG, PNG или WebP."); return; }
    if (file.size > 8 * 1024 * 1024) { alert("❌ Файл больше 8 МБ."); return; }
    setUploading(true); setStatus("idle");
    let uploadFile: File = file;
    try { uploadFile = await compressImage(file, 1200, 0.85); } catch {}
    const fd = new FormData();
    fd.append("file", uploadFile); fd.append("folder", "categories");
    const res = await fetch("/api/admin/upload-image", { method: "POST", body: fd });
    const json = await res.json();
    if (json.url) {
      const saveRes = await fetch("/api/admin/save-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: `category:${cat.slug}`, url: json.url }),
      });
      const saveJson = await saveRes.json();
      if (saveJson.ok) { setStatus("ok"); onUpdated(); }
      else { setStatus("err"); alert("❌ Ошибка сохранения: " + saveJson.error); }
    } else { setStatus("err"); }
    setUploading(false);
  };

  return (
    <div className={`bg-[#16213e] rounded-xl overflow-hidden border transition-all group ${
      selected ? "border-[#E8B86D] ring-2 ring-[#E8B86D]/40" : "border-white/10 hover:border-[#E8B86D]/40"
    }`}>
      {/* Photo preview */}
      <div className="relative h-44 bg-[#0d0d1a] overflow-hidden">
        {cat.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
            <div className="text-4xl mb-2">📷</div>
            <span className="text-xs">Нет фото</span>
          </div>
        )}
        {/* Upload overlay (individual) */}
        <label className={`absolute inset-0 flex flex-col items-center justify-center cursor-pointer transition-all ${
          uploading ? "bg-black/70" : "bg-black/0 group-hover:bg-black/50"
        }`}>
          {uploading ? <Loader2 size={28} className="text-[#E8B86D] animate-spin" /> : (
            <>
              <Upload size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity mb-1" />
              <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                {cat.image_url ? "Заменить фото" : "Добавить фото"}
              </span>
            </>
          )}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
            className="hidden" disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </label>
        {status === "ok" && <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1"><CheckCircle size={14} className="text-white" /></div>}
        {status === "err" && <div className="absolute top-2 right-2 bg-red-500 rounded-full p-1"><AlertCircle size={14} className="text-white" /></div>}
      </div>
      {/* Info + checkbox */}
      <div className="p-3 flex items-center gap-2">
        <button onClick={() => onToggle(cat.id)} className="flex-shrink-0 text-[#E8B86D] hover:scale-110 transition-transform">
          {selected ? <CheckSquare size={18} /> : <Square size={18} className="text-white/30 hover:text-[#E8B86D]" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium truncate">{cat.name}</div>
          <div className="text-white/30 text-xs">{cat.slug}</div>
        </div>
        <a href={`/catalog/${cat.slug}`} target="_blank" rel="noopener noreferrer"
          className="p-1.5 text-white/20 hover:text-[#E8B86D] transition-colors flex-shrink-0">
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

export default function PhotosPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "no-photo" | "has-photo">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupUploading, setGroupUploading] = useState(false);
  const groupInputRef = useRef<HTMLInputElement>(null);

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectAll = (ids: string[]) => setSelected(prev => {
    const next = new Set(prev);
    ids.forEach(id => next.add(id));
    return next;
  });

  const clearSelect = () => setSelected(new Set());

  const handleGroupUpload = async (file: File) => {
    if (selected.size === 0) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { alert("❌ Только JPG, PNG или WebP."); return; }
    if (file.size > 8 * 1024 * 1024) { alert("❌ Файл больше 8 МБ."); return; }
    setGroupUploading(true);
    let uploadFile = file;
    try { uploadFile = await compressImage(file, 1200, 0.85); } catch {}
    const fd = new FormData();
    fd.append("file", uploadFile); fd.append("folder", "categories");
    const upRes = await fetch("/api/admin/upload-image", { method: "POST", body: fd });
    const { url } = await upRes.json();
    if (!url) { alert("❌ Ошибка загрузки"); setGroupUploading(false); return; }
    // Save to each selected category via API (uses service role key)
    const slugs = cats.filter(c => selected.has(c.id)).map(c => c.slug);
    await Promise.all(slugs.map(slug =>
      fetch("/api/admin/save-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: `category:${slug}`, url }),
      })
    ));
    setGroupUploading(false);
    setSelected(new Set());
    load();
  };

  const load = async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    setCats(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const roots = cats.filter(c => !c.parent_id);
  const children = cats.filter(c => c.parent_id);

  const filtered = (list: Category[]) => {
    if (filter === "no-photo") return list.filter(c => !c.image_url);
    if (filter === "has-photo") return list.filter(c => c.image_url);
    return list;
  };

  const noPhotoCount = cats.filter(c => !c.image_url).length;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Фото разделов</h1>
          <p className="text-white/40 text-sm mt-0.5">
            Наведи на карточку и нажми — фото загрузится и сразу появится на сайте
          </p>
        </div>
        {noPhotoCount > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm px-4 py-2 rounded-lg">
            {noPhotoCount} разделов без фото
          </div>
        )}
      </div>

      {/* Group upload bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-6 p-4 bg-[#E8B86D]/10 border border-[#E8B86D]/30 rounded-xl">
          <Layers size={16} className="text-[#E8B86D] flex-shrink-0" />
          <span className="text-[#E8B86D] text-sm font-medium flex-1">
            Выбрано: {selected.size} {selected.size === 1 ? "раздел" : selected.size < 5 ? "раздела" : "разделов"}
          </span>
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm cursor-pointer transition-all ${
            groupUploading ? "bg-white/10 text-white/40" : "bg-[#E8B86D] text-black hover:bg-yellow-400"
          }`}>
            {groupUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {groupUploading ? "Загружаю..." : "Загрузить одно фото для всех"}
            <input ref={groupInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              className="hidden" disabled={groupUploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleGroupUpload(f); }} />
          </label>
          <button onClick={clearSelect} className="text-white/40 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-white/5 transition-all">
            Сбросить
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-8">
        {([["all", "Все"], ["no-photo", "Без фото"], ["has-photo", "С фото"]] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === val ? "bg-[#E8B86D] text-black" : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-white/40 text-center py-20">Загрузка...</div>
      ) : (
        <div className="space-y-10">
          {roots.map(root => {
            const subs = filtered(children.filter(c => c.parent_id === root.id));
            const rootVisible = filter === "all" || (filter === "no-photo" && !root.image_url) || (filter === "has-photo" && !!root.image_url);
            if (!rootVisible && subs.length === 0) return null;
            return (
              <div key={root.id}>
                <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-[#E8B86D] rounded-full inline-block" />
                  {root.name}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {rootVisible && (
                    <div className="relative">
                      <div className="absolute -top-2 -left-2 z-10 bg-[#E8B86D] text-black text-xs font-bold px-2 py-0.5 rounded">
                        Раздел
                      </div>
                      <PhotoCard cat={root} onUpdated={load} selected={selected.has(root.id)} onToggle={toggleSelect} />
                    </div>
                  )}
                  {subs.map(sub => (
                    <PhotoCard key={sub.id} cat={sub} onUpdated={load} selected={selected.has(sub.id)} onToggle={toggleSelect} />
                  ))}
                </div>
                {(rootVisible || subs.length > 0) && (
                  <button onClick={() => selectAll([...(rootVisible ? [root.id] : []), ...subs.map(s => s.id)])}
                    className="mt-2 text-xs text-white/30 hover:text-[#E8B86D] transition-colors">
                    Выбрать все в группе
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
