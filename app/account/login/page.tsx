"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Building2, Phone, MessageCircle } from "lucide-react";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AccountLoginPage() {
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [tab, setTab] = useState<"login" | "register">("login");

  // Email/password state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // Phone OTP state
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Phone login — step 1: send OTP
  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/account/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) { setError(d.error ?? "Ошибка"); return; }
    setOtpSent(true);
    setSuccess(`Код отправлен в Telegram, ${d.name ? d.name + "!" : ""}`);
  };

  // Phone login — step 2: verify OTP
  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/account/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) { setError(d.error ?? "Неверный код"); return; }
    window.location.href = "/account";
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
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
          <div className="flex flex-shrink-0">
            <div className="w-10 h-10 flex items-center justify-center bg-gold">
              <span className="text-black font-black text-xl leading-none" style={{ fontFamily: 'Georgia, serif' }}>Х</span>
            </div>
            <div className="w-10 h-10 flex items-center justify-center bg-foreground">
              <span className="text-background font-black text-xl leading-none" style={{ fontFamily: 'Georgia, serif' }}>М</span>
            </div>
          </div>
          <div className="leading-tight">
            <span className="text-xl font-bold text-foreground">Харланметалл</span>
          </div>
        </Link>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <Building2 size={20} className="text-gold" />
            <h1 className="text-xl font-bold text-foreground">Личный кабинет</h1>
          </div>

          {/* Mode selector */}
          <div className="flex bg-muted rounded-lg p-1 mb-6">
            <button onClick={() => { setMode("phone"); setError(""); setSuccess(""); setOtpSent(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
                mode === "phone" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Phone size={14} /> По телефону
            </button>
            <button onClick={() => { setMode("email"); setError(""); setSuccess(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
                mode === "email" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Mail size={14} /> По email
            </button>
          </div>

          {/* ── PHONE MODE ── */}
          {mode === "phone" && (
            <div className="space-y-4">
              {!otpSent ? (
                <form onSubmit={sendOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Номер телефона</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder="+7 (999) 000-00-00" autoComplete="tel"
                        className="w-full bg-input border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-gold transition-colors"
                      />
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
                  <button type="submit" disabled={loading || !phone.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1a8bbf] disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-all">
                    {loading ? "Отправляю..." : <>
                      <MessageCircle size={16} /> Получить код в Telegram
                    </>}
                  </button>
                  <p className="text-xs text-muted-foreground text-center">
                    Код придёт в бот <a href="https://t.me/metallportal_bot" target="_blank" className="text-[#229ED9] hover:underline">@metallportal_bot</a>
                  </p>
                </form>
              ) : (
                <form onSubmit={verifyOtp} className="space-y-4">
                  {success && <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{success}</p>}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Код из Telegram</label>
                    <input
                      type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000" autoComplete="one-time-code" inputMode="numeric"
                      className="w-full bg-input border border-border rounded-lg px-4 py-3 text-2xl text-center tracking-[0.5em] text-foreground outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
                  <button type="submit" disabled={loading || otp.length < 6}
                    className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 disabled:opacity-50 text-black font-semibold rounded-lg py-2.5 text-sm transition-all">
                    {loading ? "Проверяю..." : <><ArrowRight size={16} /> Войти</>}
                  </button>
                  <button type="button" onClick={() => { setOtpSent(false); setOtp(""); setError(""); setSuccess(""); }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
                    ← Изменить номер
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ── EMAIL MODE ── */}
          {mode === "email" && (<>
            {/* Tabs */}
            <div className="flex bg-muted rounded-lg p-1 mb-4">
              {(["login", "register"] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); setError(""); setSuccess(""); }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                    tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {t === "login" ? "Войти" : "Регистрация"}
                </button>
              ))}
            </div>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
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
          </>)}

        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link href="/" className="hover:text-gold transition-colors">← На главную</Link>
        </p>
      </div>
    </div>
  );
}
