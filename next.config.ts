import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/security-headers";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...buildSecurityHeaders({ dev: process.env.NODE_ENV !== "production" })],
      },
    ];
  },
};

export default nextConfig;
