'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { safeFetchJson } from '@/lib/safe-fetch';
import {
  Rocket,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  FileText,
  Send,
  Copy,
  Users,
  Megaphone,
  ArrowRight,
  Check,
  PenLine,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react';
import type { Campaign, AdVariant } from '@/lib/marketing/types';
import { CAMPAIGN_STATUS_LABELS, buildStartLink } from '@/lib/marketing/types';
import { fmtMsk } from '@/lib/tz';

interface CampaignWithVariants extends Campaign {
  variants: AdVariant[];
}

interface Group {
  seg_order: number | null;
  segment: string | null;
  portrait: string | null;
  campaigns: CampaignWithVariants[];
}

interface AssetRow {
  id: string;
  channel: string | null;
  title: string | null;
  body: string | null;
  link: string | null;
  status: string | null;
  created_at: string;
}

interface ContentPostRow {
  id: string;
  title: string | null;
  body: string | null;
  status: string | null;
  scheduled_at: string | null;
  channels_sel: string[] | null;
  photo_url: string | null;
}

type Channel = 'landings' | 'vk' | 'tg' | 'other';

interface Props {
  tenantName: string | null;
}

const CHANNEL_META: Record<Channel, { label: string; emoji: string; color: string }> = {
  landings: { label: 'Лендинги', emoji: '📄', color: 'text-gray-800' },
  vk:       { label: 'ВКонтакте', emoji: '🔵', color: 'text-blue-700' },
  tg:       { label: 'Telegram', emoji: '✈️', color: 'text-sky-700' },
  other:    { label: 'Яндекс / прочее', emoji: '🟡', color: 'text-yellow-700' },
};

export default function OurMarketingClient({ tenantName: _tn }: Props) {
  const [channel, setChannel] = useState<Channel>('landings');

  return (
    <div className="space-y-3 max-w-5xl">
      {/* ── Hero ────────────────────────────────────────────────── */}
      <header className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Rocket size={18} />
          <h2 className="text-base font-bold">Наш маркетинг</h2>
        </div>
        <p className="text-[11px] text-blue-100 leading-relaxed">
          Что уже готово к запуску — по каналам. Копируй текст → постируй / запускай / отправляй ссылкой.
        </p>
      </header>

      {/* ── Sub-tabs по каналу ──────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md p-1 overflow-x-auto">
        {(Object.keys(CHANNEL_META) as Channel[]).map((c) => {
          const meta = CHANNEL_META[c];
          const active = c === channel;
          return (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded ${
                active ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-600 hover:bg-gray-50 border border-transparent'
              }`}
            >
              <span>{meta.emoji}</span>
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* ── Содержимое ──────────────────────────────────────────── */}
      {channel === 'landings' && <LandingsTab />}
      {channel === 'vk' && <CampaignsByChannel hint="vk" />}
      {channel === 'tg' && <CampaignsByChannel hint="tg" />}
      {channel === 'other' && <OtherChannelStub />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 *  Лендинги (marketing_assets WHERE channel='landing')
 * ──────────────────────────────────────────────────────────────── */

function LandingsTab() {
  const [items, setItems] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const j = await safeFetchJson<{ items: AssetRow[] }>('/api/recruit/marketing/assets?channel=landing');
      setItems(j.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <FileText size={14} className="text-gray-600" />
          Готовые лендинги ({items.length})
        </h3>
        <button onClick={reload} className="flex items-center gap-1 px-2 py-0.5 text-[11px] bg-white border border-gray-200 text-gray-700 rounded hover:bg-gray-50">
          <RefreshCw size={11} /> Обновить
        </button>
      </header>
      {error && (
        <div className="mx-4 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
        </div>
      )}
      {loading ? (
        <p className="text-xs text-gray-400 text-center py-8">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-8">
          Готовых лендингов нет. Мозг публикует их сюда после согласования.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((a) => (
            <li key={a.id} className="px-4 py-3 hover:bg-gray-50 flex items-start gap-3">
              <FileText size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 truncate">{a.title ?? '(без названия)'}</span>
                  <StatusPill status={a.status} />
                </div>
                {a.body && (
                  <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">{a.body}</p>
                )}
                {a.link && (
                  <a
                    href={a.link.startsWith('http') ? a.link : `/${a.link.replace(/^\/+/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 break-all"
                  >
                    {a.link} <ExternalLink size={10} />
                  </a>
                )}
              </div>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtMsk(a.created_at, false)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? '').toLowerCase();
  const meta =
    s === 'ready' || s === 'approved' || s === 'published'
      ? { label: 'готово', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
      : s === 'draft'
      ? { label: 'черновик', color: 'bg-gray-100 text-gray-600 border-gray-200' }
      : s === 'revise'
      ? { label: 'на правке', color: 'bg-orange-100 text-orange-700 border-orange-200' }
      : { label: s || '—', color: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-block text-[9px] px-1.5 py-0 rounded border font-semibold ${meta.color}`}>
      {meta.label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────
 *  ВК / Telegram — кампании по портретам + (для TG) content_posts
 * ──────────────────────────────────────────────────────────────── */

function CampaignsByChannel({ hint }: { hint: 'vk' | 'tg' }) {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [posts, setPosts] = useState<ContentPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // Кампании одинаковые на обоих каналах — это «связка сообщений», текст
      // одинаковый, отличается только куда его постят.
      const g = await safeFetchJson<{ groups: Group[] }>('/api/recruit/marketing/campaigns-grouped');
      setGroups(g.groups ?? []);
      // content_posts грузим параллельно только для Telegram-таба, чтобы UX был
      // быстрее на ВК (там их нет).
      if (hint === 'tg') {
        try {
          const c = await safeFetchJson<{ posts: ContentPostRow[] }>('/api/content/posts');
          setPosts((c.posts ?? []).filter((p) => Array.isArray(p.channels_sel) && p.channels_sel.includes('telegram')));
        } catch {
          // /api/content может вернуть другой shape — не валим всю вкладку.
          setPosts([]);
        }
      } else {
        setPosts([]);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [hint]);
  useEffect(() => { reload(); }, [reload]);

  async function patchVariant(id: string, body: Partial<AdVariant>) {
    const j = await safeFetchJson<{ variant: AdVariant }>(`/api/recruit/variants/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setGroups((prev) => prev.map((g) => ({
      ...g,
      campaigns: g.campaigns.map((c) => ({
        ...c,
        variants: c.variants.map((v) => v.id === id ? j.variant : v),
      })),
    })));
  }

  const totalCampaigns = groups.reduce((n, g) => n + g.campaigns.length, 0);
  const totalVariants = groups.reduce((n, g) => n + g.campaigns.reduce((m, c) => m + c.variants.length, 0), 0);

  return (
    <div className="space-y-3">
      <div className={`rounded-md border p-3 ${hint === 'vk' ? 'bg-blue-50/60 border-blue-200' : 'bg-sky-50/60 border-sky-200'}`}>
        <p className="text-xs text-gray-700">
          {hint === 'vk' ? (
            <>🔵 <strong>ВК-посты для размещения в группах:</strong> готовые тексты по портретам ЦА. Копируй → публикуй вручную или через демона.</>
          ) : (
            <>✈️ <strong>Telegram-посты:</strong> кампании-связки для рекламы в ТГ-группах + контент-план канала ({posts.length} постов).</>
          )}
        </p>
        <div className="text-[10px] text-gray-600 mt-1.5">
          {totalCampaigns} кампаний · {totalVariants} сообщений
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400 text-center py-8">Загрузка…</p>
      ) : groups.length === 0 ? (
        <div className="text-center py-8 bg-white border border-gray-200 rounded-lg">
          <Megaphone size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-500">Кампаний нет — мозг ещё не собрал.</p>
        </div>
      ) : (
        groups.map((g) => (
          <SegmentGroup
            key={String(g.seg_order ?? 'none')}
            group={g}
            onOpenCampaign={(id) => router.push(`/marketing/${id}`)}
            onPatchVariant={patchVariant}
          />
        ))
      )}

      {hint === 'tg' && posts.length > 0 && (
        <ContentPostsBlock posts={posts} />
      )}
    </div>
  );
}

function ContentPostsBlock({ posts }: { posts: ContentPostRow[] }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Send size={14} className="text-sky-600" />
          Контент-план в TG-канал ({posts.length})
        </h3>
        <a href="/content" className="text-[11px] text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
          Открыть календарь <ArrowRight size={11} />
        </a>
      </header>
      <ul className="divide-y divide-gray-100">
        {posts.slice(0, 12).map((p) => (
          <li key={p.id} className="px-4 py-2 flex items-start gap-3 hover:bg-gray-50">
            <Send size={11} className="text-sky-500 mt-1 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-900 truncate">{p.title ?? '(без названия)'}</span>
                <StatusPill status={p.status} />
              </div>
              {p.scheduled_at && (
                <div className="text-[10px] text-gray-500 mt-0.5 inline-flex items-center gap-0.5">
                  <Calendar size={9} /> {fmtMsk(p.scheduled_at, true)} МСК
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
 *  Яндекс / прочее — заглушка
 * ──────────────────────────────────────────────────────────────── */

function OtherChannelStub() {
  return (
    <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-lg">
      <div className="text-3xl mb-2">🟡</div>
      <h3 className="text-sm font-medium text-gray-700">Яндекс / прочее</h3>
      <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
        Яндекс.Директ, Авито, hh, Telegram-Ads. Когда подключим эти каналы — креативы появятся тут отдельным потоком.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 *  Группа сегмента — внутренний компонент (копия CampaignsBySegment)
 * ──────────────────────────────────────────────────────────────── */

function SegmentGroup({
  group, onOpenCampaign, onPatchVariant,
}: {
  group: Group;
  onOpenCampaign: (id: string) => void;
  onPatchVariant: (id: string, body: Partial<AdVariant>) => Promise<void>;
}) {
  const hasSegment = !!group.segment;
  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <header className={`px-4 py-3 border-b ${hasSegment ? 'border-blue-100 bg-blue-50/40' : 'border-gray-100 bg-gray-50/60'}`}>
        <div className="flex items-start gap-3">
          <div className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold flex-shrink-0 ${
            hasSegment ? 'bg-white border border-blue-200 text-blue-700' : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
            {group.seg_order ?? '·'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-900 leading-tight">
              <Users size={13} className="inline mr-1 -mt-0.5 opacity-70" />
              {group.segment ?? 'Без сегмента'}
            </div>
            {group.portrait && (
              <p className="text-[11px] text-gray-600 mt-1 leading-relaxed whitespace-pre-wrap break-words">{group.portrait}</p>
            )}
          </div>
        </div>
      </header>
      <div className="divide-y divide-gray-100">
        {group.campaigns.map((c) => (
          <CampaignBlock key={c.id} campaign={c} onOpen={() => onOpenCampaign(c.id)} onPatchVariant={onPatchVariant} />
        ))}
      </div>
    </section>
  );
}

function CampaignBlock({
  campaign, onOpen, onPatchVariant,
}: {
  campaign: CampaignWithVariants;
  onOpen: () => void;
  onPatchVariant: (id: string, body: Partial<AdVariant>) => Promise<void>;
}) {
  const statusMeta = CAMPAIGN_STATUS_LABELS[campaign.status ?? 'draft'] ?? CAMPAIGN_STATUS_LABELS.draft;
  const variants = (campaign.variants ?? []).slice().sort((a, b) => {
    const la = String(a.label ?? ''); const lb = String(b.label ?? '');
    return la.localeCompare(lb, 'ru', { numeric: true });
  });
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Megaphone size={12} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-900">{campaign.name}</span>
            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${statusMeta.color}`}>{statusMeta.label}</span>
          </div>
          {campaign.objective && (
            <div className="text-[11px] text-gray-600 mt-0.5">🎯 {campaign.objective}</div>
          )}
        </div>
        <button onClick={onOpen} className="text-[11px] text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 flex-shrink-0">
          Открыть <ArrowRight size={11} />
        </button>
      </div>
      {variants.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic">В кампании пока нет сообщений.</p>
      ) : (
        <div className="space-y-2 mt-2">
          {variants.map((v) => (
            <VariantInline key={v.id} variant={v} onPatch={onPatchVariant} />
          ))}
        </div>
      )}
    </div>
  );
}

function VariantInline({
  variant, onPatch,
}: {
  variant: AdVariant;
  onPatch: (id: string, body: Partial<AdVariant>) => Promise<void>;
}) {
  const [reviseOpen, setReviseOpen] = useState(false);
  const [note, setNote] = useState(variant.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textExpanded, setTextExpanded] = useState(false);
  const startLink = variant.utm ? buildStartLink(variant.utm) : null;
  const status = variant.status ?? 'draft';
  const text = variant.text ?? '';
  const longish = text.length > 220;

  async function apply(body: Partial<AdVariant>) {
    setBusy(true); setError(null);
    try {
      await onPatch(variant.id, body);
      if (body.status === 'revise') setReviseOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  function copyText() {
    if (text) navigator.clipboard?.writeText(text);
  }
  function copyStart() {
    if (startLink) navigator.clipboard?.writeText(startLink);
  }

  return (
    <div className={`rounded-md border p-2.5 ${
      status === 'approved' ? 'bg-emerald-50/40 border-emerald-200' :
      status === 'revise' ? 'bg-orange-50/40 border-orange-200' :
      'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-start gap-2">
        <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
          {variant.label ?? '?'}
        </span>
        <div className="flex-1 min-w-0">
          {text ? (
            <div className="text-xs text-gray-800 whitespace-pre-wrap break-words leading-snug">
              {textExpanded || !longish ? text : <>{text.slice(0, 220)}<span className="text-gray-400">…</span></>}
              {longish && (
                <button onClick={() => setTextExpanded((v) => !v)} className="ml-1 text-[10px] text-blue-600 hover:text-blue-800">
                  {textExpanded ? <>свернуть <ChevronUp size={9} className="inline" /></> : <>читать целиком <ChevronDown size={9} className="inline" /></>}
                </button>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">Текст пустой</p>
          )}
          {variant.utm && (
            <div className="mt-1.5 text-[10px] font-mono text-gray-600">
              <span className="opacity-70">UTM:</span> {variant.utm}
            </div>
          )}
          {startLink && (
            <div className="mt-1 flex items-center gap-1">
              <code className="flex-1 text-[10px] text-blue-700 break-all">{startLink}</code>
              <button onClick={copyStart} className="p-0.5 text-blue-600 hover:bg-blue-100 rounded" title="Копировать ссылку">
                <Copy size={9} />
              </button>
            </div>
          )}
          {status === 'revise' && variant.note && (
            <div className="mt-1.5 text-[10px] text-orange-800 bg-orange-100/60 border border-orange-200 rounded px-1.5 py-0.5">
              <strong>На правке:</strong> {variant.note}
            </div>
          )}
          {error && (
            <div className="mt-1 text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">{error}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {status === 'approved' && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-300">✓ ок</span>
          )}
          <div className="flex items-center gap-1">
            {text && (
              <button
                onClick={copyText}
                title="Копировать текст"
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                <Copy size={9} /> текст
              </button>
            )}
            {!reviseOpen && status !== 'approved' && (
              <button
                onClick={() => setReviseOpen(true)}
                disabled={busy}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-orange-700 border border-orange-300 rounded hover:bg-orange-50 disabled:opacity-40"
              >
                <PenLine size={9} /> переделать
              </button>
            )}
            {status !== 'approved' && (
              <button
                onClick={() => apply({ status: 'approved', note: null })}
                disabled={busy}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40"
              >
                <Check size={9} /> ок
              </button>
            )}
            {status === 'approved' && (
              <button
                onClick={() => apply({ status: 'draft', note: null })}
                disabled={busy}
                className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 rounded"
              >
                ↩ снять
              </button>
            )}
          </div>
          <div className="text-[9px] text-gray-400">Отправлено: {variant.sent_count ?? 0}</div>
        </div>
      </div>
      {reviseOpen && (
        <div className="mt-2 space-y-1 pl-9">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Что переделать в этом сообщении?"
            className="w-full px-2 py-1 text-[11px] border border-orange-200 rounded focus:border-orange-400 focus:outline-none resize-y"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button onClick={() => { setReviseOpen(false); setNote(variant.note ?? ''); }} className="px-1.5 py-0.5 text-[10px] text-gray-700 hover:bg-gray-100 rounded">Отмена</button>
            <button
              onClick={() => apply({ status: 'revise', note: note.trim() })}
              disabled={busy || !note.trim()}
              className="px-1.5 py-0.5 text-[10px] bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-40"
            >
              {busy ? '…' : 'Поправить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
