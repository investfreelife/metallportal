"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";

interface Application {
  id: string;
  user_id: string;
  user_email: string;
  company_name: string;
  legal_form: string;
  inn: string;
  ogrn: string | null;
  legal_address: string;
  bank_name: string | null;
  bank_account: string | null;
  bik: string | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  regions_served: string[];
  product_categories_planned: string[];
  documents_url: string | null;
  documents_count: number;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  seller_id: string | null;
  created_at: string;
}

interface Props {
  applications: Application[];
  statusFilter: "pending" | "approved" | "rejected";
}

const REGIONS_LABELS: Record<string, string> = {
  MO: "Москва и МО",
  SPB: "Санкт-Петербург и ЛО",
  CFO: "Центральный ФО",
  PFO: "Приволжский ФО",
  UFO: "Уральский ФО",
  SFO: "Сибирский ФО",
  DFO: "Дальневосточный ФО",
  SZFO: "Северо-Западный ФО",
  YUFO: "Южный ФО",
  SKFO: "Северо-Кавказский ФО",
  ALL_RU: "Вся Россия",
};

const LEGAL_FORM_LABELS: Record<string, string> = {
  OOO: "ООО",
  IP: "ИП",
  AO: "АО",
  PAO: "ПАО",
  other: "Другое",
};

export default function ApplicationsQueueClient({ applications, statusFilter }: Props) {
  if (applications.length === 0) {
    const empty = {
      pending: "Нет заявок на рассмотрении",
      approved: "Нет одобренных заявок",
      rejected: "Нет отклонённых заявок",
    };
    return (
      <div className="bg-[#161628] border border-gray-800 rounded-lg p-12 text-center text-gray-500">
        {empty[statusFilter]}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((app) => (
        <ApplicationRow key={app.id} app={app} />
      ))}
    </div>
  );
}

function ApplicationRow({ app }: { app: Application }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(app.status === "pending");
  const [acting, setActing] = useState<"none" | "approve" | "reject">("none");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  async function handleApprove() {
    if (!confirm(`Одобрить заявку «${app.company_name}»? Будет создан supplier row.`)) return;
    setActing("approve");
    setError(null);
    try {
      const res = await fetch(`/api/admin/sellers/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка одобрения");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Не удалось одобрить");
      setActing("none");
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      setError("Укажите причину отклонения");
      return;
    }
    setActing("reject");
    setError(null);
    try {
      const res = await fetch(`/api/admin/sellers/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejection_reason: rejectReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка отклонения");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Не удалось отклонить");
      setActing("none");
    }
  }

  return (
    <div className="bg-[#161628] border border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-[#1a1a30]"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-200 font-mono">
            {LEGAL_FORM_LABELS[app.legal_form] || app.legal_form}
          </span>
          <p className="font-bold truncate">{app.company_name}</p>
          <p className="text-xs text-gray-500">ИНН: {app.inn}</p>
          <p className="text-xs text-gray-500 hidden md:block">{formatDate(app.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={app.status} />
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-4">
          {/* Details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <DetailRow label="ИНН" value={app.inn} />
            <DetailRow label="ОГРН" value={app.ogrn || "—"} />
            <DetailRow label="Юр. адрес" value={app.legal_address} fullWidth />
            <DetailRow label="Банк" value={app.bank_name || "—"} />
            <DetailRow label="БИК" value={app.bik || "—"} />
            <DetailRow label="Расчётный счёт" value={app.bank_account || "—"} fullWidth />
            <DetailRow label="Контакт" value={app.contact_name} />
            <DetailRow label="Телефон" value={app.contact_phone} />
            <DetailRow label="Email" value={app.contact_email} />
            <DetailRow label="User account" value={app.user_email} />
            <DetailRow
              label="Регионы"
              value={app.regions_served.map((r) => REGIONS_LABELS[r] || r).join(", ")}
              fullWidth
            />
            <DetailRow
              label="Категории"
              value={app.product_categories_planned.join(", ")}
              fullWidth
            />
            {app.documents_url && (
              <DetailRow
                label="Документы"
                value={
                  <a
                    href={app.documents_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-400 hover:underline inline-flex items-center gap-1"
                  >
                    Открыть <ExternalLink size={12} />
                  </a>
                }
                fullWidth
              />
            )}
            {app.rejection_reason && (
              <DetailRow label="Причина отказа" value={app.rejection_reason} fullWidth />
            )}
            {app.seller_id && <DetailRow label="Supplier ID" value={app.seller_id} fullWidth />}
            {app.reviewed_at && (
              <DetailRow label="Рассмотрено" value={formatDate(app.reviewed_at)} fullWidth />
            )}
          </div>

          {/* Actions — pending only */}
          {app.status === "pending" && (
            <div className="border-t border-gray-800 pt-4 space-y-3">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded p-2 text-xs">
                  {error}
                </div>
              )}

              {!showReject ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    disabled={acting !== "none"}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
                  >
                    {acting === "approve" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Одобрить
                  </button>
                  <button
                    onClick={() => setShowReject(true)}
                    disabled={acting !== "none"}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold disabled:opacity-50"
                  >
                    <XCircle size={16} /> Отклонить
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Причина отклонения (будет показана заявителю)"
                    rows={2}
                    className="w-full bg-[#0d0d1a] border border-gray-700 rounded px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReject}
                      disabled={acting !== "none"}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50"
                    >
                      {acting === "reject" ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                      Подтвердить отклонение
                    </button>
                    <button
                      onClick={() => {
                        setShowReject(false);
                        setRejectReason("");
                        setError(null);
                      }}
                      disabled={acting !== "none"}
                      className="px-4 py-2 rounded border border-gray-700 text-gray-400 hover:text-white disabled:opacity-50"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const styles = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  };
  const labels = { pending: "Ожидает", approved: "Одобрено", rejected: "Отклонено" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function DetailRow({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}>
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-white break-words">{value}</p>
    </div>
  );
}
