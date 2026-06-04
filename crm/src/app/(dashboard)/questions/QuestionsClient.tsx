'use client';

import { useEffect, useMemo, useState } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import { HelpCircle, Send, RefreshCw, CheckCircle2, AlertCircle, MessageCircle, User as UserIcon, Search } from 'lucide-react';
import { fmtMsk } from '@/lib/tz';

interface PendingQuestion {
  id: string;
  chat_id: string | null;
  who: string | null;
  username: string | null;
  question: string | null;
  answer: string | null;
  status: 'open' | 'answered' | 'delivered' | string;
  source: string | null;
  answered_by: string | null;
  created_at: string;
  answered_at: string | null;
}

interface Props {
  tenantName: string | null;
}

const POLL_MS = 15_000;


export default function QuestionsClient({ tenantName }: Props) {
  const [items, setItems] = useState<PendingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'open' | 'answered'>('open');

  async function reload(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const j = await safeFetchJson<{ questions: PendingQuestion[] }>('/api/recruit/questions');
      setItems(j.questions ?? []);
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

  const open = useMemo(() => items.filter((q) => q.status === 'open'), [items]);
  const history = useMemo(
    () => items.filter((q) => q.status === 'answered' || q.status === 'delivered'),
    [items]
  );

  const filtered = useMemo(() => {
    const list = tab === 'open' ? open : history;
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (q) =>
        (q.question ?? '').toLowerCase().includes(s) ||
        (q.who ?? '').toLowerCase().includes(s) ||
        (q.username ?? '').toLowerCase().includes(s) ||
        (q.answer ?? '').toLowerCase().includes(s)
    );
  }, [tab, open, history, search]);

  async function submitAnswer(q: PendingQuestion, answer: string) {
    if (!answer.trim()) return { ok: false, error: 'Введи ответ' };
    try {
      await safeFetchJson('/api/recruit/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: q.id, answer: answer.trim() }),
      });
      await reload(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <HelpCircle size={20} className="text-gray-600" />
            Вопросы{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Бот пишет сюда, когда не знает ответа. Ответь — фоновый демон доставит кандидату и положит в базу знаний. Время МСК.
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

      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-100">
        <TabBtn active={tab === 'open'} onClick={() => setTab('open')}>
          <AlertCircle size={11} />
          Открытые ({open.length})
        </TabBtn>
        <TabBtn active={tab === 'answered'} onClick={() => setTab('answered')}>
          <CheckCircle2 size={11} />
          Отвеченные ({history.length})
        </TabBtn>
        <div className="flex-1" />
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск…"
            className="w-56 pl-6 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
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
        ) : filtered.length === 0 ? (
          <EmptyState tab={tab} hasItems={items.length > 0} />
        ) : (
          <div className="space-y-3 max-w-4xl">
            {filtered.map((q) =>
              tab === 'open' ? (
                <OpenCard key={q.id} q={q} onAnswer={(a) => submitAnswer(q, a)} />
              ) : (
                <AnsweredCard key={q.id} q={q} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
        active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function OpenCard({ q, onAnswer }: { q: PendingQuestion; onAnswer: (a: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setErr(null);
    const r = await onAnswer(text);
    setSaving(false);
    if (!r.ok) setErr(r.error ?? 'Ошибка');
    else setText('');
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 flex-shrink-0 bg-gradient-to-br from-amber-400 to-orange-500 text-white font-semibold rounded-full flex items-center justify-center text-sm">
            {(q.who || q.username || '?').charAt(0).toUpperCase() || <UserIcon size={14} />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">
              {q.who || q.username || `chat ${q.chat_id}`}
            </div>
            <div className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
              {q.username && <span>@{q.username.replace(/^@/, '')}</span>}
              <SourceBadge source={q.source} />
              <span>{fmtMsk(q.created_at, true)} МСК</span>
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded">
          <AlertCircle size={9} />
          Открыт
        </span>
      </div>

      <div className="bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
        <div className="text-[10px] text-gray-500 mb-0.5">Вопрос:</div>
        <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">{q.question || '—'}</div>
      </div>

      <div>
        <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Твой ответ</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Сформулируй ответ. Демон отправит его кандидату и добавит в базу знаний."
          className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none resize-y"
        />
      </div>

      {err && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">{err}</div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-400">
          После «Ответить» статус → answered. Доставку и kb_facts делает фоновый демон.
        </span>
        <button
          onClick={submit}
          disabled={saving || !text.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-40"
        >
          <Send size={12} />
          {saving ? 'Сохранение…' : 'Ответить и отправить кандидату'}
        </button>
      </div>
    </div>
  );
}

function AnsweredCard({ q }: { q: PendingQuestion }) {
  const delivered = q.status === 'delivered';
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 flex-shrink-0 bg-gradient-to-br from-blue-500 to-violet-500 text-white font-semibold rounded-full flex items-center justify-center text-sm">
            {(q.who || q.username || '?').charAt(0).toUpperCase() || <UserIcon size={14} />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {q.who || q.username || `chat ${q.chat_id}`}
            </div>
            <div className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
              {q.username && <span>@{q.username.replace(/^@/, '')}</span>}
              <SourceBadge source={q.source} />
              <span>спросил {fmtMsk(q.created_at, true)}</span>
            </div>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 border rounded ${
            delivered ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}
        >
          <CheckCircle2 size={9} />
          {delivered ? 'Доставлено' : 'Отвечено'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
        <div className="bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
          <div className="text-[10px] text-gray-500 mb-0.5">Вопрос:</div>
          <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">{q.question || '—'}</div>
        </div>
        <div className="bg-emerald-50/40 border border-emerald-100 rounded-md px-3 py-2">
          <div className="text-[10px] text-emerald-700 mb-0.5">
            Ответ {q.answered_by ? `· ${q.answered_by}` : ''} {q.answered_at ? `· ${fmtMsk(q.answered_at, true)} МСК` : ''}
          </div>
          <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">{q.answer || '—'}</div>
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  const styles: Record<string, string> = {
    tg: 'bg-sky-100 text-sky-700 border-sky-200',
    vk: 'bg-blue-100 text-blue-800 border-blue-300',
  };
  const labels: Record<string, string> = { tg: 'TG', vk: 'VK' };
  const cls = source && styles[source] ? styles[source] : 'bg-gray-100 text-gray-600 border-gray-200';
  const label = source ? labels[source] ?? source.toUpperCase() : '·';
  return (
    <span className={`inline-block text-[9px] px-1 py-0 rounded border font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function EmptyState({ tab, hasItems }: { tab: 'open' | 'answered'; hasItems: boolean }) {
  if (tab === 'open') {
    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <CheckCircle2 size={36} className="text-emerald-400 mx-auto mb-3" />
        <h2 className="text-sm font-medium text-gray-700">
          {hasItems ? 'Открытых вопросов нет' : 'Вопросов пока не было'}
        </h2>
        <p className="text-xs text-gray-500 mt-2">
          Когда бот столкнётся с вопросом, на который не знает ответ — он положит его сюда, а ты ответишь.
          Так бот никогда не врёт и постепенно учится.
        </p>
      </div>
    );
  }
  return (
    <div className="text-center py-12 max-w-md mx-auto">
      <MessageCircle size={36} className="text-gray-300 mx-auto mb-3" />
      <h2 className="text-sm font-medium text-gray-700">История пуста</h2>
      <p className="text-xs text-gray-500 mt-2">Здесь появятся вопросы, на которые ты уже дал ответ.</p>
    </div>
  );
}
