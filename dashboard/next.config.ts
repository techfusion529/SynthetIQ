import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for MUI v6 with Next.js App Router
  transpilePackages: ["@mui/material", "@mui/icons-material", "@emotion/react", "@emotion/styled", "@emotion/cache"],
};

export default nextConfig;
