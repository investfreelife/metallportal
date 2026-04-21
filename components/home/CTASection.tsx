"use client";

import { Send, Check, Loader2 } from "lucide-react";
import { useState } from "react";

export default function CTASection() {
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() && !phone.trim()) { setErr("Опишите запрос или укажите телефон"); return; }
    setLoading(true); setErr("");
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone || null, message, type: "quote" }),
      });
      // Fire CRM tracking event
      if (typeof window !== "undefined" && (window as Window & { mpTrack?: (t: string, d: object) => void }).mpTrack) {
        (window as Window & { mpTrack?: (t: string, d: object) => void }).mpTrack!("form_submit", { phone, message });
      }
      setDone(true);
    } catch {
      setErr("Ошибка отправки, попробуйте ещё раз");
    }
    setLoading(false);
  }

  return (
    <section className="py-16" style={{ backgroundColor: "#0d0d1a" }}>
      <div className="container-main">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-8">
            Не нашли нужную позицию?
          </h2>

          {done ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-14 h-14 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
                <Check size={28} className="text-gold" />
              </div>
              <p className="text-white font-semibold text-lg">Заявка принята!</p>
              <p className="text-white/60 text-sm">Ответим в Telegram за 15 минут</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="relative mb-3">
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Опишите что нужно — марка, размер, количество..."
                  className="w-full bg-card border-2 border-gold/40 focus:border-gold rounded p-4 text-foreground placeholder:text-muted-foreground outline-none resize-none h-28 transition-colors"
                />
              </div>
              <div className="flex gap-3">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Ваш телефон"
                  className="flex-1 bg-card border-2 border-gold/40 focus:border-gold rounded px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none transition-colors text-sm"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-gold hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-6 py-3 rounded transition-all"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  {loading ? "" : "Отправить"}
                </button>
              </div>
              {err && <p className="text-red-400 text-sm mt-2">{err}</p>}
            </form>
          )}

          <p className="text-white/50 text-sm mt-4">
            Отвечаем в Telegram за 15 минут
          </p>
        </div>
      </div>
    </section>
  );
}
