'use client';

import { useEffect, useMemo, useState } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import { BookOpen, Plus, Trash2, Edit3, Search, RefreshCw, X, AlertCircle, Check } from 'lucide-react';
import { fmtMsk } from '@/lib/tz';

interface KbFact {
  id: string;
  question: string | null;
  answer: string | null;
  added_by: string | null;
  created_at: string;
}

interface Props {
  tenantName: string | null;
}


export default function KbClient({ tenantName }: Props) {
  const [facts, setFacts] = useState<KbFact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<KbFact | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const q = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
      const j = await safeFetchJson<{ facts: KbFact[] }>(`/api/recruit/kb-facts${q}`);
      setFacts(j.facts ?? []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => reload(true), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function remove(f: KbFact) {
    if (!confirm(`Удалить факт «${(f.question ?? '').slice(0, 60)}»?`)) return;
    try {
      await safeFetchJson(`/api/recruit/kb-facts/${f.id}`, { method: 'DELETE' });
      await reload(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={20} className="text-gray-600" />
            База знаний{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Факты, на которых учится бот. Сюда автоматически попадают ответы из «Вопросов»; можно добавить вручную.
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
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700"
          >
            <Plus size={14} />
            Добавить факт
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-100">
        <span className="text-xs text-gray-500">Фактов: <strong className="text-gray-900">{facts.length}</strong></span>
        <div className="flex-1" />
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по вопросу или ответу…"
            className="w-72 pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>
        ) : facts.length === 0 ? (
          <EmptyState hasSearch={!!search.trim()} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-6xl">
            {facts.map((f) => (
              <FactCard key={f.id} fact={f} onEdit={() => setEditing(f)} onDelete={() => remove(f)} />
            ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <FactForm
          fact={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await reload(true); }}
        />
      )}
    </div>
  );
}

function FactCard({ fact, onEdit, onDelete }: { fact: KbFact; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm font-medium text-gray-900 leading-snug">{fact.question || '—'}</div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={onEdit} className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Редактировать">
            <Edit3 size={12} />
          </button>
          <button onClick={onDelete} className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="Удалить">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{fact.answer || '—'}</div>
      <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-between">
        <span>{fact.added_by ? `от ${fact.added_by}` : '—'}</span>
        <span>{fmtMsk(fact.created_at, true)} МСК</span>
      </div>
    </div>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <Search size={36} className="text-gray-300 mx-auto mb-3" />
        <h2 className="text-sm font-medium text-gray-700">Ничего не найдено</h2>
        <p className="text-xs text-gray-500 mt-2">Поменяй запрос или сбрось фильтр.</p>
      </div>
    );
  }
  return (
    <div className="text-center py-12 max-w-md mx-auto">
      <BookOpen size={36} className="text-gray-300 mx-auto mb-3" />
      <h2 className="text-sm font-medium text-gray-700">База знаний пуста</h2>
      <p className="text-xs text-gray-500 mt-2">
        Как только ты ответишь на вопрос во вкладке «Вопросы», или добавишь факт вручную — он появится здесь и бот начнёт его использовать.
      </p>
    </div>
  );
}

function FactForm({ fact, onClose, onSaved }: { fact: KbFact | null; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [question, setQuestion] = useState(fact?.question ?? '');
  const [answer, setAnswer] = useState(fact?.answer ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      if (fact) {
        await safeFetchJson(`/api/recruit/kb-facts/${fact.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
        });
      } else {
        await safeFetchJson('/api/recruit/kb-facts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
        });
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg">
        <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">{fact ? 'Изменить факт' : 'Новый факт'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </header>
        <div className="px-4 py-4 space-y-3">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</div>}
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Вопрос</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Как бы кандидат это сформулировал?"
              className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Ответ</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              placeholder="Какой ответ должен давать бот."
              className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none resize-y"
            />
          </div>
        </div>
        <footer className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 rounded-md">Отмена</button>
          <button
            onClick={submit}
            disabled={saving || !question.trim() || !answer.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-40"
          >
            <Check size={12} />
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </footer>
      </div>
    </div>
  );
}
