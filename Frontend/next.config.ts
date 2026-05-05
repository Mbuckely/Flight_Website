import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.1.10.23"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
