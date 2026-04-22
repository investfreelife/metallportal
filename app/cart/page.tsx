"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, Package, Check, ExternalLink } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

export default function CartPage() {
  const { items, count, removeItem, updateQty, clearCart } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [tgLink, setTgLink] = useState("");

  // Auto-fill from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mp_contact') ?? '{}')
      if (saved.name) setName(saved.name)
      if (saved.phone) setPhone(saved.phone)
      if (saved.email) setEmail(saved.email)
    } catch {}
  }, []);

  const itemTotal = (i: typeof items[0]) =>
    i.tons ? (i.price ?? 0) * i.tons * i.quantity : (i.price ?? 0) * i.quantity;
  const total = items.reduce((s, i) => s + itemTotal(i), 0);
  const hasPrice = items.some(i => i.price !== null);

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) { setErr("Введите имя"); return; }
    if (!phone.trim()) { setErr("Введите телефон"); return; }
    if (!consent) { setErr("Подтвердите согласие на обработку данных"); return; }
    setSubmitting(true);

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, phone, email, comment,
        items: items.map(i => ({
            id: i.id,
            name: i.name,
            qty: i.tons ? parseFloat((i.tons * i.quantity).toFixed(4)) : i.quantity,
            unit: i.unit,
            price: i.price,
            ...(i.meters ? { meters: Math.round(i.meters * i.quantity) } : {}),
            total: Math.round(itemTotal(i)),
          })),
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) { setErr(json.error || "Ошибка отправки"); return; }
    // Fire CRM tracking event
    if (typeof window !== "undefined" && (window as Window & { mpTrack?: (t: string, d: object) => void }).mpTrack) {
      (window as Window & { mpTrack?: (t: string, d: object) => void }).mpTrack!("form_submit", {
        contact_name: name, contact_phone: phone, contact_email: email, cart_value: total,
      });
    }
    clearCart();
    // Save contact for auto-fill next time
    try { localStorage.setItem('mp_contact', JSON.stringify({ name, phone, email })) } catch {}
    setDone(true);
  };

  if (done) {
    return (
      <div className="container-main py-20 flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check size={32} className="text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Заказ отправлен!</h1>
        <p className="text-muted-foreground max-w-md">
          Мы получили вашу заявку и свяжемся с вами в ближайшее время для уточнения деталей.
        </p>
        <a href="https://t.me/metallportal_bot" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full max-w-sm bg-[#229ED9]/10 hover:bg-[#229ED9]/20 border border-[#229ED9]/30 text-[#229ED9] font-medium px-4 py-3 rounded-lg transition-all text-sm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.05 13.845l-2.97-.924c-.645-.204-.658-.645.136-.953l11.57-4.461c.537-.194 1.006.131.776.741z"/></svg>
          Ответ придёт в бот — @metallportal_bot
        </a>
        <Link href="/catalog" className="mt-2 px-8 py-3 bg-gold hover:bg-yellow-400 text-black font-bold rounded-lg transition-all">
          Продолжить покупки
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-main py-20 flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <ShoppingCart size={32} className="text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Корзина пуста</h1>
        <p className="text-muted-foreground">Добавьте товары из каталога</p>
        <Link href="/catalog" className="mt-2 px-8 py-3 bg-gold hover:bg-yellow-400 text-black font-bold rounded-lg transition-all flex items-center gap-2">
          Перейти в каталог <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="container-main py-8">
      <div className="flex items-center gap-3 mb-8">
        <ShoppingCart size={24} className="text-gold" />
        <h1 className="text-2xl font-bold text-foreground">Корзина</h1>
        <span className="text-muted-foreground text-sm">({count} позиций)</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Items list */}
        <div className="flex-1 space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex gap-3 items-start">
                {/* Image */}
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center opacity-30"><Package size={24} /></div>}
                </div>

                {/* Info + controls */}
                <div className="flex-1 min-w-0">
                  <Link href={`/catalog`} className="text-sm font-semibold text-foreground hover:text-gold transition-colors line-clamp-2">
                    {item.name}
                  </Link>
                  {item.price !== null
                    ? <p className="text-gold font-bold text-sm mt-0.5">{item.price.toLocaleString("ru-RU")} ₽/{item.unit}</p>
                    : <p className="text-muted-foreground text-xs mt-0.5">Цена по запросу</p>}
                  {item.meters && item.tons && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {Math.round(item.meters * item.quantity).toLocaleString("ru-RU")} м.п. ≈ {(item.tons * item.quantity).toFixed(3)} т
                    </p>
                  )}
                  {!item.meters && item.tons && (
                    <p className="text-xs text-muted-foreground mt-0.5">{(item.tons * item.quantity).toFixed(3)} т</p>
                  )}

                  {/* Qty + total + trash — same row under name */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, item.quantity - 1)}
                        className="w-7 h-7 rounded border border-border flex items-center justify-center hover:border-gold hover:text-gold transition-all">
                        <Minus size={12} />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, item.quantity + 1)}
                        className="w-7 h-7 rounded border border-border flex items-center justify-center hover:border-gold hover:text-gold transition-all">
                        <Plus size={12} />
                      </button>
                      {!item.tons && <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>}
                    </div>
                    {item.price !== null && (
                      <span className="font-bold text-foreground text-sm ml-auto">
                        {Math.round(itemTotal(item)).toLocaleString("ru-RU")} ₽
                      </span>
                    )}
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Total */}
          {hasPrice && (
            <div className="flex justify-between items-center py-3 border-t border-border">
              <span className="text-muted-foreground text-sm">Итого (предварительно):</span>
              <span className="text-xl font-bold text-gold">{total.toLocaleString("ru-RU")} ₽</span>
            </div>
          )}
        </div>

        {/* Order form */}
        <div className="w-full lg:w-[380px] flex-shrink-0">
          <div className="bg-card border border-border rounded-xl p-6 sticky top-[160px]">
            <h2 className="text-lg font-bold text-foreground mb-5">Оформить заказ</h2>

            <form onSubmit={handleOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Имя <span className="text-red-400">*</span>
                </label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Иван Петров"
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Телефон <span className="text-red-400">*</span>
                </label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 000-00-00" type="tel"
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" type="email"
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Комментарий</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Объём, сроки, нарезка..."
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold transition-colors resize-none" />
              </div>

              {/* Consent */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <div onClick={() => setConsent(v => !v)}
                  className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                    consent ? "bg-gold border-gold" : "border-border hover:border-gold"
                  }`}>
                  {consent && <Check size={10} className="text-black" />}
                </div>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Я согласен на обработку{" "}
                  <Link href="/privacy" target="_blank" className="text-gold hover:underline inline-flex items-center gap-0.5">
                    персональных данных <ExternalLink size={10} />
                  </Link>
                </span>
              </label>

              {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}

              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 disabled:opacity-50 text-black font-bold py-3 rounded-lg transition-all">
                {submitting ? "Отправляю..." : "Отправить заказ"}
                {!submitting && <ArrowRight size={16} />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
