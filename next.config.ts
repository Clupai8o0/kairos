import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output enables Docker self-hosting; Vercel ignores this.
  output: 'standalone',
};

export default nextConfig;
