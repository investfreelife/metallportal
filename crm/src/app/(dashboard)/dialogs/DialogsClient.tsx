'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Search, Clock, RefreshCw, User as UserIcon, Inbox as InboxIcon, UserCheck, Bot, Send, Sparkles, AlertCircle } from 'lucide-react';
import type { DialogSummary, DialogMessage } from '@/lib/recruit/types';
import { STAGE_LABELS, STAGE_COLORS } from '@/lib/recruit/types';
import { fmtMsk } from '@/lib/tz';

interface HandoffState {
  active: boolean;
  taken_by: string | null;
  since: string | null;
}

/**
 * Безопасный JSON-fetch: проверяем content-type перед res.json(), иначе
 * HTML-ошибки прода (500/redirect) ломали парсер с «Unexpected token '<'».
 */
async function safeFetchJson<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const r = await fetch(input, { cache: 'no-store', ...init });
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await r.text().catch(() => '');
    throw new Error(`Сервер ответил не-JSON (HTTP ${r.status}): ${text.slice(0, 120)}`);
  }
  const j = await r.json();
  if (!r.ok || (j as { error?: string })?.error) {
    throw new Error((j as { error?: string })?.error || `HTTP ${r.status}`);
  }
  return j as T;
}

interface Props {
  initialChatId: string | null;
  tenantName: string | null;
  /**
   * scope — фильтр chat_id'ов:
   *   - 'business' → только tgb:* (Telegram Business / личка Сергея)
   *   - 'recruit'  → всё ОСТАЛЬНОЕ (кандидаты из бота/VK/ручные)
   *   - undefined  → всё
   * Передаётся в /api/recruit/dialogs?scope=...
   */
  scope?: 'business' | 'recruit';
  /** Заголовок страницы (по умолчанию «Диалоги»). */
  pageTitle?: string;
  /** Подзаголовок под H1. */
  pageHint?: string;
}

const POLL_MS = 10_000;

export default function DialogsClient({ initialChatId, tenantName, scope, pageTitle = 'Диалоги', pageHint }: Props) {
  const [dialogs, setDialogs] = useState<DialogSummary[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialChatId);
  const [messages, setMessages] = useState<DialogMessage[]>([]);
  const [handoff, setHandoff] = useState<HandoffState>({ active: false, taken_by: null, since: null });
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);

  // ─── Load dialogs (with polling) ────────────────────────────────────
  async function loadDialogs() {
    try {
      const scopeQs = scope ? `?scope=${scope}` : '';
      const j = await safeFetchJson<{ dialogs: DialogSummary[] }>(`/api/recruit/dialogs${scopeQs}`);
      setDialogs(j.dialogs ?? []);
      setError(null);
      if (!selectedChatId && (j.dialogs ?? []).length > 0) {
        setSelectedChatId(j.dialogs[0].chat_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingList(false);
    }
  }

  async function loadMessages(chatId: string) {
    setLoadingMsgs(true);
    try {
      const j = await safeFetchJson<{ messages: DialogMessage[]; handoff?: HandoffState }>(
        `/api/recruit/dialogs/${encodeURIComponent(chatId)}`
      );
      setMessages(j.messages ?? []);
      setHandoff(j.handoff ?? { active: false, taken_by: null, since: null });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function toggleHandoff(active: boolean) {
    if (!selectedChatId) return;
    setHandoffBusy(true);
    try {
      const j = await safeFetchJson<HandoffState>('/api/recruit/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: selectedChatId, active }),
      });
      setHandoff(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setHandoffBusy(false);
    }
  }

  useEffect(() => {
    loadDialogs();
    const id = setInterval(loadDialogs, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedChatId);
    const id = setInterval(() => loadMessages(selectedChatId), POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId]);

  // Авто-скролл вниз при появлении новых сообщений (если уже снизу).
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dialogs;
    return dialogs.filter(
      (d) =>
        (d.who ?? '').toLowerCase().includes(q) ||
        (d.username ?? '').toLowerCase().includes(q) ||
        (d.last_text ?? '').toLowerCase().includes(q) ||
        d.chat_id.toLowerCase().includes(q)
    );
  }, [dialogs, search]);

  const selectedDialog = useMemo(
    () => dialogs.find((d) => d.chat_id === selectedChatId) ?? null,
    [dialogs, selectedChatId]
  );

  return (
    <div className="flex h-full bg-gray-50">
      {/* ── Sidebar: list of chats ────────────────────────────────── */}
      <aside className="w-[340px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <header className="px-4 py-3 border-b border-gray-200">
          <h1 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
            <MessageSquare size={16} className="text-gray-600" />
            {pageTitle}{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {pageHint ?? 'Переписки бот ↔ кандидат · обновление каждые 10 сек · время МСК'}
          </p>
        </header>
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени / username / тексту…"
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList && (
            <p className="text-xs text-gray-400 text-center py-8">Загрузка…</p>
          )}
          {!loadingList && dialogs.length === 0 && (
            <EmptyState
              icon={<InboxIcon size={28} className="text-gray-300" />}
              title="Диалогов пока нет"
              hint="Когда кандидат напишет в бот, появится здесь."
            />
          )}
          {!loadingList && dialogs.length > 0 && filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-8">Не найдено.</p>
          )}
          {filtered.map((d) => (
            <DialogRow
              key={d.chat_id}
              dialog={d}
              active={d.chat_id === selectedChatId}
              onClick={() => setSelectedChatId(d.chat_id)}
            />
          ))}
        </div>
        <footer className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-500 flex items-center justify-between">
          <span>{filtered.length} {plural(filtered.length, 'диалог', 'диалога', 'диалогов')}</span>
          <button
            onClick={loadDialogs}
            className="flex items-center gap-1 text-gray-500 hover:text-blue-600"
            title="Обновить сейчас"
          >
            <RefreshCw size={10} />
            Обновить
          </button>
        </footer>
      </aside>

      {/* ── Main: messages ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">
        {error && (
          <div className="mx-4 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        {!selectedChatId && (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<MessageSquare size={40} className="text-gray-300" />}
              title={dialogs.length === 0 ? 'Нет переписок' : 'Выбери диалог слева'}
              hint={dialogs.length === 0
                ? 'Когда бот начнёт общаться с кандидатом, его переписка появится здесь.'
                : undefined}
            />
          </div>
        )}
        {selectedChatId && selectedDialog && (
          <>
            <header className="px-5 py-3 border-b border-gray-200 bg-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar text={selectedDialog.who || selectedDialog.username || selectedDialog.chat_id} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {selectedDialog.who || selectedDialog.username || `чат ${selectedDialog.chat_id}`}
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
                    {selectedDialog.username && <span>@{selectedDialog.username.replace(/^@/, '')}</span>}
                    <span>· chat_id {selectedDialog.chat_id}</span>
                    <span>· {selectedDialog.msg_count} {plural(selectedDialog.msg_count, 'сообщ.', 'сообщ.', 'сообщ.')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {handoff.active && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                    <UserCheck size={11} />
                    Общается человек{handoff.taken_by ? ` · ${handoff.taken_by}` : ''}
                  </span>
                )}
                {selectedDialog.stage && <StageBadge stage={selectedDialog.stage} />}
                <button
                  onClick={() => toggleHandoff(!handoff.active)}
                  disabled={handoffBusy}
                  title={
                    handoff.active
                      ? `Вернуть управление AI (${handoff.taken_by ?? 'человек'} с ${handoff.since ? fmtMsk(handoff.since, true) : '—'})`
                      : 'Перехватить диалог: AI замолчит, ты пишешь сам'
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors disabled:opacity-50 ${
                    handoff.active
                      ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {handoff.active ? <Bot size={12} /> : <UserCheck size={12} />}
                  {handoff.active ? 'Вернуть мозгу' : 'Общаюсь сам'}
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto bg-gray-50 px-5 py-4">
              {loadingMsgs && messages.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">Загрузка ленты…</p>
              )}
              {!loadingMsgs && messages.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">Сообщений нет.</p>
              )}
              <div className="space-y-2">
                {messages.map((m, i) => (
                  <Bubble key={m.id ?? i} message={m} prev={messages[i - 1]} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <Composer
              chatId={selectedChatId}
              onSent={async () => {
                // Подтянем ленту + handoff после отправки.
                await loadMessages(selectedChatId);
                await loadDialogs();
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}

// ─── Composer (поле ввода менеджера + AI-переписать/raw) ──────────────
function Composer({ chatId, onSent }: { chatId: string; onSent: () => void | Promise<void> }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState<'ai' | 'raw' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAiText, setLastAiText] = useState<string | null>(null);

  async function send(mode: 'ai' | 'raw') {
    if (!text.trim()) return;
    setSending(mode);
    setError(null);
    setLastAiText(null);
    try {
      const r = await fetch('/api/recruit/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text.trim(), mode }),
      });
      const ct = r.headers.get('content-type') || '';
      const j = ct.includes('application/json') ? await r.json() : null;
      if (!r.ok || j?.error) {
        throw new Error(j?.error || `HTTP ${r.status}`);
      }
      if (mode === 'ai' && j?.final_text && j.final_text !== text.trim()) {
        setLastAiText(j.final_text as string);
      }
      setText('');
      await onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white px-5 py-3">
      {error && (
        <div className="mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5 flex items-start gap-2">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          <span className="break-words">{error}</span>
        </div>
      )}
      {lastAiText && (
        <div className="mb-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
          <strong>ИИ переписал и отправил:</strong> «{lastAiText.slice(0, 200)}{lastAiText.length > 200 ? '…' : ''}»
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void send('ai');
          }
        }}
        rows={2}
        placeholder="Коротко суть, что сказать кандидату (например: «аренда 2000 в день, можно сегодня выйти»). ИИ перепишет тепло и человечески. Cmd/Ctrl+Enter — отправить через ИИ."
        className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none resize-y"
      />
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-[10px] text-gray-400">
          После отправки бот перестанет писать — переключатель «Общаюсь сам» включится автоматически.
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => send('raw')}
            disabled={!text.trim() || !!sending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-40"
            title="Отправить дословно — то, что ты ввёл, попадёт прямо кандидату"
          >
            <Send size={12} />
            {sending === 'raw' ? 'Отправка…' : 'Отправить как есть'}
          </button>
          <button
            onClick={() => send('ai')}
            disabled={!text.trim() || !!sending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-md hover:bg-violet-700 disabled:opacity-40"
            title="ИИ перепишет твою суть в человеческое сообщение и отправит"
          >
            <Sparkles size={12} />
            {sending === 'ai' ? 'ИИ пишет…' : 'Написать с ИИ и отправить'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dialog row in left list ──────────────────────────────────────────
function DialogRow({ dialog, active, onClick }: { dialog: DialogSummary; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-blue-50/40 transition-colors ${
        active ? 'bg-blue-50' : 'bg-white'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <Avatar text={dialog.who || dialog.username || dialog.chat_id} small />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-gray-900 truncate">
              {dialog.who || dialog.username || `чат ${dialog.chat_id}`}
            </div>
            <div className="text-[10px] text-gray-500 flex-shrink-0">{fmtMsk(dialog.last_at, true)}</div>
          </div>
          <div className="text-[11px] text-gray-500 truncate">
            {dialog.last_direction === 'out' && <span className="text-blue-600">Бот: </span>}
            {dialog.last_text ?? '—'}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {dialog.stage && <StageBadge stage={dialog.stage} small />}
            <span className="text-[10px] text-gray-400">{dialog.msg_count} сообщ.</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Bubble ───────────────────────────────────────────────────────────
function Bubble({ message, prev }: { message: DialogMessage; prev?: DialogMessage }) {
  const isOut = message.direction === 'out';
  const showDayDivider =
    !prev ||
    fmtMsk(prev.created_at, false) !== fmtMsk(message.created_at, false);
  return (
    <>
      {showDayDivider && (
        <div className="flex items-center my-3">
          <div className="flex-1 border-t border-gray-200" />
          <span className="px-2 text-[10px] font-medium text-gray-500">{fmtMsk(message.created_at, false)}</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>
      )}
      <div className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[75%] rounded-2xl px-3 py-2 ${
            isOut
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
          }`}
        >
          <div className="text-sm whitespace-pre-wrap break-words leading-snug">
            {message.text || <span className="opacity-60 italic">(пусто)</span>}
          </div>
          <div className={`text-[10px] mt-1 flex items-center gap-1 ${isOut ? 'text-blue-100' : 'text-gray-400'}`}>
            <Clock size={9} />
            {fmtMsk(message.created_at, true).split(' ').slice(-1)[0]}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────
function Avatar({ text, small }: { text: string; small?: boolean }) {
  const ch = (text || '?').trim().charAt(0).toUpperCase();
  const size = small ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';
  return (
    <div className={`${size} flex-shrink-0 bg-gradient-to-br from-blue-500 to-violet-500 text-white font-semibold rounded-full flex items-center justify-center`}>
      {ch || <UserIcon size={small ? 14 : 18} />}
    </div>
  );
}

function StageBadge({ stage, small }: { stage: string; small?: boolean }) {
  const color = STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  const label = STAGE_LABELS[stage] ?? stage;
  return (
    <span className={`inline-block border rounded ${color} ${small ? 'text-[10px] px-1.5 py-0' : 'text-[11px] px-2 py-0.5'}`}>
      {label}
    </span>
  );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4">
      <div className="mb-3">{icon}</div>
      <h2 className="text-sm font-medium text-gray-700">{title}</h2>
      {hint && <p className="text-xs text-gray-500 mt-1 max-w-xs">{hint}</p>}
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
