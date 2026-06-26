'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  MessagesSquare, RefreshCw, Search, Plus, X, ExternalLink, Tag, AlertCircle,
} from 'lucide-react';
import { safeFetchJson } from '@/lib/safe-fetch';
import { fmtMsk } from '@/lib/tz';

interface LabelItem { name: string; color: string }
interface Card {
  id: string;
  source: 'seeker' | 'lead';
  username: string | null;
  name: string | null;
  city: string | null;
  last_text: string | null;
  stage_or_status: string | null;
  labels: string[];
  link: string | null;
  updated_at: string;
}
interface CommResp {
  items: Card[];
  labelCount: Record<string, number>;
  totals: { seekers: number; leads: number };
}

interface Props { tenantName: string | null }

const COLOR_OPTIONS = [
  '#94a3b8', '#60a5fa', '#34d399', '#f59e0b', '#ef4444',
  '#a78bfa', '#f472b6', '#facc15',
];

export default function CommunicationClient({ tenantName }: Props) {
  const [items, setItems] = useState<Card[]>([]);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [labelCount, setLabelCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [q, setQ] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (filter) sp.set('label', filter);
      if (q.trim()) sp.set('q', q.trim());
      const [c, l] = await Promise.all([
        safeFetchJson<CommResp>(`/api/recruit/communication?${sp.toString()}`),
        safeFetchJson<{ items: LabelItem[] }>('/api/recruit/labels'),
      ]);
      setItems(c.items ?? []);
      setLabelCount(c.labelCount ?? {});
      setLabels(l.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [filter, q]);
  useEffect(() => { reload(); }, [reload]);

  async function addLabel(name: string, color: string) {
    try {
      const j = await safeFetchJson<{ items: LabelItem[] }>('/api/recruit/labels', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
      setLabels(j.items);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  }
  async function removeLabel(name: string) {
    if (!confirm(`Удалить метку «${name}» из справочника? Она останется на старых карточках до ручного снятия.`)) return;
    try {
      const j = await safeFetchJson<{ items: LabelItem[] }>(`/api/recruit/labels?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
      setLabels(j.items);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  }
  async function toggleCardLabel(card: Card, name: string) {
    const next = card.labels.includes(name) ? card.labels.filter((x) => x !== name) : [...card.labels, name];
    try {
      await safeFetchJson(`/api/recruit/communication/${card.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: card.source, labels: next }),
      });
      await reload();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessagesSquare size={20} className="text-gray-600" />
            💬 Общение{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Соискатели и лиды в работе. Свои метки помогают сортировать (цветные чипы).
          </p>
        </div>
        <button onClick={reload} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Обновить
        </button>
      </header>

      {/* ── Справочник меток ──────────────────────────────────── */}
      <LabelsDictBar labels={labels} onAdd={addLabel} onRemove={removeLabel} />

      {/* ── Фильтры ──────────────────────────────────────────── */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-2 flex-wrap">
        <button onClick={() => setFilter('')} className={`px-2.5 py-1 text-xs rounded ${!filter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          Все · {items.length}
        </button>
        {labels.map((l) => (
          <button key={l.name} onClick={() => setFilter(filter === l.name ? '' : l.name)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border whitespace-nowrap"
            style={{ backgroundColor: filter === l.name ? l.color : 'transparent', color: filter === l.name ? '#fff' : l.color, borderColor: l.color }}>
            <Tag size={10} /> {l.name} · {labelCount[l.name] ?? 0}
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative w-64">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск…"
            className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none" />
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Список карточек ──────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {loading && items.length === 0 ? (
          <p className="col-span-full text-xs text-gray-400 text-center py-12">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="col-span-full text-sm text-gray-500 text-center py-12">
            Никого в общении. Возьми кандидата из «🔥 Соискатели» (статус → ≠ new) или из «🔻 Воронки» (стадия contact+).
          </p>
        ) : items.map((card) => (
          <CommCard key={`${card.source}:${card.id}`} card={card} labels={labels}
            onToggleLabel={(n) => toggleCardLabel(card, n)} />
        ))}
      </div>
    </div>
  );
}

function LabelsDictBar({ labels, onAdd, onRemove }: { labels: LabelItem[]; onAdd: (n: string, c: string) => void; onRemove: (n: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  return (
    <div className="px-6 py-2 bg-white border-b border-gray-100 flex items-center gap-2 flex-wrap text-xs">
      <span className="text-gray-500 font-medium">📑 Метки:</span>
      {labels.map((l) => (
        <span key={l.name} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border"
          style={{ backgroundColor: `${l.color}22`, color: l.color, borderColor: l.color }}>
          {l.name}
          <button onClick={() => onRemove(l.name)} className="opacity-50 hover:opacity-100"><X size={9} /></button>
        </span>
      ))}
      {adding ? (
        <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="имя метки"
            className="px-1 py-0 text-[11px] border-0 bg-transparent w-28 focus:outline-none" />
          <select value={color} onChange={(e) => setColor(e.target.value)} className="text-[11px] border-0 bg-transparent">
            {COLOR_OPTIONS.map((c) => <option key={c} value={c} style={{ color: c }}>●</option>)}
          </select>
          <button onClick={() => { if (name.trim()) { onAdd(name.trim(), color); setName(''); setAdding(false); } }}
            className="text-emerald-700 text-[11px]">✓</button>
          <button onClick={() => { setAdding(false); setName(''); }} className="text-gray-400 text-[11px]">×</button>
        </span>
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] text-blue-700 hover:bg-blue-50 rounded">
          <Plus size={10} /> метка
        </button>
      )}
    </div>
  );
}

function CommCard({ card, labels, onToggleLabel }: { card: Card; labels: LabelItem[]; onToggleLabel: (n: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-md p-3 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <span className={`text-[10px] px-1.5 py-0 rounded border font-medium ${card.source === 'seeker' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
          {card.source === 'seeker' ? '🔥 соискатель' : '🎯 лид'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {card.link ? (
              <a href={card.link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-700 hover:underline truncate">
                {card.username ? `@${String(card.username).replace(/^@/, '')}` : 'без username'}
              </a>
            ) : (
              <span className="text-xs font-semibold text-gray-700 truncate">{card.username ?? card.id.slice(0, 8)}</span>
            )}
            <span className="text-xs text-gray-700 truncate">{card.name ?? ''}</span>
          </div>
          {card.city && <div className="text-[10px] text-gray-500">📍 {card.city}</div>}
        </div>
        {card.link && (
          <a href={card.link} target="_blank" rel="noopener noreferrer" title="Открыть чат"
            className="p-0.5 text-gray-400 hover:text-blue-600">
            <ExternalLink size={11} />
          </a>
        )}
      </div>
      {card.last_text && (
        <p className="text-[11px] text-gray-600 line-clamp-3 leading-snug bg-gray-50 rounded px-2 py-1.5">{card.last_text}</p>
      )}
      <div className="flex items-center gap-1 flex-wrap">
        {card.labels.map((name) => {
          const meta = labels.find((l) => l.name === name);
          const color = meta?.color ?? '#94a3b8';
          return (
            <span key={name} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border"
              style={{ backgroundColor: `${color}22`, color, borderColor: color }}>
              {name}
              <button onClick={() => onToggleLabel(name)} className="opacity-50 hover:opacity-100"><X size={8} /></button>
            </span>
          );
        })}
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-blue-700 hover:bg-blue-50 rounded border border-blue-200 border-dashed">
            <Plus size={9} /> метка
          </button>
          {menuOpen && (
            <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded shadow-lg min-w-[120px]" onMouseLeave={() => setMenuOpen(false)}>
              {labels.length === 0 ? (
                <p className="px-2 py-1 text-[10px] text-gray-400">Сначала создай метку выше.</p>
              ) : labels.map((l) => {
                const has = card.labels.includes(l.name);
                return (
                  <button key={l.name} onClick={() => { onToggleLabel(l.name); setMenuOpen(false); }}
                    className={`w-full text-left px-2 py-1 text-[11px] hover:bg-blue-50 flex items-center gap-1.5 ${has ? 'bg-blue-50/60' : ''}`}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                    {l.name} {has && '✓'}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="text-[9px] text-gray-400 flex items-center justify-between border-t border-gray-100 pt-1.5 mt-auto">
        <span>{fmtMsk(card.updated_at, true)} МСК</span>
        {card.stage_or_status && <span className="px-1 py-0 rounded bg-gray-100 text-gray-700 border border-gray-200">{card.stage_or_status}</span>}
      </div>
    </div>
  );
}
