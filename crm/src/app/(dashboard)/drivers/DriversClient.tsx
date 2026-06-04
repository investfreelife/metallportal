'use client';

import { useEffect, useMemo, useState } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import { Users, Search, RefreshCw, Phone, Send, MessageSquare, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { fmtMsk } from '@/lib/tz';

interface DriverRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  telegram: string | null;
  telegram_chat_id: string | null;
  source: string | null;
  tags: string[] | null;
  last_contact_at: string | null;
  created_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

interface Props { tenantName: string | null }


function transportFromTags(tags: string[] | null): string | null {
  if (!Array.isArray(tags)) return null;
  const t = tags.find((x) => typeof x === 'string' && x.startsWith('transport:'));
  if (!t) return null;
  const v = t.slice('transport:'.length);
  return { auto: '🚗 Авто', bike: '🚲 Велосипед', foot: '🚶 Пешком', other: 'Другое' }[v] ?? v;
}

export default function DriversClient({ tenantName }: Props) {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function reload(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const j = await safeFetchJson<{ drivers: DriverRow[] }>('/api/recruit/drivers');
      setDrivers(j.drivers ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) =>
      (d.full_name ?? '').toLowerCase().includes(q) ||
      (d.phone ?? '').toLowerCase().includes(q) ||
      (d.telegram ?? '').toLowerCase().includes(q)
    );
  }, [drivers, search]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={20} className="text-gray-600" />
            Водители{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Действующие водители ({drivers.length}) · перевод сюда — кнопкой «✅ В водители» в Воронке
          </p>
        </div>
        <button
          onClick={() => reload()}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </header>

      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-100">
        <div className="relative w-80">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени / телефону / @telegram…"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
          />
        </div>
        {search && <span className="text-[11px] text-gray-500">Найдено: {filtered.length}</span>}
      </div>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>
        ) : filtered.length === 0 ? (
          <EmptyState hasSearch={!!search.trim()} hasItems={drivers.length > 0} />
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                  <th className="px-3 py-2">Имя</th>
                  <th className="px-3 py-2 w-44">Телефон</th>
                  <th className="px-3 py-2 w-40">Telegram</th>
                  <th className="px-3 py-2 w-32">Транспорт</th>
                  <th className="px-3 py-2 w-32">Источник</th>
                  <th className="px-3 py-2 w-40">Активность</th>
                  <th className="px-3 py-2 w-32 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((d) => {
                  const transport = transportFromTags(d.tags);
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-gray-900 truncate">{d.full_name ?? '—'}</div>
                        {d.notes && <div className="text-[10px] text-gray-500 truncate max-w-md">{d.notes}</div>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {d.phone ? (
                          <a href={`tel:${d.phone.replace(/[^\d+]/g, '')}`} className="text-blue-600 hover:underline">{d.phone}</a>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {d.telegram ? (
                          <a href={`https://t.me/${d.telegram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{d.telegram}</a>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">{transport ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{d.source ?? '—'}</td>
                      <td className="px-3 py-2 text-[11px] text-gray-500">
                        {d.last_contact_at ? `${fmtMsk(d.last_contact_at, true)} МСК` : d.created_at ? `создан ${fmtMsk(d.created_at, false)}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {d.telegram_chat_id && (
                          <Link
                            href={`/dialogs?chat=${encodeURIComponent(d.telegram_chat_id)}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-blue-600 hover:text-blue-800"
                            title="Открыть диалог"
                          >
                            <MessageSquare size={10} />
                            диалог
                          </Link>
                        )}
                        {d.phone && (
                          <a href={`tel:${d.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-blue-600 hover:text-blue-800" title="Позвонить">
                            <Phone size={10} />
                          </a>
                        )}
                        {d.telegram && (
                          <a href={`https://t.me/${d.telegram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-blue-600 hover:text-blue-800" title="Написать в Telegram">
                            <Send size={10} />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasSearch, hasItems }: { hasSearch: boolean; hasItems: boolean }) {
  if (hasSearch && hasItems) {
    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <Search size={36} className="text-gray-300 mx-auto mb-3" />
        <h2 className="text-sm font-medium text-gray-700">Не найдено</h2>
      </div>
    );
  }
  return (
    <div className="text-center py-12 max-w-md mx-auto">
      <Users size={36} className="text-gray-300 mx-auto mb-3" />
      <h2 className="text-sm font-medium text-gray-700">Действующих водителей пока нет</h2>
      <p className="text-xs text-gray-500 mt-2">
        Кандидаты, дошедшие до этапа «Документы» или «На линии» в <Link href="/funnel" className="text-blue-600 hover:underline">Воронке</Link>,
        получают кнопку <strong>«✅ В водители»</strong> — после клика они попадают сюда.
      </p>
    </div>
  );
}
