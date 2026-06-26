'use client';

import { useEffect, useState, useCallback } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import {
  Lightbulb,
  RefreshCw,
  Trash2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

interface Props {
  tenantName: string | null;
}

interface IdeaItem {
  id: string;
  source: string | null;
  text: string | null;
  link: string | null;
}

interface ListResponse {
  items: IdeaItem[];
}

export default function ContentIdeasClient({ tenantName }: Props) {
  const [items, setItems] = useState<IdeaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const j = await safeFetchJson<ListResponse>('/api/recruit/content-ideas');
      setItems(j.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function removeRow(item: IdeaItem) {
    if (!confirm('Удалить этот инфо-повод?')) return;
    try {
      await safeFetchJson(`/api/recruit/content-ideas/${item.id}`, { method: 'DELETE' });
      reload(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Lightbulb size={20} className="text-amber-500" />
            Инфо-поводы (из групп — идеи для нашего канала){tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Парсер выуживает из групп-источников сообщения-поводы — идеи для постов в нашем канале.
          </p>
        </div>
        <button
          onClick={() => reload()}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </header>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Пока пусто — парсер наполняет.</p>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-start gap-3"
              >
                <Lightbulb size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  {it.source ? (
                    it.link ? (
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1 text-xs font-medium"
                        title="Открыть группу-источник в Telegram"
                      >
                        @{it.source.replace(/^@/, '')}
                        <ExternalLink size={10} className="opacity-50" />
                      </a>
                    ) : (
                      <span className="text-xs font-medium text-gray-700">@{it.source.replace(/^@/, '')}</span>
                    )
                  ) : (
                    <span className="text-xs text-gray-400">источник неизвестен</span>
                  )}
                  <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap break-words">
                    {it.text || '—'}
                  </p>
                </div>
                <button
                  onClick={() => removeRow(it)}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0"
                  title="Удалить инфо-повод"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
