"use client";
import { useState, useEffect } from "react";
import { Camera, X } from "lucide-react";

export default function AdminBar() {
  const [session, setSession] = useState<{ name: string; role: string } | null>(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("admin_session");
      if (raw) setSession(JSON.parse(raw));
    } catch {}
  }, []);

  const toggle = () => {
    const next = !editMode;
    setEditMode(next);
    if (next) {
      document.body.classList.add("photo-edit-mode");
    } else {
      document.body.classList.remove("photo-edit-mode");
    }
    window.dispatchEvent(new CustomEvent("photoEditMode", { detail: next }));
  };

  if (!session) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
      {editMode && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-[#E8B86D]/90 text-black font-medium shadow-xl border border-[#E8B86D]">
          <Camera size={14} />
          Нажми на любое фото чтобы заменить
        </div>
      )}
      <button
        onClick={toggle}
        title={editMode ? "Выключить режим фото" : "Режим редактирования фото"}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 border-2 ${
          editMode
            ? "bg-[#E8B86D] border-yellow-400 text-black scale-110"
            : "bg-[#16213e] border-[#E8B86D]/40 text-[#E8B86D] hover:border-[#E8B86D] hover:scale-105"
        }`}
      >
        {editMode ? <X size={22} /> : <Camera size={22} />}
      </button>
    </div>
  );
}
