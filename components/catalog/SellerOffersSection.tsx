"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Star, MapPin, Truck, Package } from "lucide-react";

/**
 * Layer 3 frontend aggregation per LAW-marketplace-architecture.
 *
 * Renders aggregated seller_offers list для product page:
 *   - Buy Box winner card (highlighted) сверху
 *   - "Все предложения" expandable list по price ASC
 *   - Per-offer: company_name, verified, rating, region, final_price,
 *     lead_time, in_stock, contact CTA
 *
 * ТЗ #040 — additive only, существующий PriceBlock остаётся
 * (читает price_items до cutover в ТЗ #041).
 */

interface SellerOffer {
  id: string;
  product_id: string;
  seller_id: string;
  base_price: number | null;
  final_price: number | null;
  currency: string | null;
  unit: string | null;
  in_stock: boolean | null;
  stock_quantity: number | null;
  min_quantity: number | null;
  min_order_qty: number | null;
  lead_time_days: number | null;
  regions_served: string[] | null;
  is_active: boolean | null;
  is_buy_box: boolean | null;
  valid_until: string | null;
  seller: {
    id: string;
    company_name: string | null;
    is_verified: boolean | null;
    rating: number | null;
    region: string | null;
    city: string | null;
  } | null;
}

interface Props {
  offers: SellerOffer[];
  unit?: string | null;
}

function formatPrice(value: number | null | undefined): string {
  if (value == null) return "—";
  return Math.round(value).toLocaleString("ru-RU") + " ₽";
}

function formatLeadTime(days: number | null | undefined): string {
  if (days == null) return "В наличии";
  if (days === 0) return "В наличии";
  if (days === 1) return "1 день";
  if (days < 5) return `${days} дня`;
  return `${days} дней`;
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating == null) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-amber-500">
      <Star size={12} fill="currentColor" />
      <span className="font-medium">{rating.toFixed(1)}</span>
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] rounded font-medium">
      <CheckCircle2 size={10} /> Верифицирован
    </span>
  );
}

function OfferRow({ offer, isBuyBox, unit }: { offer: SellerOffer; isBuyBox?: boolean; unit?: string | null }) {
  const seller = offer.seller;
  const price = offer.final_price ?? offer.base_price;
  const displayUnit = offer.unit || unit || "т";
  const location = [seller?.city, seller?.region].filter(Boolean).join(", ");
  const inStock = offer.in_stock !== false;

  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        isBuyBox
          ? "bg-gold/5 border-gold/40"
          : "bg-card border-border hover:border-border/80"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* Left: seller info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isBuyBox && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gold/20 text-gold text-[10px] rounded font-bold uppercase">
                ★ Лучшее предложение
              </span>
            )}
            <p className="font-bold text-foreground text-sm truncate">
              {seller?.company_name || "Поставщик"}
            </p>
            {seller?.is_verified && <VerifiedBadge />}
            <StarRating rating={seller?.rating ?? null} />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} /> {location}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 ${
                inStock ? "text-emerald-500" : "text-muted-foreground"
              }`}
            >
              <Package size={11} />
              {inStock ? "В наличии" : "Под заказ"}
              {offer.stock_quantity != null && inStock && (
                <span className="text-muted-foreground">· {offer.stock_quantity} {displayUnit}</span>
              )}
            </span>
            {offer.lead_time_days != null && offer.lead_time_days > 0 && (
              <span className="inline-flex items-center gap-1">
                <Truck size={11} /> {formatLeadTime(offer.lead_time_days)}
              </span>
            )}
            {offer.min_quantity != null && offer.min_quantity > 1 && (
              <span>от {offer.min_quantity} {displayUnit}</span>
            )}
          </div>
        </div>

        {/* Right: price + CTA */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="text-right">
            <p className={`text-xl font-black leading-none ${isBuyBox ? "text-gold" : "text-foreground"}`}>
              {formatPrice(price)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">за {displayUnit}</p>
          </div>
          <a
            href={`/contacts?seller=${offer.seller_id}&offer=${offer.id}`}
            className={`inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              isBuyBox
                ? "bg-gold text-black hover:bg-gold/90"
                : "bg-muted text-foreground hover:bg-muted/80 border border-border"
            }`}
          >
            Связаться
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SellerOffersSection({ offers, unit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<"price" | "rating" | "lead_time">("price");
  const [filterInStock, setFilterInStock] = useState(false);

  const sortedOffers = useMemo(() => {
    let list = [...offers];
    if (filterInStock) list = list.filter((o) => o.in_stock !== false);

    list.sort((a, b) => {
      // Buy box always first
      if (a.is_buy_box && !b.is_buy_box) return -1;
      if (!a.is_buy_box && b.is_buy_box) return 1;
      if (sortBy === "price") {
        const ap = a.final_price ?? a.base_price ?? Infinity;
        const bp = b.final_price ?? b.base_price ?? Infinity;
        return ap - bp;
      }
      if (sortBy === "rating") {
        return (b.seller?.rating ?? 0) - (a.seller?.rating ?? 0);
      }
      if (sortBy === "lead_time") {
        return (a.lead_time_days ?? 0) - (b.lead_time_days ?? 0);
      }
      return 0;
    });
    return list;
  }, [offers, sortBy, filterInStock]);

  if (offers.length === 0) return null;

  const buyBox = sortedOffers.find((o) => o.is_buy_box);
  const others = sortedOffers.filter((o) => !o.is_buy_box);
  const visibleOthers = expanded ? others : others.slice(0, 2);
  const remainingCount = others.length - visibleOthers.length;
  const minOtherPrice = others.length
    ? Math.min(...others.map((o) => o.final_price ?? o.base_price ?? Infinity))
    : null;

  return (
    <section className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-lg font-bold text-foreground">
          Предложения поставщиков
          <span className="text-sm font-normal text-muted-foreground ml-2">
            ({sortedOffers.length})
          </span>
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={filterInStock}
              onChange={(e) => setFilterInStock(e.target.checked)}
              className="accent-gold"
            />
            Только в наличии
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground"
          >
            <option value="price">По цене</option>
            <option value="rating">По рейтингу</option>
            <option value="lead_time">По сроку</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {buyBox && <OfferRow offer={buyBox} isBuyBox unit={unit} />}
        {visibleOthers.map((offer) => (
          <OfferRow key={offer.id} offer={offer} unit={unit} />
        ))}
      </div>

      {remainingCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 w-full text-sm text-center py-2 px-3 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:border-gold/40 transition-colors"
        >
          Показать ещё {remainingCount}{" "}
          {remainingCount === 1 ? "предложение" : remainingCount < 5 ? "предложения" : "предложений"}
          {minOtherPrice != null && Number.isFinite(minOtherPrice) && (
            <span className="text-muted-foreground"> от {formatPrice(minOtherPrice)}</span>
          )}
        </button>
      )}
      {expanded && others.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 w-full text-sm text-center py-2 px-3 rounded-md text-muted-foreground hover:text-foreground transition-colors"
        >
          Свернуть
        </button>
      )}
    </section>
  );
}
