/** @type {import('next').NextConfig} */

// Security headers applied site-wide. CSP is in Report-Only mode initially —
// browsers log violations without blocking, so we collect false positives
// before flipping to enforcing. See SECURITY_REVIEW B4-HIGH-1.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()",
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://telegram.org https://oauth.telegram.org https://va.vercel-scripts.com https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://lh3.googleusercontent.com https://*.harlansteel.ru https://challenges.cloudflare.com https://*.vercel-storage.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.upstash.io https://challenges.cloudflare.com https://api.telegram.org https://oauth.telegram.org https://vitals.vercel-insights.com",
      "frame-src https://challenges.cloudflare.com https://oauth.telegram.org",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "tmzqirzyvmnkzfmotlcj.supabase.co" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  // Permanent (308) redirects for legacy catalog URLs that used to be linked
  // from Header/Footer. After fix/v1-followups the navigation no longer
  // points here, but external links / Google cache still hit these paths.
  // Sending them to the right new location preserves SEO + UX.
  async redirects() {
    return [
      // W2-22 #i006 restructure (lesson 091): профнастил перенесён из дублирующего
      // L1 metalloprokat в canonical listovoy-prokat → profnastil-proflist.
      // Старые URL (Yandex/Google cache + external links) перенаправляются на новые.
      // Catch-all для всех потомков (3 L3 + ~935 SKU pages).
      {
        source: "/catalog/metalloprokat/profnastil/:path*",
        destination: "/catalog/listovoy-prokat/profnastil-proflist/:path*",
        permanent: true,
      },
      { source: "/catalog/metalloprokat",   destination: "/catalog",                 permanent: true },
      { source: "/catalog/armatura",        destination: "/catalog/sortovoy-prokat", permanent: true },
      { source: "/catalog/balki-shvellery", destination: "/catalog/sortovoy-prokat", permanent: true },
    ];
  },
};

module.exports = nextConfig;
