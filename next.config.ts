import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "shoppie-agent.onrender.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.rakuten.co.jp",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.amazon.co.jp",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "item-shopping.c.yimg.jp",
        pathname: "/**",
      }
    ],
  },
};

export default nextConfig;
