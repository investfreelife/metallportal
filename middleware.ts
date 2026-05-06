import { NextRequest, NextResponse } from "next/server";

const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

const UTM_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 дней

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // 1. Защита /account (кроме /account/login) — pre-existing.
  if (pathname.startsWith("/account") && !pathname.startsWith("/account/login")) {
    const session = req.cookies.get("user_session")?.value;
    const hasSbSession = [...req.cookies.getAll()].some(
      (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
    );
    if (!session && !hasSbSession) {
      return NextResponse.redirect(new URL("/account/login", req.url));
    }
  }

  // 2. UTM capture — m003. При visit с ?utm_*=... в URL → set cookies (30 дней).
  // Не overwrite если уже есть cookie с тем же именем — first-touch attribution
  // (стандарт PPC: первый клик получает credit, не последний).
  const incomingUtm: Array<[string, string]> = [];
  for (const key of UTM_PARAMS) {
    const v = searchParams.get(key);
    if (v && v.length <= 256 && !req.cookies.has(key)) {
      incomingUtm.push([key, v]);
    }
  }

  if (incomingUtm.length > 0) {
    const res = NextResponse.next();
    for (const [k, v] of incomingUtm) {
      res.cookies.set(k, v, {
        maxAge: UTM_TTL_SECONDS,
        path: "/",
        sameSite: "lax",
        // НЕ httpOnly — landing CTA fetch'ит /api/landings/submit-lead
        // через server cookies (next/headers), client тоже может прочесть
        // если понадобится для GTM dataLayer push.
      });
    }
    return res;
  }

  return NextResponse.next();
}

/**
 * Matcher: пропускает API/static/_next paths (perf). Все остальные — обходит,
 * чтобы UTM capture работал на любой entry-page (homepage, landing, category, ...).
 */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|opengraph-image|robots.txt|sitemap.xml).*)",
  ],
};
