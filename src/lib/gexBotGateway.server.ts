import "server-only";
import { fetchInstitutionalMarketData, isInstitutionalMarketDataConfigured } from "./institutionalMarketData.server.ts";

export const hasGexBotGatewayAccess = isInstitutionalMarketDataConfigured;

/** Vendor secrets and signed archive downloads belong to the VPS, never Next. */
export async function fetchGexBotGateway(path: string, history = false): Promise<Response> {
  if (!path.startsWith("/") || path.includes("?") || path.includes("#")) throw new Error("Invalid positioning request.");
  const response = await fetchInstitutionalMarketData(
    `/v1/gexbot-legacy/${history ? "history" : "read"}?path=${encodeURIComponent(path)}`,
    { method: "GET" }, history ? 40_000 : 12_000,
  );
  if (!response) throw new Error("Positioning gateway is not configured.");
  return response;
}

export async function fetchGexBotResearch(selection: Record<string, string>): Promise<Response> {
  const response = await fetchInstitutionalMarketData(
    `/v1/native-positioning/snapshot?${new URLSearchParams(selection)}`, { method: "GET" }, 15_000,
  );
  if (!response) throw new Error("Positioning gateway is not configured.");
  const payload = await response.json();
  // Preserve the old raw-frame contract while sharing the VPS native cache.
  return Response.json(response.ok ? payload.data : payload, { status: response.status });
}
