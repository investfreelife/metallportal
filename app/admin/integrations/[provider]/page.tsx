import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  PROVIDERS,
  isValidProvider,
  PROVIDER_ORDER,
} from "@/lib/integrations/_providers";

interface Props {
  params: { provider: string };
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return PROVIDER_ORDER.map((slug) => ({ provider: slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  if (!isValidProvider(params.provider)) return { title: "Не найдено" };
  const meta = PROVIDERS[params.provider];
  return {
    title: `${meta.displayName} | Интеграции | Админ-панель`,
    robots: { index: false },
  };
}

/**
 * Provider-specific settings page (placeholder для m007/m008).
 *
 * m007 (Yandex stack) добавит здесь:
 *   - yandex_direct → список campaigns + перевод бюджета между ad-groups
 *   - yandex_metrika → выбор counter ID + goals mapping (lead_submit_landing_*)
 *   - yandex_maps    → форма для NAP (phone/address/hours)
 *   - yandex_zen     → channel ID + auto-publish toggle
 *
 * m008 (social) добавит:
 *   - vk            → выбор группы + auto-post on new landing/article
 *   - telegram_bot  → канал ID + paid-channel настройки
 *
 * Сейчас просто placeholder с meta info + ссылка на docs.
 */
export default function ProviderSettingsPage({ params }: Props) {
  if (!isValidProvider(params.provider)) return notFound();
  const meta = PROVIDERS[params.provider];

  return (
    <div className="container-main py-8 max-w-3xl">
      <Link
        href="/admin/integrations"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-6"
      >
        <ChevronLeft size={16} />
        Все интеграции
      </Link>

      <div className="flex items-start gap-4 mb-8">
        <div
          className="text-4xl flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: meta.brandColor ? meta.brandColor + "20" : undefined }}
        >
          {meta.icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{meta.displayName}</h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-xl leading-relaxed">
            {meta.shortDescription}
          </p>
        </div>
      </div>

      <div className="bg-[#15151e] border border-zinc-700/50 rounded-xl p-6 space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-zinc-500">Slug</span>
          <code className="text-zinc-300">{meta.slug}</code>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-zinc-500">Метод авторизации</span>
          <span className="text-zinc-300">{meta.authMethod}</span>
        </div>
        {meta.oauthScopes && meta.oauthScopes.length > 0 && (
          <div className="flex justify-between gap-3">
            <span className="text-zinc-500">OAuth scopes</span>
            <code className="text-zinc-300 text-xs">{meta.oauthScopes.join(", ")}</code>
          </div>
        )}
        {meta.docsUrl && (
          <div className="flex justify-between gap-3">
            <span className="text-zinc-500">Документация</span>
            <Link
              href={meta.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              {new URL(meta.docsUrl).hostname}
            </Link>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-200/80 leading-relaxed">
        <strong className="text-amber-300">Provider-specific настройки</strong>{" "}
        будут добавлены в{" "}
        {meta.slug.startsWith("yandex_")
          ? "m007 (Yandex stack)"
          : meta.slug === "vk" || meta.slug === "telegram_bot"
            ? "m008 (social channels)"
            : "следующих ТЗ"}{" "}
        — выбор кампаний / каналов / сценариев + статистика. Сейчас доступен
        только base connect/disconnect через главную страницу{" "}
        <Link
          href="/admin/integrations"
          className="text-blue-400 hover:underline"
        >
          /admin/integrations
        </Link>
        .
      </div>
    </div>
  );
}
