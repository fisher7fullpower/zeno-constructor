import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "morrowlab.by" },
      { protocol: "https", hostname: "constructor.morrowlab.by" },
      { protocol: "https", hostname: "constructor.zenohome.by" },
    ],
  },
};

export default nextConfig;
