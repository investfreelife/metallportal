"use client";
import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Stage = "checking" | "logged_out" | "checking_role" | "denied" | "admin" | "designer";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("checking");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const verifyRole = useCallback(async () => {
    setStage("checking_role");
    const res = await fetch("/api/admin/check-role", { cache: "no-store" });
    if (!res.ok) {
      setStage("logged_out");
      return;
    }
    const { role } = await res.json();
    if (role === "admin") setStage("admin");
    else if (role === "designer") setStage("designer");
    else setStage("denied");
  }, []);

  // On mount: see if there's already a Supabase session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) { setStage("logged_out"); return; }
      await verifyRole();
    })();
    return () => { cancelled = true; };
  }, [verifyRole]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pw) return;
    setSubmitting(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (err) {
      setError("Неверный email или пароль");
      setSubmitting(false);
      return;
    }
    await verifyRole();
    setSubmitting(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setStage("logged_out");
    setEmail("");
    setPw("");
    setError("");
  };

  if (stage === "checking" || stage === "checking_role") {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <div className="text-white/40 text-sm">Проверяем доступ…</div>
      </div>
    );
  }

  if (stage === "denied") {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <div className="bg-[#16213e] rounded-xl p-8 w-full max-w-sm border border-red-500/30 text-center">
          <h1 className="text-xl font-bold text-white mb-2">Доступ запрещён</h1>
          <p className="text-white/60 text-sm mb-6">
            Для входа в админку нужна роль <b className="text-[#E8B86D]">admin</b> или
            <b className="text-blue-400"> designer</b>.
          </p>
          <button
            onClick={handleSignOut}
            className="w-full bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-lg text-sm border border-white/10"
          >
            Выйти
          </button>
        </div>
      </div>
    );
  }

  if (stage === "admin" || stage === "designer") {
    return <>{children}</>;
  }

  // logged_out → login form
  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
      <form onSubmit={handleLogin} className="bg-[#16213e] rounded-xl p-8 w-full max-w-sm border border-[#E8B86D]/20">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-[#E8B86D] mb-1">МП</div>
          <h1 className="text-xl font-bold text-white">Вход в админ-панель</h1>
        </div>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full bg-[#0d0d1a] border border-white/20 rounded-lg px-4 py-3 text-white outline-none focus:border-[#E8B86D] mb-3"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Пароль"
          className="w-full bg-[#0d0d1a] border border-white/20 rounded-lg px-4 py-3 text-white outline-none focus:border-[#E8B86D] mb-3"
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !email || !pw}
          className="w-full bg-[#E8B86D] hover:bg-yellow-400 text-black font-bold py-3 rounded-lg transition-all disabled:opacity-60"
        >
          {submitting ? "Проверка..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
