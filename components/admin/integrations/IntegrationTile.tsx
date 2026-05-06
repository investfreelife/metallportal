"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, RotateCw, Power, AlertCircle } from "lucide-react";
import type {
  IntegrationProviderSlug,
  IntegrationStatus,
} from "@/lib/integrations/_base";
import type { ProviderMetadata } from "@/lib/integrations/_base";

interface Props {
  provider: IntegrationProviderSlug;
  meta: ProviderMetadata;
}

interface StatusResp {
  provider: IntegrationProviderSlug;
  displayName: string;
  status: IntegrationStatus | "not_configured";
  metadata: Record<string, unknown>;
  last_error?: string | null;
  expires_at?: string | null;
  connected_at?: string | null;
}

const STATUS_LABEL: Record<StatusResp["status"], { text: string; color: string; icon: string }> = {
  connected: { text: "Подключено", color: "text-emerald-400", icon: "🟢" },
  pending: { text: "В процессе…", color: "text-amber-400", icon: "🟡" },
  expired: { text: "Истёк токен — переподключи", color: "text-amber-500", icon: "🟠" },
  revoked: { text: "Отключено", color: "text-zinc-400", icon: "⚫" },
  error: { text: "Ошибка", color: "text-red-400", icon: "🔴" },
  not_configured: { text: "Не подключено", color: "text-zinc-500", icon: "⚪" },
};

export default function IntegrationTile({ provider, meta }: Props) {
  const [data, setData] = useState<StatusResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/integrations/${provider}/status`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as StatusResp;
      setData(j);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "fetch failed");
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [provider]);

  const handleConnect = () => {
    if (meta.authMethod === "oauth2") {
      // Redirect — браузер уйдёт на provider's authorize URL.
      window.location.href = `/api/integrations/${provider}/connect`;
    } else if (meta.authMethod === "service-account") {
      // Voximplant — env-based, нечего connecting'ать через UI.
      alert(
        "Этот сервис настраивается через переменные окружения Vercel. См. документацию провайдера.",
      );
    } else {
      // token / webhook — переходим на settings page для manual paste / setup.
      window.location.href = `/admin/integrations/${provider}`;
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Отключить ${meta.displayName}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/integrations/${provider}/disconnect`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      await fetchStatus();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "disconnect failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/integrations/${provider}/refresh`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      await fetchStatus();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "refresh failed");
    } finally {
      setBusy(false);
    }
  };

  const status = data?.status ?? "not_configured";
  const lbl = STATUS_LABEL[status];
  const isConnected = status === "connected";

  return (
    <div className="bg-[#15151e] border border-zinc-700/50 rounded-xl p-5 hover:border-gold/40 transition-colors flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          className="text-3xl flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: meta.brandColor ? meta.brandColor + "20" : undefined }}
        >
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white text-base">{meta.displayName}</h3>
            {meta.docsUrl && (
              <Link
                href={meta.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-zinc-300"
                title="Документация провайдера"
              >
                <ExternalLink size={14} />
              </Link>
            )}
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed mt-1">
            {meta.shortDescription}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span>{lbl.icon}</span>
        <span className={lbl.color}>{lbl.text}</span>
        {data?.connected_at && isConnected && (
          <span className="text-xs text-zinc-500 ml-auto">
            с {new Date(data.connected_at).toLocaleDateString("ru-RU")}
          </span>
        )}
      </div>

      {data?.last_error && (
        <div className="text-xs bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-red-300 flex gap-2">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span className="break-words">{data.last_error}</span>
        </div>
      )}

      {data && Object.keys(data.metadata).length > 0 && isConnected && (
        <dl className="text-xs space-y-1 bg-black/20 rounded-lg p-2.5">
          {Object.entries(data.metadata).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-zinc-500">{k}</dt>
              <dd className="text-zinc-300 truncate">{String(v ?? "—")}</dd>
            </div>
          ))}
        </dl>
      )}

      {err && (
        <div className="text-xs bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-red-300">
          {err}
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        {isConnected ? (
          <>
            <button
              onClick={handleDisconnect}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
              Отключить
            </button>
            {meta.authMethod === "oauth2" && (
              <button
                onClick={handleRefresh}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 text-xs border border-zinc-700 hover:border-gold/50 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors"
                title="Refresh access token"
              >
                <RotateCw size={12} />
              </button>
            )}
          </>
        ) : (
          <button
            onClick={handleConnect}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm bg-gold hover:bg-yellow-400 disabled:opacity-50 text-black font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            Подключить
          </button>
        )}
      </div>
    </div>
  );
}
