'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Megaphone,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Copy,
  PenLine,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { safeFetchJson } from '@/lib/safe-fetch';
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

interface Props {
  tenantName: string | null;
}

export default function CampaignsBySegment({ tenantName: _tn }: Props) {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const j = await safeFetchJson<{ groups: Group[] }>('/api/recruit/marketing/campaigns-grouped');
      setGroups(j.groups ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function patchVariant(id: string, body: Partial<AdVariant>) {
    const j = await safeFetchJson<{ variant: AdVariant }>(`/api/recruit/variants/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    // оптимистично обновим в локальном state
    setGroups((prev) => prev.map((g) => ({
      ...g,
      campaigns: g.campaigns.map((c) => ({
        ...c,
        variants: c.variants.map((v) => v.id === id ? j.variant : v),
      })),
    })));
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Кампании сгруппированы по портрету ЦА (по порядку сегментов). 👤 ЦА → 📣 кампания → сообщения-связка.
        </p>
        <button
          onClick={() => reload()}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>
      ) : groups.length === 0 ? (
        <div className="text-center py-12">
          <Megaphone size={36} className="text-gray-300 mx-auto mb-3" />
          <h2 className="text-sm font-medium text-gray-700">Кампаний пока нет</h2>
          <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
            Когда мозг соберёт кампании по портретам ЦА — они появятся здесь.
          </p>
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
    </div>
  );
}

function SegmentGroup({
  group, onOpenCampaign, onPatchVariant,
}: {
  group: Group;
  onOpenCampaign: (id: string) => void;
  onPatchVariant: (id: string, body: Partial<AdVariant>) => void | Promise<void>;
}) {
  const hasSegment = !!group.segment;
  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* ── Шапка-портрет ─────────────────────────────────────────── */}
      <header className={`px-4 py-3 border-b ${hasSegment ? 'border-blue-100 bg-blue-50/40' : 'border-gray-100 bg-gray-50/60'}`}>
        <div className="flex items-start gap-3">
          <div className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold flex-shrink-0 ${
            hasSegment ? 'bg-white border border-blue-200 text-blue-700' : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
            {group.seg_order ?? '·'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 leading-tight">
              <Users size={14} className="inline mr-1 -mt-0.5 opacity-70" />
              {group.segment ?? 'Без сегмента'}
            </div>
            {group.portrait && (
              <p className="text-xs text-gray-600 mt-1 leading-relaxed whitespace-pre-wrap break-words">
                {group.portrait}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ── Кампании ─────────────────────────────────────────────── */}
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
  onPatchVariant: (id: string, body: Partial<AdVariant>) => void | Promise<void>;
}) {
  const statusMeta = CAMPAIGN_STATUS_LABELS[campaign.status ?? 'draft'] ?? CAMPAIGN_STATUS_LABELS.draft;
  const variants = (campaign.variants ?? []).slice().sort((a, b) => {
    // sort по label ASC (label = '1/4', '2/4' и т.п.)
    const la = String(a.label ?? '');
    const lb = String(b.label ?? '');
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
        <button
          onClick={onOpen}
          className="text-[11px] text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 flex-shrink-0"
          title="Открыть в редакторе"
        >
          Открыть <ArrowRight size={11} />
        </button>
      </div>

      {variants.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic">В кампании пока нет сообщений (откройте чтобы добавить).</p>
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
  onPatch: (id: string, body: Partial<AdVariant>) => void | Promise<void>;
}) {
  const [reviseOpen, setReviseOpen] = useState(false);
  const [note, setNote] = useState(variant.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startLink = variant.utm ? buildStartLink(variant.utm) : null;
  const status = variant.status ?? 'draft';

  async function apply(body: Partial<AdVariant>) {
    setBusy(true); setError(null);
    try {
      await onPatch(variant.id, body);
      if (body.status === 'revise') setReviseOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
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
          {variant.text ? (
            <div className="text-xs text-gray-800 whitespace-pre-wrap break-words leading-snug">{variant.text}</div>
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
              <button onClick={copyStart} className="p-0.5 text-blue-600 hover:bg-blue-100 rounded" title="Копировать">
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
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-300">
              ✓ ок
            </span>
          )}
          <div className="flex items-center gap-1">
            {!reviseOpen && status !== 'approved' && (
              <button
                onClick={() => setReviseOpen(true)}
                disabled={busy}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-orange-700 border border-orange-300 rounded hover:bg-orange-50 disabled:opacity-40"
                title="Поправить — мозг переделает по комменту"
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
                title="Снять согласование"
              >
                ↩ снять
              </button>
            )}
          </div>
          <div className="text-[9px] text-gray-400">
            Отправлено: {variant.sent_count ?? 0}
          </div>
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
