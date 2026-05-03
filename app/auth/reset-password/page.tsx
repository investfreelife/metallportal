"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Stage = "checking" | "ready" | "no_token" | "saved";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Recovery flow can arrive in two shapes:
  //   PKCE (default in @supabase/ssr): ?code=<pkce> in query
  //   Implicit (legacy):              #access_token=...&type=recovery in hash
  // @supabase/ssr's createBrowserClient auto-exchanges either form on mount,
  // but the resulting event differs (SIGNED_IN for PKCE, PASSWORD_RECOVERY for
  // implicit). We listen for both, plus poll getUser() as a final fallback.
  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setStage("ready");
      }
    });

    const init = async () => {
      const url = new URL(window.location.href);
      const errorDesc = url.searchParams.get("error_description") || url.hash.match(/error_description=([^&]*)/)?.[1];
      if (errorDesc) {
        if (!cancelled) {
          setError(decodeURIComponent(errorDesc.replace(/\+/g, " ")));
          setStage("no_token");
        }
        return;
      }

      // Poll for ~1.5s while @supabase/ssr exchanges the code/hash for a session.
      for (let i = 0; i < 15; i++) {
        if (cancelled) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (!cancelled) setStage("ready");
          return;
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      if (!cancelled) {
        setStage((s) => (s === "checking" ? "no_token" : s));
      }
    };

    init();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    if (password.length < 8) {
      setError("Минимум 8 символов");
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStage("saved");
    setTimeout(() => router.push("/admin"), 1500);
  };

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center px-4">
      <div className="bg-[#16213e] rounded-xl p-8 w-full max-w-sm border border-[#E8B86D]/20">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-[#E8B86D] mb-1">МП</div>
          <h1 className="text-xl font-bold text-white">
            {stage === "saved" ? "Пароль обновлён" : "Новый пароль"}
          </h1>
        </div>

        {stage === "checking" && (
          <div className="text-center text-white/40 text-sm py-6">
            Проверяем ссылку…
          </div>
        )}

        {stage === "no_token" && (
          <div className="space-y-4">
            <p className="text-sm text-white/60 text-center">
              Ссылка устарела или уже использована. Запросите новое письмо.
            </p>
            <Link
              href="/auth/forgot-password"
              className="block text-center w-full bg-[#E8B86D] hover:bg-yellow-400 text-black font-bold py-3 rounded-lg transition-all"
            >
              Запросить ссылку
            </Link>
          </div>
        )}

        {stage === "ready" && (
          <form onSubmit={handleSubmit}>
            <div className="relative mb-3">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                type={showPwd ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Новый пароль (мин. 8)"
                required
                className="w-full bg-[#0d0d1a] border border-white/20 rounded-lg pl-10 pr-10 py-3 text-white outline-none focus:border-[#E8B86D]"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative mb-3">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                type={showPwd ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Повторите пароль"
                required
                className="w-full bg-[#0d0d1a] border border-white/20 rounded-lg pl-10 pr-4 py-3 text-white outline-none focus:border-[#E8B86D]"
              />
            </div>
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !password || !confirm}
              className="w-full bg-[#E8B86D] hover:bg-yellow-400 text-black font-bold py-3 rounded-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {submitting ? "Сохраняю..." : "Сохранить"}
            </button>
          </form>
        )}

        {stage === "saved" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 size={48} className="text-green-400" />
            <p className="text-sm text-white/70 text-center">
              Пароль обновлён. Перенаправляем в админку…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
