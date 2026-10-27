import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "htphjrxbvognahdocpeb.supabase.co" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
};

export default nextConfig;
