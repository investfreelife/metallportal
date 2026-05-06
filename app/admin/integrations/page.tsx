import type { Metadata } from "next";
import { PROVIDERS, PROVIDER_ORDER } from "@/lib/integrations/_providers";
import IntegrationTile from "@/components/admin/integrations/IntegrationTile";

export const metadata: Metadata = {
  title: "Интеграции | Админ-панель",
  robots: { index: false },
};

/**
 * /admin/integrations — main page с tiles для всех providers.
 *
 * AdminGuard уже наложен через app/admin/layout.tsx (m001/m002).
 * Tiles — client components (нужны fetch + buttons), но registry-data
 * передаётся серверно через props.
 */
export default function IntegrationsPage() {
  return (
    <div className="container-main py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Интеграции</h1>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
          Подключение к внешним сервисам. Каждая интеграция работает
          независимо — отключение одного не влияет на остальные. OAuth-токены
          хранятся в зашифрованном виде (pgcrypto + master-key из Vercel env).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROVIDER_ORDER.map((slug) => (
          <IntegrationTile key={slug} provider={slug} meta={PROVIDERS[slug]} />
        ))}
      </div>

      <div className="mt-10 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-300/80 leading-relaxed">
        <strong className="text-blue-300">База готова</strong> (n004). Provider-specific
        логика (Yandex tiles m007 + social m008) добавляется через placeholder
        clients в <code>lib/integrations/{"{provider}"}.ts</code>. OAuth flow
        работает для любого <code>authMethod: 'oauth2'</code> provider'а — нужны
        только <code>{"{PROVIDER}_OAUTH_CLIENT_ID"}</code> /{" "}
        <code>{"{PROVIDER}_OAUTH_CLIENT_SECRET"}</code> в Vercel env.
      </div>
    </div>
  );
}
