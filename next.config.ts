import type { NextConfig } from "next";

const deploymentId = process.env.VERCEL_DEPLOYMENT_ID?.replace(/[^a-zA-Z0-9_-]/g, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {"/api/options-expiration-calendar":["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"]},
  // Keep an open chart tab pinned to the assets and route payloads from the
  // deployment that created it. This prevents lazy panel imports from crossing
  // releases while a trader leaves the workspace open.
  ...(deploymentId ? { deploymentId } : {}),
  async redirects() {
    return [
      { source: "/gex-box", destination: "/gex-data", permanent: true },
      { source: "/gex-box/:surface", destination: "/gex-data", permanent: true },
      { source: "/gexbot", destination: "/gex-data", permanent: true },
    ];
  },
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
