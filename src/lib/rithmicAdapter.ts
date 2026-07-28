import type {
  FuturesAccountRecord,
  FuturesConnectorSignalIntent,
  FuturesRoutingProfile,
  RithmicApiFlavor,
  RithmicFlavorBlueprint,
  RithmicLiveSubmitHandoff,
  RithmicOrderPreview,
  RithmicRouteBinding,
  RithmicSubmitAttemptResult,
} from "@/lib/futuresConnectors";

export const RITHMIC_FLAVOR_BLUEPRINTS: RithmicFlavorBlueprint[] = [
  {
    key: "api_plus",
    label: "R | API+",
    languageSurface: "C++ / .NET",
    latencyProfile: "<1ms order handling",
    bestFor: "Desktop platforms, custom OMS, and native high-performance trading applications.",
    serverSideFeatures: ["brackets", "OCO", "trailing stops", "custom bars"],
  },
  {
    key: "protocol_api",
    label: "R | Protocol API",
    languageSurface: "Any language / any OS",
    latencyProfile: "<1ms order routing",
    bestFor: "Cloud services, web-native automation stacks, and language-agnostic connector backends.",
    serverSideFeatures: ["brackets", "OCO", "trailing stops", "symbol metadata"],
  },
  {
    key: "diamond",
    label: "R | Diamond API",
    languageSurface: "C / C++ on Linux",
    latencyProfile: "<250µs tick-to-trade",
    bestFor: "Ultra-low-latency colocated execution and market making systems.",
    serverSideFeatures: ["partial server-side features", "low-jitter routing", "microsecond timestamps"],
  },
];

export function normalizeRithmicApiFlavor(value: string | undefined | null): RithmicApiFlavor {
  const normalized = (value ?? "").trim().toLowerCase();
  switch (normalized) {
    case "api_plus":
    case "api+":
    case "rapi":
      return "api_plus";
    case "diamond":
    case "diamond_api":
      return "diamond";
    default:
      return "protocol_api";
  }
}

function toRithmicSide(side: FuturesConnectorSignalIntent["side"]): "BUY" | "SELL" {
  return side === "sell" ? "SELL" : "BUY";
}

function toRithmicOrderType(orderType: FuturesConnectorSignalIntent["orderType"]) {
  switch (orderType) {
    case "limit":
      return "LIMIT";
    case "stop":
      return "STOP";
    case "stop_limit":
      return "STOP_LIMIT";
    case "trailing_stop":
      return "TRAILING_STOP";
    case "trailing_stop_limit":
      return "TRAILING_STOP_LIMIT";
    case "market":
    default:
      return "MARKET";
  }
}

export function buildRithmicOrderPreview(args: {
  signal: FuturesConnectorSignalIntent;
  route: FuturesRoutingProfile;
  account: FuturesAccountRecord;
  binding: RithmicRouteBinding;
}): RithmicOrderPreview {
  const { signal, route, account, binding } = args;
  const usesBracketProtection =
    route.supportsBrackets &&
    signal.stopLoss.mode === "ticks" &&
    signal.stopLoss.value != null &&
    signal.takeProfit.mode === "ticks" &&
    signal.takeProfit.value != null;

  return {
    adapterId: "rithmic-direct",
    preferredFlavor: binding.preferredFlavor,
    selectedEnvironment: binding.selectedEnvironment,
    routeProfileId: route.id,
    accountId: account.id,
    accountReference: binding.accountReference || "unresolved-account-reference",
    binding: {
      managedAccountLabel: binding.managedAccountLabel,
      managedRouteLabel: binding.managedRouteLabel,
      managedRiskProfileLabel: binding.managedRiskProfileLabel,
      brokerAccountRef: binding.brokerAccountRef,
    },
    usesBracketProtection,
    body: {
      accountReference: binding.accountReference,
      systemName: binding.resolvedSystemName,
      userId: binding.resolvedUserId,
      symbol: signal.symbol,
      side: toRithmicSide(signal.side),
      quantity: signal.quantity,
      orderType: toRithmicOrderType(signal.orderType),
      tif: signal.tif.toUpperCase(),
      limitPrice: signal.limitPrice,
      stopPrice: signal.stopPrice,
      clientOrderId: signal.signalId,
      text: signal.comment ?? `KWANT:${signal.strategyId}:${signal.versionId}`,
      bracket:
        usesBracketProtection
          ? {
              stopTicks: signal.stopLoss.value,
              targetTicks: signal.takeProfit.value,
            }
          : null,
      trail:
        signal.trail &&
        (signal.trail.trigger != null || signal.trail.distance != null || signal.trail.step != null)
          ? {
              trigger: signal.trail.trigger,
              distance: signal.trail.distance,
              step: signal.trail.step,
            }
          : null,
    },
    notes: [
      "This is a kwantify-side translation seam for the future Rithmic adapter, not a live dev-kit request body yet.",
      "Protocol API remains the preferred first backend flavor, so the preview is intentionally shaped around a service-friendly execution envelope.",
      usesBracketProtection
        ? "The current signal can be expressed with server-side bracket protection in ticks."
        : "The current signal does not yet resolve into a full bracket payload; stop/target would need separate follow-on handling or richer translation.",
    ],
    failureReasons: [
      "symbol_not_mapped",
      "contract_not_tradable",
      "session_closed",
      "account_not_authorized",
      "risk_rejected",
      "stale_market_data",
      "duplicate_client_order_id",
      "uncertain_submit_requires_reconciliation",
    ],
  };
}

export function buildRithmicLiveSubmitHandoff(args: {
  attempt: RithmicSubmitAttemptResult;
}): RithmicLiveSubmitHandoff {
  const { attempt } = args;
  const handoffMode: RithmicLiveSubmitHandoff["handoffMode"] =
    attempt.preferredFlavor === "protocol_api"
      ? "protocol_service"
      : attempt.preferredFlavor === "api_plus"
        ? "desktop_sdk"
        : "colo_binary";

  const requiredCredentials = [
    "systemName",
    "userId",
    "environment",
    "accountReference",
  ];

  const missingRequirements = [
    !attempt.binding.resolvedSystemName ? "systemName missing" : null,
    !attempt.binding.resolvedUserId ? "userId missing" : null,
    !attempt.binding.accountReference ? "accountReference missing" : null,
    attempt.submitState === "binding_blocked" ? "binding resolution still blocked" : null,
    handoffMode === "protocol_service" && !attempt.localGatewayReady
      ? "protocol transport implementation still missing"
      : null,
    handoffMode === "desktop_sdk" ? "desktop SDK bridge implementation still missing" : null,
    handoffMode === "colo_binary" ? "diamond binary handoff implementation still missing" : null,
  ].filter(Boolean) as string[];

  return {
    adapterId: attempt.adapterId,
    preferredFlavor: attempt.preferredFlavor,
    selectedEnvironment: attempt.selectedEnvironment,
    handoffMode,
    operatorReady: missingRequirements.length === 0,
    missingRequirements,
    requiredCredentials,
    deliveryNotes: [
      handoffMode === "protocol_service"
        ? "Protocol API handoff should stay cloud-native: serialize this envelope into the service transport layer and keep the operator-facing contract unchanged."
        : handoffMode === "desktop_sdk"
          ? "API+ handoff will need a desktop or native bridge process, but the request envelope should remain stable from the operator perspective."
          : "Diamond handoff is a specialized low-latency lane; keep it behind the same operator contract even if the runtime path becomes colocated.",
      "This handoff object is the boundary between platform-facing futures workflow and broker-facing adapter implementation.",
    ],
    requestEnvelope: {
      handoffMode,
      preferredFlavor: attempt.preferredFlavor,
      selectedEnvironment: attempt.selectedEnvironment,
      routeProfileId: attempt.routeProfileId,
      accountId: attempt.accountId,
      signalId: attempt.signalId,
      accountReference: attempt.binding.accountReference,
      requestBody: attempt.requestBody,
    },
  };
}
