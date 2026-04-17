"use client";
import { useState, useEffect, useCallback } from "react";
import { Camera, X, Loader2, CheckCircle } from "lucide-react";

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

export default function AdminBar() {
  const [session, setSession] = useState<{ name: string; role: string } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("admin_session");
      if (raw) setSession(JSON.parse(raw));
    } catch {}
  }, []);

  // Handle click on photo blocks
  const handlePhotoClick = useCallback((e: MouseEvent) => {
    if (!editMode) return;
    const target = (e.target as HTMLElement).closest("[data-photo-id]") as HTMLElement | null;
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();

    const photoId = target.dataset.photoId;
    if (!photoId) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      // ── Validate format
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) {
        alert("❌ Неверный формат. Загружайте только JPG, PNG или WebP.");
        return;
      }

      // ── Validate size (max 8MB before compression)
      if (file.size > 8 * 1024 * 1024) {
        alert("❌ Файл слишком большой (максимум 8 МБ). Уменьшите изображение.");
        return;
      }

      setUploading(true);

      // ── Compress & resize via canvas → WebP max 1200px, 85% quality
      let uploadFile: File = file;
      try {
        uploadFile = await compressImage(file, 1200, 0.85);
      } catch { /* use original if canvas fails */ }

      // 1. Upload file
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("folder", "site");
      const upRes = await fetch("/api/admin/upload-image", { method: "POST", body: fd });
      const { url, error } = await upRes.json();
      if (!url) {
        alert("❌ Ошибка загрузки: " + (error ?? "неизвестная ошибка"));
        setUploading(false);
        return;
      }

      // 2. Save to DB
      const saveRes = await fetch("/api/admin/save-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, url }),
      });
      const saveJson = await saveRes.json();
      if (!saveJson.ok) {
        alert("❌ Ошибка сохранения в базу: " + (saveJson.error ?? "неизвестная ошибка"));
        setUploading(false);
        return;
      }

      // 3. Update DOM immediately (works even if no <img> existed before)
      const existingImg = target.tagName === "IMG"
        ? target as HTMLImageElement
        : target.querySelector("img");
      if (existingImg) {
        existingImg.src = url;
      } else {
        // No img existed (was showing icon) — inject one
        target.innerHTML = "";
        const newImg = document.createElement("img");
        newImg.src = url;
        newImg.alt = "";
        newImg.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
        target.appendChild(newImg);
      }

      setUploading(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    };
    input.click();
  }, [editMode]);

  useEffect(() => {
    if (editMode) {
      document.body.classList.add("photo-edit-mode");
      document.addEventListener("click", handlePhotoClick, true);
    } else {
      document.body.classList.remove("photo-edit-mode");
      document.removeEventListener("click", handlePhotoClick, true);
    }
    return () => {
      document.body.classList.remove("photo-edit-mode");
      document.removeEventListener("click", handlePhotoClick, true);
    };
  }, [editMode, handlePhotoClick]);

  if (!session) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
      {/* Status toast */}
      {(uploading || saved) && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl backdrop-blur-sm border ${
          saved ? "bg-green-500/90 border-green-400 text-white" : "bg-[#1a1a2e]/95 border-[#E8B86D]/30 text-white"
        }`}>
          {uploading && <Loader2 size={14} className="animate-spin text-[#E8B86D]" />}
          {saved && <CheckCircle size={14} />}
          {uploading ? "Загружаю фото..." : "Сохранено! Обновите страницу для финального вида"}
        </div>
      )}

      {/* Edit mode hint */}
      {editMode && !uploading && !saved && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-[#E8B86D]/90 text-black font-medium shadow-xl backdrop-blur-sm border border-[#E8B86D]">
          <Camera size={14} />
          Нажми на любой блок с фото
        </div>
      )}

      {/* Main button */}
      <button
        onClick={() => setEditMode(v => !v)}
        title={editMode ? "Выключить режим фото" : "Режим редактирования фото"}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 border-2 ${
          editMode
            ? "bg-[#E8B86D] border-yellow-400 text-black rotate-0 scale-110"
            : "bg-[#16213e] border-[#E8B86D]/40 text-[#E8B86D] hover:border-[#E8B86D] hover:scale-105"
        }`}
      >
        {editMode ? <X size={22} /> : <Camera size={22} />}
      </button>
    </div>
  );
}
