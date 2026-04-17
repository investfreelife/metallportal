"use client";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

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

interface Props {
  photoId: string;
  className?: string;
  children: React.ReactNode;
}

export default function PhotoEditable({ photoId, className = "", children }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => setEditMode((e as CustomEvent<boolean>).detail);
    window.addEventListener("photoEditMode", handler);
    return () => window.removeEventListener("photoEditMode", handler);
  }, []);

  const handleFile = async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { alert("❌ Только JPG, PNG или WebP"); return; }
    if (file.size > 8 * 1024 * 1024) { alert("❌ Файл больше 8 МБ"); return; }

    setUploading(true);
    let uploadFile = file;
    try { uploadFile = await compressImage(file, 1200, 0.85); } catch {}

    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("folder", "site");
    const upRes = await fetch("/api/admin/upload-image", { method: "POST", body: fd });
    const { url, error: upErr } = await upRes.json();
    if (!url) { alert("❌ Ошибка загрузки: " + upErr); setUploading(false); return; }

    const saveRes = await fetch("/api/admin/save-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId, url }),
    });
    const saveJson = await saveRes.json();
    if (!saveJson.ok) { alert("❌ Ошибка сохранения: " + saveJson.error); setUploading(false); return; }

    setUploading(false);
    setDone(true);
    setTimeout(() => { setDone(false); window.location.reload(); }, 1200);
  };

  return (
    <div className={`relative ${className}`}>
      {children}
      {editMode && (
        <label className={`absolute inset-0 z-20 flex flex-col items-center justify-center cursor-pointer transition-all ${
          uploading || done
            ? "bg-black/60"
            : "bg-transparent hover:bg-[#E8B86D]/20 hover:outline hover:outline-2 hover:outline-dashed hover:outline-[#E8B86D]"
        }`}>
          {uploading && <Loader2 size={22} className="text-[#E8B86D] animate-spin" />}
          {done && <span className="text-green-400 font-bold text-sm">✓ Сохранено!</span>}
          {!uploading && !done && (
            <span className="text-[#E8B86D] font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none px-2 py-1 rounded bg-black/40">
              📷 Вставить фото
            </span>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>
      )}
    </div>
  );
}
