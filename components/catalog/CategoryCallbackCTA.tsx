"use client";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

export default function CategoryCallbackCTA() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !phone) return;
    setLoading(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, type: "callback" }),
      });
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
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-6 py-3 rounded-xl transition-all whitespace-nowrap text-sm"
            >
              {loading ? "Отправка..." : <>Получить КП <ArrowRight size={15} /></>}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
