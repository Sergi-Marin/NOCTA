/** @type {import('next').NextConfig} */
const nextConfig = {
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
