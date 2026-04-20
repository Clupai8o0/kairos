import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output enables Docker self-hosting; Vercel ignores this.
  output: 'standalone',
  experimental: {
    // @ts-expect-error nodeMiddleware is a Next.js 15.1+ flag not yet in shipped types
    nodeMiddleware: true,
  },
};

export default nextConfig;
