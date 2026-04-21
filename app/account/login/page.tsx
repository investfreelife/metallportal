"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AccountLoginPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!email || !password) { setError("Заполните все поля"); return; }
    if (password.length < 6) { setError("Пароль минимум 6 символов"); return; }
    setLoading(true);

    if (tab === "login") {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError("Неверный email или пароль"); setLoading(false); return; }
      window.location.href = "/account";
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) { setError(err.message); setLoading(false); return; }
      setSuccess("Аккаунт создан! Проверьте почту для подтверждения.");
      setLoading(false);
    }
  };

  const tgBtnRef = useRef<HTMLDivElement>(null);

  const handleTelegramAuth = async (tgUser: any) => {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/telegram/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tgUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      if (data.access_token) {
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        await sb.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      }
      window.location.href = "/account";
    } catch (e: any) {
      setError(e.message); setLoading(false);
    }
  };

  useEffect(() => {
    const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    if (!botName || !tgBtnRef.current) return;
    (window as any).TelegramLoginCallback = handleTelegramAuth;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "TelegramLoginCallback(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    tgBtnRef.current.appendChild(script);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 justify-center mb-10">
          <div className="w-10 h-10 bg-gold rounded" />
          <span className="text-2xl font-bold text-foreground">МЕТАЛЛПОРТАЛ</span>
        </Link>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <Building2 size={20} className="text-gold" />
            <h1 className="text-xl font-bold text-foreground">Личный кабинет</h1>
          </div>

          {/* Telegram Login */}
          <div className="mb-6">
            <div ref={tgBtnRef} className="flex justify-center" />
            {!process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME && (
              <div className="flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1a8bbf] text-white rounded-lg py-2.5 px-4 text-sm font-medium opacity-50 cursor-not-allowed">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.25l-2.04 9.61c-.15.667-.54.833-1.095.52l-3-2.21-1.447 1.393c-.16.16-.295.295-.605.295l.215-3.053 5.56-5.023c.242-.215-.053-.334-.373-.12L7.03 14.42l-2.97-.924c-.645-.2-.658-.645.135-.954l11.59-4.47c.537-.194 1.007.13.777.178z"/></svg>
                Войти через Telegram (настройте бота)
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">или по email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Tabs */}
          <div className="flex bg-muted rounded-lg p-1 mb-6">
            {(["login", "register"] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(""); setSuccess(""); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>
                {t === "login" ? "Войти" : "Регистрация"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" autoComplete="email"
                  className="w-full bg-input border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Пароль</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete={tab === "login" ? "current-password" : "new-password"}
                  className="w-full bg-input border border-border rounded-lg pl-9 pr-10 py-2.5 text-sm text-foreground outline-none focus:border-gold transition-colors"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error / success */}
            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{success}</p>}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 disabled:bg-gold/50 text-black font-semibold rounded-lg py-2.5 text-sm transition-all">
              {loading ? "Загрузка..." : tab === "login" ? "Войти" : "Создать аккаунт"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          {tab === "login" && (
            <p className="text-center text-xs text-muted-foreground mt-4">
              Нет аккаунта?{" "}
              <button onClick={() => setTab("register")} className="text-gold hover:underline">
                Зарегистрируйтесь
              </button>
            </p>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link href="/" className="hover:text-gold transition-colors">← На главную</Link>
        </p>
      </div>
    </div>
  );
}
