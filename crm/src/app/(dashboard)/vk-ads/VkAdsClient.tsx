'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import {
  Megaphone, Upload, Check, AlertTriangle, RefreshCw, X, Copy,
  Camera, ChevronDown, ChevronUp, Play, Pause, Save, Image as ImageIcon,
} from 'lucide-react';

/* ───────────────────────────────────────────────────────
 *  Типы — синхронизированы с /api/recruit/vk-ads
 * ─────────────────────────────────────────────────────── */
interface VkTexts {
  title_40_vkads: string;
  text_90: string;
  title_30_additional: string;
  about_company_115: string;
  text_long: string;
  cta: string;
}
interface VkImages {
  image_607x1080: string | null;
  image_600x600: string | null;
  image_1080x607: string | null;
  icon_256x256: string | null;
}
interface Ad {
  id: string;
  name: string;
  code: string | null;
  format: 'banner' | 'carousel';
  status: string;
  link: string | null;
  creative_ref: string | null;
  source_banner_ref: string | null;
  vk_texts: VkTexts;
  images: VkImages;
  slides: string[];
  design_brief: string;
  design_sizes: string;
  design_rules: string;
  budget_day: number;
  comment: string | null;
  approved: boolean;
  last_pushed_at: string | null;
  created_at: string;
}
interface Resp {
  ads: Ad[];
  cta_options: Array<{ key: string; label: string }>;
  cta_recommended?: string;     // ТЗ-079: VK-рекомендованный CTA для пакета (обычно 'apply')
  campaign: { objective: string; package: number; default_budget_day: number; target: string };
}

const TEXT_LIMITS: Record<keyof VkTexts, number> = {
  title_40_vkads: 40,
  text_90: 90,
  title_30_additional: 30,
  about_company_115: 115,
  text_long: 0,        // 0 = без лимита
  cta: 50,
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  awaiting_design:  { label: '🎨 Ждём дизайн',     cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  design_uploaded:  { label: '📤 Дизайн загружен', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  approved:         { label: '✅ Согласовано',      cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  ready_to_push:    { label: '🚀 Готово к заливу', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  live:             { label: '🟢 LIVE',             cls: 'bg-green-100 text-green-900 border-green-300' },
  paused:           { label: '⏸ Пауза',             cls: 'bg-gray-100 text-gray-700 border-gray-300' },
  archived:         { label: '🗄 В архиве',         cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

/** Требуемые размеры по слоту — для валидации (точные пропорции). */
const SLOT_SPECS = {
  image_607x1080: { label: '🖼 Портрет 9:16',    w: 1080, h: 1920, minW: 607,  minH: 1080, ratio: 9/16  },
  image_600x600:  { label: '🖼 Квадрат 1:1',     w: 1080, h: 1080, minW: 600,  minH: 600,  ratio: 1     },
  image_1080x607: { label: '🖼 Ландшафт 16:9',   w: 1080, h: 607,  minW: 1080, minH: 607,  ratio: 16/9  },
  icon_256x256:   { label: '🖼 Иконка-лого',     w: 256,  h: 256,  minW: 256,  minH: 256,  ratio: 1     },
} as const;
type SlotKey = keyof typeof SLOT_SPECS;
const SLOT_KEYS: SlotKey[] = ['image_607x1080', 'image_600x600', 'image_1080x607', 'icon_256x256'];

export default function VkAdsClient() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await safeFetchJson<Resp>('/api/recruit/vk-ads');
      setData(r);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function patchAd(id: string, patch: Partial<Ad> | { config: Record<string, unknown> }) {
    const r = await safeFetchJson<{ ad: { config: unknown } }>(`/api/recruit/vk-ads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    // Обновляем локально
    setData((d) => d ? {
      ...d,
      ads: d.ads.map((a) => a.id === id ? mergeAd(a, r.ad.config as Record<string, unknown>) : a),
    } : d);
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Загрузка…</div>;
  if (err)     return <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded mx-6 mt-4">{err}</div>;
  if (!data)   return null;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone size={20} className="text-fuchsia-600" />
            ВК Реклама · кампания #{data.campaign.package}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Objective: <strong>{data.campaign.objective}</strong> · бюджет по умолчанию: <strong>{data.campaign.default_budget_day} ₽/день</strong> · цель: {data.campaign.target}
          </p>
        </div>
        <button onClick={reload} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 text-xs rounded hover:bg-gray-50">
          <RefreshCw size={12} /> Обновить
        </button>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-3">
        {data.ads.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded px-4 py-8 text-center text-sm text-gray-500">
            Объявления ещё не засеяны. Мозг кладёт их в реестр channels (config.kind=&apos;vkads_ad&apos;).
          </div>
        ) : data.ads.map((ad) => (
          <AdCard
            key={ad.id}
            ad={ad}
            ctaOptions={data.cta_options}
            ctaRecommended={data.cta_recommended}
            expanded={expandedId === ad.id}
            onToggle={() => setExpandedId(expandedId === ad.id ? null : ad.id)}
            onPatch={(p) => patchAd(ad.id, { config: p }).catch((e) => alert(String(e)))}
            onReload={reload}
          />
        ))}
      </div>
    </div>
  );
}

function mergeAd(a: Ad, cfg: Record<string, unknown>): Ad {
  const get = <T,>(k: string, d: T): T => (cfg[k] === undefined || cfg[k] === null) ? d : cfg[k] as T;
  return {
    ...a,
    format: (get('format', a.format) as 'banner'|'carousel'),
    status: get('status', a.status),
    link: get('link', a.link),
    vk_texts: { ...a.vk_texts, ...(cfg.vk_texts as Partial<VkTexts> ?? {}) },
    images: { ...a.images, ...(cfg.images as Partial<VkImages> ?? {}) },
    slides: Array.isArray(cfg.slides) ? cfg.slides as string[] : a.slides,
    budget_day: get('budget_day', a.budget_day),
    comment: get('comment', a.comment),
    approved: get('approved', a.approved),
    design_brief: get('design_brief', a.design_brief),
    design_sizes: get('design_sizes', a.design_sizes),
    design_rules: get('design_rules', a.design_rules),
  };
}

/* ─────────────────────────────────────────────────────── AdCard */
function AdCard({
  ad, ctaOptions, ctaRecommended, expanded, onToggle, onPatch, onReload,
}: {
  ad: Ad;
  ctaOptions: Array<{ key: string; label: string }>;
  ctaRecommended?: string;
  expanded: boolean;
  onToggle: () => void;
  onPatch: (cfg: Record<string, unknown>) => void;
  onReload: () => void;
}) {
  const meta = STATUS_META[ad.status] ?? STATUS_META.awaiting_design;
  const slotsFilled = SLOT_KEYS.filter((k) => ad.images[k]).length;
  const hasAllSlots = ad.format === 'banner'
    ? slotsFilled === SLOT_KEYS.length
    : ad.slides.filter(Boolean).length >= 3;

  return (
    <article className="bg-white border border-gray-200 rounded-md overflow-hidden">
      <header
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{ad.name}</span>
            <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{ad.code}</code>
            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${meta.cls}`}>{meta.label}</span>
            <span className="text-[10px] text-gray-500">{ad.format === 'carousel' ? '🎠 Карусель' : '🖼 Баннер'}</span>
            <span className="text-[10px] text-gray-500">💰 {ad.budget_day} ₽/день</span>
            <span className={`text-[10px] ${hasAllSlots ? 'text-emerald-700' : 'text-amber-700'}`}>
              {ad.format === 'banner' ? `${slotsFilled}/${SLOT_KEYS.length} слотов` : `${ad.slides.filter(Boolean).length} слайдов`}
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </header>

      {expanded && (
        <div className="px-4 py-4 border-t border-gray-100 space-y-4">
          <TextSection ad={ad} ctaOptions={ctaOptions} ctaRecommended={ctaRecommended} onPatch={onPatch} />
          <DesignBriefPanel ad={ad} />
          {ad.format === 'banner'
            ? <ImageSlots ad={ad} onUploaded={onReload} />
            : <CarouselSlides ad={ad} onUploaded={onReload} />
          }
          <BudgetAndStatus ad={ad} hasAllSlots={hasAllSlots} onPatch={onPatch} />
        </div>
      )}
    </article>
  );
}

/* ─────────────────────────────────────────────────────── Текст-блоки с лимитами */
function TextSection({ ad, ctaOptions, ctaRecommended, onPatch }: { ad: Ad; ctaOptions: Array<{ key: string; label: string }>; ctaRecommended?: string; onPatch: (cfg: Record<string, unknown>) => void }) {
  const [texts, setTexts] = useState<VkTexts>(ad.vk_texts);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function update<K extends keyof VkTexts>(key: K, v: string) {
    const limit = TEXT_LIMITS[key];
    const next = limit > 0 ? v.slice(0, limit) : v;
    setTexts((t) => ({ ...t, [key]: next }));
  }
  function save() {
    onPatch({ vk_texts: texts });
    setSavedAt(Date.now());
  }
  function flash() { return savedAt && Date.now() - savedAt < 2000 ? 'animate-pulse text-emerald-700' : ''; }

  return (
    <section className="bg-blue-50/40 border border-blue-200 rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-blue-900">📝 Тексты объявления</h3>
        <button onClick={save} className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700 ${flash()}`}>
          <Save size={11} /> Сохранить тексты
        </button>
      </div>
      <TextField label="🎯 Заголовок (40)" name="title_40_vkads" value={texts.title_40_vkads} onChange={(v) => update('title_40_vkads', v)} limit={40} />
      <TextField label="✍️ Текст (90)" name="text_90" value={texts.text_90} onChange={(v) => update('text_90', v)} limit={90} multiline />
      <TextField label="🔠 Доп. заголовок (30)" name="title_30_additional" value={texts.title_30_additional} onChange={(v) => update('title_30_additional', v)} limit={30} />
      <TextField label="🏢 О компании (115)" name="about_company_115" value={texts.about_company_115} onChange={(v) => update('about_company_115', v)} limit={115} multiline />
      <TextField label="📰 Длинный текст" name="text_long" value={texts.text_long} onChange={(v) => update('text_long', v)} limit={0} multiline />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] uppercase text-blue-700 font-medium mb-0.5 flex items-center gap-1">
            🔘 CTA-кнопка
            {ctaRecommended && (
              <span className="text-[9px] text-emerald-700 normal-case font-normal">
                · ⭐ VK рекомендует: <code>{ctaRecommended}</code>
              </span>
            )}
          </div>
          <select
            value={texts.cta}
            onChange={(e) => update('cta', e.target.value)}
            className="w-full px-2 py-1 text-xs border border-blue-200 rounded bg-white"
          >
            {ctaOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.key === ctaRecommended ? '⭐ ' : ''}{o.label} ({o.key})
              </option>
            ))}
          </select>
          {texts.cta !== ctaRecommended && ctaRecommended && (
            <button
              onClick={() => update('cta', ctaRecommended)}
              className="mt-1 text-[10px] text-emerald-700 hover:underline"
            >
              ⭐ поставить рекомендованный «{ctaRecommended}»
            </button>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase text-blue-700 font-medium mb-0.5">🔗 Ссылка (start=code — read-only)</div>
          <input value={ad.link ?? ''} readOnly className="w-full px-2 py-1 text-xs border border-gray-200 rounded bg-gray-50 font-mono text-gray-700" />
        </div>
      </div>
    </section>
  );
}
function TextField({ label, name, value, onChange, limit, multiline }: { label: string; name: string; value: string; onChange: (v: string) => void; limit: number; multiline?: boolean }) {
  const len = value.length;
  const over = limit > 0 && len > limit;
  const near = limit > 0 && len > limit * 0.9;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="uppercase text-blue-700 font-medium">{label}</span>
        {limit > 0 && <span className={over ? 'text-red-700 font-bold' : near ? 'text-amber-700' : 'text-gray-400'}>{len}/{limit}</span>}
      </div>
      {multiline ? (
        <textarea name={name} value={value} onChange={(e) => onChange(e.target.value)} rows={2}
          className={`w-full px-2 py-1 text-xs border rounded resize-y ${over ? 'border-red-400' : 'border-blue-200'}`} />
      ) : (
        <input name={name} value={value} onChange={(e) => onChange(e.target.value)}
          className={`w-full px-2 py-1 text-xs border rounded ${over ? 'border-red-400' : 'border-blue-200'}`} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────── ТЗ дизайнеру */
function DesignBriefPanel({ ad }: { ad: Ad }) {
  const brief = [
    ad.design_brief && `📋 БРИФ:\n${ad.design_brief}`,
    ad.design_sizes && `📐 РАЗМЕРЫ:\n${ad.design_sizes}`,
    ad.design_rules && `📜 ПРАВИЛА:\n${ad.design_rules}`,
    ad.source_banner_ref && `🎨 ИСХОДНЫЙ БАННЕР: ${ad.source_banner_ref}`,
  ].filter(Boolean).join('\n\n');

  function copyBrief() {
    if (!brief) return;
    navigator.clipboard?.writeText(brief);
  }

  if (!brief) return null;
  return (
    <section className="bg-amber-50/60 border border-amber-200 rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-amber-900">🎨 ТЗ дизайнеру</h3>
        <button onClick={copyBrief} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-white border border-amber-300 text-amber-900 rounded hover:bg-amber-100">
          <Copy size={11} /> Копировать ТЗ
        </button>
      </div>
      <pre className="text-[11px] text-amber-900 whitespace-pre-wrap font-mono">{brief}</pre>
    </section>
  );
}

/* ─────────────────────────────────────────────────────── Слоты картинок */
function ImageSlots({ ad, onUploaded }: { ad: Ad; onUploaded: () => void }) {
  return (
    <section className="bg-white border border-gray-200 rounded p-3">
      <h3 className="text-xs font-bold text-gray-900 mb-2">🖼 Слоты картинок (точные размеры VK)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {SLOT_KEYS.map((slot) => (
          <ImageSlot key={slot} adId={ad.id} slot={slot} url={ad.images[slot]} onUploaded={onUploaded} />
        ))}
      </div>
    </section>
  );
}

function ImageSlot({ adId, slot, url, onUploaded }: { adId: string; slot: SlotKey; url: string | null; onUploaded: () => void }) {
  const spec = SLOT_SPECS[slot];
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);

  async function upload(file: File) {
    setBusy(true); setErr(null);
    try {
      // Валидируем естественные размеры до отправки
      const img = await loadImage(file);
      setDim({ w: img.width, h: img.height });
      if (img.width < spec.minW || img.height < spec.minH) {
        setErr(`Слишком маленькое: ${img.width}×${img.height}, минимум ${spec.minW}×${spec.minH}`);
        return;
      }
      const realRatio = img.width / img.height;
      // ±2 % допуска
      if (Math.abs(realRatio - spec.ratio) / spec.ratio > 0.02) {
        setErr(`Не та пропорция: ${realRatio.toFixed(3)} (нужно ${spec.ratio.toFixed(3)}).`);
        return;
      }
      const fd = new FormData();
      fd.append('file', file);
      fd.append('slot', slot);
      const resp = await fetch(`/api/recruit/vk-ads/${adId}/image`, { method: 'POST', body: fd });
      const j = await resp.json();
      if (!resp.ok || j.error) throw new Error(j.error ?? 'upload failed');
      onUploaded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <div className={`border rounded p-2 ${url ? 'border-emerald-300 bg-emerald-50/40' : 'border-dashed border-gray-300 bg-gray-50'}`}>
      <div className="text-[10px] text-gray-600 mb-1 flex items-center justify-between">
        <span>{spec.label}</span>
        <code className="text-[9px] text-gray-400">{spec.w}×{spec.h}</code>
      </div>
      {url ? (
        <div className="space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={slot} className="w-full h-32 object-cover rounded bg-white" />
          <div className="text-[10px] text-emerald-700 flex items-center gap-1"><Check size={10} /> загружено{dim ? ` (${dim.w}×${dim.h})` : ''}</div>
        </div>
      ) : (
        <div className="h-32 flex items-center justify-center text-gray-400 text-xs">
          <ImageIcon size={20} className="opacity-50" />
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="mt-1 w-full px-2 py-1 text-[10px] bg-white border border-gray-300 rounded hover:bg-gray-50 inline-flex items-center justify-center gap-1 disabled:opacity-50"
      >
        <Upload size={10} /> {url ? 'Заменить' : 'Загрузить'}
      </button>
      {err && <div className="mt-1 text-[10px] text-red-700">{err}</div>}
    </div>
  );
}

function loadImage(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error('Не удалось прочитать картинку'));
    img.src = URL.createObjectURL(file);
  });
}

/* ─────────────────────────────────────────────────────── Слайды карусели */
function CarouselSlides({ ad, onUploaded }: { ad: Ad; onUploaded: () => void }) {
  const slides = ad.slides.length ? ad.slides : [];
  const SLIDE_SPEC = SLOT_SPECS.image_600x600; // 1:1, 1080×1080

  async function upload(file: File, index: number) {
    const img = await loadImage(file);
    if (Math.abs(img.width / img.height - 1) > 0.02 || img.width < 600) {
      alert(`Слайд должен быть квадратным 1:1, минимум 600×600. Получили: ${img.width}×${img.height}`);
      return;
    }
    const fd = new FormData();
    fd.append('file', file); fd.append('slot', 'slide'); fd.append('index', String(index));
    const r = await fetch(`/api/recruit/vk-ads/${ad.id}/image`, { method: 'POST', body: fd });
    const j = await r.json();
    if (!r.ok || j.error) { alert(j.error ?? 'upload failed'); return; }
    onUploaded();
  }

  return (
    <section className="bg-white border border-gray-200 rounded p-3">
      <h3 className="text-xs font-bold text-gray-900 mb-2">🎠 Слайды карусели (3–6 шт., {SLIDE_SPEC.w}×{SLIDE_SPEC.h}, 1:1)</h3>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[0,1,2,3,4,5].map((i) => (
          <SlideSlot key={i} index={i} url={slides[i] ?? null} onChoose={(f) => upload(f, i)} />
        ))}
      </div>
      <div className="text-[10px] text-gray-500 mt-2">Минимум 3 слайда. Drag-sort пока через мозг — измени порядок в config.slides[].</div>
    </section>
  );
}
function SlideSlot({ index, url, onChoose }: { index: number; url: string | null; onChoose: (f: File) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className={`border rounded p-1.5 ${url ? 'border-emerald-300 bg-emerald-50/40' : 'border-dashed border-gray-300 bg-gray-50'}`}>
      <div className="text-[9px] text-gray-500 mb-0.5">Слайд {index + 1}</div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`slide-${index}`} className="w-full aspect-square object-cover rounded bg-white" />
      ) : (
        <div className="aspect-square flex items-center justify-center text-gray-400 text-[10px]"><Camera size={16} /></div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onChoose(f); e.target.value = ''; }} />
      <button onClick={() => fileRef.current?.click()} className="mt-1 w-full px-1.5 py-0.5 text-[9px] bg-white border border-gray-300 rounded hover:bg-gray-50">
        {url ? 'заменить' : 'загрузить'}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────── Бюджет + статус */
function BudgetAndStatus({ ad, hasAllSlots, onPatch }: { ad: Ad; hasAllSlots: boolean; onPatch: (cfg: Record<string, unknown>) => void }) {
  const [budget, setBudget] = useState<number>(ad.budget_day);
  const [comment, setComment] = useState<string>(ad.comment ?? '');

  function saveBudget() { onPatch({ budget_day: Number(budget) || 0 }); }
  function saveComment() { onPatch({ comment }); }

  async function moveTo(next: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    onPatch({ status: next });
  }

  return (
    <section className="bg-violet-50/40 border border-violet-200 rounded p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-bold text-violet-900">⚙️ Кампания · бюджет · статус</h3>
        <span className="text-[10px] text-violet-700">last_pushed_at: {ad.last_pushed_at ?? '—'}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase text-violet-700 font-medium block mb-0.5">💰 Бюджет ₽/день</label>
          <div className="flex items-center gap-2">
            <input type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value))}
              className="w-28 px-2 py-1 text-xs border border-violet-200 rounded" />
            <button onClick={saveBudget} className="px-2 py-1 text-[11px] bg-violet-600 text-white rounded hover:bg-violet-700">Сохранить</button>
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase text-violet-700 font-medium block mb-0.5">📝 Комментарий</label>
          <div className="flex items-center gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} className="flex-1 px-2 py-1 text-xs border border-violet-200 rounded" />
            <button onClick={saveComment} className="px-2 py-1 text-[11px] bg-white border border-violet-300 rounded">Сохранить</button>
          </div>
        </div>
      </div>

      {/* Статус-воркфлоу */}
      <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-violet-100">
        <span className="text-[10px] uppercase text-violet-700 font-medium">Действия:</span>
        {ad.status === 'awaiting_design' && (
          <button
            disabled={!hasAllSlots}
            onClick={() => moveTo('design_uploaded')}
            className="px-2.5 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Check size={11} /> Дизайн загружен
          </button>
        )}
        {ad.status === 'design_uploaded' && (
          <button
            onClick={() => moveTo('approved', 'Согласовать дизайн (после этого можно лить в VK)?')}
            className="px-2.5 py-1 text-[11px] bg-emerald-600 text-white rounded hover:bg-emerald-700 inline-flex items-center gap-1"
          >
            <Check size={11} /> ✅ Согласовать
          </button>
        )}
        {ad.status === 'approved' && (
          <button
            onClick={() => moveTo('ready_to_push', 'Передать мозгу для залива в VK (PAUSED)? Деньги тратиться НЕ будут до явного «Запустить».')}
            className="px-2.5 py-1 text-[11px] bg-indigo-600 text-white rounded hover:bg-indigo-700 inline-flex items-center gap-1"
          >
            <Upload size={11} /> 🚀 Передать в VK (PAUSED)
          </button>
        )}
        {ad.status === 'ready_to_push' && (
          <button
            onClick={() => moveTo('live', '⚠️ Запустить рекламу в VK? Будут списываться ДЕНЬГИ по дневному бюджету.')}
            className="px-2.5 py-1 text-[11px] bg-green-600 text-white rounded hover:bg-green-700 inline-flex items-center gap-1"
          >
            <Play size={11} /> ▶ Запустить (LIVE)
          </button>
        )}
        {ad.status === 'live' && (
          <button onClick={() => moveTo('paused')} className="px-2.5 py-1 text-[11px] bg-gray-600 text-white rounded hover:bg-gray-700 inline-flex items-center gap-1">
            <Pause size={11} /> Пауза
          </button>
        )}
        {ad.status === 'paused' && (
          <button onClick={() => moveTo('live')} className="px-2.5 py-1 text-[11px] bg-green-600 text-white rounded hover:bg-green-700 inline-flex items-center gap-1">
            <Play size={11} /> Возобновить
          </button>
        )}
        {!hasAllSlots && ad.status === 'awaiting_design' && (
          <span className="text-[10px] text-amber-700 inline-flex items-center gap-1">
            <AlertTriangle size={10} /> Загрузи все обязательные слоты
          </span>
        )}
      </div>

      <div className="text-[10px] text-violet-700 pt-1 border-t border-violet-100">
        Залив в VK (создание ad_plan/banners) делает мозг (<code>vk_ads_client.py</code>, OAuth client_credentials, пакет 3232).
        Запуск/пауза в этой панели — флажки в реестре; мозг подхватит и сделает API-вызов в VK.
      </div>
    </section>
  );
}
