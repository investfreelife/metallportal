"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Save, RefreshCw, Eye } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DEFAULTS: Record<string, string> = {
  hero_title: "Металлопрокат и Металлоконструкции",
  hero_subtitle: "Прямые поставки от производителей",
  trust_bar_1: "1500+ позиций",
  trust_bar_2: "50+ поставщиков",
  trust_bar_3: "Доставка за 3 дня",
  trust_bar_4: "Документы: УПД, счёт-фактура",
  hero_card_1_title: "Металлопрокат",
  hero_card_1_sub: "Трубы · Арматура · Лист · Балки · Уголок",
  hero_card_2_title: "Готовые конструкции",
  hero_card_2_sub: "Ангары · Склады · Навесы · Каркасы зданий",
  hero_card_3_title: "Заборы и ограждения",
  hero_card_3_sub: "Профнастил · Сетка · Ворота · Калитки",
  hero_card_4_title: "Быстровозводимые здания",
  hero_card_4_sub: "Модульные · Склады · Ангары · Павильоны",
};

export default function HomepageEditor() {
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("key, value");
      if (data?.length) {
        const map: Record<string, string> = {};
        data.forEach((r: any) => { map[r.key] = r.value; });
        setSettings(prev => ({ ...prev, ...map }));
      }
    })();
  }, []);

  const set = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }));

  const save = async () => {
    setSaving(true);
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() });
    }
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const generateImage = async (key: string, prompt: string) => {
    setGenLoading(key);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, productName: prompt, category: "hero" }),
      });
      const data = await res.json();
      if (data.imageUrl) set(`${key}_image`, data.imageUrl);
    } catch { }
    setGenLoading(null);
  };

  const Field = ({ label, k, multiline = false }: { label: string; k: string; multiline?: boolean }) => (
    <div>
      <label className="block text-xs uppercase tracking-wider text-white/40 mb-1.5">{label}</label>
      {multiline ? (
        <textarea value={settings[k] ?? ""} onChange={e => set(k, e.target.value)} rows={2}
          className="w-full bg-[#0d0d1a] border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D] resize-none" />
      ) : (
        <input value={settings[k] ?? ""} onChange={e => set(k, e.target.value)}
          className="w-full bg-[#0d0d1a] border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]" />
      )}
    </div>
  );

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Редактор главной страницы</h1>
          <p className="text-white/40 text-sm">Изменения сохраняются в базу данных</p>
        </div>
        <div className="flex gap-3">
          <a href="/" target="_blank"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 text-white/60 hover:text-white text-sm transition-all">
            <Eye size={14} /> Просмотр
          </a>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#E8B86D] hover:bg-yellow-400 text-black font-bold text-sm transition-all disabled:opacity-60">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? "Сохранено ✓" : "Сохранить"}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Hero section */}
        <section className="bg-[#16213e] rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Hero секция</h2>
          <div className="space-y-4">
            <Field label="Заголовок H1" k="hero_title" />
            <Field label="Подзаголовок" k="hero_subtitle" />
          </div>
        </section>

        {/* Trust bar */}
        <section className="bg-[#16213e] rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Строка доверия (4 блока)</h2>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Field key={i} label={`Блок ${i}`} k={`trust_bar_${i}`} />
            ))}
          </div>
        </section>

        {/* Category cards */}
        <section className="bg-[#16213e] rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">4 карточки категорий</h2>
          <div className="space-y-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="p-4 bg-[#0d0d1a] rounded-lg border border-white/10">
                <div className="font-medium text-white/60 text-sm mb-3">Карточка {i}</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Заголовок" k={`hero_card_${i}_title`} />
                  <Field label="Подзаголовок" k={`hero_card_${i}_sub`} />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {settings[`hero_card_${i}_image`] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings[`hero_card_${i}_image`]} alt="" className="h-16 w-24 object-cover rounded" />
                  )}
                  <button
                    onClick={() => generateImage(`hero_card_${i}`, settings[`hero_card_${i}_title`])}
                    disabled={genLoading === `hero_card_${i}`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E8B86D]/40 text-[#E8B86D] text-xs hover:bg-[#E8B86D]/10 transition-all disabled:opacity-50"
                  >
                    {genLoading === `hero_card_${i}` ? <RefreshCw size={12} className="animate-spin" /> : "✨"}
                    {genLoading === `hero_card_${i}` ? "Генерация..." : "Генерировать фото AI"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
