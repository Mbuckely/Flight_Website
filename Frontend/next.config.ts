import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.1.10.23", "172.18.176.1", "localhost"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
