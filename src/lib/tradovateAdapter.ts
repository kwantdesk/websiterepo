import type {
  FuturesAccountRecord,
  FuturesConnectorSignalIntent,
  FuturesRoutingProfile,
  TradovateOrderLegPreview,
  TradovateOrderPreview,
  TradovateRouteBinding,
} from "@/lib/futuresConnectors";

function toTradovateAction(side: FuturesConnectorSignalIntent["side"]): "Buy" | "Sell" {
  return side === "sell" ? "Sell" : "Buy";
}

function toTradovateOrderType(
  orderType: FuturesConnectorSignalIntent["orderType"]
): TradovateOrderLegPreview["orderType"] {
  switch (orderType) {
    case "limit":
      return "Limit";
    case "stop":
      return "Stop";
    case "stop_limit":
      return "StopLimit";
    case "market":
    default:
      return "Market";
  }
}

function invertAction(action: "Buy" | "Sell"): "Buy" | "Sell" {
  return action === "Buy" ? "Sell" : "Buy";
}

export function buildTradovateOrderPreview(args: {
  signal: FuturesConnectorSignalIntent;
  route: FuturesRoutingProfile;
  account: FuturesAccountRecord;
}): TradovateOrderPreview {
  const { signal, route, account } = args;
  const action = toTradovateAction(signal.side);
  const orderType = toTradovateOrderType(signal.orderType);
  const usesBrackets =
    route.supportsBrackets &&
    signal.stopLoss.mode === "ticks" &&
    signal.stopLoss.value != null &&
    signal.takeProfit.mode === "ticks" &&
    signal.takeProfit.value != null;

  const baseBody: Record<string, unknown> = {
    accountSpec: "<tradovate-account-spec>",
    accountId: account.id,
    action,
    symbol: signal.symbol,
    orderQty: signal.quantity,
    orderType,
    isAutomated: true,
  };

  if (signal.limitPrice != null) {
    baseBody.price = signal.limitPrice;
  }
  if (signal.stopPrice != null) {
    baseBody.stopPrice = signal.stopPrice;
  }
  if (signal.tif !== "day") {
    baseBody.timeInForce = signal.tif.toUpperCase();
  }

  const notes = [
    "Tradovate partner docs require bearer-token auth and isAutomated=true for non-manual order flow.",
    "placeOSO is the preferred path when we can translate kwantify stop/target protections into native bracket legs.",
    "accountSpec must be the Tradovate/Ninja user name tied to the authenticated session; accountId is the resolved account id.",
  ];

  const failureReasons = [
    "InvalidContract",
    "InvalidPrice",
    "NoQuote",
    "SessionClosed",
    "TradingLocked",
    "RiskCheckTimeout",
    "ExecutionProviderUnavailable",
    "Unsupported",
  ];

  if (!usesBrackets) {
    return {
      adapterId: "tradovate-direct",
      endpoint: "/order/placeOrder",
      usesBrackets: false,
      accountSpecHint: "Authenticated Tradovate/Ninja user name",
      body: baseBody,
      notes: [
        ...notes,
        "This preview uses placeOrder because the current signal does not carry a full native stop+target bracket in ticks.",
      ],
      failureReasons,
    };
  }

  const targetTicks = signal.takeProfit.value ?? 0;
  const stopTicks = signal.stopLoss.value ?? 0;

  return {
    adapterId: "tradovate-direct",
    endpoint: "/order/placeOSO",
    usesBrackets: true,
    accountSpecHint: "Authenticated Tradovate/Ninja user name",
    body: {
      ...baseBody,
      bracket1: {
        action: invertAction(action),
        orderType: "Limit",
        qty: signal.quantity,
        offset: targetTicks,
        offsetType: "Ticks",
      },
      bracket2: {
        action: invertAction(action),
        orderType: "Stop",
        qty: signal.quantity,
        offset: stopTicks,
        offsetType: "Ticks",
      },
    },
    notes: [
      ...notes,
      `Bracket1 models the take-profit using ${targetTicks} ticks; bracket2 models the stop using ${stopTicks} ticks.`,
      "If both bracket1 and bracket2 are present, Tradovate links them as OCO according to the official placeOSO docs.",
    ],
    failureReasons,
  };
}

export function buildTradovateOrderRequest(args: {
  signal: FuturesConnectorSignalIntent;
  route: FuturesRoutingProfile;
  account: FuturesAccountRecord;
  binding: TradovateRouteBinding;
}) {
  const preview = buildTradovateOrderPreview(args);

  return {
    endpoint: preview.endpoint,
    body: {
      ...preview.body,
      accountSpec: args.binding.accountSpec,
      accountId: args.binding.resolvedTradovateAccountId ? Number(args.binding.resolvedTradovateAccountId) : null,
      text: args.signal.comment ?? `KWANT:${args.signal.strategyId}:${args.signal.versionId}`,
      clOrdId: args.signal.signalId,
    },
    notes: preview.notes,
    failureReasons: preview.failureReasons,
  };
}
