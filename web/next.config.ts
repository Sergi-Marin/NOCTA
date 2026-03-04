import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@nocta/shared", "@nocta/database"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
    ],
  },
};

export default nextConfig;
