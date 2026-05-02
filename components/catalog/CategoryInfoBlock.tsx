"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Phone, FileDown } from "lucide-react";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/contact";

/**
 * Info-блок для категорий каталога: короткое описание, длинный markdown
 * (seo_text), кнопка "Скачать ГОСТ" и CTA "Получить цену".
 *
 * Закрывает W2-3 — info-only category pages (каталог-категории без SKU,
 * только описание + ГОСТ + контакт). Пример: `armatura-a500sneu-a1000`.
 *
 * Безопасность: react-markdown по дефолту НЕ рендерит сырой HTML
 * (rehypeRaw отсутствует в plugins) → XSS-resistant. `<a>` всегда
 * открывается в новой вкладке с rel="noopener noreferrer".
 */

export type CategoryInfo = {
  description?: string | null;
  seo_text?: string | null;
  gost_url?: string | null;
  cta_label?: string | null;
  cta_action?: string | null;
};

type Props = {
  info: CategoryInfo;
  /**
   * Если true — заголовка категории на странице нет (пользователь рендерит
   * только этот блок, info-only режим). Тогда внутри блока ничего не должно
   * полагаться на heading.
   */
  standalone?: boolean;
};

/**
 * Возвращает true если у категории есть хоть какое-то наполнение которое
 * стоит показать (description / seo_text / gost_url). На пустой категории
 * блок не рендерится.
 */
export function hasCategoryInfo(info: CategoryInfo): boolean {
  return Boolean(info.description || info.seo_text || info.gost_url);
}

export default function CategoryInfoBlock({ info, standalone = false }: Props) {
  if (!hasCategoryInfo(info)) return null;

  return (
    <section
      className={`rounded-xl border border-border bg-card p-6 ${standalone ? "mb-0" : "mb-6"}`}
    >
      {info.description && (
        <p className="text-base text-foreground/85 leading-relaxed mb-4">
          {info.description}
        </p>
      )}

      {info.seo_text && (
        <div className="prose prose-sm dark:prose-invert max-w-none mb-2 prose-headings:text-foreground prose-strong:text-foreground prose-a:text-gold">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Все markdown-ссылки открываются в новой вкладке с safe rel.
              a: ({ ...props }) => (
                <a {...props} target="_blank" rel="noopener noreferrer" />
              ),
            }}
          >
            {info.seo_text}
          </ReactMarkdown>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-5">
        {info.gost_url && (
          <a
            href={info.gost_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-gold hover:text-gold"
          >
            <FileDown size={15} /> Скачать ГОСТ (PDF)
          </a>
        )}
        {info.cta_action === "phone" && (
          <a
            href={`tel:${CONTACT_PHONE_TEL}`}
            className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-yellow-400"
          >
            <Phone size={15} />
            {info.cta_label ?? "Получить цену"}{" "}
            <span className="opacity-70">— {CONTACT_PHONE_DISPLAY}</span>
          </a>
        )}
      </div>
    </section>
  );
}
