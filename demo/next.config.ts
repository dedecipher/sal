import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  output: "export",
  webpack: (config) => {
    // WebAssembly 지원 활성화
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
    };

    return config;
  },
};

export default nextConfig;
