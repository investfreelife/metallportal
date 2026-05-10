"use client";

import { useState } from "react";
import { X, Loader2, CheckCircle2, AlertCircle, PhoneCall } from "lucide-react";

/**
 * Lead modal для «Получить цену» CTA на product page.
 * POSTs к /api/contact с product context.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  productName: string;
  productSlug?: string;
  productId?: string;
}

export default function RequestPriceModal({ open, onClose, productName, productSlug, productId }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; tg_link?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() && !phone.trim()) {
      setError("Укажите имя или телефон");
      return;
    }
    if (phone.trim() && phone.replace(/\D/g, "").length < 10) {
      setError("Телефон должен содержать минимум 10 цифр");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          phone: phone.trim() || null,
          comment: comment.trim() || null,
          product: productName,
          type: "request_price",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка отправки");
      setDone({ ok: true, tg_link: json.tg_link });
    } catch (e: any) {
      setError(e?.message ?? "Не удалось отправить");
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setName("");
    setPhone("");
    setComment("");
    setDone(null);
    setError(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={close}
    >
      <div
        className="bg-card border border-border rounded-lg p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Запрос цены</h2>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{productName}</p>
          </div>
          <button
            onClick={close}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        {done?.ok ? (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-4 flex gap-3">
              <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-500 mb-1">Заявка принята</p>
                <p className="text-sm text-foreground">
                  Менеджер перезвонит в течение 15 минут в рабочее время.
                </p>
              </div>
            </div>

            {done.tg_link && (
              <a
                href={done.tg_link}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center px-4 py-2.5 rounded bg-[#26a5e4] hover:bg-[#1d8fcd] text-white font-medium transition-colors"
              >
                Открыть чат в Telegram
              </a>
            )}

            <button
              onClick={close}
              className="w-full px-4 py-2 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-500 rounded p-2 flex gap-2 text-sm">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Имя</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иван"
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-gold"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Телефон</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (999) 123-45-67"
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Комментарий <span className="text-xs text-muted-foreground">(необязательно)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Количество, сроки, дополнительные пожелания"
                rows={3}
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-gold resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold py-2.5 rounded transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <PhoneCall size={16} />}
              {submitting ? "Отправка..." : "Получить цену"}
            </button>

            <p className="text-[11px] text-muted-foreground text-center">
              Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
