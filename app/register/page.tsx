import { redirect } from "next/navigation";

/**
 * ТЗ #046 — fix /register 404.
 *
 * `/supplier/page.tsx` ссылается на `/register?redirect=...` (e.g. anonymous
 * user clicks «Начать регистрацию» когда не залогинен), but route не existed.
 *
 * Redirects к canonical `/account/login?tab=register&redirect=...` который
 * supports `?tab=register` query param на load (Block B fix в same PR).
 */

export default function RegisterRedirectPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const params = new URLSearchParams({ tab: "register", mode: "email" });
  if (searchParams.redirect) {
    params.set("redirect", searchParams.redirect);
  }
  redirect(`/account/login?${params.toString()}`);
}
