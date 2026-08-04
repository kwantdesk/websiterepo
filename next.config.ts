import type { NextConfig } from "next";

const deploymentId = process.env.VERCEL_DEPLOYMENT_ID?.replace(/[^a-zA-Z0-9_-]/g, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep an open chart tab pinned to the assets and route payloads from the
  // deployment that created it. This prevents lazy panel imports from crossing
  // releases while a trader leaves the workspace open.
  ...(deploymentId ? { deploymentId } : {}),
};

export default nextConfig;
