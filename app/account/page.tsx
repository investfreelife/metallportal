"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { User, LogOut, Package, ChevronRight, Phone, Mail, ShoppingBag } from "lucide-react";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ContactUser = { id: string; full_name: string | null; phone: string | null; email: string | null; telegram_chat_id: string | null; created_at: string }
type Order = { id: string; status: string; items: string; created_at: string; customer_name: string | null }
type Deal = { id: string; title: string; amount: number | null; stage: string; created_at: string }

const STAGE_LABELS: Record<string, string> = { new: 'Новая', qualified: 'Квалификация', proposal: 'КП отправлено', negotiation: 'Переговоры', won: 'Выиграна', lost: 'Проиграна' }
const STATUS_LABELS: Record<string, string> = { new: 'Новый', processing: 'В обработке', confirmed: 'Подтверждён', shipped: 'Отгружен', done: 'Завершён', cancelled: 'Отменён' }

export default function AccountPage() {
  const [contactUser, setContactUser] = useState<ContactUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Check phone/OTP session first (cookie-based)
      const meRes = await fetch("/api/account/me");
      const meData = await meRes.json();
      if (meData.user) {
        setContactUser(meData.user);
        setOrders(meData.orders ?? []);
        setDeals(meData.deals ?? []);
        // Also save to localStorage for auto-fill
        try {
          localStorage.setItem("mp_contact", JSON.stringify({
            name: meData.user.full_name, phone: meData.user.phone, email: meData.user.email
          }));
        } catch {}
        setLoading(false);
        return;
      }
      // Fallback: Supabase auth
      const { data } = await supabase.auth.getSession();
      if (!data.session) { window.location.href = "/account/login"; return; }
      // Use Supabase email as identifier
      setContactUser({ id: data.session.user.id, full_name: data.session.user.email ?? null, phone: null, email: data.session.user.email ?? null, telegram_chat_id: null, created_at: data.session.user.created_at });
      setLoading(false);
    }
    load();
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/account/logout", { method: "POST" });
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Загрузка...</div>
      </div>
    );
  }

  const displayName = contactUser?.full_name || contactUser?.phone || contactUser?.email || "Клиент";
  const joinedAt = contactUser?.created_at ? new Date(contactUser.created_at).toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container-main h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gold rounded" />
            <span className="font-bold text-foreground">МЕТАЛЛПОРТАЛ</span>
          </Link>
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <LogOut size={14} /> Выйти
          </button>
        </div>
      </div>

      <div className="container-main py-10 max-w-2xl mx-auto space-y-5">
        {/* Profile header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
            <User size={22} className="text-gold" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
            <p className="text-sm text-muted-foreground">Личный кабинет</p>
          </div>
        </div>

        {/* Profile card */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2"><User size={15} className="text-gold" /> Профиль</h2>
          {contactUser?.phone && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5"><Phone size={13} /> Телефон</span>
              <span className="text-foreground font-medium">{contactUser.phone}</span>
            </div>
          )}
          {contactUser?.email && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5"><Mail size={13} /> Email</span>
              <span className="text-foreground">{contactUser.email}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Telegram</span>
            {contactUser?.telegram_chat_id ? (
              <span className="text-green-400 text-xs">✓ Подключён</span>
            ) : (
              <a href="https://t.me/metallportal_bot" target="_blank" className="text-[#229ED9] text-xs hover:underline">Подключить →</a>
            )}
          </div>
          {joinedAt && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Клиент с</span>
              <span className="text-foreground">{joinedAt}</span>
            </div>
          )}
        </div>

        {/* Orders */}
        {orders.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-4">
              <ShoppingBag size={15} className="text-gold" /> Мои заказы
            </h2>
            <div className="space-y-3">
              {orders.map(order => {
                let itemCount = 0
                try { const parsed = JSON.parse(order.items ?? "[]"); itemCount = Array.isArray(parsed) ? parsed.length : 0 } catch {}
                return (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm text-foreground">Заказ от {new Date(order.created_at).toLocaleDateString("ru-RU")}</p>
                      <p className="text-xs text-muted-foreground">{itemCount > 0 ? `${itemCount} позиций` : "Запрос"}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      order.status === "done" ? "bg-green-500/20 text-green-400" :
                      order.status === "cancelled" ? "bg-red-500/20 text-red-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Deals */}
        {deals.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-4">
              <Package size={15} className="text-gold" /> Сделки
            </h2>
            <div className="space-y-2">
              {deals.map(deal => (
                <div key={deal.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm text-foreground">{deal.title}</p>
                    {deal.amount && <p className="text-xs text-green-400">{deal.amount.toLocaleString("ru")} ₽</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{STAGE_LABELS[deal.stage] ?? deal.stage}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Catalog link */}
        <Link href="/catalog" className="flex items-center gap-3 bg-card border border-border rounded-xl p-5 hover:border-gold transition-colors group">
          <Package size={20} className="text-gold" />
          <div className="flex-1">
            <p className="font-medium text-foreground">Каталог металлопроката</p>
            <p className="text-xs text-muted-foreground mt-0.5">Арматура, трубы, листы и профиль</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground group-hover:text-gold transition-colors" />
        </Link>

        <button onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
          <LogOut size={15} /> Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
