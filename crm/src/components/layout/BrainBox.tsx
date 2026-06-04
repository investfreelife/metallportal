'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, Send, X, Loader2, AlertCircle, History, ChevronUp, ChevronDown, Brain } from 'lucide-react';
import { fmtMsk } from '@/lib/tz';

/**
 * BrainBox — глобальное окно «Обратиться к мозгу» внизу страницы.
 * Sergey directive 2026-06-04: пишешь «поставь даты постам», локальный
 * демон видит status='new' в crm_commands → выполняет → возвращает response.
 *
 * Поллинг конкретной команды — каждые 3 сек, пока status не done/error.
 * История последних 3 ответов на ЭТОЙ странице — сворачиваемая.
 */

interface Command {
  id: string;
  page: string | null;
  text: string | null;
  status: 'new' | 'working' | 'done' | 'error' | string | null;
  response: string | null;
  created_at: string;
  done_at?: string | null;
}

const POLL_MS = 3_000;

export default function BrainBox() {
  const pathname = usePathname();
  const [text, setText] = useState('');
  const [activeCmd, setActiveCmd] = useState<Command | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Command[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Очистка спиннера: останавливает интервал и сбрасывает active. */
  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }

  /** Подтянуть историю по текущей странице. */
  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch(`/api/recruit/command?page=${encodeURIComponent(pathname || '/')}`, { cache: 'no-store' });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) return;
      const j = await r.json();
      if (r.ok && !j.error) setHistory(j.history ?? []);
    } catch {/* silent */}
  }, [pathname]);

  useEffect(() => {
    loadHistory();
    return () => { stopPolling(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function send() {
    const txt = text.trim();
    if (!txt || sending) return;
    setSending(true); setError(null);
    try {
      const r = await fetch('/api/recruit/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: pathname || '/', text: txt }),
      });
      const ct = r.headers.get('content-type') || '';
      const j = ct.includes('application/json') ? await r.json() : null;
      if (!r.ok || j?.error) throw new Error(j?.error || `HTTP ${r.status}`);
      const cmd = j.command as Command;
      setActiveCmd(cmd);
      setText('');
      // запускаем poll
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const r2 = await fetch(`/api/recruit/command?id=${cmd.id}`, { cache: 'no-store' });
          const ct2 = r2.headers.get('content-type') || '';
          if (!ct2.includes('application/json')) return;
          const j2 = await r2.json();
          if (!r2.ok || j2?.error) return;
          const got = j2.command as Command;
          setActiveCmd(got);
          if (got?.status === 'done' || got?.status === 'error') {
            stopPolling();
            loadHistory();
          }
        } catch {/* keep trying */}
      }, POLL_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  const working = activeCmd && (activeCmd.status === 'new' || activeCmd.status === 'working');
  const responseReady = activeCmd && (activeCmd.status === 'done' || activeCmd.status === 'error');

  return (
    <div className="sticky bottom-0 z-30 w-full bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      {/* ── Карточка ответа / спиннер ──────────────────────────── */}
      {(working || responseReady) && (
        <div className="border-b border-gray-100 px-4 py-2 bg-gray-50/60">
          {working && (
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <Loader2 size={12} className="animate-spin text-blue-600" />
              <span><strong>🧠 Думаю…</strong> {activeCmd?.text}</span>
            </div>
          )}
          {responseReady && (
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-500 mb-0.5 flex items-center gap-1.5">
                  <Brain size={10} />
                  Мозг ответил на: «{(activeCmd?.text ?? '').slice(0, 80)}{(activeCmd?.text?.length ?? 0) > 80 ? '…' : ''}»
                  {activeCmd?.done_at && <span>· {fmtMsk(activeCmd.done_at, true)} МСК</span>}
                </div>
                <div className={`text-xs whitespace-pre-wrap break-words ${activeCmd?.status === 'error' ? 'text-red-700' : 'text-gray-800'}`}>
                  {activeCmd?.response || (activeCmd?.status === 'error' ? '(ошибка без описания)' : '(пусто)')}
                </div>
              </div>
              <button
                onClick={() => { setActiveCmd(null); stopPolling(); }}
                className="p-1 text-gray-400 hover:text-gray-700 flex-shrink-0"
                title="Закрыть"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Ошибка отправки ──────────────────────────────────── */}
      {error && (
        <div className="px-4 py-1.5 bg-red-50 border-b border-red-200 text-[11px] text-red-700 flex items-center gap-1.5">
          <AlertCircle size={11} /> {error}
        </div>
      )}

      {/* ── Поле ввода ────────────────────────────────────────── */}
      <div className="px-4 py-2.5 flex items-end gap-2">
        <Sparkles size={14} className="text-violet-500 flex-shrink-0 mb-2" />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          rows={collapsed ? 1 : 2}
          placeholder={collapsed
            ? 'Обратиться к мозгу…'
            : 'Напишите мозгу: поставь даты постам, проверь воронку, добавь факт… (выполню и отвечу здесь). Cmd/Ctrl+Enter — отправить'}
          className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none resize-none"
        />
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={send}
            disabled={sending || !text.trim() || !!working}
            className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-md hover:bg-violet-700 disabled:opacity-40"
            title={working ? 'Мозг ещё думает над предыдущей' : 'Отправить мозгу (Cmd/Ctrl+Enter)'}
          >
            <Send size={11} />
            {sending ? '…' : 'Мозгу'}
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center justify-center gap-0.5 px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-800"
            title={collapsed ? 'Развернуть' : 'Свернуть'}
          >
            {collapsed ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>
      </div>

      {/* ── История ──────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-1.5 text-[10px]">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800"
          >
            <History size={10} />
            История ({history.length})
            {historyOpen ? <ChevronDown size={9} /> : <ChevronUp size={9} />}
          </button>
          {historyOpen && (
            <ul className="mt-1 space-y-1">
              {history.map((h) => (
                <li key={h.id} className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                  <div className="text-[10px] text-gray-500 truncate">
                    {h.done_at ? `${fmtMsk(h.done_at, true)} МСК` : fmtMsk(h.created_at, true)} ·
                    <span className={`ml-1 ${h.status === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
                      {h.status === 'error' ? 'ошибка' : 'готово'}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-800 truncate">
                    <strong>«{(h.text ?? '').slice(0, 60)}{(h.text?.length ?? 0) > 60 ? '…' : ''}»</strong>
                    {h.response && <span className="text-gray-600"> → {h.response.slice(0, 120)}{h.response.length > 120 ? '…' : ''}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
