"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { User, LogOut, Package, ChevronRight, Phone, Mail, ShoppingBag, Share2, Copy, Check } from "lucide-react";
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
  const [tab, setTab] = useState<'main' | 'referral'>('main');
  const [siteUser, setSiteUser] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

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
        // Also load site_users referral data
        try {
          const r2 = await fetch('/api/auth/me');
          const d2 = await r2.json();
          if (d2.user) { setSiteUser(d2.user); setReferrals(d2.referrals || []); }
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

  const copyRefLink = () => {
    if (!siteUser?.ref_code) return;
    navigator.clipboard.writeText(`https://harlansteel.ru/?ref=${siteUser.ref_code}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleSignOut = async () => {
    await fetch("/api/account/logout", { method: "POST" });
    await fetch("/api/auth/logout", { method: "POST" });
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

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button onClick={() => setTab('main')}
            className={`px-4 py-2.5 text-sm border-b-2 transition-all ${tab==='main' ? 'text-gold border-gold font-medium' : 'text-muted-foreground border-transparent'}`}>
            Профиль и заказы
          </button>
          <button onClick={() => setTab('referral')}
            className={`px-4 py-2.5 text-sm border-b-2 transition-all flex items-center gap-1.5 ${tab==='referral' ? 'text-gold border-gold font-medium' : 'text-muted-foreground border-transparent'}`}>
            <Share2 size={13} /> Реферальная программа
          </button>
        </div>

        {/* Referral tab */}
        {tab === 'referral' && (
          <div className="space-y-4">
            {!siteUser ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <p className="text-muted-foreground text-sm mb-3">Для участия в реферальной программе нужна регистрация по email</p>
                <Link href="/partner/join" className="bg-gold text-black px-5 py-2 rounded-xl text-sm font-semibold hover:bg-yellow-400 transition-all">
                  Узнать подробнее →
                </Link>
              </div>
            ) : (
              <>
                {/* Уровень */}
                <div className={`rounded-xl p-4 ${
                  referrals.length >= 20 ? 'bg-yellow-500/10 border border-yellow-400/30' :
                  referrals.length >= 5  ? 'bg-muted/60 border border-border' :
                  'bg-orange-500/10 border border-orange-400/30'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{referrals.length >= 20 ? '🥇' : referrals.length >= 5 ? '🥈' : '🥉'}</span>
                    <div>
                      <div className="font-bold text-foreground">
                        {referrals.length >= 20 ? 'Золото — 5%' : referrals.length >= 5 ? 'Серебро — 3.5%' : 'Бронза — 2%'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {referrals.length < 5 ? `ещё ${5 - referrals.length} до Серебра` :
                         referrals.length < 20 ? `ещё ${20 - referrals.length} до Золота` : 'Максимальный уровень!'}
                      </div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-xs text-muted-foreground">Рефералов</div>
                      <div className="text-2xl font-bold text-foreground">{referrals.length}</div>
                    </div>
                  </div>
                </div>

                {/* Ссылка */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="text-sm font-medium text-foreground mb-2">Ваша реферальная ссылка</div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-muted rounded-xl px-3 py-2 text-xs font-mono text-muted-foreground truncate">
                      harlansteel.ru/?ref={siteUser.ref_code}
                    </div>
                    <button onClick={copyRefLink}
                      className="flex items-center gap-1.5 bg-gold text-black text-xs font-medium px-3 py-2 rounded-xl hover:bg-yellow-400 transition-all">
                      {copied ? <><Check size={12} /> Скопировано</> : <><Copy size={12} /> Копировать</>}
                    </button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <a href={`https://t.me/share/url?url=https://harlansteel.ru/?ref=${siteUser.ref_code}`} target="_blank"
                      className="flex-1 text-center text-xs border border-border rounded-xl py-2 hover:bg-muted transition-colors">
                      📱 Telegram
                    </a>
                    <a href={`https://wa.me/?text=https://harlansteel.ru/?ref=${siteUser.ref_code}`} target="_blank"
                      className="flex-1 text-center text-xs border border-border rounded-xl py-2 hover:bg-muted transition-colors">
                      💬 WhatsApp
                    </a>
                  </div>
                </div>

                {/* Рефералы */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border text-sm font-medium text-foreground">
                    Мои рефералы ({referrals.length})
                  </div>
                  {referrals.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Поделитесь ссылкой — вы получаете % с заказов приглашённых клиентов
                    </div>
                  ) : referrals.map((r: any) => (
                    <div key={r.id} className="px-4 py-3 border-b border-border last:border-0 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium text-foreground">{r.company_name || r.full_name}</div>
                        <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('ru-RU')}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{r.total_orders} заказов</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'main' && <>
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
        </>}
      </div>
    </div>
  );
}
