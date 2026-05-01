"use client";
import { useState, useEffect } from "react";
import { Save, RefreshCw } from "lucide-react";

const FIELDS = [
  { section: "Контакты", fields: [
    { key: "site_name", label: "Название сайта" },
    { key: "phone", label: "Телефон" },
    { key: "email", label: "Email" },
    { key: "telegram", label: "Telegram" },
    { key: "address", label: "Адрес" },
  ]},
  { section: "SEO", fields: [
    { key: "seo_title_template", label: "Шаблон title (используй %s для названия)" },
    { key: "seo_description", label: "Глобальное описание" },
  ]},
  { section: "Внешний вид", fields: [
    { key: "accent_color", label: "Цвет акцента (HEX)" },
    { key: "logo_url", label: "URL логотипа" },
  ]},
];

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/site-settings", { cache: "no-store" });
      if (!res.ok) return;
      const data: Array<{ key: string; value: unknown }> = await res.json();
      setSettings(Object.fromEntries(data.map(r => [r.key, String(r.value ?? "")])));
    })();
  }, []);

  const set = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }));

  const save = async () => {
    setSaving(true);
    const entries = Object.entries(settings).map(([key, value]) => ({ key, value }));
    await fetch("/api/admin/site-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Настройки сайта</h1>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#E8B86D] hover:bg-yellow-400 text-black font-bold text-sm disabled:opacity-60">
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? "Сохранено ✓" : "Сохранить"}
        </button>
      </div>

      <div className="space-y-8">
        {FIELDS.map(({ section, fields }) => (
          <section key={section} className="bg-[#16213e] rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">{section}</h2>
            <div className="space-y-4">
              {fields.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs uppercase tracking-wider text-white/40 mb-1.5">{label}</label>
                  <input value={settings[key] ?? ""} onChange={e => set(key, e.target.value)}
                    className="w-full bg-[#0d0d1a] border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#E8B86D]" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
