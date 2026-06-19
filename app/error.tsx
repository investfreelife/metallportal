"use client";

/**
 * TASK_054 (audit 2026-06-18 SEV-2): app-level graceful UI при ошибках в
 * Server Components / page.tsx render. Без этого Next отдаёт пустой
 * стандартный экран с UNCAUGHT ERROR в логе.
 *
 * Note: error boundary НЕ ловит errors в layout.tsx — это покрывает
 * global-error.tsx (отдельный файл, монтирует свой <html>).
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-md text-center space-y-5">
        <div className="inline-flex w-16 h-16 rounded-full bg-gold/10 items-center justify-center mx-auto">
          <AlertTriangle size={32} className="text-gold" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Что-то пошло не так</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Мы уже видим эту ошибку и&nbsp;разбираемся. Попробуйте обновить
          страницу или вернитесь на&nbsp;главную.
          {error.digest && (
            <span className="block mt-2 font-mono text-xs text-muted-foreground/60">
              ref: {error.digest}
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-semibold px-5 py-2.5 rounded-lg transition-all"
          >
            <RefreshCw size={16} /> Обновить
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 border border-border hover:border-gold text-foreground px-5 py-2.5 rounded-lg transition-all"
          >
            <Home size={16} /> На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
