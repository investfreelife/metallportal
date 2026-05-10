import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";
import SupplierDashboardClient from "./SupplierDashboardClient";

/**
 * Supplier dashboard MVP (ТЗ #039 / LAW-marketplace-architecture Phase 1).
 *
 * Auth flow:
 *   1. getCurrentUser() через SSR cookies → redirect к /login если nil
 *   2. Lookup в suppliers WHERE user_id = auth.uid()
 *   3. Если нет supplier record → redirect к /supplier (registration page)
 *   4. Render dashboard с own offers + canonical catalog browse + activate flow
 *
 * RLS на seller_offers (#037 migration) автоматически scopes к own offers через
 * suppliers.user_id == auth.uid() — нам нужен только service-role-like чтение
 * canonical catalog (через admin client) для browse view.
 */

export const metadata = {
  title: "Личный кабинет поставщика — Харланметалл",
  description: "Управление офферами, ценами и остатками в каталоге Харланметалл.",
};

export const dynamic = "force-dynamic"; // auth-scoped — never static

export default async function SupplierDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/supplier/dashboard");

  const admin = createAdminClient();

  // Lookup supplier record для current user
  const { data: supplier } = (await admin
    .from("suppliers")
    .select("id, company_name, inn, is_verified, is_active, contact_email, region, city, rating")
    .eq("user_id", user.id)
    .single()) as { data: any | null };

  if (!supplier) {
    redirect("/supplier?error=not-registered");
  }

  // Fetch own offers with product details
  const { data: ownOffersRaw } = await (admin as any)
    .from("seller_offers")
    .select(`
      id, product_id, base_price, final_price, currency, unit,
      in_stock, stock_quantity, min_quantity, lead_time_days,
      is_active, is_buy_box, valid_until, updated_at
    `)
    .eq("seller_id", supplier.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  const ownOffers = ownOffersRaw ?? [];

  // Hydrate с product names
  const productIds = Array.from(new Set(ownOffers.map((o: any) => o.product_id)));
  let productsMap = new Map<string, any>();
  if (productIds.length > 0) {
    const { data: products } = await admin
      .from("products")
      .select("id, name, slug")
      .in("id", productIds);
    productsMap = new Map((products ?? []).map((p: any) => [p.id, p]));
  }
  const offersWithProducts = ownOffers.map((o: any) => ({
    ...o,
    product: productsMap.get(o.product_id) ?? null,
  }));

  // Stats
  const stats = {
    total_offers: ownOffers.length,
    active_offers: ownOffers.filter((o: any) => o.is_active).length,
    in_stock: ownOffers.filter((o: any) => o.is_active && o.in_stock).length,
    buy_box_winners: ownOffers.filter((o: any) => o.is_buy_box).length,
  };

  return (
    <div className="container-main py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-foreground">{supplier.company_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ИНН: {supplier.inn ?? "—"}
            {supplier.region && ` · ${supplier.region}`}
            {supplier.city && `, ${supplier.city}`}
            {supplier.is_verified && (
              <span className="inline-block ml-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-xs rounded">
                ✓ Верифицирован
              </span>
            )}
          </p>
        </div>
        <Link
          href="/api/auth/logout"
          className="text-sm text-muted-foreground hover:text-gold transition-colors"
        >
          Выйти →
        </Link>
      </div>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Всего офферов", value: stats.total_offers, gold: false },
          { label: "Активных", value: stats.active_offers, gold: false },
          { label: "В наличии", value: stats.in_stock, gold: false },
          { label: "Buy Box winners", value: stats.buy_box_winners, gold: true },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-3xl font-black ${s.gold ? "text-gold" : "text-foreground"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </section>

      {/* Client component с offers + catalog browse */}
      <SupplierDashboardClient
        supplier={supplier}
        initialOffers={offersWithProducts}
      />

      <p className="text-xs text-muted-foreground pt-4 border-t border-border">
        Заказы и аналитика — в работе. RFQ flow появится в следующей фазе marketplace.
      </p>
    </div>
  );
}
