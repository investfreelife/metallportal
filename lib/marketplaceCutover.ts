/**
 * ТЗ #041 — Marketplace cutover feature flag.
 *
 * Phase A scope: product detail page (PriceBlock + ProductTabs + JSON-LD).
 * Catalog list views (CatalogView, ProductCard, ProductTable) НЕ затронуты —
 * они читают product.price_items из JOIN'а в getCategoryWithChildren. Cutover
 * для них в следующей фазе (Phase B / ТЗ #042).
 *
 * Flag: `NEXT_PUBLIC_MARKETPLACE_CUTOVER`
 *   - "1"   → product detail читает seller_offers (через adapter в price_items shape)
 *   - "0"   → product detail читает price_items напрямую (current behavior, default)
 *   - undefined → "0" (safe default — никакого визуального изменения)
 *
 * Why feature-flagged: позволяет gradual rollout — staging → prod, easy rollback
 * через env var без redeploy логики. Когда #042 закроет catalog views, flag
 * можно поднять до dev-time константы и убрать после full deprecation.
 *
 * Audit trail остаётся: seller_offers.source_price_item_id указывает на оригинал
 * price_items row для каждого мirrored offer (#037).
 */

export const MARKETPLACE_CUTOVER_ENABLED =
  process.env.NEXT_PUBLIC_MARKETPLACE_CUTOVER === "1";

/**
 * Shape compatible с тем, что PriceBlock / ProductTabs / SupplierPriceTable
 * ожидают от price_items. Поля name'd как у price_items для drop-in замены.
 */
export interface PriceItemShape {
  id?: string;
  base_price: number;
  discount_price?: number | null;
  in_stock?: boolean;
  unit?: string | null;
  supplier_id?: string | null;
  supplier?: {
    id?: string;
    company_name?: string | null;
    region?: string | null;
    city?: string | null;
    rating?: number | null;
    is_verified?: boolean | null;
  } | null;
  // Audit trail / marketplace metadata (необязательные, но полезные при cutover)
  is_buy_box?: boolean | null;
  final_price?: number | null;
  seller_id?: string | null;
}

/**
 * Convert seller_offer row → price_item-compatible shape.
 *
 * Mapping rationale:
 *   - `base_price` → `base_price`
 *   - `final_price < base_price` → `discount_price = final_price`, иначе null
 *     (PriceBlock рендерит strikethrough только если discount_price truthy)
 *   - `in_stock` → `in_stock`
 *   - `unit` → `unit`
 *   - `seller_id` → `supplier_id` (legacy field name)
 *   - `seller` (suppliers!seller_id join) → `supplier` (legacy field name)
 *
 * Original seller_offer fields сохранены под их именами (final_price, seller_id,
 * is_buy_box) — на случай, если consumer хочет marketplace-aware рендеринг.
 */
export function sellerOfferToPriceItem(offer: any): PriceItemShape {
  const basePrice = Number(offer.base_price ?? offer.final_price ?? 0);
  const finalPrice =
    offer.final_price != null ? Number(offer.final_price) : null;
  const hasDiscount =
    finalPrice != null && basePrice > 0 && finalPrice < basePrice;

  return {
    id: offer.id,
    base_price: basePrice,
    discount_price: hasDiscount ? finalPrice : null,
    in_stock: offer.in_stock !== false,
    unit: offer.unit ?? null,
    supplier_id: offer.seller_id ?? null,
    supplier: offer.seller ?? null,
    // Marketplace-specific (преserved для downstream consumers)
    is_buy_box: offer.is_buy_box ?? null,
    final_price: finalPrice,
    seller_id: offer.seller_id ?? null,
  };
}
