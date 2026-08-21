import type { NextConfig } from "next";

const deploymentId = process.env.VERCEL_DEPLOYMENT_ID?.replace(/[^a-zA-Z0-9_-]/g, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep an open chart tab pinned to the assets and route payloads from the
  // deployment that created it. This prevents lazy panel imports from crossing
  // releases while a trader leaves the workspace open.
  ...(deploymentId ? { deploymentId } : {}),
  // Allows the page to sample its own JS call stacks (window.Profiler).
  // Without this header Chrome refuses to construct a Profiler, and a freeze
  // can only be described — never attributed to the function causing it.
  async headers() {
    return [{
      source: "/:path*",
      headers: [{ key: "Document-Policy", value: "js-profiling" }],
    }];
  },
};

export default nextConfig;
