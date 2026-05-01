/** @type {import('next').NextConfig} */
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

  // Permanent (308) redirects for legacy catalog URLs that used to be linked
  // from Header/Footer. After fix/v1-followups the navigation no longer
  // points here, but external links / Google cache still hit these paths.
  // Sending them to the right new location preserves SEO + UX.
  async redirects() {
    return [
      { source: "/catalog/metalloprokat",   destination: "/catalog",                 permanent: true },
      { source: "/catalog/armatura",        destination: "/catalog/sortovoy-prokat", permanent: true },
      { source: "/catalog/balki-shvellery", destination: "/catalog/sortovoy-prokat", permanent: true },
    ];
  },
};

module.exports = nextConfig;
