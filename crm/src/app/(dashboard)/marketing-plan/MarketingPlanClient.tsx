'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ListChecks, Plus, Sparkles, Trash2, ExternalLink, AlertCircle, X } from 'lucide-react';
import type { MarketingTheme, MarketingThemeStatus } from '@/lib/marketing-plan/types';
import { MARKETING_THEME_STATUS_LABELS, MARKETING_THEME_STATUS_COLORS, groupBySegment } from '@/lib/marketing-plan/types';
import { safeFetchJson } from '@/lib/safe-fetch';

interface Props {
  initialThemes: MarketingTheme[];
  tenantName: string | null;
}

const STATUSES: MarketingThemeStatus[] = ['draft', 'active', 'paused', 'done'];

/**
 * /marketing-plan — Маркетинг-план (кампании-сегменты как «темы»).
 *
 * Task 050 (sergey-coder, taksopark-machine): копия /content-plan с заменой
 * источника на campaigns. UI идентичен — фильтры по статусу, группировка по
 * сегменту, кнопки «Раскрыть в пост» / «Открыть пост» / «Удалить».
 *
 * «Раскрыть в пост» создаёт новый ad_variants черновик в этой кампании
 * (через POST /api/marketing-plan/posts) — в Контенте это делает expand.
 */
export default function MarketingPlanClient({ initialThemes, tenantName }: Props) {
  const router = useRouter();
  const [themes, setThemes] = useState<MarketingTheme[]>(initialThemes);
  const [statusFilter, setStatusFilter] = useState<MarketingThemeStatus | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(
    () => (statusFilter === 'all' ? themes : themes.filter((t) => t.status === statusFilter)),
    [themes, statusFilter]
  );

  const grouped = useMemo(() => groupBySegment(filtered), [filtered]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: themes.length };
    for (const s of STATUSES) c[s] = themes.filter((t) => t.status === s).length;
    return c;
  }, [themes]);

  async function refresh() {
    try {
      const j = await safeFetchJson<{ themes: MarketingTheme[] }>('/api/marketing-plan/themes');
      if (j.themes) setThemes(j.themes);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function expand(t: MarketingTheme) {
    setBusyId(t.id); setError(null);
    try {
      // Создаём черновик ad_variants в этой кампании. В Контенте expand делал
      // больше работы — мы создаём минимальную «болванку», мозг доработает.
      await safeFetchJson('/api/marketing-plan/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: t.id,
          label: t.name,
          text: t.portrait || null,
        }),
      });
      // Помечаем кампанию как active, если ещё draft.
      if (t.status === 'draft') {
        await safeFetchJson(`/api/marketing-plan/themes/${t.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        });
      }
      await refresh();
      router.push('/marketing-planner');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  function openPlanner() {
    router.push('/marketing-planner');
  }

  async function setStatus(t: MarketingTheme, s: MarketingThemeStatus) {
    setBusyId(t.id);
    try {
      await safeFetchJson(`/api/marketing-plan/themes/${t.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: s }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusyId(null); }
  }

  async function remove(t: MarketingTheme) {
    if (!confirm(`Удалить кампанию «${t.name}»?`)) return;
    setBusyId(t.id);
    try {
      await safeFetchJson(`/api/marketing-plan/themes/${t.id}`, { method: 'DELETE' });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusyId(null); }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ListChecks size={20} className="text-gray-600" />
            Маркетинг-план
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Стратегия маркетинга{tenantName ? ` · ${tenantName}` : ''} — кампании-сегменты, сгруппированы по сегменту ЦА
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          <Plus size={14} />
          Добавить кампанию
        </button>
      </header>

      {/* ── Фильтр статусов ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-100">
        <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
          Все ({counts.all ?? 0})
        </FilterButton>
        {STATUSES.map((s) => (
          <FilterButton key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
            {MARKETING_THEME_STATUS_LABELS[s]} ({counts[s] ?? 0})
          </FilterButton>
        ))}
      </div>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Кампании по сегментам ───────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 space-y-5">
        {grouped.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">
            Кампаний нет — добавь первую кнопкой «Добавить кампанию».
          </p>
        )}
        {grouped.map(([segment, items]) => (
          <section key={segment}>
            <div className="flex items-baseline gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-900">{segment}</h2>
              <span className="text-[11px] text-gray-500">{items.length} кампаний</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((t) => (
                <ThemeCard
                  key={t.id}
                  theme={t}
                  busy={busyId === t.id}
                  onExpand={() => expand(t)}
                  onOpenPost={openPlanner}
                  onSetStatus={(s) => setStatus(t, s)}
                  onRemove={() => remove(t)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {creating && (
        <CreateThemeModal
          onClose={() => setCreating(false)}
          onCreated={async () => { setCreating(false); await refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────
function ThemeCard({
  theme, busy, onExpand, onOpenPost, onSetStatus, onRemove,
}: {
  theme: MarketingTheme;
  busy: boolean;
  onExpand: () => void;
  onOpenPost: () => void;
  onSetStatus: (s: MarketingThemeStatus) => void;
  onRemove: () => void;
}) {
  const status = (theme.status as MarketingThemeStatus) ?? 'draft';
  const isActive = status === 'active';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col gap-2 hover:border-blue-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900 leading-snug flex-1">{theme.name}</h3>
        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${MARKETING_THEME_STATUS_COLORS[status]}`}>
          {MARKETING_THEME_STATUS_LABELS[status]}
        </span>
      </div>
      {theme.portrait && (
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{theme.portrait}</p>
      )}
      {theme.seg_order != null && (
        <div className="text-[10px] text-gray-400">Сегмент #{theme.seg_order}</div>
      )}
      <div className="border-t border-gray-100 pt-2 flex items-center gap-1.5 mt-auto">
        {isActive ? (
          <button
            onClick={onOpenPost}
            disabled={busy}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-40"
            title="Открыть в Маркетинг-планировщике"
          >
            <ExternalLink size={11} />
            Открыть посты
          </button>
        ) : (
          <button
            onClick={onExpand}
            disabled={busy}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
          >
            <Sparkles size={11} />
            Раскрыть в пост
          </button>
        )}
        <div className="flex-1" />
        {status !== 'paused' && status !== 'done' && (
          <button
            onClick={() => onSetStatus('paused')}
            disabled={busy}
            className="px-1.5 py-1 text-[10px] text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded"
            title="Поставить на паузу"
          >
            ⏸
          </button>
        )}
        <button
          onClick={onRemove}
          disabled={busy}
          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
          title="Удалить"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
        active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Add-campaign modal ────────────────────────────────────────────────
function CreateThemeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void | Promise<void> }) {
  const [segment, setSegment] = useState('');
  const [name, setName] = useState('');
  const [portrait, setPortrait] = useState('');
  const [segOrder, setSegOrder] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true); setError(null);
    try {
      await safeFetchJson('/api/marketing-plan/themes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          segment: segment.trim() || undefined,
          portrait: portrait.trim() || undefined,
          seg_order: segOrder === '' ? undefined : Number(segOrder),
        }),
      });
      await onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md">
        <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Новая кампания</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </header>
        <div className="px-4 py-4 space-y-3">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</div>}
          <Field label="Сегмент ЦА">
            <input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="🟢 В Москве, местный / 🟠 Приезжий с регионов / …"
                   className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none" />
          </Field>
          <Field label="Название кампании" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Короткое имя"
                   className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none" />
          </Field>
          <Field label="Портрет / тезисы (опц.)">
            <textarea value={portrait} onChange={(e) => setPortrait(e.target.value)} rows={4}
                      placeholder="Что показать, под кого, какой угол"
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none resize-y" />
          </Field>
          <Field label="Порядок сегмента (опц.)">
            <input type="number" value={segOrder} onChange={(e) => setSegOrder(e.target.value === '' ? '' : Number(e.target.value))}
                   placeholder="Чем меньше — тем выше"
                   className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none" />
          </Field>
        </div>
        <footer className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 rounded-md">Отмена</button>
          <button onClick={submit} disabled={saving || !name.trim()}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
            {saving ? 'Сохранение…' : 'Создать кампанию'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
