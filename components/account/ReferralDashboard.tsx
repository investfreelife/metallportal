"use client";

import { useMemo, useState } from "react";
import {
  Copy,
  Check,
  Wallet,
  Hourglass,
  Users,
  BadgePercent,
  Link2,
  Image as ImageIcon,
  QrCode,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ReferralUser {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone?: string | null;
  email?: string | null;
  total_orders: number | null;
  total_amount: number | null;
  created_at: string;
}

interface ReferralStats {
  total_earned: number;
  pending: number;
  paid_out: number;
  by_level: Record<1 | 2 | 3, { count: number; amount: number }>;
}

interface ReferralTree {
  level1: ReferralUser[];
  level2: ReferralUser[];
  level3: ReferralUser[];
}

interface SiteUser {
  id: string;
  email: string | null;
  ref_code: string | null;
  referral_card: boolean | null;
}

interface Props {
  user: SiteUser;
  stats: ReferralStats;
  tree: ReferralTree;
}

const SITE_BASE = "https://www.harlansteel.ru";

export default function ReferralDashboard({ user, stats, tree }: Props) {
  const refLink = `${SITE_BASE}/?ref=${user.ref_code ?? ""}`;
  const [copied, setCopied] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<1 | 2 | 3>(1);
  const [toolsOpen, setToolsOpen] = useState(false);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const fmtRub = (n: number) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n));

  const totalReferrals = tree.level1.length + tree.level2.length + tree.level3.length;

  const currentList = activeLevel === 1 ? tree.level1 : activeLevel === 2 ? tree.level2 : tree.level3;

  return (
    <div className="space-y-4">
      {/* Карта постоянного клиента baner */}
      {user.referral_card && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <BadgePercent size={28} className="text-emerald-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-emerald-500">Карта постоянного клиента активирована</p>
            <p className="text-sm text-foreground">−1% скидка на все ваши заказы, навсегда</p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Wallet size={16} />}
          label="Заработано"
          value={fmtRub(stats.total_earned) + " ₽"}
          accent="text-emerald-500"
        />
        <StatCard
          icon={<Hourglass size={16} />}
          label="В ожидании"
          value={fmtRub(stats.pending) + " ₽"}
          hint="30 дней до выплаты"
        />
        <StatCard
          icon={<Wallet size={16} className="opacity-50" />}
          label="Выплачено"
          value={fmtRub(stats.paid_out) + " ₽"}
        />
        <StatCard
          icon={<Users size={16} />}
          label="Всего рефералов"
          value={String(totalReferrals)}
          hint={`L1: ${tree.level1.length} · L2: ${tree.level2.length} · L3: ${tree.level3.length}`}
        />
      </div>

      {/* 3 level cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { level: 1 as const, rate: "0.5%", desc: "Прямые рефералы", count: tree.level1.length, amount: stats.by_level[1].amount },
          { level: 2 as const, rate: "0.25%", desc: "Рефералы рефералов", count: tree.level2.length, amount: stats.by_level[2].amount },
          { level: 3 as const, rate: "0.25%", desc: "Третий уровень", count: tree.level3.length, amount: stats.by_level[3].amount },
        ].map((lvl) => (
          <div key={lvl.level} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Уровень {lvl.level}</span>
              <span className="text-lg font-bold text-gold">{lvl.rate}</span>
            </div>
            <p className="text-sm text-foreground mb-2">{lvl.desc}</p>
            <div className="flex justify-between items-end text-xs">
              <span className="text-muted-foreground">{lvl.count} {lvl.count === 1 ? "человек" : "людей"}</span>
              <span className="font-medium text-foreground">{fmtRub(lvl.amount)} ₽</span>
            </div>
          </div>
        ))}
      </div>

      {/* Ссылка + Telegram/WhatsApp */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-medium text-foreground mb-2">Ваша реферальная ссылка</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs font-mono text-muted-foreground truncate">
            {refLink}
          </div>
          <button
            onClick={() => copy(refLink, "link")}
            className="flex items-center gap-1.5 bg-gold text-black text-xs font-medium px-3 py-2 rounded-lg hover:bg-yellow-400 transition-all"
          >
            {copied === "link" ? <><Check size={12} /> Скопировано</> : <><Copy size={12} /> Копировать</>}
          </button>
        </div>
        <div className="flex gap-2 mt-2">
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Заказывай металлопрокат на Харланметалл — получишь 1% скидку на все заказы")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-xs border border-border rounded-lg py-2 hover:bg-muted transition-colors"
          >
            📱 Telegram
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Заказывай металлопрокат на Харланметалл — получишь 1% скидку: ${refLink}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-xs border border-border rounded-lg py-2 hover:bg-muted transition-colors"
          >
            💬 WhatsApp
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent("Скидка 1% на металлопрокат")}&body=${encodeURIComponent(`Привет! Заказывай металлопрокат на Харланметалл — получишь карту постоянного клиента с 1% скидкой на все заказы: ${refLink}`)}`}
            className="flex-1 text-center text-xs border border-border rounded-lg py-2 hover:bg-muted transition-colors"
          >
            ✉️ Email
          </a>
        </div>
      </div>

      {/* Tools (collapsible) */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setToolsOpen((o) => !o)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            🛠 Инструменты заработка
          </span>
          {toolsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {toolsOpen && (
          <div className="border-t border-border p-4 space-y-4">
            <ToolUtmGenerator refCode={user.ref_code ?? ""} baseUrl={SITE_BASE} />
            <ToolReadyTexts refLink={refLink} copy={copy} copied={copied} />
            <ToolBanners refLink={refLink} copy={copy} copied={copied} />
            <ToolQrCode refLink={refLink} />
          </div>
        )}
      </div>

      {/* Tree list with level tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-1">
          {[1, 2, 3].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setActiveLevel(lvl as 1 | 2 | 3)}
              className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                activeLevel === lvl
                  ? "bg-gold/15 text-gold font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Уровень {lvl} ({lvl === 1 ? tree.level1.length : lvl === 2 ? tree.level2.length : tree.level3.length})
            </button>
          ))}
        </div>
        {currentList.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {activeLevel === 1
              ? "Поделитесь ссылкой — приглашённые сюда попадут"
              : activeLevel === 2
                ? "Когда ваши L1-рефералы пригласят кого-то — они появятся здесь"
                : "Третий уровень — когда сеть подрастёт"}
          </div>
        ) : (
          currentList.map((r) => (
            <div key={r.id} className="px-4 py-3 border-b border-border last:border-0 flex justify-between items-center">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {r.company_name || r.full_name || r.email || "Без имени"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("ru-RU")}
                </div>
              </div>
              <div className="text-xs text-right">
                <div className="text-muted-foreground">{r.total_orders || 0} заказов</div>
                {r.total_amount ? <div className="text-foreground font-medium">{fmtRub(Number(r.total_amount))} ₽</div> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-xl font-bold ${accent || "text-foreground"}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function ToolUtmGenerator({ refCode, baseUrl }: { refCode: string; baseUrl: string }) {
  const [source, setSource] = useState("telegram");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    p.set("ref", refCode);
    if (source) p.set("utm_source", source);
    if (campaign) p.set("utm_campaign", campaign);
    return `${baseUrl}/?${p.toString()}`;
  }, [refCode, source, campaign, baseUrl]);

  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
        <Link2 size={14} /> UTM-ссылка (для трекинга откуда трафик)
      </p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="bg-background border border-border rounded px-2 py-1.5 text-xs"
        >
          <option value="telegram">Telegram</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="vk">VK</option>
          <option value="email">Email</option>
          <option value="website">Сайт</option>
          <option value="other">Другое</option>
        </select>
        <input
          type="text"
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          placeholder="Кампания (опц.)"
          className="bg-background border border-border rounded px-2 py-1.5 text-xs"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1 bg-muted rounded px-2 py-1.5 text-[11px] font-mono text-muted-foreground truncate">
          {url}
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="bg-gold text-black text-xs font-medium px-3 py-1.5 rounded hover:bg-yellow-400"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
}

function ToolReadyTexts({
  refLink,
  copy,
  copied,
}: {
  refLink: string;
  copy: (s: string, k: string) => void;
  copied: string | null;
}) {
  const texts = [
    {
      key: "short",
      label: "Короткий (Telegram, WhatsApp)",
      text: `Заказывай металлопрокат на Харланметалл — получишь карту постоянного клиента с 1% скидкой на все заказы навсегда: ${refLink}`,
    },
    {
      key: "medium",
      label: "Средний (соцсети)",
      text: `🔧 Металлопрокат для стройки и производства\n\nЗаказывай напрямую у производителя на Харланметалл — получишь:\n• Карту постоянного клиента (−1% на каждый заказ навсегда)\n• Прозрачные цены без посредников\n• Доставку по всей России\n\n${refLink}`,
    },
    {
      key: "email",
      label: "Письмо (email рассылка)",
      text: `Добрый день!\n\nХочу порекомендовать Харланметалл — поставщика металлопроката для производства и стройки.\n\nЧто получаете при регистрации по моей ссылке:\n• Карта постоянного клиента — 1% скидка на все заказы навсегда\n• Прямой доступ к производителю\n• Доставка по России\n\nПерейти: ${refLink}\n\nС уважением.`,
    },
  ];
  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
        <MessageSquare size={14} /> Готовые тексты
      </p>
      <div className="space-y-2">
        {texts.map((t) => (
          <div key={t.key} className="border border-border rounded p-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">{t.label}</span>
              <button
                onClick={() => copy(t.text, `text-${t.key}`)}
                className="text-[11px] text-gold hover:underline"
              >
                {copied === `text-${t.key}` ? "Скопировано" : "Копировать"}
              </button>
            </div>
            <pre className="text-[11px] text-foreground whitespace-pre-wrap font-sans">{t.text}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolBanners({
  refLink,
  copy,
  copied,
}: {
  refLink: string;
  copy: (s: string, k: string) => void;
  copied: string | null;
}) {
  const banners = [
    {
      key: "300x250",
      label: "Прямоугольник 300×250 (для сайтов, блогов)",
      html: `<a href="${refLink}" target="_blank"><img src="https://www.harlansteel.ru/banners/300x250.png" alt="Харланметалл — металлопрокат с 1% скидкой" width="300" height="250" style="border:0"/></a>`,
    },
    {
      key: "728x90",
      label: "Лидерборд 728×90 (шапка сайта)",
      html: `<a href="${refLink}" target="_blank"><img src="https://www.harlansteel.ru/banners/728x90.png" alt="Харланметалл — металлопрокат с 1% скидкой" width="728" height="90" style="border:0"/></a>`,
    },
    {
      key: "160x600",
      label: "Вертикальный 160×600 (боковая колонка)",
      html: `<a href="${refLink}" target="_blank"><img src="https://www.harlansteel.ru/banners/160x600.png" alt="Харланметалл — металлопрокат с 1% скидкой" width="160" height="600" style="border:0"/></a>`,
    },
  ];
  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
        <ImageIcon size={14} /> Баннеры (HTML код для встраивания)
      </p>
      <div className="space-y-2">
        {banners.map((b) => (
          <div key={b.key} className="border border-border rounded p-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">{b.label}</span>
              <button
                onClick={() => copy(b.html, `banner-${b.key}`)}
                className="text-[11px] text-gold hover:underline"
              >
                {copied === `banner-${b.key}` ? "Скопировано" : "Скопировать HTML"}
              </button>
            </div>
            <code className="text-[10px] text-muted-foreground break-all block">{b.html}</code>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Картинки баннеров появятся позже — пока ссылка работает как текстовая.
      </p>
    </div>
  );
}

function ToolQrCode({ refLink }: { refLink: string }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(refLink)}`;
  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
        <QrCode size={14} /> QR-код реферальной ссылки
      </p>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrUrl} alt="QR код" width={128} height={128} className="border border-border rounded" />
        <div className="flex-1 space-y-1 text-xs text-muted-foreground">
          <p>Распечатайте и разместите на визитке, флаере, в офисе.</p>
          <p>Скан → переход на сайт со скидкой 1%.</p>
          <a
            href={qrUrl}
            download="harlanmetall-ref-qr.png"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-1 text-gold hover:underline"
          >
            Скачать PNG 256×256 →
          </a>
        </div>
      </div>
    </div>
  );
}
