import Link from "next/link";
import { createAdminClient } from "@/lib/supabase";
import ApplicationsQueueClient from "./ApplicationsQueueClient";

/**
 * ТЗ #044 — Admin queue для seller applications.
 *
 * Layout protection: AdminGuard в /app/admin/layout.tsx auto-gates по profiles.role='admin'.
 *
 * Renders:
 *   - Stats: pending / approved / rejected counts
 *   - Filter tabs (по status)
 *   - Table per application с full details + approve/reject actions
 */

export const metadata = {
  title: "Заявки поставщиков | Админ",
  description: "Очередь заявок на регистрацию поставщиков",
};

export const dynamic = "force-dynamic";

export default async function ApplicationsQueuePage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const admin = createAdminClient();

  const statusFilter = ["pending", "approved", "rejected"].includes(searchParams?.status ?? "")
    ? (searchParams!.status as "pending" | "approved" | "rejected")
    : "pending";

  // Stats — counts by status
  const { data: statsRows } = await (admin as any)
    .from("seller_applications")
    .select("status");
  const stats = {
    pending: (statsRows ?? []).filter((r: any) => r.status === "pending").length,
    approved: (statsRows ?? []).filter((r: any) => r.status === "approved").length,
    rejected: (statsRows ?? []).filter((r: any) => r.status === "rejected").length,
    total: (statsRows ?? []).length,
  };

  // Applications list через admin view (joins email)
  const { data: applications, error } = await (admin as any)
    .from("seller_applications_admin")
    .select("*")
    .eq("status", statusFilter)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) console.error("[admin/sellers/applications] err:", error);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Заявки поставщиков</h1>
        <p className="text-sm text-gray-400">
          KYC модерация — review documents → approve creates supplier row
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Всего" value={stats.total} />
        <StatCard label="Ожидают" value={stats.pending} highlight={stats.pending > 0} />
        <StatCard label="Одобрены" value={stats.approved} />
        <StatCard label="Отклонены" value={stats.rejected} />
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 border-b border-gray-800">
        {(["pending", "approved", "rejected"] as const).map((s) => {
          const labels = { pending: "Ожидают", approved: "Одобрены", rejected: "Отклонены" };
          const counts = stats[s];
          return (
            <Link
              key={s}
              href={`/admin/sellers/applications?status=${s}`}
              className={`px-4 py-2 -mb-px border-b-2 transition-colors ${
                statusFilter === s
                  ? "border-yellow-400 text-yellow-400 font-bold"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {labels[s]} <span className="text-xs">({counts})</span>
            </Link>
          );
        })}
      </div>

      {/* Applications */}
      <ApplicationsQueueClient
        applications={applications ?? []}
        statusFilter={statusFilter}
      />
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`bg-[#161628] border ${highlight ? "border-yellow-400/40" : "border-gray-800"} rounded-lg p-4`}>
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-black ${highlight ? "text-yellow-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
