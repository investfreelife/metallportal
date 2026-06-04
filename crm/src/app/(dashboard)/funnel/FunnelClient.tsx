'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KanbanSquare, RefreshCw, Users, MessageCircle, Plus, UserCheck } from 'lucide-react';
import { FUNNEL_COLUMNS } from '@/lib/recruit/types';
import { fmtMsk } from '@/lib/tz';
import AddCandidateModal from './AddCandidateModal';

interface FunnelItem {
  chat_id: string;
  who: string | null;
  username: string | null;
  stage: string;
  source: string;
  last_text: string | null;
  last_at: string;
  msg_count: number;
}

interface Props {
  tenantName: string | null;
}

const POLL_MS = 30_000;

export default function FunnelClient({ tenantName }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<FunnelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);

  async function reload(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const r = await fetch('/api/recruit/funnel?scope=recruit', { cache: 'no-store' });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error(`Сервер ответил не-JSON (HTTP ${r.status})`);
      }
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
      setItems(j.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    reload();
    const id = setInterval(() => reload(true), POLL_MS);
    return () => clearInterval(id);
  }, []);

  const byStage = useMemo(() => {
    const map = new Map<string, FunnelItem[]>();
    for (const it of items) {
      const key = (it.stage || 'new').toLowerCase();
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  const total = items.length;

  const openDialog = (it: FunnelItem) => {
    router.push(`/dialogs?chat=${encodeURIComponent(it.chat_id)}`);
  };

  async function promoteToDriver(it: FunnelItem) {
    if (!confirm(`Перевести «${it.who || it.username || it.chat_id}» в действующие водители?`)) return;
    setPromoting(it.chat_id);
    try {
      const r = await fetch('/api/recruit/funnel/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: it.chat_id }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'promote failed');
      await reload(true);
      if (j.reused) {
        // уже водитель — ничего особенного
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPromoting(null);
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <KanbanSquare size={20} className="text-gray-600" />
            Воронка{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Канбан кандидатов по этапам · клик по карточке → диалог · время МСК
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <Users size={12} />
            Кандидатов: <strong className="text-gray-900">{total}</strong>
          </span>
          <button
            onClick={() => reload()}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Обновить
          </button>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700"
          >
            <Plus size={12} />
            Добавить кандидата
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          Ошибка: {error}
        </div>
      )}

      {adding && (
        <AddCandidateModal
          onClose={() => setAdding(false)}
          onAdded={async () => { setAdding(false); await reload(true); }}
        />
      )}

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>
        ) : total === 0 ? (
          <EmptyFunnel />
        ) : (
          <div className="flex gap-3 w-max h-full pr-2">
            {FUNNEL_COLUMNS.map((col) => {
              const colItems = byStage.get(col.key) ?? [];
              return (
                <div key={col.key} className="w-[280px] flex-shrink-0 flex flex-col bg-white rounded-lg border border-gray-200 max-h-full">
                  <header className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${dotColor(col.key)}`} />
                      <h2 className="text-xs font-semibold text-gray-700">{col.label}</h2>
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">{colItems.length}</span>
                  </header>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {colItems.length === 0 ? (
                      <p className="text-[11px] text-gray-400 text-center py-6">Пусто</p>
                    ) : colItems.map((it) => (
                      <Card
                        key={it.chat_id}
                        item={it}
                        onClick={() => openDialog(it)}
                        onPromote={() => promoteToDriver(it)}
                        promoting={promoting === it.chat_id}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  item,
  onClick,
  onPromote,
  promoting,
}: {
  item: FunnelItem;
  onClick: () => void;
  onPromote: () => void;
  promoting: boolean;
}) {
  const displayName = item.who || (item.username ? `@${item.username.replace(/^@/, '')}` : `чат ${item.chat_id}`);
  return (
    <div className="bg-white border border-gray-200 rounded-md p-2 hover:border-blue-300 hover:shadow-sm transition-all">
      <button onClick={onClick} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium text-gray-900 truncate">{displayName}</div>
          <SourceBadge source={item.source} />
        </div>
        {item.last_text && (
          <div className="text-[11px] text-gray-600 truncate mt-1 leading-snug">
            {item.last_text}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <MessageCircle size={9} />
            {item.msg_count}
          </span>
          <span>{fmtMsk(item.last_at, true)} МСК</span>
        </div>
      </button>
      {(item.stage === 'on_line' || item.stage === 'docs') && (
        <button
          onClick={(e) => { e.stopPropagation(); onPromote(); }}
          disabled={promoting}
          className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-40"
          title="Перевести в действующие водители"
        >
          <UserCheck size={10} />
          {promoting ? 'Перевод…' : '✅ В водители'}
        </button>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const styles: Record<string, string> = {
    telegram: 'bg-sky-100 text-sky-700 border-sky-200',
    vk: 'bg-blue-100 text-blue-800 border-blue-300',
    other: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  const labels: Record<string, string> = {
    telegram: 'TG',
    vk: 'VK',
    other: '·',
  };
  const cls = styles[source] ?? styles.other;
  return (
    <span className={`inline-block text-[9px] px-1 py-0 rounded border font-semibold flex-shrink-0 ${cls}`}>
      {labels[source] ?? '·'}
    </span>
  );
}

function EmptyFunnel() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        <KanbanSquare size={48} className="text-gray-300 mx-auto mb-3" />
        <h2 className="text-base font-medium text-gray-700">Кандидатов пока нет</h2>
        <p className="text-xs text-gray-500 mt-2">
          Когда бот наберёт хотя бы одно сообщение с кандидатом, он появится здесь.
          Этапы: <strong>Новый → Общается → Хочет работать → Документы → На линии</strong> (или <strong>Отказ</strong>).
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
          {FUNNEL_COLUMNS.map((col) => (
            <span key={col.key} className={`text-[11px] px-2 py-0.5 border rounded ${col.color}`}>
              {col.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function dotColor(key: string): string {
  return {
    new: 'bg-gray-400',
    engaged: 'bg-blue-500',
    wants: 'bg-violet-500',
    docs: 'bg-amber-500',
    on_line: 'bg-emerald-500',
    rejected: 'bg-red-400',
  }[key] ?? 'bg-gray-400';
}
