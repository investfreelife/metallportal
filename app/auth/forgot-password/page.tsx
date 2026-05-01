"use client";
import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center px-4">
      <div className="bg-[#16213e] rounded-xl p-8 w-full max-w-sm border border-[#E8B86D]/20">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-[#E8B86D] mb-1">МП</div>
          <h1 className="text-xl font-bold text-white">
            {sent ? "Проверьте почту" : "Восстановление пароля"}
          </h1>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 size={48} className="text-green-400" />
              <p className="text-sm text-white/70 text-center">
                Письмо со ссылкой для смены пароля отправлено на
                <br />
                <span className="text-[#E8B86D] font-mono">{email}</span>
              </p>
              <p className="text-xs text-white/40 text-center mt-2">
                Не пришло? Проверьте папку «Спам».
              </p>
            </div>
            <Link
              href="/admin"
              className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-lg text-sm border border-white/10 transition-all"
            >
              <ArrowLeft size={14} /> Вернуться к входу
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-white/60 mb-4">
              Введите email — пришлём ссылку для установки нового пароля.
            </p>
            <div className="relative mb-3">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full bg-[#0d0d1a] border border-white/20 rounded-lg pl-10 pr-4 py-3 text-white outline-none focus:border-[#E8B86D]"
              />
            </div>
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-[#E8B86D] hover:bg-yellow-400 text-black font-bold py-3 rounded-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? "Отправляю..." : "Отправить ссылку"}
            </button>
            <div className="text-center mt-4">
              <Link
                href="/admin"
                className="text-sm text-white/40 hover:text-white inline-flex items-center gap-1"
              >
                <ArrowLeft size={12} /> К форме входа
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
