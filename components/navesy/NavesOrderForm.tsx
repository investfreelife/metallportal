"use client";

import { useState } from "react";
import { Phone, Send } from "lucide-react";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/contact";

/**
 * NavesOrderForm — lead form для navesy product detail page.
 * POST к /api/leads (или existing endpoint, TBD совместно с Pavel когда CRM готов).
 * Сейчас mailto fallback.
 */

interface NavesOrderFormProps {
  productId: string;
  productName: string;
}

export default function NavesOrderForm({ productId, productName }: NavesOrderFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "navesy_product_detail",
          productId,
          productName,
          name: name.trim(),
          phone: phone.trim(),
          comment: comment.trim(),
        }),
      });
      if (!res.ok) throw new Error("submit failed");
      setSubmitted(true);
    } catch {
      // Fallback: открыть mailto
      const subject = encodeURIComponent(`Заказ навеса: ${productName}`);
      const body = encodeURIComponent(
        `Имя: ${name}\nТелефон: ${phone}\nКомментарий: ${comment}\n\nProduct: ${productName}`,
      );
      window.location.href = `mailto:7909885@mail.ru?subject=${subject}&body=${body}`;
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section id="order-form" className="bg-card border border-gold/40 rounded-lg p-6 text-center space-y-3">
        <div className="text-4xl">✓</div>
        <h3 className="text-xl font-bold text-foreground">Заявка принята</h3>
        <p className="text-muted-foreground">
          Менеджер свяжется в течение 30 минут (рабочее время 9:00-19:00 МСК).
        </p>
        <a
          href={`tel:${CONTACT_PHONE_TEL}`}
          className="inline-flex items-center gap-2 text-gold hover:underline font-semibold"
        >
          <Phone size={16} />
          {CONTACT_PHONE_DISPLAY}
        </a>
      </section>
    );
  }

  return (
    <section id="order-form" className="bg-card border border-border rounded-lg p-6 space-y-5">
      <div className="space-y-1">
        <h3 className="text-2xl font-bold text-foreground">Заказать навес</h3>
        <p className="text-sm text-muted-foreground">
          Бесплатный замер и расчёт. Менеджер свяжется в течение 30 минут.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">Имя *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="bg-background border border-border rounded-lg px-3 py-2 focus:border-gold/60 focus:outline-none"
            placeholder="Иван"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">Телефон *</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="bg-background border border-border rounded-lg px-3 py-2 focus:border-gold/60 focus:outline-none"
            placeholder="+7 ___ ___ __ __"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">Комментарий (опционально)</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="bg-background border border-border rounded-lg px-3 py-2 focus:border-gold/60 focus:outline-none resize-none"
            placeholder="Адрес объекта, удобное время для звонка, особые требования..."
          />
        </label>

        <button
          type="submit"
          disabled={submitting || !name.trim() || !phone.trim()}
          className="w-full inline-flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 disabled:bg-muted disabled:text-muted-foreground text-black font-bold px-6 py-3.5 rounded-lg transition-all"
        >
          <Send size={16} />
          {submitting ? "Отправка..." : "Отправить заявку"}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          Нажимая кнопку, вы соглашаетесь с{" "}
          <a href="/privacy" className="underline hover:text-gold">
            политикой обработки данных
          </a>
          .
        </p>
      </form>
    </section>
  );
}
