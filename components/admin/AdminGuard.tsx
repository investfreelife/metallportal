"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface AdminSession {
  login: string;
  name: string;
  role: "admin" | "designer";
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("admin_session");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AdminSession | null | "loading">("loading");
  const [login, setLogin] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_session");
    setSession(stored ? JSON.parse(stored) : null);
  }, []);

  const handleLogin = async () => {
    if (!login || !pw) return;
    setSubmitting(true);
    setError("");
    const { data, error: err } = await supabase
      .from("admin_users")
      .select("name, login, role, is_active")
      .eq("login", login.trim())
      .eq("password", pw)
      .eq("is_active", true)
      .single();

    if (err || !data) {
      setError("Неверный логин или пароль");
      setSubmitting(false);
      return;
    }
    const s: AdminSession = { login: data.login, name: data.name, role: data.role };
    sessionStorage.setItem("admin_session", JSON.stringify(s));
    setSession(s);
    setSubmitting(false);
  };

  if (session === "loading") return null;

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <div className="bg-[#16213e] rounded-xl p-8 w-full max-w-sm border border-[#E8B86D]/20">
          <div className="text-center mb-6">
            <div className="text-3xl font-bold text-[#E8B86D] mb-1">МП</div>
            <h1 className="text-xl font-bold text-white">Вход в админ-панель</h1>
          </div>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Логин"
            className="w-full bg-[#0d0d1a] border border-white/20 rounded-lg px-4 py-3 text-white outline-none focus:border-[#E8B86D] mb-3"
          />
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Пароль"
            className="w-full bg-[#0d0d1a] border border-white/20 rounded-lg px-4 py-3 text-white outline-none focus:border-[#E8B86D] mb-3"
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={submitting}
            className="w-full bg-[#E8B86D] hover:bg-yellow-400 text-black font-bold py-3 rounded-lg transition-all disabled:opacity-60"
          >
            {submitting ? "Проверка..." : "Войти"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
