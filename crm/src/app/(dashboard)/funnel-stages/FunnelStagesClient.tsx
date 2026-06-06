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
} from 'lucide-react';
import { safeFetchJson } from '@/lib/safe-fetch';
import {
  STAGE_ORDER, STAGE_LABELS, STAGE_COLORS,
  isActiveStage, canMoveTo,
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
}

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

  function scrollBy(dx: number) {
    scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' });
  }

  const reload = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const j = await safeFetchJson<Resp>('/api/recruit/funnel-stages');
      setResp(j); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
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
            Стадии new → online → retained, красная панель просрочек. Обновление каждую минуту.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
  stage, contacts, onOpen, onMove, onDelete,
}: {
  stage: FunnelStage;
  contacts: FunnelContact[];
  onOpen: (c: FunnelContact) => void;
  onMove: (c: FunnelContact, to: FunnelStage) => void;
  onDelete: (c: FunnelContact) => void;
}) {
  return (
    <div className="w-72 flex-shrink-0 flex flex-col bg-white border border-gray-200 rounded-md overflow-hidden">
      <header className="px-3 py-2 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-semibold ${STAGE_COLORS[stage]}`}>
          {STAGE_LABELS[stage]}
        </span>
        <span className="text-[10px] text-gray-500">{contacts.length}</span>
      </header>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-260px)]">
        {contacts.length === 0 ? (
          <p className="text-[10px] text-gray-300 text-center py-4">Пусто</p>
        ) : contacts.map((c) => (
          <ContactCard key={c.id} c={c}
            onOpen={() => onOpen(c)}
            onMove={(to) => onMove(c, to)}
            onDelete={() => onDelete(c)} />
        ))}
      </div>
    </div>
  );
}

function ContactCard({
  c, onOpen, onMove, onDelete,
}: {
  c: FunnelContact;
  onOpen: () => void;
  onMove: (to: FunnelStage) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const overdue = isActiveStage(c.stage as string) && !c.next_touch_at;
  const currentStage = (c.stage as FunnelStage) ?? 'new';
  const locked = currentStage === 'scheduled' || currentStage === 'online' || c.human_locked;

  return (
    <div
      className={`relative bg-white border rounded p-2 hover:border-blue-300 hover:shadow-sm transition-all ${
        overdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
      }`}
    >
      <button onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-1.5 mb-1">
          <span className="text-xs font-medium text-gray-900 truncate flex-1">
            {c.full_name ?? c.telegram_chat_id ?? '—'}
          </span>
          {c.human_locked && <Lock size={10} className="text-amber-600 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1 flex-wrap">
          {c.segment && <span className="px-1 py-0 bg-gray-100 rounded">{c.segment}</span>}
          {c.city && <span>📍 {c.city}</span>}
          {typeof c.has_car === 'boolean' && <span>{c.has_car ? '🚗' : '🚲'}</span>}
        </div>
        {c.last_text && (
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
      </button>

      {/* ── Кнопки быстрого действия (Task 062 §3) ─────────── */}
      <div className="absolute top-1 right-1 flex gap-0.5">
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
                const allowed = canMoveTo(currentStage, s);
                return (
                  <button
                    key={s}
                    disabled={!allowed}
                    onClick={() => {
                      setMenuOpen(false);
                      if (locked && !confirm(`Карточка под замком (${STAGE_LABELS[currentStage]}). Точно переносим в «${STAGE_LABELS[s]}»?`)) return;
                      onMove(s);
                    }}
                    className={`w-full text-left px-2 py-1 text-[11px] hover:bg-blue-50 ${allowed ? 'text-gray-800' : 'text-gray-300 cursor-not-allowed'}`}
                  >
                    {STAGE_LABELS[s]}
                    {!allowed && <span className="text-[9px] ml-1 text-gray-400">(откат)</span>}
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

  const allowedStages = STAGE_ORDER.filter((s) => canMoveTo(contact.stage as string, s));

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
