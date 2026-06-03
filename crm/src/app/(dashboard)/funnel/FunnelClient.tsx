'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KanbanSquare, RefreshCw, Users } from 'lucide-react';
import { FUNNEL_COLUMNS } from '@/lib/recruit/types';
import { fmtMsk } from '@/lib/tz';

interface ContactRow {
  id: string;
  full_name: string | null;
  type: string | null;
  status: string | null;
  source: string | null;
  telegram: string | null;
  telegram_chat_id: string | null;
  last_contact_at: string | null;
  ai_segment: string | null;
  ai_score: number | null;
  tags: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Props {
  initialContacts: ContactRow[];
  tenantName: string | null;
}

export default function FunnelClient({ initialContacts, tenantName }: Props) {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactRow[]>(initialContacts);
  const [refreshing, setRefreshing] = useState(false);

  async function reload() {
    setRefreshing(true);
    try {
      const r = await fetch('/api/recruit/funnel', { cache: 'no-store' });
      const j = await r.json();
      if (j.contacts) setContacts(j.contacts);
    } finally {
      setRefreshing(false);
    }
  }

  // мягкое автообновление раз в 30с — Sergey должен видеть актуальную картинку
  useEffect(() => {
    const id = setInterval(reload, 30_000);
    return () => clearInterval(id);
  }, []);

  const byStatus = useMemo(() => {
    const map = new Map<string, ContactRow[]>();
    for (const c of contacts) {
      const key = (c.status ?? 'new').toLowerCase();
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return map;
  }, [contacts]);

  const totalKnown = useMemo(
    () => FUNNEL_COLUMNS.reduce((a, col) => a + (byStatus.get(col.key)?.length ?? 0), 0),
    [byStatus]
  );

  const openDialog = (c: ContactRow) => {
    if (c.telegram_chat_id) {
      router.push(`/dialogs?chat=${encodeURIComponent(c.telegram_chat_id)}`);
    } else {
      router.push('/dialogs');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <KanbanSquare size={20} className="text-gray-600" />
            Воронка{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Канбан кандидатов по этапам · клик по карточке → открыть диалог · время МСК
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <Users size={12} />
            Всего по этапам: <strong className="text-gray-900">{totalKnown}</strong>
          </span>
          <button
            onClick={reload}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {totalKnown === 0 ? (
          <EmptyFunnel />
        ) : (
          <div className="flex gap-3 min-w-fit h-full">
            {FUNNEL_COLUMNS.map((col) => {
              const items = byStatus.get(col.key) ?? [];
              return (
                <div key={col.key} className="w-[260px] flex-shrink-0 flex flex-col bg-white rounded-lg border border-gray-200 max-h-full">
                  <header className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${dotColor(col.key)}`} />
                      <h2 className="text-xs font-semibold text-gray-700">{col.label}</h2>
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">{items.length}</span>
                  </header>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {items.length === 0 ? (
                      <p className="text-[11px] text-gray-400 text-center py-6">Пусто</p>
                    ) : items.map((c) => (
                      <Card key={c.id} contact={c} onClick={() => openDialog(c)} />
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

function Card({ contact, onClick }: { contact: ContactRow; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left bg-white border border-gray-200 rounded-md p-2 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="text-sm font-medium text-gray-900 truncate">
        {contact.full_name || (contact.telegram ? `@${contact.telegram.replace(/^@/, '')}` : 'Кандидат')}
      </div>
      {contact.source && (
        <div className="text-[10px] text-gray-500 mt-0.5">Источник: {contact.source}</div>
      )}
      {contact.ai_segment && (
        <div className="text-[10px] text-violet-600 mt-0.5">{contact.ai_segment}</div>
      )}
      <div className="text-[10px] text-gray-500 mt-1">
        {contact.last_contact_at
          ? `Активность: ${fmtMsk(contact.last_contact_at, true)} МСК`
          : contact.created_at
          ? `Создан: ${fmtMsk(contact.created_at, false)} МСК`
          : ''}
      </div>
      {contact.tags && contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {contact.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[9px] bg-gray-100 text-gray-700 border border-gray-200 px-1 py-0 rounded">
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function EmptyFunnel() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        <KanbanSquare size={48} className="text-gray-300 mx-auto mb-3" />
        <h2 className="text-base font-medium text-gray-700">Кандидатов пока нет</h2>
        <p className="text-xs text-gray-500 mt-2">
          Когда лид-кандидат попадёт в CRM (через бот, форму или импорт), он появится здесь.
          Статусы: <strong>Новый → Общается → Хочет работать → Документы → На линии</strong> (или <strong>Отказ</strong>).
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
