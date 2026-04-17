"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Upload, CheckCircle, AlertCircle, ExternalLink, Loader2 } from "lucide-react";

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

function PhotoCard({ cat, onUpdated }: { cat: Category; onUpdated: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      alert("❌ Только JPG, PNG или WebP. Другие форматы не принимаются.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert("❌ Файл больше 8 МБ. Уменьшите изображение перед загрузкой.");
      return;
    }
    setUploading(true);
    setStatus("idle");

    let uploadFile: File = file;
    try { uploadFile = await compressImage(file, 1200, 0.85); } catch {}

    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("folder", "categories");
    const res = await fetch("/api/admin/upload-image", { method: "POST", body: fd });
    const json = await res.json();
    if (json.url) {
      await supabase.from("categories").update({ image_url: json.url }).eq("id", cat.id);
      setStatus("ok");
      onUpdated();
    } else {
      setStatus("err");
    }
    setUploading(false);
  };

  return (
    <div className="bg-[#16213e] rounded-xl overflow-hidden border border-white/10 hover:border-[#E8B86D]/40 transition-all group">
      {/* Photo preview */}
      <div className="relative h-44 bg-[#0d0d1a] overflow-hidden">
        {cat.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cat.image_url}
            alt={cat.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
            <div className="text-4xl mb-2">📷</div>
            <span className="text-xs">Нет фото</span>
          </div>
        )}

        {/* Upload overlay */}
        <label className={`absolute inset-0 flex flex-col items-center justify-center cursor-pointer transition-all ${
          uploading ? "bg-black/70" : "bg-black/0 group-hover:bg-black/50"
        }`}>
          {uploading ? (
            <Loader2 size={28} className="text-[#E8B86D] animate-spin" />
          ) : (
            <>
              <Upload size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity mb-1" />
              <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                {cat.image_url ? "Заменить фото" : "Добавить фото"}
              </span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>

        {/* Status badge */}
        {status === "ok" && (
          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
            <CheckCircle size={14} className="text-white" />
          </div>
        )}
        {status === "err" && (
          <div className="absolute top-2 right-2 bg-red-500 rounded-full p-1">
            <AlertCircle size={14} className="text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex items-center justify-between">
        <div>
          <div className="text-white text-sm font-medium">{cat.name}</div>
          <div className="text-white/30 text-xs mt-0.5">{cat.slug}</div>
        </div>
        <a
          href={`/catalog/${cat.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-white/20 hover:text-[#E8B86D] transition-colors"
          title="Посмотреть на сайте"
        >
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
                      <PhotoCard cat={root} onUpdated={load} />
                    </div>
                  )}
                  {subs.map(sub => (
                    <PhotoCard key={sub.id} cat={sub} onUpdated={load} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
