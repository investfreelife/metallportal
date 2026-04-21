"use client";

import { Send, Check, Loader2 } from "lucide-react";
import { useState } from "react";

export default function CTASection() {
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [tgLink, setTgLink] = useState("");
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() && !phone.trim()) { setErr("Опишите запрос или укажите телефон"); return; }
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone || null, message, type: "quote" }),
      });
      const data = await res.json();
      if (data.tg_link) setTgLink(data.tg_link);
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
              <p className="text-white/60 text-sm">Менеджер ответит в течение 15 минут</p>
              {tgLink && (
                <a
                  href={tgLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-[#229ED9] hover:bg-[#1a8bbf] text-white font-semibold px-5 py-3 rounded-xl transition-all text-sm"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.05 13.845l-2.97-.924c-.645-.204-.658-.645.136-.953l11.57-4.461c.537-.194 1.006.131.776.741z"/></svg>
                  Получать ответы в Telegram
                </a>
              )}
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
              {phone.replace(/\D/g, '').length >= 10 && (
                <a
                  href={`https://t.me/metallportal_bot?start=client_${phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#229ED9]/10 hover:bg-[#229ED9]/20 border border-[#229ED9]/30 text-[#229ED9] font-medium px-4 py-2.5 rounded transition-all text-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.05 13.845l-2.97-.924c-.645-.204-.658-.645.136-.953l11.57-4.461c.537-.194 1.006.131.776.741z"/></svg>
                  Подключить Telegram — получать ответы быстрее
                </a>
              )}
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
