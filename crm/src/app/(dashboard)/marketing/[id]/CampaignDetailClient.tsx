'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Megaphone,
  Plus,
  Sparkles,
  Trash2,
  Edit3,
  RefreshCw,
  Search,
  Send,
  Image as ImageIcon,
  Upload,
  AlertTriangle,
  Award,
  AlertCircle,
  Check,
  Users,
  Copy,
  ChevronRight,
} from 'lucide-react';
import type {
  Campaign,
  AdVariant,
  MailingJob,
  CampaignStatus,
} from '@/lib/marketing/types';
import {
  CAMPAIGN_STATUS_LABELS,
  JOB_STATUS_LABELS,
  buildStartLink,
} from '@/lib/marketing/types';
import { fmtMsk } from '@/lib/tz';

interface Props { campaignId: string; tenantName: string | null }

interface CampaignDetail {
  campaign: Campaign;
  variants: AdVariant[];
  jobs: MailingJob[];
}

interface ChannelTargetRow {
  id: string;
  name: string;
  username: string | null;
  link: string | null;
  members: number | null;
  city: string | null;
  is_group: boolean;
  joined: boolean | null;
  source: string | null;
}

interface AnalyticsResp {
  variants: Array<{ id: string; label: string | null; utm: string | null; sent_count: number; leads: number; conv: number; jobs_sent: number; jobs_failed: number }>;
  by_status: Record<string, number>;
  by_channel: Array<{ target: string; total: number; sent: number; failed: number }>;
  winner_variant_id: string | null;
  totals: { variants: number; jobs: number; leads: number; sent: number; failed: number; queued: number };
}

type Tab = 'variants' | 'channels' | 'mailing' | 'analytics';


function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('ru-RU');
}

export default function CampaignDetailClient({ campaignId, tenantName }: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('variants');

  const reload = useCallback(async () => {
    try {
      const j = await safeFetchJson<CampaignDetail>(`/api/recruit/campaigns/${campaignId}`);
      setDetail(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { reload(); }, [reload]);

  async function updateCampaign(patch: Partial<Campaign>) {
    try {
      const j = await safeFetchJson<{ campaign: Campaign }>(`/api/recruit/campaigns/${campaignId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      setDetail((d) => d ? { ...d, campaign: j.campaign } : d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function removeCampaign() {
    if (!confirm('Удалить кампанию вместе с вариантами и jobs?')) return;
    try {
      await safeFetchJson(`/api/recruit/campaigns/${campaignId}`, { method: 'DELETE' });
      router.push('/marketing');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) {
    return <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>;
  }
  if (!detail) {
    return (
      <div className="p-6">
        <button onClick={() => router.push('/marketing')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft size={14} /> Назад
        </button>
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error || 'Кампания не найдена'}
        </div>
      </div>
    );
  }

  const { campaign, variants, jobs } = detail;
  const statusMeta = CAMPAIGN_STATUS_LABELS[campaign.status ?? 'draft'] ?? CAMPAIGN_STATUS_LABELS.draft;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="px-6 py-3 bg-white border-b border-gray-200">
        <button onClick={() => router.push('/marketing')} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft size={12} /> Маркетинг
        </button>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Megaphone size={18} className="text-gray-600 flex-shrink-0" />
            <h1 className="text-base font-bold text-gray-900 truncate">{campaign.name}</h1>
            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${statusMeta.color}`}>{statusMeta.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={campaign.status ?? 'draft'}
              onChange={(e) => updateCampaign({ status: e.target.value as CampaignStatus })}
              className="px-2 py-1 text-xs border border-gray-200 rounded-md bg-white focus:border-blue-500 focus:outline-none"
            >
              {Object.entries(CAMPAIGN_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button onClick={reload} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Обновить"><RefreshCw size={12} /></button>
            <button onClick={removeCampaign} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="Удалить кампанию"><Trash2 size={12} /></button>
          </div>
        </div>
        {(campaign.objective || campaign.audience) && (
          <div className="mt-2 text-[11px] text-gray-600 flex flex-wrap gap-x-4">
            {campaign.objective && <span>🎯 {campaign.objective}</span>}
            {campaign.audience && <span>👥 {campaign.audience}</span>}
            {tenantName && <span>· {tenantName}</span>}
          </div>
        )}
      </header>

      <div className="flex items-center gap-1 px-6 bg-white border-b border-gray-200 overflow-x-auto">
        <TabBtn active={tab === 'variants'} onClick={() => setTab('variants')}>A/B-варианты ({variants.length})</TabBtn>
        <TabBtn active={tab === 'channels'} onClick={() => setTab('channels')}>Каналы-цели</TabBtn>
        <TabBtn active={tab === 'mailing'} onClick={() => setTab('mailing')}>Рассылка ({jobs.length})</TabBtn>
        <TabBtn active={tab === 'analytics'} onClick={() => setTab('analytics')}>Аналитика A/B</TabBtn>
      </div>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {tab === 'variants' && <VariantsTab variants={variants} campaign={campaign} onReload={reload} />}
        {tab === 'channels' && <ChannelsTab campaign={campaign} variants={variants} onJobsCreated={reload} />}
        {tab === 'mailing' && <MailingTab jobs={jobs} variants={variants} />}
        {tab === 'analytics' && <AnalyticsTab campaignId={campaignId} />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
      active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'
    }`}>{children}</button>
  );
}

// ─── Variants Tab ─────────────────────────────────────────────────────
function VariantsTab({ variants, campaign, onReload }: { variants: AdVariant[]; campaign: Campaign; onReload: () => void | Promise<void> }) {
  const [adding, setAdding] = useState(false);
  async function add() {
    setAdding(true);
    try {
      await fetch(`/api/recruit/campaigns/${campaign.id}/variants`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      await onReload();
    } finally { setAdding(false); }
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">{variants.length} вариантов. AI-генерация подмешивает «Столица», доход до 400 000 ₽, на «ты», без AI-воды.</p>
        <button onClick={add} disabled={adding} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-40">
          <Plus size={12} /> {adding ? 'Создание…' : 'Добавить вариант'}
        </button>
      </div>
      {variants.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">Вариантов нет. Жми «Добавить вариант» — авто-метка A, B, C…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {variants.map((v) => (
            <VariantCard key={v.id} variant={v} onChanged={onReload} />
          ))}
        </div>
      )}
    </div>
  );
}

function VariantCard({ variant, onChanged }: { variant: AdVariant; onChanged: () => void | Promise<void> }) {
  const [text, setText] = useState(variant.text ?? '');
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingText, setSavingText] = useState(false);
  const [brief, setBrief] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const startLink = variant.utm ? buildStartLink(variant.utm) : null;

  async function generate() {
    setGenerating(true); setError(null);
    try {
      const j = await safeFetchJson<{ text: string }>(`/api/recruit/variants/${variant.id}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief }),
      });
      setText(j.text);
      setEditing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function saveText() {
    setSavingText(true); setError(null);
    try {
      await safeFetchJson(`/api/recruit/variants/${variant.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      });
      setEditing(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingText(false);
    }
  }

  async function uploadPhoto(file: File) {
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/recruit/variants/${variant.id}/photo`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function removePhoto() {
    if (!confirm('Удалить фото?')) return;
    try {
      await safeFetchJson(`/api/recruit/variants/${variant.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_url: null }),
      });
      await onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  async function remove() {
    if (!confirm('Удалить вариант?')) return;
    try {
      await safeFetchJson(`/api/recruit/variants/${variant.id}`, { method: 'DELETE' });
      await onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <header className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-600 text-white text-sm font-bold rounded">
            {variant.label ?? '?'}
          </span>
          <div>
            <div className="text-[11px] text-gray-500">UTM</div>
            <div className="text-xs font-mono text-gray-800">{variant.utm ?? '—'}</div>
          </div>
        </div>
        <button onClick={remove} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Удалить вариант">
          <Trash2 size={12} />
        </button>
      </header>

      <div className="px-3 py-3 space-y-2">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</div>
        )}

        {/* AI generate brief + button */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Бриф для ИИ (опц.)</label>
          <input
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Что подчеркнуть: газ дёшево, помощь приезжим, и т.п."
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-600 text-white text-[11px] font-medium rounded-md hover:bg-violet-700 disabled:opacity-40"
          >
            <Sparkles size={11} />
            {generating ? 'ИИ пишет…' : '✨ Сгенерировать с ИИ'}
          </button>
        </div>

        {/* Text */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Текст поста</label>
            {!editing && variant.text && (
              <button onClick={() => setEditing(true)} className="text-[10px] text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                <Edit3 size={9} /> Изменить
              </button>
            )}
          </div>
          {editing ? (
            <div className="space-y-1.5">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none resize-y font-mono"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button onClick={() => { setEditing(false); setText(variant.text ?? ''); }} className="px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100 rounded">Отмена</button>
                <button onClick={saveText} disabled={savingText} className="flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40">
                  <Check size={10} /> {savingText ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </div>
          ) : variant.text ? (
            <div className="text-xs text-gray-800 whitespace-pre-wrap break-words bg-gray-50 border border-gray-200 rounded p-2 max-h-48 overflow-y-auto">{variant.text}</div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">Пусто — сгенерируй с ИИ или напиши вручную (Edit).</p>
          )}
        </div>

        {/* Start link */}
        {startLink && (
          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
            <div className="font-medium text-blue-900 mb-0.5">Готовая ссылка для поста:</div>
            <div className="flex items-center gap-1">
              <code className="flex-1 break-all text-blue-700">{startLink}</code>
              <button
                onClick={() => navigator.clipboard?.writeText(startLink)}
                className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                title="Копировать"
              >
                <Copy size={10} />
              </button>
            </div>
          </div>
        )}

        {/* Photo */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Фото</label>
            {variant.photo_url && (
              <button onClick={removePhoto} className="text-[10px] text-red-500 hover:text-red-700">Удалить</button>
            )}
          </div>
          {variant.photo_url ? (
            <div className="rounded border border-gray-200 overflow-hidden bg-gray-50">
              <img src={variant.photo_url} alt="" className="w-full max-h-48 object-contain" />
            </div>
          ) : (
            <div className="text-[11px] text-gray-400 italic">Без фото — будет только текст.</div>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
          <button onClick={() => fileRef.current?.click()} className="mt-1 text-[11px] text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
            <Upload size={10} /> {variant.photo_url ? 'Заменить фото' : 'Загрузить фото'}
          </button>
        </div>

        {/* ── Согласование «✅ Ок» / «✏️ Переделать» ───────────── */}
        <VariantApproveBlock variant={variant} onChanged={onChanged} />

        <div className="border-t border-gray-100 pt-2 text-[10px] text-gray-400 flex items-center justify-between">
          <span>Отправлено: {fmtNum(variant.sent_count)}</span>
          <span>{fmtMsk(variant.created_at, false)} МСК</span>
        </div>
      </div>
    </div>
  );
}

function VariantApproveBlock({ variant, onChanged }: { variant: AdVariant; onChanged: () => void | Promise<void> }) {
  const [reviseOpen, setReviseOpen] = useState(false);
  const [note, setNote] = useState(variant.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = variant.status ?? 'draft';

  async function patch(body: Partial<AdVariant>) {
    setBusy(true); setError(null);
    try {
      await safeFetchJson(`/api/recruit/variants/${variant.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      await onChanged();
      if (body.status === 'revise') setReviseOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-gray-100 pt-2 space-y-1.5">
      {status === 'revise' && variant.note && (
        <div className="text-[10px] text-orange-800 bg-orange-50 border border-orange-200 rounded px-2 py-1">
          <strong>На правке:</strong> {variant.note}
        </div>
      )}
      {error && (
        <div className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {status === 'approved' && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-200">
              ✓ согласовано
            </span>
          )}
          {status === 'revise' && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-orange-100 text-orange-700 border-orange-200">
              ✏️ на правке
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!reviseOpen ? (
            <button
              onClick={() => setReviseOpen(true)}
              disabled={busy}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-orange-700 border border-orange-300 rounded hover:bg-orange-50 disabled:opacity-40"
            >
              ✏️ Переделать
            </button>
          ) : null}
          {status !== 'approved' && (
            <button
              onClick={() => patch({ status: 'approved', note: null })}
              disabled={busy}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40"
            >
              ✅ Ок
            </button>
          )}
          {status === 'approved' && (
            <button
              onClick={() => patch({ status: 'draft', note: null })}
              disabled={busy}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100 rounded"
              title="Снять согласование"
            >
              ↩ Снять
            </button>
          )}
        </div>
      </div>
      {reviseOpen && (
        <div className="space-y-1">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Что переделать?"
            className="w-full px-2 py-1.5 text-[11px] border border-orange-200 rounded focus:border-orange-400 focus:outline-none resize-y"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button onClick={() => { setReviseOpen(false); setNote(variant.note ?? ''); }} className="px-2 py-0.5 text-[10px] text-gray-700 hover:bg-gray-100 rounded">Отмена</button>
            <button
              onClick={() => patch({ status: 'revise', note: note.trim() })}
              disabled={busy || !note.trim()}
              className="px-2 py-0.5 text-[10px] bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-40"
            >
              {busy ? '…' : '✏️ Поправить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Channels Tab ─────────────────────────────────────────────────────
function ChannelsTab({ campaign, variants, onJobsCreated }: { campaign: Campaign; variants: AdVariant[]; onJobsCreated: () => void | Promise<void> }) {
  const router = useRouter();
  const [items, setItems] = useState<ChannelTargetRow[]>([]);
  const [search, setSearch] = useState('');
  const [size, setSize] = useState<'' | 'small' | 'mid' | 'large'>('mid');
  const [joinedF, setJoinedF] = useState<'' | 'yes' | 'no'>('yes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queueing, setQueueing] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('q', search.trim());
      if (size) qs.set('size', size);
      if (joinedF) qs.set('joined', joinedF);
      qs.set('per', '100');
      const j = await safeFetchJson<{ items: ChannelTargetRow[] }>(`/api/recruit/parser-channels?${qs.toString()}`);
      setItems(j.items ?? []);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [search, size, joinedF]);

  useEffect(() => {
    const t = setTimeout(reload, 250);
    return () => clearTimeout(t);
  }, [reload]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllVisible() {
    setSelected((s) => {
      const next = new Set(s);
      for (const it of items) next.add(it.id);
      return next;
    });
  }
  function clearAll() { setSelected(new Set()); }

  async function queueJobs() {
    if (!selected.size) return;
    if (!variants.length) {
      setError('Сначала добавь хотя бы один A/B-вариант на вкладке «A/B-варианты».');
      return;
    }
    setQueueing(true); setError(null); setResultMsg(null);
    try {
      const targets = items
        .filter((it) => selected.has(it.id))
        .map((it) => ({
          target: it.username ?? it.link ?? it.id,
          target_kind: 'group' as const,
        }));
      const j = await safeFetchJson<{ inserted: number; variants: number; targets: number }>(
        `/api/recruit/campaigns/${campaign.id}/jobs`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targets }) }
      );
      setResultMsg(`✓ Поставлено в очередь: ${j.inserted} jobs (× ${j.variants} вариантов на ${j.targets} каналов)`);
      setSelected(new Set());
      await onJobsCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setQueueing(false);
    }
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-900 flex items-start gap-2">
        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
        <div>
          <strong>Анти-бан:</strong> посев в чужие группы — только в те, куда мы УЖЕ вступлены (Подписан=да);
          человеческий темп (паузы между постами); фоновый демон сам соблюдает лимиты Telegram и проверяет
          dialog_handoff. Отсюда мы только формируем очередь — отправляет демон.
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-72">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию / городу…"
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none" />
          </div>
          <label className="text-[11px] flex items-center gap-1 text-gray-700">
            <span className="text-gray-500">Размер:</span>
            <select value={size} onChange={(e) => setSize(e.target.value as typeof size)} className="px-1.5 py-1 text-xs border border-gray-200 rounded-md bg-white">
              <option value="">все</option>
              <option value="small">мелкие &lt;1k</option>
              <option value="mid">средние</option>
              <option value="large">крупные &gt;10k</option>
            </select>
          </label>
          <label className="text-[11px] flex items-center gap-1 text-gray-700">
            <span className="text-gray-500">Подписан:</span>
            <select value={joinedF} onChange={(e) => setJoinedF(e.target.value as typeof joinedF)} className="px-1.5 py-1 text-xs border border-gray-200 rounded-md bg-white">
              <option value="yes">да (можно постить)</option>
              <option value="">все</option>
              <option value="no">нет</option>
            </select>
          </label>
          <div className="flex-1" />
          <button onClick={selectAllVisible} className="text-[11px] text-blue-600 hover:text-blue-800">Выбрать всё видимое</button>
          {selected.size > 0 && (
            <button onClick={clearAll} className="text-[11px] text-gray-600 hover:text-gray-900">Сбросить ({selected.size})</button>
          )}
        </div>
      </div>

      {error && <div className="mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</div>}
      {resultMsg && <div className="mb-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">{resultMsg}</div>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-8">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">Ничего не найдено по фильтрам.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                <th className="px-3 py-2 w-8"></th>
                <th className="px-3 py-2">Название</th>
                <th className="px-3 py-2 w-24">Город</th>
                <th className="px-3 py-2 w-24 text-right">Участников</th>
                <th className="px-3 py-2 w-20">Тип</th>
                <th className="px-3 py-2 w-20 text-center">Подписан</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it) => (
                <tr key={it.id} className={selected.has(it.id) ? 'bg-blue-50/40' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-1.5">
                    <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} className="rounded" />
                  </td>
                  <td className="px-3 py-1.5">
                    {it.link ? (
                      <a href={it.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{it.name}</a>
                    ) : (
                      <span className="text-gray-900">{it.name}</span>
                    )}
                    {it.username && <div className="text-[10px] text-gray-400">@{it.username.replace(/^@/, '')}</div>}
                  </td>
                  <td className="px-3 py-1.5 text-gray-700">{it.city || '—'}</td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">{fmtNum(it.members)}</td>
                  <td className="px-3 py-1.5 text-gray-700">{it.is_group ? 'группа' : 'канал'}</td>
                  <td className="px-3 py-1.5 text-center">
                    {it.joined === true ? <span className="text-emerald-600">✓</span> : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sticky bottom-0 mt-3 bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
        <div className="text-xs text-gray-700 flex items-center gap-2">
          <Users size={12} />
          Выбрано: <strong>{selected.size}</strong> · вариантов: <strong>{variants.length}</strong> ·
          jobs будет создано: <strong>{selected.size * variants.length}</strong>
        </div>
        <button
          onClick={queueJobs}
          disabled={!selected.size || !variants.length || queueing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700 disabled:opacity-40"
        >
          <Send size={12} /> {queueing ? 'Постановка…' : 'Поставить в очередь'}
        </button>
      </div>
    </div>
  );
}

// ─── Mailing Tab ─────────────────────────────────────────────────────
function MailingTab({ jobs, variants }: { jobs: MailingJob[]; variants: AdVariant[] }) {
  const variantById = useMemo(() => {
    const m = new Map<string, AdVariant>();
    for (const v of variants) m.set(v.id, v);
    return m;
  }, [variants]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { queued: 0, sent: 0, failed: 0, skipped: 0 };
    for (const j of jobs) c[j.status as string] = (c[j.status as string] ?? 0) + 1;
    return c;
  }, [jobs]);

  return (
    <div className="max-w-7xl space-y-3">
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(JOB_STATUS_LABELS).map(([k, v]) => (
          <div key={k} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">{v.label}</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{counts[k] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900">
        Очередь видна сразу. Отправляет фоновый демон — мы из CRM ничего не шлём напрямую.
        Если нужно паузу — снизь статус кампании на «Пауза» (демон уважает campaign.status).
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {jobs.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-12">
            Очередь пуста. На вкладке «Каналы-цели» выбери группы и жми «Поставить в очередь».
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                <th className="px-3 py-2 w-12">Вариант</th>
                <th className="px-3 py-2">Цель</th>
                <th className="px-3 py-2 w-24">Тип</th>
                <th className="px-3 py-2 w-28">Статус</th>
                <th className="px-3 py-2 w-32">Запланировано</th>
                <th className="px-3 py-2 w-32">Отправлено</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((j) => {
                const v = j.variant_id ? variantById.get(j.variant_id) : null;
                const sm = JOB_STATUS_LABELS[j.status ?? 'queued'] ?? JOB_STATUS_LABELS.queued;
                return (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 text-[11px] font-bold rounded">{v?.label ?? '?'}</span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-800 break-all">{j.target ?? '—'}</td>
                    <td className="px-3 py-1.5 text-gray-700">{j.target_kind ?? '—'}</td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${sm.color}`}>{sm.label}</span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-700">{j.scheduled_at ? `${fmtMsk(j.scheduled_at, true)} МСК` : '—'}</td>
                    <td className="px-3 py-1.5 text-gray-700">{j.posted_at ? `${fmtMsk(j.posted_at, true)} МСК` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Analytics Tab ─────────────────────────────────────────────────────
function AnalyticsTab({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<AnalyticsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const j = await safeFetchJson<AnalyticsResp>(`/api/recruit/campaigns/${campaignId}/analytics`);
      setData(j); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [campaignId]);
  useEffect(() => { reload(); }, [reload]);

  if (loading) return <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>;
  if (error) return <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>;
  if (!data) return null;

  const maxLeads = Math.max(1, ...data.variants.map((v) => v.leads));

  return (
    <div className="max-w-6xl space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <TotalCard label="Вариантов" value={data.totals.variants} />
        <TotalCard label="Jobs всего" value={data.totals.jobs} hint={`отправлено ${data.totals.sent}`} />
        <TotalCard label="Лидов всего" value={data.totals.leads} hint="contacts.source = utm" />
        <TotalCard label="В очереди" value={data.totals.queued} hint={`ошибок ${data.totals.failed}`} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 text-[12px] font-medium text-gray-900">A/B сравнение</div>
        {data.variants.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Нет вариантов.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50/60 border-b border-gray-100">
              <tr className="text-left text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                <th className="px-3 py-2 w-16">Метка</th>
                <th className="px-3 py-2">UTM</th>
                <th className="px-3 py-2 w-24 text-right">Отправлено</th>
                <th className="px-3 py-2 w-24 text-right">Лиды</th>
                <th className="px-3 py-2 w-32 text-right">Конверсия</th>
                <th className="px-3 py-2">Лиды (визуал)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.variants.map((v) => {
                const winner = data.winner_variant_id === v.id;
                return (
                  <tr key={v.id} className={winner ? 'bg-emerald-50/40' : ''}>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-[11px] font-bold rounded">{v.label ?? '?'}</span>
                        {winner && <Award size={12} className="text-emerald-600" />}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700">{v.utm ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(v.sent_count)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(v.leads)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {v.sent_count > 0 ? `${(v.conv * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-2 bg-gray-100 rounded overflow-hidden">
                        <div className={`h-full ${winner ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${(v.leads / maxLeads) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data.by_channel.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 text-[12px] font-medium text-gray-900">Топ-20 каналов по jobs</div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50/60 border-b border-gray-100">
              <tr className="text-left text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                <th className="px-3 py-2">Цель</th>
                <th className="px-3 py-2 w-20 text-right">Всего</th>
                <th className="px-3 py-2 w-20 text-right">Отправ.</th>
                <th className="px-3 py-2 w-20 text-right">Ошибок</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.by_channel.map((c) => (
                <tr key={c.target} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono text-gray-800 break-all">{c.target}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{c.total}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">{c.sent}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-red-600">{c.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TotalCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}
