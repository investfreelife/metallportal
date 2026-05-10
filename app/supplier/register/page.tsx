import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";
import SupplierRegisterClient from "./SupplierRegisterClient";

export const metadata = {
  title: "Регистрация поставщика — Харланметалл",
  description: "Заполните заявку для регистрации поставщика на Харланметалл. KYC модерация — 1-2 рабочих дня.",
};

export const dynamic = "force-dynamic"; // auth-aware

/**
 * ТЗ #044 — public registration page для suppliers.
 *
 * Auth flow:
 *   - anonymous → render form, but require login сначала через signup-link
 *   - logged in + already supplier → redirect к dashboard
 *   - logged in + has pending application → render form readonly (status banner)
 *   - logged in + no application → render form
 *
 * Sergey directive: «не делай отдельный signup для suppliers, используй existing
 * /login + /register». Form requires user be logged in. CTA выше отправляет
 * на /register?redirect=/supplier/register если nil.
 */
export default async function SupplierRegisterPage() {
  const user = await getCurrentUser();

  if (!user) {
    // Push к existing register flow с redirect-back
    redirect("/register?redirect=/supplier/register");
  }

  const admin = createAdminClient();

  // Check if уже есть supplier row → dashboard
  const { data: existingSupplier } = await admin
    .from("suppliers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingSupplier) {
    redirect("/supplier/dashboard");
  }

  // Check if есть pending/rejected application
  const { data: existingApp } = await (admin as any)
    .from("seller_applications")
    .select("id, status, rejection_reason, created_at, company_name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="container-main py-10 max-w-3xl">
      <SupplierRegisterClient
        userEmail={user.email ?? ""}
        existingApplication={existingApp ?? null}
      />
    </div>
  );
}
