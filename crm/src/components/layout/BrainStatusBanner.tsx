'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * BrainStatusBanner — глобальная sticky-полоса сверху на всех страницах
 * дашборда CRM. Показывается ТОЛЬКО когда фоновый watchdog поставил
 * channels.config.kind='brain_status' {ok:false, error:...}.
 *
 * Sergey directive 2026-06-04: «крупный красный баннер во всю ширину
 * на всех страницах CRM, чтобы я сразу видел и вернул мозг через
 * `claude login`».
 *
 * Поллинг каждые 30с (без особо большой частоты — мозг отвалился, не
 * нужно бомбить и без того сломанный бэк).
 */
const POLL_MS = 30_000;

interface BrainState {
  ok: boolean;
  error?: string | null;
}

export default function BrainStatusBanner() {
  const [state, setState] = useState<BrainState>({ ok: true });

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const r = await fetch('/api/recruit/brain-status', { cache: 'no-store' });
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return;
        const j = await r.json();
        if (!alive) return;
        // Если эндпоинт сам вернул ошибку (401 на /login и т.п.) — не рисуем.
        if (!r.ok || (j as { error?: string }).error) return;
        setState({ ok: j.ok !== false, error: j.error ?? null });
      } catch {
        // тихо: не баннерим из-за сетевых сбоев самого баннера
      }
    }
    check();
    const id = setInterval(check, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (state.ok) return null;

  return (
    <div
      className="sticky top-0 z-[60] w-full bg-red-600 text-white shadow-md animate-pulse"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3 px-4 py-2.5">
        <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm sm:text-base font-bold tracking-wide">
            🔴 МОЗГ ОТВАЛИЛСЯ — бот на резерве. Верните: Терминал → <code className="bg-red-700/60 px-1.5 py-0.5 rounded">claude login</code>
          </div>
          {state.error && (
            <div className="text-[11px] sm:text-xs text-red-100 mt-0.5 break-words">
              {state.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
