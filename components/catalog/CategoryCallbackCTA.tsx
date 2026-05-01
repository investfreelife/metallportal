"use client";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";

export default function CategoryCallbackCTA() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tgLink, setTgLink] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !phone) return;
    if (!turnstileToken) { setError("Подтвердите что вы не робот"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, type: "callback", turnstile_token: turnstileToken }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? `Ошибка ${res.status}`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.tg_link) setTgLink(data.tg_link);
      if (typeof window !== "undefined" && (window as Window & { mpTrack?: (t: string, d: object) => void }).mpTrack) {
        (window as Window & { mpTrack?: (t: string, d: object) => void }).mpTrack!("form_submit", { phone, contact_name: name, contact_phone: phone });
      }
    } catch {}
    setSent(true);
    setLoading(false);
  }

  return (
    <section className="mt-12 rounded-2xl border border-gold/20 bg-gold/5 p-8">
      {sent ? (
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
            <Check size={24} className="text-gold" />
          </div>
          <h3 className="text-xl font-bold text-foreground">{name ? `${name}, заявка принята!` : "Заявка принята!"}</h3>
          <p className="text-muted-foreground text-sm">Менеджер свяжется с вами в течение 15 минут</p>
          {tgLink && (
            <a
              href={tgLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#229ED9] hover:bg-[#1a8bbf] text-white font-semibold px-5 py-2.5 rounded-xl transition-all text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.05 13.845l-2.97-.924c-.645-.204-.658-.645.136-.953l11.57-4.461c.537-.194 1.006.131.776.741z"/></svg>
              Получать ответы в Telegram
            </a>
          )}
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-foreground mb-2">Получите расчёт стоимости за 1 день</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Оставьте заявку — менеджер перезвонит в течение 15 минут, уточнит параметры и подготовит коммерческое предложение. Бесплатно.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 lg:flex-col xl:flex-row w-full lg:w-auto xl:w-auto">
            <input
              type="text"
              placeholder="Ваше имя"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-gold transition-colors w-full sm:w-40 lg:w-full xl:w-40"
            />
            <input
              type="tel"
              placeholder="+7 (___) ___-__-__"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              className="bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-gold transition-colors w-full sm:w-44 lg:w-full xl:w-44"
            />
            <button
              type="submit"
              disabled={loading || !turnstileToken}
              className="flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-6 py-3 rounded-xl transition-all whitespace-nowrap text-sm"
            >
              {loading ? "Отправка..." : <>Получить КП <ArrowRight size={15} /></>}
            </button>
          </form>
        </div>
      )}
      {!sent && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <Turnstile
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
            onSuccess={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}
    </section>
  );
}
