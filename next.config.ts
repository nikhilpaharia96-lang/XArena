import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  // better-sqlite3 is a native module — must stay external to the server
  // bundle rather than being processed by webpack/turbopack.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
