import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getReferralStats, getReferralTree } from "@/lib/referrals";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const userId = req.cookies.get("user_session")?.value;
  if (!userId) return NextResponse.json({ user: null });

  const { data: user } = await supabase
    .from("site_users")
    .select(
      "id, email, full_name, company_name, phone, ref_code, total_orders, total_amount, created_at, referral_card, referred_by, kyc_verified",
    )
    .eq("id", userId)
    .single();

  if (!user) return NextResponse.json({ user: null });

  // ТЗ #049: full referral data — stats (earnings) + 3-level tree
  const [stats, tree] = await Promise.all([
    getReferralStats(userId),
    getReferralTree(userId),
  ]);

  // Backward-compat: keep `referrals` field как L1 only
  return NextResponse.json({
    user,
    referrals: tree.level1,
    referral_stats: stats,
    referral_tree: tree,
  });
}
