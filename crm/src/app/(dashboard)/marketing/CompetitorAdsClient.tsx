'use client';

import { useEffect, useMemo, useState } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import {
  Search,
  RefreshCw,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Building2,
  Megaphone,
} from 'lucide-react';
import { fmtMsk } from '@/lib/tz';

interface AdRow {
  id: string;
  channel: string | null;
  brand: string | null;
  text: string | null;
  image_url: string | null;
  source_link: string | null;
  hooks: string | null;
  reach: number | null;
  created_at: string;
}

interface Resp {
  items: AdRow[];
  totals: { total: number; by_channel: Record<string, number>; by_brand: Record<string, number> };
  brands: string[];
}

interface Props { tenantName: string | null }

const CHANNEL_META: Record<string, { label: string; color: string }> = {
  vk:       { label: 'VK',       color: 'bg-blue-100 text-blue-800 border-blue-200' },
  site:     { label: 'Сайт',     color: 'bg-gray-100 text-gray-700 border-gray-200' },
  telegram: { label: 'Telegram', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  yandex:   { label: 'Яндекс',   color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
};

type GroupBy = 'brand' | 'channel' | 'none';

export default function CompetitorAdsClient({ tenantName: _tn }: Props) {
  const [resp, setResp] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [channel, setChannel] = useState<string>('');
  const [brand, setBrand] = useState<string>('');
  const [q, setQ] = useState<string>('');
  const [groupBy, setGroupBy] = useState<GroupBy>('brand');

  async function reload(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const qs = new URLSearchParams();
      if (channel) qs.set('channel', channel);
      if (brand) qs.set('brand', brand);
      if (q.trim()) qs.set('q', q.trim());
      const j = await safeFetchJson<Resp>(`/api/recruit/marketing/competitor-ads?${qs.toString()}`);
      setResp(j); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }
  // мгновенный фильтр
  useEffect(() => {
    const t = setTimeout(() => reload(true), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, brand, q]);
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const items = resp?.items ?? [];
  const totals = resp?.totals ?? { total: 0, by_channel: {}, by_brand: {} };

  // Группировка
  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '__all__', label: 'Все', items }];
    const map = new Map<string, AdRow[]>();
    for (const it of items) {
      const key = (groupBy === 'brand' ? it.brand : it.channel) ?? '—';
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([key, list]) => ({ key, label: key, items: list }));
  }, [items, groupBy]);

  return (
    <div className="space-y-3">
      {/* ── Сводка + фильтры ─────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-700">
            Всего объявлений: <strong>{totals.total}</strong>
            {items.length !== totals.total && <> · после фильтров: <strong>{items.length}</strong></>}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => reload()}
            disabled={refreshing}
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-72">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по тексту / хукам / бренду…"
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
            />
          </div>

          <FilterChip
            icon={<Layers size={11} />}
            label="Канал"
            value={channel}
            onChange={setChannel}
            options={[['', 'все'], ...Object.entries(totals.by_channel)
              .filter(([k]) => k !== '—')
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => [k, `${CHANNEL_META[k]?.label ?? k} (${v})`] as [string, string])]}
          />

          <FilterChip
            icon={<Building2 size={11} />}
            label="Бренд"
            value={brand}
            onChange={setBrand}
            options={[['', 'все'], ...Object.entries(totals.by_brand)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => [k, `${k} (${v})`] as [string, string])]}
          />

          <span className="text-[10px] text-gray-500 ml-2">Группировка:</span>
          <div className="flex bg-gray-100 rounded p-0.5">
            {(['brand', 'channel', 'none'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-2 py-0.5 text-[10px] rounded ${groupBy === g ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
              >
                {g === 'brand' ? 'по бренду' : g === 'channel' ? 'по каналу' : 'все одной лентой'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => reload()}
            className="flex-shrink-0 px-2 py-0.5 text-[11px] bg-white border border-red-300 text-red-700 font-medium rounded hover:bg-red-100"
          >
            🔄 Повторить
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        groups.map((g) => (
          <section key={g.key} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <header className="px-3 py-2 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                {groupBy === 'channel' && CHANNEL_META[g.key]?.label ? (
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${CHANNEL_META[g.key].color}`}>
                    {CHANNEL_META[g.key].label}
                  </span>
                ) : groupBy === 'brand' ? (
                  <><Building2 size={11} /> {g.label}</>
                ) : (
                  <><Layers size={11} /> {g.label}</>
                )}
              </h3>
              <span className="text-[10px] text-gray-500">{g.items.length} объявлений</span>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
              {g.items.map((it) => <AdCard key={it.id} ad={it} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function AdCard({ ad }: { ad: AdRow }) {
  const [expanded, setExpanded] = useState(false);
  const meta = CHANNEL_META[(ad.channel ?? '').toLowerCase()];
  const text = ad.text ?? '';
  const preview = text.slice(0, 200);
  const longish = text.length > 200;
  const hooks = (ad.hooks ?? '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all flex flex-col">
      {ad.image_url ? (
        <a href={ad.image_url} target="_blank" rel="noopener noreferrer" className="block bg-gray-50">
          <img src={ad.image_url} alt={ad.brand ?? ''} className="w-full max-h-60 object-cover" />
        </a>
      ) : (
        <div className="aspect-video bg-gray-50 flex items-center justify-center text-gray-300">
          <ImageIcon size={32} />
        </div>
      )}
      <div className="p-2.5 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {meta && (
            <span className={`inline-block text-[9px] px-1.5 py-0 rounded border font-semibold ${meta.color}`}>
              {meta.label}
            </span>
          )}
          {ad.brand && (
            <span className="text-[10px] text-gray-700 font-medium truncate">{ad.brand}</span>
          )}
          {ad.reach != null && (
            <span className="text-[10px] text-gray-500 inline-flex items-center gap-0.5">
              <Eye size={9} /> {ad.reach.toLocaleString('ru-RU')}
            </span>
          )}
        </div>
        {text && (
          <div className="text-[11px] text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
            {expanded || !longish ? text : <>{preview}<span className="text-gray-400">…</span></>}
            {longish && (
              <button onClick={() => setExpanded((v) => !v)} className="ml-1 text-[10px] text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5">
                {expanded ? <>свернуть <ChevronUp size={9} /></> : <>читать целиком <ChevronDown size={9} /></>}
              </button>
            )}
          </div>
        )}
        {hooks.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {hooks.slice(0, 6).map((h, i) => (
              <span key={i} className="text-[9px] px-1 py-0 rounded bg-violet-50 text-violet-700 border border-violet-200">
                {h}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
          <span className="text-[9px] text-gray-400">{fmtMsk(ad.created_at, false)}</span>
          {ad.source_link && (
            <a
              href={ad.source_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5"
            >
              Открыть оригинал <ExternalLink size={9} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 max-w-md mx-auto">
      <Megaphone size={36} className="text-gray-300 mx-auto mb-3" />
      <h2 className="text-sm font-medium text-gray-700">Объявлений конкурентов нет</h2>
      <p className="text-xs text-gray-500 mt-2">
        Скрейпер по VK / сайтам / Telegram / Яндексу складывает сюда реальные креативы конкурентов.
        Когда заполнит — увидишь насмотренность.
      </p>
    </div>
  );
}

function FilterChip({
  icon, label, value, onChange, options,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-gray-700">
      <span className="text-gray-500 inline-flex items-center gap-1">{icon}{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-1.5 py-0.5 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none bg-white"
      >
        {options.map(([v, l]) => (
          <option key={v || '_'} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}
