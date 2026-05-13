"use client";
import { useState, useEffect } from "react";
import { Camera, X } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function AdminBar() {
  const [role, setRole] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Detect admin/designer session — same pattern as AdminGuard.tsx
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) { setRole(null); return; }
      try {
        const res = await fetch("/api/admin/check-role", { cache: "no-store" });
        if (!res.ok) { setRole(null); return; }
        const { role: r } = await res.json();
        if (!cancelled) setRole(r || null);
      } catch { if (!cancelled) setRole(null); }
    })();
    // Re-check on auth state change (login/logout in another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (!cancelled) {
        supabase.auth.getUser().then(async ({ data }) => {
          if (cancelled) return;
          if (!data.user) { setRole(null); return; }
          const res = await fetch("/api/admin/check-role", { cache: "no-store" });
          if (res.ok) {
            const { role: r } = await res.json();
            if (!cancelled) setRole(r || null);
          }
        });
      }
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
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

  // Only show button для admin / designer
  if (role !== "admin" && role !== "designer") return null;

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
