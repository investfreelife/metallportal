'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ListChecks, Plus, Sparkles, Trash2, ExternalLink, AlertCircle, X } from 'lucide-react';
import type { ContentTheme, ThemeStatus } from '@/lib/content/themes';
import { THEME_STATUS_LABELS, THEME_STATUS_COLORS, groupByRubric } from '@/lib/content/themes';

interface Props {
  initialThemes: ContentTheme[];
  tenantName: string | null;
}

const STATUSES: ThemeStatus[] = ['idea', 'drafted', 'rejected'];

export default function ContentPlanClient({ initialThemes, tenantName }: Props) {
  const router = useRouter();
  const [themes, setThemes] = useState<ContentTheme[]>(initialThemes);
  const [statusFilter, setStatusFilter] = useState<ThemeStatus | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(
    () => (statusFilter === 'all' ? themes : themes.filter((t) => t.status === statusFilter)),
    [themes, statusFilter]
  );

  const grouped = useMemo(() => groupByRubric(filtered), [filtered]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: themes.length };
    for (const s of STATUSES) c[s] = themes.filter((t) => t.status === s).length;
    return c;
  }, [themes]);

  async function refresh() {
    const r = await fetch('/api/content/themes');
    const j = await r.json();
    if (j.themes) setThemes(j.themes);
  }

  async function expand(t: ContentTheme) {
    setBusyId(t.id);
    setError(null);
    try {
      const r = await fetch(`/api/content/themes/${t.id}/expand`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'expand failed');
      await refresh();
      // Перенаправим в /content — пользователь сразу увидит новый черновик в «Ожидании».
      router.push('/content');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function openInContent(t: ContentTheme) {
    if (!t.post_id) return;
    router.push('/content');
  }

  async function setStatus(t: ContentTheme, s: ThemeStatus) {
    setBusyId(t.id);
    const r = await fetch(`/api/content/themes/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: s }),
    });
    setBusyId(null);
    if (r.ok) await refresh();
  }

  async function remove(t: ContentTheme) {
    if (!confirm(`Удалить тему «${t.title}»?`)) return;
    setBusyId(t.id);
    await fetch(`/api/content/themes/${t.id}`, { method: 'DELETE' });
    setBusyId(null);
    await refresh();
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ListChecks size={20} className="text-gray-600" />
            Контент-план
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Стратегия контента{tenantName ? ` · ${tenantName}` : ''} — темы для постов, сгруппированы по рубрикам
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          <Plus size={14} />
          Добавить тему
        </button>
      </header>

      {/* ── Фильтр статусов ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-100">
        <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
          Все ({counts.all ?? 0})
        </FilterButton>
        {STATUSES.map((s) => (
          <FilterButton key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
            {THEME_STATUS_LABELS[s]} ({counts[s] ?? 0})
          </FilterButton>
        ))}
      </div>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Темы по рубрикам ────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 space-y-5">
        {grouped.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">
            Тем нет — добавь идею кнопкой «Добавить тему».
          </p>
        )}
        {grouped.map(([rubric, items]) => (
          <section key={rubric}>
            <div className="flex items-baseline gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-900">{rubric}</h2>
              <span className="text-[11px] text-gray-500">{items.length} тем</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((t) => (
                <ThemeCard
                  key={t.id}
                  theme={t}
                  busy={busyId === t.id}
                  onExpand={() => expand(t)}
                  onOpenPost={() => openInContent(t)}
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
  theme: ContentTheme;
  busy: boolean;
  onExpand: () => void;
  onOpenPost: () => void;
  onSetStatus: (s: ThemeStatus) => void;
  onRemove: () => void;
}) {
  const status = (theme.status as ThemeStatus) ?? 'idea';
  const isDrafted = status === 'drafted' && theme.post_id;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col gap-2 hover:border-blue-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900 leading-snug flex-1">{theme.title}</h3>
        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${THEME_STATUS_COLORS[status]}`}>
          {THEME_STATUS_LABELS[status]}
        </span>
      </div>
      {theme.idea && (
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{theme.idea}</p>
      )}
      {theme.priority != null && (
        <div className="text-[10px] text-gray-400">Приоритет {theme.priority}</div>
      )}
      <div className="border-t border-gray-100 pt-2 flex items-center gap-1.5 mt-auto">
        {isDrafted ? (
          <button
            onClick={onOpenPost}
            disabled={busy}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-40"
            title="Открыть в Календаре"
          >
            <ExternalLink size={11} />
            Открыть пост
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
        {status !== 'rejected' && (
          <button
            onClick={() => onSetStatus('rejected')}
            disabled={busy}
            className="px-1.5 py-1 text-[10px] text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
            title="Отклонить"
          >
            ✕
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

// ─── Add-theme modal ───────────────────────────────────────────────────
function CreateThemeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void | Promise<void> }) {
  const [rubric, setRubric] = useState('');
  const [title, setTitle] = useState('');
  const [idea, setIdea] = useState('');
  const [priority, setPriority] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true); setError(null);
    try {
      const r = await fetch('/api/content/themes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rubric: rubric.trim(), title: title.trim(),
          idea: idea.trim() || undefined,
          priority: priority === '' ? undefined : Number(priority),
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'create failed');
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
          <h2 className="text-sm font-semibold text-gray-900">Новая тема</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </header>
        <div className="px-4 py-4 space-y-3">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</div>}
          <Field label="Рубрика" required>
            <input value={rubric} onChange={(e) => setRubric(e.target.value)} placeholder="🏠 Приезжим, 🔥 Деньги, ⚡ Старт …"
                   className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none" />
          </Field>
          <Field label="Заголовок темы" required>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Короткое имя темы"
                   className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none" />
          </Field>
          <Field label="Идея / тезисы (опц.)">
            <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={4}
                      placeholder="Что показать, какой угол подачи"
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none resize-y" />
          </Field>
          <Field label="Приоритет (число, опц.)">
            <input type="number" value={priority} onChange={(e) => setPriority(e.target.value === '' ? '' : Number(e.target.value))}
                   placeholder="Чем больше — тем выше"
                   className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none" />
          </Field>
        </div>
        <footer className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 rounded-md">Отмена</button>
          <button onClick={submit} disabled={saving || !rubric.trim() || !title.trim()}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
            {saving ? 'Сохранение…' : 'Создать тему'}
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
