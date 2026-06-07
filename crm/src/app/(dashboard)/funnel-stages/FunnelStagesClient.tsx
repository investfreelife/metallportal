'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KanbanSquare,
  RefreshCw,
  AlertTriangle,
  Clock,
  Lock,
  ArrowRight,
  Calendar,
  AlertCircle,
  UserPlus,
  X,
  Move,
  GripVertical,
  Pencil,
  Check,
} from 'lucide-react';
import { safeFetchJson } from '@/lib/safe-fetch';
import {
  STAGE_ORDER, STAGE_LABELS, STAGE_COLORS,
  isActiveStage,
  type FunnelContact, type FunnelStage,
} from '@/lib/recruit/stages';
import { fmtMsk, toMskInputValue, mskInputToUTC } from '@/lib/tz';
import AddCandidateModal from '../funnel/AddCandidateModal';

interface RedPanel {
  missing_next_touch: string[];
  agreed_over_4h: string[];
  promise_overdue: string[];
  new_no_reply: string[];
}

interface Resp {
  contacts: FunnelContact[];
  red: RedPanel;
  summary: Record<string, number>;
  period?: { key: string; from: string | null; to: string | null };
  total?: number;
  total_all?: number;
  total_spam?: number;
}

// ТЗ-077: фильтр периода
type PeriodKey = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';
const PERIOD_OPTIONS: Array<{ v: PeriodKey; label: string }> = [
  { v: 'today',  label: 'Сегодня' },
  { v: 'week',   label: 'Неделя' },
  { v: 'month',  label: 'Месяц' },
  { v: 'year',   label: 'Год' },
  { v: 'all',    label: 'Всё' },
  { v: 'custom', label: 'Период…' },
];

interface Props { tenantName: string | null }

const POLL_MS = 60_000;

export default function FunnelStagesClient({ tenantName }: Props) {
  const [resp, setResp] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<keyof RedPanel | null>(null);
  const [editing, setEditing] = useState<FunnelContact | null>(null);
  const [adding, setAdding] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Drag-and-drop состояние: {id, fromStage}
  const [dragging, setDragging] = useState<{ id: string; fromStage: FunnelStage } | null>(null);
  const [dragOverStage, setDragOverStage] = useState<FunnelStage | null>(null);
  // ТЗ-077: фильтр периода + кастомные даты
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  function scrollBy(dx: number) {
    scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' });
  }

  async function handleDrop(toStage: FunnelStage) {
    if (!dragging || dragging.fromStage === toStage) {
      setDragging(null); setDragOverStage(null); return;
    }
    // canMoveTo() убран — в реальной работе кандидаты ходят туда-сюда (agreed→engaged,
    // engaged→qualified когда уточняем и т.д.). Запрет мешал, фриктион на drag-drop
    // не нужен. Замок 🔒 остаётся — это важная защита от случайных тыков.
    const card = resp?.contacts.find((c) => c.id === dragging.id);
    if (card && (dragging.fromStage === 'scheduled' || dragging.fromStage === 'online' || card.human_locked)) {
      const yes = confirm(`Карточка под замком (${dragging.fromStage}). Точно перенести в «${toStage}»?`);
      if (!yes) { setDragging(null); setDragOverStage(null); return; }
    }
    await patchContact(dragging.id, { stage: toStage });
    setDragging(null); setDragOverStage(null);
  }

  const reload = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const sp = new URLSearchParams();
      if (period === 'custom') {
        if (customFrom) sp.set('from', new Date(customFrom).toISOString());
        if (customTo) sp.set('to', new Date(customTo).toISOString());
      } else {
        sp.set('period', period);
      }
      const j = await safeFetchJson<Resp>(`/api/recruit/funnel-stages?${sp.toString()}`);
      setResp(j); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); setRefreshing(false); }
  }, [period, customFrom, customTo]);
  useEffect(() => {
    reload();
    const id = setInterval(() => reload(true), POLL_MS);
    return () => clearInterval(id);
  }, [reload]);

  const grouped = useMemo(() => {
    const m = new Map<string, FunnelContact[]>();
    for (const s of STAGE_ORDER) m.set(s, []);
    for (const c of resp?.contacts ?? []) {
      const s = (c.stage as string) || 'new';
      const arr = m.get(s) ?? [];
      arr.push(c);
      m.set(s, arr);
    }
    return m;
  }, [resp]);

  async function patchContact(id: string, patch: Partial<FunnelContact>) {
    try {
      await safeFetchJson('/api/recruit/funnel-stages', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      await reload(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <KanbanSquare size={20} className="text-gray-600" />
            🔻 Воронка{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Стадии new → online → retained · спам/тесты исключены · период: <strong>{PERIOD_OPTIONS.find((p) => p.v === period)?.label}</strong>
            {resp?.total != null && <> · <strong className="text-blue-700">{resp.total}</strong> лидов</>}
            {resp?.total_spam != null && resp.total_spam > 0 && <> <span className="text-rose-600">· 🚫 {resp.total_spam} спам/тест</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ТЗ-077: переключатель периода */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md p-0.5">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.v}
                onClick={() => setPeriod(p.v)}
                className={`px-2 py-1 text-[11px] font-medium rounded ${
                  period === p.v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => reload()}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Обновить
          </button>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700"
          >
            <UserPlus size={12} />
            Добавить кандидата
          </button>
        </div>
      </header>

      {/* ТЗ-077: кастомный date-range picker — появляется при period='custom' */}
      {period === 'custom' && (
        <div className="px-6 py-2 bg-blue-50/40 border-b border-blue-100 flex items-center gap-2 text-xs">
          <span className="text-gray-600">Период:</span>
          <label className="flex items-center gap-1">
            от <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-1.5 py-0.5 border border-gray-300 rounded" />
          </label>
          <label className="flex items-center gap-1">
            до <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-1.5 py-0.5 border border-gray-300 rounded" />
          </label>
          <button onClick={() => reload()} className="px-2 py-0.5 bg-blue-600 text-white rounded text-[11px]">Применить</button>
          <button onClick={() => { setCustomFrom(''); setCustomTo(''); setPeriod('month'); }} className="px-2 py-0.5 text-gray-500 hover:underline text-[11px]">Сбросить</button>
        </div>
      )}

      {/* ── Красная панель ─────────────────────────────────────────── */}
      {resp && (
        <RedPanelStrip
          red={resp.red}
          contacts={resp.contacts}
          expanded={expanded}
          onToggle={(k) => setExpanded(expanded === k ? null : k)}
          onOpen={(c) => setEditing(c)}
        />
      )}

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Канбан + кнопки прокрутки ───────────────────────── */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {/* Floating ◀ ▶ — фолбэк на случай если webkit скроллбар спрятался */}
        {!loading && (
          <>
            <button
              onClick={() => scrollBy(-360)}
              title="Прокрутить влево"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white border border-gray-300 shadow-lg rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:scale-105 active:scale-95 transition"
            >
              ◀
            </button>
            <button
              onClick={() => scrollBy(360)}
              title="Прокрутить вправо"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white border border-gray-300 shadow-lg rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:scale-105 active:scale-95 transition"
            >
              ▶
            </button>
          </>
        )}
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>
        ) : (
          // hscroll: видимый горизонтальный ползунок (см. globals.css). Task 059/063+1.
          <div ref={scrollRef} className="hscroll flex-1 overflow-y-hidden p-4 pb-2">
            <div className="flex gap-3 min-w-max h-full">
              {STAGE_ORDER.map((s) => (
                <StageColumn
                  key={s}
                  stage={s}
                  contacts={grouped.get(s) ?? []}
                  onOpen={(c) => setEditing(c)}
                  onMove={(c, to) => patchContact(c.id, { stage: to })}
                  onDelete={(c) => patchContact(c.id, { stage: 'lost' as FunnelStage })}
                  onPatch={(id, patch) => patchContact(id, patch)}
                  dragging={dragging}
                  isDragOver={dragOverStage === s}
                  onDragStart={(id, fromStage) => setDragging({ id, fromStage })}
                  onDragEnd={() => { setDragging(null); setDragOverStage(null); }}
                  onDragOverColumn={(over) => setDragOverStage(over ? s : null)}
                  onDropColumn={() => handleDrop(s)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EditDrawer
          contact={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await patchContact(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
      {adding && (
        <AddCandidateModal
          onClose={() => setAdding(false)}
          onAdded={async () => {
            setAdding(false);
            await reload(true);
          }}
        />
      )}
    </div>
  );
}

/* ─── Красная панель ────────────────────────────────────────────── */

function RedPanelStrip({
  red, contacts, expanded, onToggle, onOpen,
}: {
  red: RedPanel;
  contacts: FunnelContact[];
  expanded: keyof RedPanel | null;
  onToggle: (k: keyof RedPanel) => void;
  onOpen: (c: FunnelContact) => void;
}) {
  const total = red.missing_next_touch.length + red.agreed_over_4h.length
              + red.promise_overdue.length + red.new_no_reply.length;
  if (!total) return null;

  const byId = new Map(contacts.map((c) => [c.id, c]));
  const tile = (key: keyof RedPanel, label: string, icon: React.ReactNode, count: number) => (
    <button
      key={key}
      onClick={() => onToggle(key)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border ${
        expanded === key
          ? 'bg-red-600 text-white border-red-700'
          : count > 0 ? 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100' : 'bg-gray-50 text-gray-500 border-gray-200'
      }`}
    >
      {icon} {label} <span className="font-bold">{count}</span>
    </button>
  );

  const expandedList = expanded ? red[expanded].map((id) => byId.get(id)).filter((x): x is FunnelContact => !!x) : [];

  return (
    <div className="mx-6 mt-3 mb-1 bg-red-50/40 border border-red-200 rounded-md px-3 py-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <AlertTriangle size={14} className="text-red-700 flex-shrink-0" />
        <span className="text-xs font-semibold text-red-800">🔴 Красная панель</span>
        <div className="flex-1" />
        {tile('missing_next_touch', 'без касания', <Clock size={11} />, red.missing_next_touch.length)}
        {tile('agreed_over_4h', 'agreed 4ч+', <AlertTriangle size={11} />, red.agreed_over_4h.length)}
        {tile('promise_overdue', 'обещание 24ч+', <Calendar size={11} />, red.promise_overdue.length)}
        {tile('new_no_reply', 'new без ответа', <AlertCircle size={11} />, red.new_no_reply.length)}
      </div>
      {expanded && expandedList.length > 0 && (
        <ul className="bg-white border border-red-200 rounded divide-y divide-red-100 max-h-64 overflow-y-auto">
          {expandedList.map((c) => (
            <li key={c.id} className="px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-red-50">
              <span className={`inline-block px-1.5 py-0 text-[10px] rounded border ${STAGE_COLORS[(c.stage as FunnelStage) ?? 'new']}`}>
                {STAGE_LABELS[(c.stage as FunnelStage) ?? 'new']}
              </span>
              <span className="flex-1 truncate text-gray-900 font-medium">
                {c.full_name ?? c.telegram_chat_id ?? '—'}
              </span>
              <button
                onClick={() => onOpen(c)}
                className="text-[10px] text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5"
              >
                Открыть <ArrowRight size={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── Колонка стадии ───────────────────────────────────────────── */

function StageColumn({
  stage, contacts, onOpen, onMove, onDelete, onPatch,
  dragging, isDragOver, onDragStart, onDragEnd, onDragOverColumn, onDropColumn,
}: {
  stage: FunnelStage;
  contacts: FunnelContact[];
  onOpen: (c: FunnelContact) => void;
  onMove: (c: FunnelContact, to: FunnelStage) => void;
  onDelete: (c: FunnelContact) => void;
  onPatch: (id: string, patch: Partial<FunnelContact>) => Promise<void> | void;
  dragging: { id: string; fromStage: FunnelStage } | null;
  isDragOver: boolean;
  onDragStart: (id: string, fromStage: FunnelStage) => void;
  onDragEnd: () => void;
  onDragOverColumn: (over: boolean) => void;
  onDropColumn: () => void;
}) {
  const dragActive = !!dragging && dragging.fromStage !== stage;
  return (
    <div
      onDragOver={(e) => { if (dragActive) { e.preventDefault(); onDragOverColumn(true); } }}
      onDragLeave={() => onDragOverColumn(false)}
      onDrop={(e) => { if (dragActive) { e.preventDefault(); onDropColumn(); } }}
      className={`w-72 flex-shrink-0 flex flex-col bg-white border rounded-md overflow-hidden transition-colors ${
        isDragOver ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-300' : 'border-gray-200'
      }`}
    >
      <header className="px-3 py-2 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-semibold ${STAGE_COLORS[stage]}`}>
          {STAGE_LABELS[stage]}
        </span>
        <span className="text-[10px] text-gray-500">{contacts.length}</span>
      </header>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-260px)]">
        {contacts.length === 0 ? (
          <p className={`text-[10px] text-center py-4 ${isDragOver ? 'text-blue-600 font-medium' : 'text-gray-300'}`}>
            {isDragOver ? '↓ отпусти, чтобы перенести' : 'Пусто'}
          </p>
        ) : contacts.map((c) => (
          <ContactCard key={c.id} c={c}
            onOpen={() => onOpen(c)}
            onMove={(to) => onMove(c, to)}
            onDelete={() => onDelete(c)}
            onPatch={onPatch}
            onDragStart={() => onDragStart(c.id, stage)}
            onDragEnd={onDragEnd} />
        ))}
      </div>
    </div>
  );
}

/** Варианты сегмента кандидата — соответствуют entry_segment из бота
 *  (см. memory taksopark_audience_and_group_rules). */
const SEGMENT_OPTIONS = [
  { v: 'priezzhiy', label: '🟠 Приезжий' },
  { v: 'mestnyy',   label: '🟢 Местный' },
  { v: 'novichok',  label: '🟡 Новичок' },
  { v: 'referral',  label: '🔵 Реферал' },
  { v: 'other',     label: '⚪ Другой' },
];

function ContactCard({
  c, onOpen, onMove, onDelete, onPatch, onDragStart, onDragEnd,
}: {
  c: FunnelContact;
  onOpen: () => void;
  onMove: (to: FunnelStage) => void;
  onDelete: () => void;
  onPatch: (id: string, patch: Partial<FunnelContact>) => Promise<void> | void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const overdue = isActiveStage(c.stage as string) && !c.next_touch_at;
  const currentStage = (c.stage as FunnelStage) ?? 'new';
  const locked = currentStage === 'scheduled' || currentStage === 'online' || c.human_locked;

  // Локальные поля inline-квалификации
  const [segment, setSegment] = useState<string>(c.segment ?? '');
  const [city, setCity] = useState<string>(c.city ?? '');
  const [hasCarStr, setHasCarStr] = useState<string>(
    c.has_car === true ? 'yes' : c.has_car === false ? 'no' : ''
  );

  async function saveQualification() {
    const patch: Partial<FunnelContact> = {
      segment: segment.trim() || null,
      city: city.trim() || null,
      has_car: hasCarStr === 'yes' ? true : hasCarStr === 'no' ? false : null,
    };
    await onPatch(c.id, patch);
    setEditing(false);
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        // Setting data so external drop zones don't interfere; payload via state.
        try { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; } catch {}
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`relative bg-white border rounded p-2 transition-all ${
        overdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
      } hover:border-blue-300 hover:shadow-sm cursor-grab active:cursor-grabbing`}
      title="Перетащи в другую колонку"
    >
      {/* Drag-handle полоска сверху + кнопки действий */}
      <div className="absolute top-1 right-1 flex gap-0.5 items-center z-10">
        <button
          onClick={(e) => { e.stopPropagation(); setEditing((v) => !v); }}
          title={editing ? 'Закрыть редактирование' : 'Квалификация (сегмент/город/авто)'}
          className={`p-1 rounded ${editing ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
        >
          <Pencil size={10} />
        </button>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            title="Перенести в стадию…"
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
          >
            <Move size={10} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-0.5 z-20 bg-white border border-gray-200 rounded shadow-lg min-w-[150px]"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <div className="px-2 py-1 text-[10px] text-gray-500 border-b border-gray-100">Перенести в…</div>
              {STAGE_ORDER.filter((s) => s !== currentStage).map((s) => {
                const isBack = STAGE_ORDER.indexOf(s) < STAGE_ORDER.indexOf(currentStage);
                return (
                  <button
                    key={s}
                    onClick={() => {
                      setMenuOpen(false);
                      if (locked && !confirm(`Карточка под замком (${STAGE_LABELS[currentStage]}). Точно переносим в «${STAGE_LABELS[s]}»?`)) return;
                      onMove(s);
                    }}
                    className="w-full text-left px-2 py-1 text-[11px] hover:bg-blue-50 text-gray-800"
                  >
                    {STAGE_LABELS[s]}
                    {isBack && <span className="text-[9px] ml-1 text-gray-400">↩</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const ok = confirm(
              locked
                ? `Карточка под замком (${STAGE_LABELS[currentStage]}). Удалить из активной воронки (→ потерян)?`
                : 'Удалить кандидата из активной воронки? Карточка переедет в «❌ Потерян», не удалится физически.'
            );
            if (ok) onDelete();
          }}
          title="Удалить из воронки (→ потерян)"
          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
        >
          <X size={11} />
        </button>
      </div>

      {/* Имя + drag-handle + lock-индикатор */}
      <div className="flex items-start gap-1.5 mb-1 pr-20">
        <GripVertical size={11} className="text-gray-300 flex-shrink-0 mt-0.5" />
        <button onClick={onOpen} className="text-xs font-medium text-gray-900 truncate flex-1 text-left hover:underline">
          {c.full_name ?? c.telegram_chat_id ?? '—'}
        </button>
        {c.human_locked && <Lock size={10} className="text-amber-600 flex-shrink-0 mt-0.5" />}
      </div>

      {/* Inline-квалификация (раскрывается по карандашу) */}
      {editing ? (
        <div className="space-y-1.5 my-1.5 p-2 bg-emerald-50/50 border border-emerald-200 rounded">
          <div>
            <label className="text-[9px] text-gray-500 uppercase tracking-wide block">Сегмент</label>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="w-full px-1.5 py-0.5 text-[11px] border border-gray-200 rounded bg-white"
            >
              <option value="">—</option>
              {SEGMENT_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] text-gray-500 uppercase tracking-wide block">Город</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Москва / …"
                className="w-full px-1.5 py-0.5 text-[11px] border border-gray-200 rounded bg-white"
              />
            </div>
            <div>
              <label className="text-[9px] text-gray-500 uppercase tracking-wide block">Авто</label>
              <select
                value={hasCarStr}
                onChange={(e) => setHasCarStr(e.target.value)}
                className="w-full px-1.5 py-0.5 text-[11px] border border-gray-200 rounded bg-white"
              >
                <option value="">—</option>
                <option value="yes">🚗 есть</option>
                <option value="no">🚲 нет</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-1 pt-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(false); setSegment(c.segment ?? ''); setCity(c.city ?? ''); setHasCarStr(c.has_car === true ? 'yes' : c.has_car === false ? 'no' : ''); }}
              className="px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100 rounded"
            >
              Отмена
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); saveQualification(); }}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-emerald-600 text-white rounded hover:bg-emerald-700"
            >
              <Check size={9} /> Сохранить
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1 flex-wrap">
          {c.segment && <span className="px-1 py-0 bg-gray-100 rounded">{c.segment}</span>}
          {c.city && <span>📍 {c.city}</span>}
          {typeof c.has_car === 'boolean' && <span>{c.has_car ? '🚗' : '🚲'}</span>}
        </div>
      )}

      {c.last_text && !editing && (
        <p className="text-[10px] text-gray-600 line-clamp-2 leading-snug mb-1">{c.last_text}</p>
      )}
      <div className="flex items-center justify-between text-[10px] mt-1.5 pt-1.5 border-t border-gray-100">
        {c.next_touch_at ? (
          <span className="text-blue-700 inline-flex items-center gap-0.5"><Clock size={9} />{fmtMsk(c.next_touch_at, false)}</span>
        ) : overdue ? (
          <span className="text-red-700 font-semibold">⚠ нет касания</span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
        <span className="text-gray-400">{c.last_at ? fmtMsk(c.last_at, false) : ''}</span>
      </div>
    </div>
  );
}

/* ─── Drawer редактирования ────────────────────────────────────── */

function EditDrawer({
  contact, onClose, onSave,
}: {
  contact: FunnelContact;
  onClose: () => void;
  onSave: (patch: Partial<FunnelContact>) => Promise<void>;
}) {
  const [stage, setStage] = useState<FunnelStage>((contact.stage as FunnelStage) ?? 'new');
  const [nextTouch, setNextTouch] = useState<string>(
    contact.next_touch_at ? toMskInputValue(contact.next_touch_at) : ''
  );
  const [city, setCity] = useState(contact.city ?? '');
  const [segment, setSegment] = useState(contact.segment ?? '');
  const [hasCarStr, setHasCarStr] = useState(
    contact.has_car === true ? 'yes' : contact.has_car === false ? 'no' : ''
  );
  const [readyDate, setReadyDate] = useState(contact.ready_date ?? '');
  const [lostReason, setLostReason] = useState(contact.lost_reason ?? '');
  const [busy, setBusy] = useState(false);

  // canMoveTo больше не используется — все стадии доступны (см. handleDrop коммент).
  const allowedStages = STAGE_ORDER;

  async function save() {
    setBusy(true);
    try {
      const patch: Partial<FunnelContact> = { stage };
      if (nextTouch) patch.next_touch_at = mskInputToUTC(nextTouch) || null;
      else patch.next_touch_at = null;
      if (city.trim() !== (contact.city ?? '').trim()) patch.city = city.trim() || null;
      if (segment.trim() !== (contact.segment ?? '').trim()) patch.segment = segment.trim() || null;
      patch.has_car = hasCarStr === 'yes' ? true : hasCarStr === 'no' ? false : null;
      if (readyDate) patch.ready_date = readyDate;
      if (lostReason.trim()) patch.lost_reason = lostReason.trim();
      await onSave(patch);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md shadow-2xl flex flex-col">
        <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2">
            {contact.human_locked && <Lock size={13} className="text-amber-600" />}
            {contact.full_name ?? contact.telegram_chat_id ?? '—'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-lg leading-none">×</button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-xs">
          {contact.human_locked && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded px-2.5 py-2 text-[11px]">
              🔒 Карточка доведена руками — агенты её НЕ редактируют (см. human_locked).
            </div>
          )}
          <Field label="Стадия">
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as FunnelStage)}
              className="w-full px-2 py-1 border border-gray-200 rounded"
            >
              {allowedStages.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Когда касаться (МСК)">
            <input
              type="datetime-local"
              value={nextTouch}
              onChange={(e) => setNextTouch(e.target.value)}
              className="w-full px-2 py-1 border border-gray-200 rounded"
            />
          </Field>
          <Field label="Сегмент">
            <input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="приезжий / местный / молодёжь / …"
              className="w-full px-2 py-1 border border-gray-200 rounded" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Город">
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва / Бишкек / …"
                className="w-full px-2 py-1 border border-gray-200 rounded" />
            </Field>
            <Field label="Авто">
              <select value={hasCarStr} onChange={(e) => setHasCarStr(e.target.value)} className="w-full px-2 py-1 border border-gray-200 rounded">
                <option value="">—</option>
                <option value="yes">да, есть</option>
                <option value="no">нет</option>
              </select>
            </Field>
          </div>
          <Field label="Дата готовности к старту">
            <input type="date" value={readyDate} onChange={(e) => setReadyDate(e.target.value)}
              className="w-full px-2 py-1 border border-gray-200 rounded" />
          </Field>
          {stage === 'lost' && (
            <Field label="Причина потери">
              <input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="не отвечает / нашёл другой парк / …"
                className="w-full px-2 py-1 border border-gray-200 rounded" />
            </Field>
          )}
          {Array.isArray(contact.objections) && contact.objections.length > 0 && (
            <Field label="Возражения">
              <ul className="space-y-1">
                {contact.objections.map((o, i) => (
                  <li key={i} className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[11px]">
                    {String((o as Record<string, unknown>).text ?? JSON.stringify(o))}
                  </li>
                ))}
              </ul>
            </Field>
          )}
          {Array.isArray(contact.promises) && contact.promises.length > 0 && (
            <Field label="Обещания">
              <ul className="space-y-1">
                {contact.promises.map((p, i) => {
                  const o = p as Record<string, unknown>;
                  return (
                    <li key={i} className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[11px] flex items-center gap-1.5">
                      <span className="flex-1">{String(o.text ?? JSON.stringify(p))}</span>
                      <span className={`text-[9px] px-1 py-0 rounded ${o.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {String(o.status ?? 'open')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Field>
          )}
        </div>
        <footer className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 rounded-md">Отмена</button>
          <button onClick={save} disabled={busy}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
            {busy ? 'Сохранение…' : 'Сохранить'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
      {children}
    </div>
  );
}
