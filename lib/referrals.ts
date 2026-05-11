/**
 * ТЗ #049 — Referral program v2 (3-level MLM cascade).
 *
 * Rules:
 *   - L1 (прямой реферал): 0.5% от order amount
 *   - L2 (на 2 уровня выше): 0.25%
 *   - L3 (на 3 уровня выше): 0.25%
 *   - Покупатель с referral_card: −1% discount (lifetime)
 *   - Min order: 3 tonnes металла (3000 kg) — иначе payout не начисляется
 *   - Cooling: 30 days между заказом и earnable_at
 *   - Cap: NONE (Sergey: «без cap на старте»)
 *
 * Tables:
 *   - site_users (referred_by → uuid цепочка)
 *   - site_referral_transactions (per-level payout records)
 */

import { createAdminClient } from "@/lib/supabase";

export const REFERRAL_LEVELS = [
  { level: 1, rate: 0.005 }, // 0.5%
  { level: 2, rate: 0.0025 }, // 0.25%
  { level: 3, rate: 0.0025 }, // 0.25%
] as const;

export const REFERRAL_DISCOUNT_RATE = 0.01; // 1% lifetime скидка для referral_card holders

export const MIN_ORDER_WEIGHT_KG = 3000; // 3 tonnes
export const COOLING_PERIOD_DAYS = 30;

/**
 * Generate уникальный ref_code (8 chars upper alpha-numeric).
 * Используется при регистрации site_users если ref_code не set.
 */
export function generateRefCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // безопасные symbols (no 0/O/1/I)
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/**
 * Resolve рефeрер user от ref code.
 * Returns site_user id who owns this ref_code, or null.
 */
export async function resolveReferrerByCode(refCode: string): Promise<string | null> {
  if (!refCode || typeof refCode !== "string") return null;
  const admin = createAdminClient();
  const { data } = await (admin as any)
    .from("site_users")
    .select("id")
    .eq("ref_code", refCode.toUpperCase().trim())
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Compute 1% discount для buyer если у него referral_card=true.
 * Returns: { discount_amount, has_card }
 */
export async function computeReferralDiscount(
  buyerUserId: string,
  orderAmount: number,
): Promise<{ discount_amount: number; has_card: boolean }> {
  if (!buyerUserId || !orderAmount || orderAmount <= 0) {
    return { discount_amount: 0, has_card: false };
  }
  const admin = createAdminClient();
  const { data: user } = await (admin as any)
    .from("site_users")
    .select("referral_card")
    .eq("id", buyerUserId)
    .maybeSingle();
  if (!user?.referral_card) return { discount_amount: 0, has_card: false };
  return {
    discount_amount: orderAmount * REFERRAL_DISCOUNT_RATE,
    has_card: true,
  };
}

/**
 * Записать payouts для 3 уровней цепочки при оформлении заказа.
 *
 * Walks up site_users.referred_by chain до 3 уровней:
 *   L1 = buyer.referred_by
 *   L2 = L1.referred_by
 *   L3 = L2.referred_by
 *
 * Per level: INSERT site_referral_transactions row с status='pending',
 * earnable_at = NOW() + 30 days.
 *
 * Защита:
 *   - Min weight 3t (3000 kg) — иначе skip
 *   - Если referrer NULL — chain закончилась
 *   - Self-referral (buyer.id == referrer.id) — skip
 *
 * Returns: how many levels paid (0-3)
 */
export async function recordReferralPayouts(params: {
  orderId: string | null;
  buyerUserId: string;
  orderAmount: number;
  orderWeightKg: number;
}): Promise<{ levels_paid: number; total_commission: number; reason?: string }> {
  const { orderId, buyerUserId, orderAmount, orderWeightKg } = params;

  if (!buyerUserId || orderAmount <= 0) {
    return { levels_paid: 0, total_commission: 0, reason: "invalid params" };
  }

  // Min order: 3 tonnes
  if (!orderWeightKg || orderWeightKg < MIN_ORDER_WEIGHT_KG) {
    return {
      levels_paid: 0,
      total_commission: 0,
      reason: `order weight ${orderWeightKg}kg < min ${MIN_ORDER_WEIGHT_KG}kg`,
    };
  }

  const admin = createAdminClient();
  const earnableAt = new Date();
  earnableAt.setDate(earnableAt.getDate() + COOLING_PERIOD_DAYS);

  let currentUserId = buyerUserId;
  let levelsPaid = 0;
  let totalCommission = 0;
  const rows: any[] = [];

  for (const { level, rate } of REFERRAL_LEVELS) {
    // Lookup current user's referrer (walk up the chain)
    const { data: u } = await (admin as any)
      .from("site_users")
      .select("referred_by")
      .eq("id", currentUserId)
      .maybeSingle();

    if (!u?.referred_by) break; // chain закончилась

    // Self-referral guard (paranoia)
    if (u.referred_by === buyerUserId) break;

    const commission = Number((orderAmount * rate).toFixed(2));
    rows.push({
      earner_user_id: u.referred_by,
      buyer_user_id: buyerUserId,
      order_id: orderId,
      order_amount: orderAmount,
      order_weight_kg: orderWeightKg,
      level,
      commission_rate: rate,
      commission_amount: commission,
      status: "pending",
      earnable_at: earnableAt.toISOString(),
    });
    totalCommission += commission;
    levelsPaid++;
    currentUserId = u.referred_by; // step up
  }

  if (rows.length > 0) {
    const { error } = await (admin as any).from("site_referral_transactions").insert(rows);
    if (error) {
      console.error("[referrals] payout insert err:", error);
      return { levels_paid: 0, total_commission: 0, reason: error.message };
    }
  }

  return { levels_paid: levelsPaid, total_commission: totalCommission };
}

/**
 * Cancel referral payouts если order был возвращён/cancelled.
 * Status pending → cancelled, не выплачивается.
 */
export async function cancelReferralPayoutsByOrder(orderId: string, reason: string): Promise<number> {
  if (!orderId) return 0;
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("site_referral_transactions")
    .update({ status: "cancelled", cancelled_reason: reason })
    .eq("order_id", orderId)
    .in("status", ["pending", "confirmed"])
    .select("id");
  if (error) {
    console.error("[referrals] cancel err:", error);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Confirm pending payouts которые прошли cooling period.
 * Status pending → confirmed (готовы к выплате). Вызывать через cron / scheduled job.
 */
export async function confirmRipePayouts(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("site_referral_transactions")
    .update({ status: "confirmed" })
    .eq("status", "pending")
    .lte("earnable_at", new Date().toISOString())
    .select("id");
  if (error) {
    console.error("[referrals] confirm err:", error);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Aggregate stats для одного пользователя — earnings dashboard.
 */
export async function getReferralStats(userId: string): Promise<{
  total_earned: number; // confirmed + paid
  pending: number; // pending (cooling)
  paid_out: number; // paid
  by_level: Record<1 | 2 | 3, { count: number; amount: number }>;
}> {
  const admin = createAdminClient();
  const { data } = await (admin as any)
    .from("site_referral_transactions")
    .select("level, commission_amount, status")
    .eq("earner_user_id", userId);

  const stats = {
    total_earned: 0,
    pending: 0,
    paid_out: 0,
    by_level: { 1: { count: 0, amount: 0 }, 2: { count: 0, amount: 0 }, 3: { count: 0, amount: 0 } },
  };

  for (const t of data ?? []) {
    const amt = Number(t.commission_amount) || 0;
    const lvl = t.level as 1 | 2 | 3;
    if (t.status === "pending") stats.pending += amt;
    else if (t.status === "confirmed") stats.total_earned += amt;
    else if (t.status === "paid") {
      stats.total_earned += amt;
      stats.paid_out += amt;
    }
    if (stats.by_level[lvl]) {
      stats.by_level[lvl].count++;
      stats.by_level[lvl].amount += amt;
    }
  }

  return stats;
}

/**
 * Get list рефералов пользователя — все 3 уровня с meta.
 */
export async function getReferralTree(userId: string): Promise<{
  level1: any[];
  level2: any[];
  level3: any[];
}> {
  const admin = createAdminClient();

  // L1: прямые рефералы (referred_by = userId)
  const { data: l1 } = await (admin as any)
    .from("site_users")
    .select("id, full_name, company_name, phone, email, total_orders, total_amount, created_at, referral_card")
    .eq("referred_by", userId);

  const l1Ids = (l1 ?? []).map((u: any) => u.id);

  // L2: рефералы рефералов (referred_by ∈ L1)
  let l2: any[] = [];
  let l2Ids: string[] = [];
  if (l1Ids.length > 0) {
    const { data } = await (admin as any)
      .from("site_users")
      .select("id, full_name, company_name, phone, email, total_orders, total_amount, created_at, referred_by")
      .in("referred_by", l1Ids);
    l2 = data ?? [];
    l2Ids = l2.map((u: any) => u.id);
  }

  // L3: третий уровень (referred_by ∈ L2)
  let l3: any[] = [];
  if (l2Ids.length > 0) {
    const { data } = await (admin as any)
      .from("site_users")
      .select("id, full_name, company_name, phone, email, total_orders, total_amount, created_at, referred_by")
      .in("referred_by", l2Ids);
    l3 = data ?? [];
  }

  return { level1: l1 ?? [], level2: l2, level3: l3 };
}
