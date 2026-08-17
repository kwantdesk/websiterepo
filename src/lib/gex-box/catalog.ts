import { GEX_BOX_INSTRUMENTS, GEX_BOX_ORDERFLOW_METRICS } from "@/lib/gex-box/domain";

export const GEX_BOX_STATE_METRICS = ["gex", "gamma", "delta", "convexity", "negative_vanna", "charm"] as const;
export const GEX_BOX_EXPIRY_MODES = ["aggregate_90d", "latest", "next", "combined"] as const;

export function gexBoxCatalog() {
  return {
    version: 1,
    product: "GEX BOX",
    canonicalRoute: "/gex-box",
    surfaces: ["classic", "state", "orderflow", "research"],
    instruments: GEX_BOX_INSTRUMENTS,
    stateMetrics: GEX_BOX_STATE_METRICS,
    orderflowMetrics: GEX_BOX_ORDERFLOW_METRICS,
    expiryModes: GEX_BOX_EXPIRY_MODES,
    capabilities: {
      liveProfiles: { available: true, source: "quantdata", entitlementDependent: false },
      stateProfiles: { available: true, source: "quantdata", entitlementDependent: false },
      orderflow: { available: true, source: "quantdata", entitlementDependent: false },
      historicalOrderflow: { available: true, source: "quantdata", configurationDependent: false },
      contractReconstruction: { available: false, reason: "Normalized option contracts are not supplied to this workspace yet." },
      durableServerAlerts: { available: false, reason: "A durable server-side alert store is not configured for GEX BOX." },
      providerStream: { available: false, reason: "QuantData exposure frames are polled and aligned to Databento underlying prices." },
    },
  };
}
