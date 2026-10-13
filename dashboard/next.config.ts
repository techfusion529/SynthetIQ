import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for MUI v6 with Next.js App Router
  transpilePackages: ["@mui/material", "@mui/icons-material", "@emotion/react", "@emotion/styled", "@emotion/cache"],
  async rewrites() {
    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
