import type {
  RithmicGatewayScenario,
  RithmicProtocolServiceAttemptResult,
  RithmicTransportPacket,
} from "@/lib/futuresConnectors";

function deriveSignalId(packet: RithmicTransportPacket) {
  return typeof packet.payload.requestEnvelope === "object" &&
    packet.payload.requestEnvelope &&
    typeof (packet.payload.requestEnvelope as Record<string, unknown>).signalId === "string"
    ? String((packet.payload.requestEnvelope as Record<string, unknown>).signalId)
    : "unknown-signal";
}

function getRequestEnvelope(packet: RithmicTransportPacket) {
  return (packet.payload.requestEnvelope as Record<string, unknown> | undefined) ?? {};
}

function isoToMicros(iso: string, offsetMicros = 0) {
  const base = Date.parse(iso);
  if (!Number.isFinite(base)) {
    return Date.now() * 1000 + offsetMicros;
  }
  return base * 1000 + offsetMicros;
}

function buildGatewayOrderIds(correlationId: string) {
  const suffix = correlationId.replace(/[^a-zA-Z0-9]/g, "").slice(-16) || "SIM";
  return {
    brokerOrderId: `RIT-ORD-${suffix}`,
    parentOrderId: `RIT-PARENT-${suffix}`,
    bracketGroupId: `RIT-BRG-${suffix}`,
  };
}

function getSimulatedExecutionPrice(symbol: string | null) {
  if (!symbol) return 21876.25;
  if (symbol.includes("NQ") || symbol.includes("MNQ")) return 21876.25;
  if (symbol.includes("ES") || symbol.includes("MES")) return 5342.5;
  if (symbol.includes("YM") || symbol.includes("MYM")) return 39215;
  return 21876.25;
}

function isRecoveredGatewayScenario(scenario: RithmicGatewayScenario) {
  return scenario === "uncertain_recovered" || scenario === "transport_recovered";
}

function buildExecutionSnapshot(args: {
  scenario: RithmicGatewayScenario;
  attemptedAt: string;
  quantity: number;
  clientOrderId: string | null;
  gatewayIds: ReturnType<typeof buildGatewayOrderIds>;
  targetTicks: number | null;
  stopTicks: number | null;
  symbol: string | null;
}) {
  const { scenario, attemptedAt, quantity, clientOrderId, gatewayIds, targetTicks, stopTicks, symbol } = args;
  const hasBracketProtection = targetTicks != null && stopTicks != null;
  const simulatedFillPrice = getSimulatedExecutionPrice(symbol);
  const partialFillQty = quantity > 1 ? Math.max(1, Math.floor(quantity / 2)) : quantity / 2;
  const partialLeavesQty = Math.max(0, quantity - partialFillQty);
  const recoveredScenario = isRecoveredGatewayScenario(scenario);
  const protectionOrders =
    (scenario === "submitted" ||
      scenario === "partial_fill" ||
      scenario === "filled" ||
      scenario === "flat_exit" ||
      recoveredScenario) &&
    hasBracketProtection
      ? [
          {
            orderId: `${gatewayIds.bracketGroupId}-TP`,
            parentOrderId: gatewayIds.parentOrderId,
            groupId: gatewayIds.bracketGroupId,
            role: "take_profit",
            execType:
              scenario === "flat_exit"
                ? "fill"
                : recoveredScenario
                  ? "new_after_recovery"
                : scenario === "partial_fill"
                  ? "new"
                  : "new",
            ordStatus:
              scenario === "flat_exit"
                ? "filled"
                : recoveredScenario
                  ? "working"
                : "working",
            priceMode: "ticks",
            priceValue: targetTicks,
            leavesQty: scenario === "partial_fill" ? partialFillQty : scenario === "flat_exit" ? 0 : quantity,
            cumQty: scenario === "flat_exit" ? quantity : 0,
            brokerTimestampMicros: isoToMicros(attemptedAt, recoveredScenario ? 240_000 : 140_000),
          },
          {
            orderId: `${gatewayIds.bracketGroupId}-SL`,
            parentOrderId: gatewayIds.parentOrderId,
            groupId: gatewayIds.bracketGroupId,
            role: "stop_loss",
            execType: scenario === "flat_exit" ? "cancelled" : recoveredScenario ? "new_after_recovery" : "new",
            ordStatus: scenario === "flat_exit" ? "cancelled" : "working",
            priceMode: "ticks",
            priceValue: stopTicks,
            leavesQty: scenario === "partial_fill" ? partialFillQty : scenario === "flat_exit" ? 0 : quantity,
            cumQty: 0,
            brokerTimestampMicros: isoToMicros(
              attemptedAt,
              scenario === "flat_exit" ? 170_000 : recoveredScenario ? 245_000 : 145_000
            ),
          },
        ]
      : [];

  if (scenario === "transport_failed") {
    return {
      primaryOrder: {
        brokerOrderId: null,
        parentOrderId: null,
        clientOrderId,
        execType: "unavailable",
        ordStatus: "not_sent",
        submittedQty: quantity,
        leavesQty: null,
        filledQty: null,
        cumQty: null,
        avgFillPrice: null,
        orderState: "transport_failed_before_gateway",
        brokerTimestampMicros: null,
      },
      protectionOrders: [],
      positionSnapshot: {
        positionState: "unknown",
        openPositionQty: null,
        avgEntryPrice: null,
        lastUpdateMicros: null,
      },
    };
  }

  if (scenario === "rejected") {
    return {
      primaryOrder: {
        brokerOrderId: gatewayIds.brokerOrderId,
        parentOrderId: gatewayIds.parentOrderId,
        clientOrderId,
        execType: "rejected",
        ordStatus: "rejected",
        submittedQty: quantity,
        leavesQty: 0,
        filledQty: 0,
        cumQty: 0,
        avgFillPrice: null,
        orderState: "rejected",
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      protectionOrders: [],
      positionSnapshot: {
        positionState: "flat",
        openPositionQty: 0,
        avgEntryPrice: null,
        lastUpdateMicros: isoToMicros(attemptedAt, 160_000),
      },
    };
  }

  if (scenario === "uncertain") {
    return {
      primaryOrder: {
        brokerOrderId: gatewayIds.brokerOrderId,
        parentOrderId: gatewayIds.parentOrderId,
        clientOrderId,
        execType: "pending",
        ordStatus: "unknown",
        submittedQty: quantity,
        leavesQty: quantity,
        filledQty: null,
        cumQty: null,
        avgFillPrice: null,
        orderState: "pending_reconciliation",
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      protectionOrders: [],
      positionSnapshot: {
        positionState: "unknown",
        openPositionQty: null,
        avgEntryPrice: null,
        lastUpdateMicros: null,
      },
    };
  }

  if (scenario === "uncertain_recovered") {
    return {
      primaryOrder: {
        brokerOrderId: gatewayIds.brokerOrderId,
        parentOrderId: gatewayIds.parentOrderId,
        clientOrderId,
        execType: "fill_after_recovery",
        ordStatus: "filled",
        submittedQty: quantity,
        leavesQty: 0,
        filledQty: quantity,
        cumQty: quantity,
        avgFillPrice: simulatedFillPrice,
        orderState: "filled_after_recovery",
        brokerTimestampMicros: isoToMicros(attemptedAt, 220_000),
      },
      protectionOrders,
      positionSnapshot: {
        positionState: "open",
        openPositionQty: quantity,
        avgEntryPrice: simulatedFillPrice,
        lastUpdateMicros: isoToMicros(attemptedAt, 260_000),
      },
    };
  }

  if (scenario === "transport_recovered") {
    return {
      primaryOrder: {
        brokerOrderId: gatewayIds.brokerOrderId,
        parentOrderId: gatewayIds.parentOrderId,
        clientOrderId,
        execType: "new_after_recovery",
        ordStatus: "working",
        submittedQty: quantity,
        leavesQty: quantity,
        filledQty: 0,
        cumQty: 0,
        avgFillPrice: null,
        orderState: "working_after_recovery",
        brokerTimestampMicros: isoToMicros(attemptedAt, 220_000),
        allowedTransitions: ["partially_filled", "filled", "cancelled"],
      },
      protectionOrders,
      positionSnapshot: {
        positionState: "flat",
        openPositionQty: 0,
        avgEntryPrice: null,
        lastUpdateMicros: isoToMicros(attemptedAt, 260_000),
      },
    };
  }

  if (scenario === "partial_fill") {
    return {
      primaryOrder: {
        brokerOrderId: gatewayIds.brokerOrderId,
        parentOrderId: gatewayIds.parentOrderId,
        clientOrderId,
        execType: "partial_fill",
        ordStatus: "partially_filled",
        submittedQty: quantity,
        leavesQty: partialLeavesQty,
        filledQty: partialFillQty,
        cumQty: partialFillQty,
        avgFillPrice: simulatedFillPrice,
        orderState: "partially_filled",
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      protectionOrders,
      positionSnapshot: {
        positionState: "open_partial",
        openPositionQty: partialFillQty,
        avgEntryPrice: simulatedFillPrice,
        lastUpdateMicros: isoToMicros(attemptedAt, 160_000),
      },
    };
  }

  if (scenario === "filled") {
    return {
      primaryOrder: {
        brokerOrderId: gatewayIds.brokerOrderId,
        parentOrderId: gatewayIds.parentOrderId,
        clientOrderId,
        execType: "fill",
        ordStatus: "filled",
        submittedQty: quantity,
        leavesQty: 0,
        filledQty: quantity,
        cumQty: quantity,
        avgFillPrice: simulatedFillPrice,
        orderState: "filled",
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      protectionOrders,
      positionSnapshot: {
        positionState: "open",
        openPositionQty: quantity,
        avgEntryPrice: simulatedFillPrice,
        lastUpdateMicros: isoToMicros(attemptedAt, 160_000),
      },
    };
  }

  if (scenario === "flat_exit") {
    return {
      primaryOrder: {
        brokerOrderId: gatewayIds.brokerOrderId,
        parentOrderId: gatewayIds.parentOrderId,
        clientOrderId,
        execType: "fill",
        ordStatus: "filled",
        submittedQty: quantity,
        leavesQty: 0,
        filledQty: quantity,
        cumQty: quantity,
        avgFillPrice: simulatedFillPrice,
        orderState: "filled_then_flattened",
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      protectionOrders,
      positionSnapshot: {
        positionState: "flat_after_exit",
        openPositionQty: 0,
        avgEntryPrice: null,
        lastUpdateMicros: isoToMicros(attemptedAt, 175_000),
      },
    };
  }

  return {
    primaryOrder: {
      brokerOrderId: gatewayIds.brokerOrderId,
      parentOrderId: gatewayIds.parentOrderId,
      clientOrderId,
      execType: "new",
      ordStatus: "working",
      submittedQty: quantity,
      leavesQty: quantity,
      filledQty: 0,
      cumQty: 0,
      avgFillPrice: null,
      orderState: "working",
      brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      allowedTransitions: ["partially_filled", "filled", "cancelled"],
    },
    protectionOrders,
    positionSnapshot: {
      positionState: "flat",
      openPositionQty: 0,
      avgEntryPrice: null,
      lastUpdateMicros: isoToMicros(attemptedAt, 160_000),
    },
  };
}

function buildExecutionHistory(args: {
  scenario: RithmicGatewayScenario;
  attemptedAt: string;
  quantity: number;
  gatewayIds: ReturnType<typeof buildGatewayOrderIds>;
  targetTicks: number | null;
  stopTicks: number | null;
  symbol: string | null;
}) {
  const { scenario, attemptedAt, quantity, gatewayIds, targetTicks, stopTicks, symbol } = args;
  const fillPrice = getSimulatedExecutionPrice(symbol);
  const partialFillQty = quantity > 1 ? Math.max(1, Math.floor(quantity / 2)) : quantity / 2;
  const hasBracketProtection = targetTicks != null && stopTicks != null;

  if (scenario === "transport_failed") {
    return [
      {
        eventType: "transport_error",
        orderRole: "entry",
        orderId: null,
        orderState: "transport_failed_before_gateway",
        qty: null,
        price: null,
        brokerTimestampMicros: null,
      },
    ];
  }

  if (scenario === "rejected") {
    return [
      {
        eventType: "submit_rejected",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "rejected",
        qty: 0,
        price: null,
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
    ];
  }

  if (scenario === "uncertain") {
    return [
      {
        eventType: "submit_uncertain",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "pending_reconciliation",
        qty: quantity,
        price: null,
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
    ];
  }

  if (scenario === "uncertain_recovered") {
    return [
      {
        eventType: "submit_uncertain",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "pending_reconciliation",
        qty: quantity,
        price: null,
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      {
        eventType: "broker_sync_recovered",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "recovered",
        qty: quantity,
        price: null,
        brokerTimestampMicros: isoToMicros(attemptedAt, 200_000),
      },
      {
        eventType: "fill_after_recovery",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "filled_after_recovery",
        qty: quantity,
        price: fillPrice,
        brokerTimestampMicros: isoToMicros(attemptedAt, 220_000),
      },
      ...(hasBracketProtection
        ? [
            {
              eventType: "protection_working",
              orderRole: "take_profit",
              orderId: `${gatewayIds.bracketGroupId}-TP`,
              orderState: "working",
              qty: quantity,
              price: targetTicks,
              brokerTimestampMicros: isoToMicros(attemptedAt, 240_000),
            },
            {
              eventType: "protection_working",
              orderRole: "stop_loss",
              orderId: `${gatewayIds.bracketGroupId}-SL`,
              orderState: "working",
              qty: quantity,
              price: stopTicks,
              brokerTimestampMicros: isoToMicros(attemptedAt, 245_000),
            },
          ]
        : []),
    ];
  }

  if (scenario === "transport_recovered") {
    return [
      {
        eventType: "transport_error",
        orderRole: "entry",
        orderId: null,
        orderState: "transport_failed_before_gateway",
        qty: null,
        price: null,
        brokerTimestampMicros: null,
      },
      {
        eventType: "transport_restage",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "restaged_for_submit",
        qty: quantity,
        price: null,
        brokerTimestampMicros: isoToMicros(attemptedAt, 180_000),
      },
      {
        eventType: "submit_accepted_after_recovery",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "working_after_recovery",
        qty: quantity,
        price: null,
        brokerTimestampMicros: isoToMicros(attemptedAt, 220_000),
      },
      ...(hasBracketProtection
        ? [
            {
              eventType: "protection_working",
              orderRole: "take_profit",
              orderId: `${gatewayIds.bracketGroupId}-TP`,
              orderState: "working",
              qty: quantity,
              price: targetTicks,
              brokerTimestampMicros: isoToMicros(attemptedAt, 240_000),
            },
            {
              eventType: "protection_working",
              orderRole: "stop_loss",
              orderId: `${gatewayIds.bracketGroupId}-SL`,
              orderState: "working",
              qty: quantity,
              price: stopTicks,
              brokerTimestampMicros: isoToMicros(attemptedAt, 245_000),
            },
          ]
        : []),
    ];
  }

  if (scenario === "submitted") {
    return [
      {
        eventType: "submit_accepted",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "working",
        qty: quantity,
        price: null,
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      ...(hasBracketProtection
        ? [
            {
              eventType: "protection_working",
              orderRole: "take_profit",
              orderId: `${gatewayIds.bracketGroupId}-TP`,
              orderState: "working",
              qty: quantity,
              price: targetTicks,
              brokerTimestampMicros: isoToMicros(attemptedAt, 140_000),
            },
            {
              eventType: "protection_working",
              orderRole: "stop_loss",
              orderId: `${gatewayIds.bracketGroupId}-SL`,
              orderState: "working",
              qty: quantity,
              price: stopTicks,
              brokerTimestampMicros: isoToMicros(attemptedAt, 145_000),
            },
          ]
        : []),
    ];
  }

  if (scenario === "partial_fill") {
    return [
      {
        eventType: "submit_accepted",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "working",
        qty: quantity,
        price: null,
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      {
        eventType: "partial_fill",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "partially_filled",
        qty: partialFillQty,
        price: fillPrice,
        brokerTimestampMicros: isoToMicros(attemptedAt, 130_000),
      },
      ...(hasBracketProtection
        ? [
            {
              eventType: "protection_resized",
              orderRole: "take_profit",
              orderId: `${gatewayIds.bracketGroupId}-TP`,
              orderState: "working",
              qty: partialFillQty,
              price: targetTicks,
              brokerTimestampMicros: isoToMicros(attemptedAt, 140_000),
            },
            {
              eventType: "protection_resized",
              orderRole: "stop_loss",
              orderId: `${gatewayIds.bracketGroupId}-SL`,
              orderState: "working",
              qty: partialFillQty,
              price: stopTicks,
              brokerTimestampMicros: isoToMicros(attemptedAt, 145_000),
            },
          ]
        : []),
    ];
  }

  if (scenario === "filled") {
    return [
      {
        eventType: "submit_accepted",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "working",
        qty: quantity,
        price: null,
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      {
        eventType: "fill",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "filled",
        qty: quantity,
        price: fillPrice,
        brokerTimestampMicros: isoToMicros(attemptedAt, 130_000),
      },
      ...(hasBracketProtection
        ? [
            {
              eventType: "protection_working",
              orderRole: "take_profit",
              orderId: `${gatewayIds.bracketGroupId}-TP`,
              orderState: "working",
              qty: quantity,
              price: targetTicks,
              brokerTimestampMicros: isoToMicros(attemptedAt, 140_000),
            },
            {
              eventType: "protection_working",
              orderRole: "stop_loss",
              orderId: `${gatewayIds.bracketGroupId}-SL`,
              orderState: "working",
              qty: quantity,
              price: stopTicks,
              brokerTimestampMicros: isoToMicros(attemptedAt, 145_000),
            },
          ]
        : []),
    ];
  }

  if (scenario === "flat_exit") {
    return [
      {
        eventType: "submit_accepted",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "working",
        qty: quantity,
        price: null,
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      {
        eventType: "fill",
        orderRole: "entry",
        orderId: gatewayIds.brokerOrderId,
        orderState: "filled",
        qty: quantity,
        price: fillPrice,
        brokerTimestampMicros: isoToMicros(attemptedAt, 130_000),
      },
      ...(hasBracketProtection
        ? [
            {
              eventType: "exit_fill",
              orderRole: "take_profit",
              orderId: `${gatewayIds.bracketGroupId}-TP`,
              orderState: "filled",
              qty: quantity,
              price: targetTicks,
              brokerTimestampMicros: isoToMicros(attemptedAt, 170_000),
            },
            {
              eventType: "oco_cancel",
              orderRole: "stop_loss",
              orderId: `${gatewayIds.bracketGroupId}-SL`,
              orderState: "cancelled",
              qty: 0,
              price: stopTicks,
              brokerTimestampMicros: isoToMicros(attemptedAt, 175_000),
            },
          ]
        : []),
      {
        eventType: "position_flat",
        orderRole: "position",
        orderId: gatewayIds.parentOrderId,
        orderState: "flat_after_exit",
        qty: 0,
        price: null,
        brokerTimestampMicros: isoToMicros(attemptedAt, 180_000),
      },
    ];
  }

  return [];
}

function buildReconciliationTimeline(args: {
  scenario: RithmicGatewayScenario;
  attemptedAt: string;
  quantity: number;
  executionSnapshot: ReturnType<typeof buildExecutionSnapshot>;
}) {
  const { scenario, attemptedAt, quantity, executionSnapshot } = args;
  const primaryOrder = executionSnapshot.primaryOrder;
  const positionSnapshot = executionSnapshot.positionSnapshot;
  const protectionOrders = executionSnapshot.protectionOrders;

  const summarizeProtection = (statuses: string[]) => ({
    total: protectionOrders.length,
    active: protectionOrders.filter((row) =>
      typeof row.ordStatus === "string" ? statuses.includes(row.ordStatus) : false
    ).length,
    filled: protectionOrders.filter((row) => row.ordStatus === "filled").length,
    cancelled: protectionOrders.filter((row) => row.ordStatus === "cancelled").length,
  });

  if (scenario === "transport_failed") {
    return [
      {
        step: 1,
        label: "transport failed",
        primaryOrderState: "transport_failed_before_gateway",
        positionState: "unknown",
        workingOrderPresent: null,
        openPositionQty: null,
        reconciliationState: "transport_retry_required",
        protectionSummary: summarizeProtection([]),
        brokerTimestampMicros: null,
      },
    ];
  }

  if (scenario === "rejected") {
    return [
      {
        step: 1,
        label: "rejected before live order",
        primaryOrderState: "rejected",
        positionState: "flat",
        workingOrderPresent: false,
        openPositionQty: 0,
        reconciliationState: "rejected_no_live_order",
        protectionSummary: summarizeProtection([]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
    ];
  }

  if (scenario === "uncertain") {
    return [
      {
        step: 1,
        label: "submit acknowledged",
        primaryOrderState: "pending_reconciliation",
        positionState: "unknown",
        workingOrderPresent: null,
        openPositionQty: null,
        reconciliationState: "manual_review_required",
        protectionSummary: summarizeProtection([]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      {
        step: 2,
        label: "manual review required",
        primaryOrderState: "pending_reconciliation",
        positionState: "unknown",
        workingOrderPresent: null,
        openPositionQty: null,
        reconciliationState: "manual_review_required",
        protectionSummary: summarizeProtection([]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 180_000),
      },
    ];
  }

  if (scenario === "uncertain_recovered") {
    return [
      {
        step: 1,
        label: "submit uncertain",
        primaryOrderState: "pending_reconciliation",
        positionState: "unknown",
        workingOrderPresent: null,
        openPositionQty: null,
        reconciliationState: "manual_review_required",
        protectionSummary: summarizeProtection([]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      {
        step: 2,
        label: "broker truth recovered",
        primaryOrderState: "filled_after_recovery",
        positionState: "open",
        workingOrderPresent: false,
        openPositionQty: quantity,
        reconciliationState: "recovery_sync_complete",
        protectionSummary: summarizeProtection(["working", "new"]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 220_000),
      },
      {
        step: 3,
        label: "protection restored",
        primaryOrderState: "filled_after_recovery",
        positionState: "open",
        workingOrderPresent: false,
        openPositionQty: quantity,
        reconciliationState: "filled_open_position",
        protectionSummary: summarizeProtection(["working", "new"]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 245_000),
      },
    ];
  }

  if (scenario === "transport_recovered") {
    return [
      {
        step: 1,
        label: "transport failed",
        primaryOrderState: "transport_failed_before_gateway",
        positionState: "unknown",
        workingOrderPresent: null,
        openPositionQty: null,
        reconciliationState: "transport_retry_required",
        protectionSummary: summarizeProtection([]),
        brokerTimestampMicros: null,
      },
      {
        step: 2,
        label: "transport restaged",
        primaryOrderState: "restaged_for_submit",
        positionState: "flat",
        workingOrderPresent: false,
        openPositionQty: 0,
        reconciliationState: "recovery_sync_in_progress",
        protectionSummary: summarizeProtection([]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 180_000),
      },
      {
        step: 3,
        label: "working order recovered",
        primaryOrderState: "working_after_recovery",
        positionState: "flat",
        workingOrderPresent: true,
        openPositionQty: 0,
        reconciliationState: "working_order_confirmed",
        protectionSummary: summarizeProtection(["working", "new"]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 245_000),
      },
    ];
  }

  if (scenario === "submitted") {
    return [
      {
        step: 1,
        label: "entry working",
        primaryOrderState: "working",
        positionState: "flat",
        workingOrderPresent: true,
        openPositionQty: 0,
        reconciliationState: "working_order_confirmed",
        protectionSummary: summarizeProtection(["working", "new"]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      {
        step: 2,
        label: "protection posted",
        primaryOrderState: "working",
        positionState: "flat",
        workingOrderPresent: true,
        openPositionQty: 0,
        reconciliationState: "working_order_confirmed",
        protectionSummary: summarizeProtection(["working", "new"]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 145_000),
      },
    ];
  }

  if (scenario === "partial_fill") {
    return [
      {
        step: 1,
        label: "entry working",
        primaryOrderState: "working",
        positionState: "flat",
        workingOrderPresent: true,
        openPositionQty: 0,
        reconciliationState: "working_order_confirmed",
        protectionSummary: summarizeProtection(["working", "new"]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      {
        step: 2,
        label: "partial fill",
        primaryOrderState: "partially_filled",
        positionState: "open_partial",
        workingOrderPresent: true,
        openPositionQty:
          Number.isFinite(Number(positionSnapshot.openPositionQty)) ? Number(positionSnapshot.openPositionQty) : null,
        reconciliationState: "partial_fill_open_position",
        protectionSummary: summarizeProtection(["working", "new"]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 130_000),
      },
      {
        step: 3,
        label: "protection resized",
        primaryOrderState: "partially_filled",
        positionState: "open_partial",
        workingOrderPresent: true,
        openPositionQty:
          Number.isFinite(Number(positionSnapshot.openPositionQty)) ? Number(positionSnapshot.openPositionQty) : null,
        reconciliationState: "partial_fill_open_position",
        protectionSummary: summarizeProtection(["working", "new"]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 145_000),
      },
    ];
  }

  if (scenario === "filled") {
    return [
      {
        step: 1,
        label: "entry filled",
        primaryOrderState: "filled",
        positionState: "open",
        workingOrderPresent: false,
        openPositionQty: quantity,
        reconciliationState: "filled_open_position",
        protectionSummary: summarizeProtection(["working", "new"]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 130_000),
      },
      {
        step: 2,
        label: "protection working",
        primaryOrderState: "filled",
        positionState: "open",
        workingOrderPresent: false,
        openPositionQty: quantity,
        reconciliationState: "filled_open_position",
        protectionSummary: summarizeProtection(["working", "new"]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 145_000),
      },
    ];
  }

  if (scenario === "flat_exit") {
    return [
      {
        step: 1,
        label: "entry filled",
        primaryOrderState: "filled",
        positionState: "open",
        workingOrderPresent: false,
        openPositionQty: quantity,
        reconciliationState: "filled_open_position",
        protectionSummary: summarizeProtection(["working", "new", "filled", "cancelled"]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 130_000),
      },
      {
        step: 2,
        label: "target filled",
        primaryOrderState:
          typeof primaryOrder.orderState === "string" ? primaryOrder.orderState : "filled_then_flattened",
        positionState: "flat_after_exit",
        workingOrderPresent: false,
        openPositionQty: 0,
        reconciliationState: "flat_after_exit",
        protectionSummary: summarizeProtection(["filled", "cancelled"]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 170_000),
      },
      {
        step: 3,
        label: "flat confirmed",
        primaryOrderState:
          typeof primaryOrder.orderState === "string" ? primaryOrder.orderState : "filled_then_flattened",
        positionState: "flat_after_exit",
        workingOrderPresent: false,
        openPositionQty: 0,
        reconciliationState: "flat_after_exit",
        protectionSummary: summarizeProtection(["filled", "cancelled"]),
        brokerTimestampMicros: isoToMicros(attemptedAt, 180_000),
      },
    ];
  }

  return [];
}

function buildProtectionTimeline(args: {
  scenario: RithmicGatewayScenario;
  attemptedAt: string;
  quantity: number;
  gatewayIds: ReturnType<typeof buildGatewayOrderIds>;
  targetTicks: number | null;
  stopTicks: number | null;
}) {
  const { scenario, attemptedAt, quantity, gatewayIds, targetTicks, stopTicks } = args;
  const hasBracketProtection = targetTicks != null && stopTicks != null;
  const partialFillQty = quantity > 1 ? Math.max(1, Math.floor(quantity / 2)) : quantity / 2;

  if (!hasBracketProtection) {
    return [];
  }

  if (scenario === "transport_failed" || scenario === "rejected" || scenario === "uncertain") {
    return [];
  }

  if (scenario === "submitted") {
    return [
      {
        step: 1,
        role: "take_profit",
        orderId: `${gatewayIds.bracketGroupId}-TP`,
        parentOrderId: gatewayIds.parentOrderId,
        groupId: gatewayIds.bracketGroupId,
        orderState: "working",
        execType: "new",
        qty: quantity,
        priceMode: "ticks",
        priceValue: targetTicks,
        brokerTimestampMicros: isoToMicros(attemptedAt, 140_000),
      },
      {
        step: 2,
        role: "stop_loss",
        orderId: `${gatewayIds.bracketGroupId}-SL`,
        parentOrderId: gatewayIds.parentOrderId,
        groupId: gatewayIds.bracketGroupId,
        orderState: "working",
        execType: "new",
        qty: quantity,
        priceMode: "ticks",
        priceValue: stopTicks,
        brokerTimestampMicros: isoToMicros(attemptedAt, 145_000),
      },
    ];
  }

  if (scenario === "partial_fill") {
    return [
      {
        step: 1,
        role: "take_profit",
        orderId: `${gatewayIds.bracketGroupId}-TP`,
        parentOrderId: gatewayIds.parentOrderId,
        groupId: gatewayIds.bracketGroupId,
        orderState: "working",
        execType: "replace",
        qty: partialFillQty,
        priceMode: "ticks",
        priceValue: targetTicks,
        brokerTimestampMicros: isoToMicros(attemptedAt, 140_000),
      },
      {
        step: 2,
        role: "stop_loss",
        orderId: `${gatewayIds.bracketGroupId}-SL`,
        parentOrderId: gatewayIds.parentOrderId,
        groupId: gatewayIds.bracketGroupId,
        orderState: "working",
        execType: "replace",
        qty: partialFillQty,
        priceMode: "ticks",
        priceValue: stopTicks,
        brokerTimestampMicros: isoToMicros(attemptedAt, 145_000),
      },
    ];
  }

  if (scenario === "filled") {
    return [
      {
        step: 1,
        role: "take_profit",
        orderId: `${gatewayIds.bracketGroupId}-TP`,
        parentOrderId: gatewayIds.parentOrderId,
        groupId: gatewayIds.bracketGroupId,
        orderState: "working",
        execType: "new",
        qty: quantity,
        priceMode: "ticks",
        priceValue: targetTicks,
        brokerTimestampMicros: isoToMicros(attemptedAt, 140_000),
      },
      {
        step: 2,
        role: "stop_loss",
        orderId: `${gatewayIds.bracketGroupId}-SL`,
        parentOrderId: gatewayIds.parentOrderId,
        groupId: gatewayIds.bracketGroupId,
        orderState: "working",
        execType: "new",
        qty: quantity,
        priceMode: "ticks",
        priceValue: stopTicks,
        brokerTimestampMicros: isoToMicros(attemptedAt, 145_000),
      },
    ];
  }

  if (scenario === "flat_exit") {
    return [
      {
        step: 1,
        role: "take_profit",
        orderId: `${gatewayIds.bracketGroupId}-TP`,
        parentOrderId: gatewayIds.parentOrderId,
        groupId: gatewayIds.bracketGroupId,
        orderState: "working",
        execType: "new",
        qty: quantity,
        priceMode: "ticks",
        priceValue: targetTicks,
        brokerTimestampMicros: isoToMicros(attemptedAt, 140_000),
      },
      {
        step: 2,
        role: "stop_loss",
        orderId: `${gatewayIds.bracketGroupId}-SL`,
        parentOrderId: gatewayIds.parentOrderId,
        groupId: gatewayIds.bracketGroupId,
        orderState: "working",
        execType: "new",
        qty: quantity,
        priceMode: "ticks",
        priceValue: stopTicks,
        brokerTimestampMicros: isoToMicros(attemptedAt, 145_000),
      },
      {
        step: 3,
        role: "take_profit",
        orderId: `${gatewayIds.bracketGroupId}-TP`,
        parentOrderId: gatewayIds.parentOrderId,
        groupId: gatewayIds.bracketGroupId,
        orderState: "filled",
        execType: "fill",
        qty: quantity,
        priceMode: "ticks",
        priceValue: targetTicks,
        brokerTimestampMicros: isoToMicros(attemptedAt, 170_000),
      },
      {
        step: 4,
        role: "stop_loss",
        orderId: `${gatewayIds.bracketGroupId}-SL`,
        parentOrderId: gatewayIds.parentOrderId,
        groupId: gatewayIds.bracketGroupId,
        orderState: "cancelled",
        execType: "cancelled",
        qty: 0,
        priceMode: "ticks",
        priceValue: stopTicks,
        brokerTimestampMicros: isoToMicros(attemptedAt, 175_000),
      },
    ];
  }

  if (scenario === "uncertain_recovered" || scenario === "transport_recovered") {
    return [
      {
        step: 1,
        role: "take_profit",
        orderId: `${gatewayIds.bracketGroupId}-TP`,
        parentOrderId: gatewayIds.parentOrderId,
        groupId: gatewayIds.bracketGroupId,
        orderState: "working",
        execType: "new_after_recovery",
        qty: quantity,
        priceMode: "ticks",
        priceValue: targetTicks,
        brokerTimestampMicros: isoToMicros(attemptedAt, 240_000),
      },
      {
        step: 2,
        role: "stop_loss",
        orderId: `${gatewayIds.bracketGroupId}-SL`,
        parentOrderId: gatewayIds.parentOrderId,
        groupId: gatewayIds.bracketGroupId,
        orderState: "working",
        execType: "new_after_recovery",
        qty: quantity,
        priceMode: "ticks",
        priceValue: stopTicks,
        brokerTimestampMicros: isoToMicros(attemptedAt, 245_000),
      },
    ];
  }

  return [];
}

function buildRecoveryPlan(args: {
  scenario: RithmicGatewayScenario;
  attemptedAt: string;
  correlationId: string;
}) {
  const { scenario, attemptedAt, correlationId } = args;

  if (scenario === "transport_failed") {
    return [
      {
        step: 1,
        action: "capture_transport_failure",
        detail: "Mark the transport packet as failed and preserve the correlation id for safe recovery.",
        owner: "gateway",
        state: "required",
        brokerTimestampMicros: isoToMicros(attemptedAt, 90_000),
      },
      {
        step: 2,
        action: "restage_transport",
        detail: `Restage the normalized transport packet for correlation ${correlationId}.`,
        owner: "operator_or_runner",
        state: "required",
        brokerTimestampMicros: null,
      },
      {
        step: 3,
        action: "broker_state_sync",
        detail: "After transport recovery, reconcile broker orders and positions before resuming normal lifecycle handling.",
        owner: "gateway",
        state: "required",
        brokerTimestampMicros: null,
      },
    ];
  }

  if (scenario === "uncertain") {
    return [
      {
        step: 1,
        action: "freeze_duplicate_submit",
        detail: "Do not resubmit immediately while broker acceptance is uncertain.",
        owner: "gateway",
        state: "required",
        brokerTimestampMicros: isoToMicros(attemptedAt, 125_000),
      },
      {
        step: 2,
        action: "pull_working_orders",
        detail: "Refresh broker working orders using the existing correlation and account reference.",
        owner: "gateway",
        state: "required",
        brokerTimestampMicros: null,
      },
      {
        step: 3,
        action: "pull_positions",
        detail: "Refresh broker positions to determine whether the entry filled, partially filled, or never reached the broker.",
        owner: "gateway",
        state: "required",
        brokerTimestampMicros: null,
      },
      {
        step: 4,
        action: "promote_reconciliation_verdict",
        detail: "Convert the uncertain state into aligned / rejected / retry-required once broker truth is available.",
        owner: "server",
        state: "required",
        brokerTimestampMicros: null,
      },
    ];
  }

  if (scenario === "uncertain_recovered") {
    return [
      {
        step: 1,
        action: "freeze_duplicate_submit",
        detail: "Hold duplicate submission while the broker state is still uncertain.",
        owner: "gateway",
        state: "complete",
        brokerTimestampMicros: isoToMicros(attemptedAt, 125_000),
      },
      {
        step: 2,
        action: "pull_working_orders",
        detail: "Broker sync found the live order and linked it back to the original correlation id.",
        owner: "gateway",
        state: "complete",
        brokerTimestampMicros: isoToMicros(attemptedAt, 200_000),
      },
      {
        step: 3,
        action: "promote_reconciliation_verdict",
        detail: "The uncertain state was resolved into a confirmed filled position with active protection.",
        owner: "server",
        state: "resolved",
        brokerTimestampMicros: isoToMicros(attemptedAt, 245_000),
      },
    ];
  }

  if (scenario === "transport_recovered") {
    return [
      {
        step: 1,
        action: "capture_transport_failure",
        detail: "The first transport attempt failed and the packet was preserved for safe recovery.",
        owner: "gateway",
        state: "complete",
        brokerTimestampMicros: isoToMicros(attemptedAt, 90_000),
      },
      {
        step: 2,
        action: "restage_transport",
        detail: `The normalized packet for correlation ${correlationId} was restaged after transport health returned.`,
        owner: "operator_or_runner",
        state: "complete",
        brokerTimestampMicros: isoToMicros(attemptedAt, 180_000),
      },
      {
        step: 3,
        action: "broker_state_sync",
        detail: "Recovered transport confirmed a live working order and restored the normal protection workflow.",
        owner: "gateway",
        state: "resolved",
        brokerTimestampMicros: isoToMicros(attemptedAt, 245_000),
      },
    ];
  }

  if (scenario === "rejected") {
    return [
      {
        step: 1,
        action: "record_reject_and_stop",
        detail: "Persist the broker reject and stop this command path without retrying automatically.",
        owner: "server",
        state: "complete",
        brokerTimestampMicros: isoToMicros(attemptedAt, 125_000),
      },
    ];
  }

  return [];
}

export function runLocalRithmicProtocolGateway(args: {
  packet: RithmicTransportPacket;
  scenario?: RithmicGatewayScenario;
}): RithmicProtocolServiceAttemptResult {
  const { packet, scenario } = args;
  const attemptedAt = new Date().toISOString();
  const signalId = deriveSignalId(packet);
  const envelope = getRequestEnvelope(packet);
  const body = (envelope.requestBody as Record<string, unknown> | undefined) ?? {};
  const accountReference =
    typeof envelope.accountReference === "string" ? envelope.accountReference : null;
  const orderType = typeof body.orderType === "string" ? body.orderType : null;
  const quantity = typeof body.quantity === "number" ? body.quantity : Number(body.quantity ?? 0);
  const symbol = typeof body.symbol === "string" ? body.symbol : null;
  const tif = typeof body.tif === "string" ? body.tif : null;
  const clientOrderId = typeof body.clientOrderId === "string" ? body.clientOrderId : null;
  const bracket = typeof body.bracket === "object" && body.bracket ? (body.bracket as Record<string, unknown>) : null;
  const targetTicks =
    bracket && Number.isFinite(Number(bracket.targetTicks)) ? Number(bracket.targetTicks) : null;
  const stopTicks =
    bracket && Number.isFinite(Number(bracket.stopTicks)) ? Number(bracket.stopTicks) : null;
  const selectedScenario: RithmicGatewayScenario =
    scenario ??
    (typeof packet.payload.simulationScenario === "string"
      ? (packet.payload.simulationScenario as RithmicGatewayScenario)
      : "submitted");
  const gatewayIds = buildGatewayOrderIds(packet.correlationId);
  const executionSnapshot = buildExecutionSnapshot({
    scenario: selectedScenario,
    attemptedAt,
    quantity,
    clientOrderId,
    gatewayIds,
    targetTicks,
    stopTicks,
    symbol,
  });
  const executionHistory = buildExecutionHistory({
    scenario: selectedScenario,
    attemptedAt,
    quantity,
    gatewayIds,
    targetTicks,
    stopTicks,
    symbol,
  });
  const reconciliationTimeline = buildReconciliationTimeline({
    scenario: selectedScenario,
    attemptedAt,
    quantity,
    executionSnapshot,
  });
  const protectionTimeline = buildProtectionTimeline({
    scenario: selectedScenario,
    attemptedAt,
    quantity,
    gatewayIds,
    targetTicks,
    stopTicks,
  });
  const recoveryPlan = buildRecoveryPlan({
    scenario: selectedScenario,
    attemptedAt,
    correlationId: packet.correlationId,
  });
  const baseResponse = {
    gatewayContract: {
      name: "rithmic_protocol_gateway",
      version: "v1",
      mode: "local_gateway",
      scenario: selectedScenario,
    },
    executionReference: {
      signalId,
      correlationId: packet.correlationId,
      accountReference,
      symbol,
      quantity,
      orderType,
      tif,
      clientOrderId,
      brokerOrderId: gatewayIds.brokerOrderId,
      parentOrderId: gatewayIds.parentOrderId,
      bracketGroupId: gatewayIds.bracketGroupId,
    },
    executionSnapshot,
    executionHistory,
    reconciliationTimeline,
    protectionTimeline,
    recoveryPlan,
  } as const;

  if (packet.packetState === "blocked") {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "config_blocked",
      operatorVerdict: "local gateway blocked",
      operatorMessage: "The local Rithmic gateway refused the packet because the upstream handoff is still blocked.",
      endpoint: "internal:rithmic-local-gateway",
      requestBody: packet.payload,
      responseBody: {
        ...baseResponse,
        transport: {
          accepted: false,
          brokerState: "handoff_blocked",
          retryable: false,
          reconciliationRequired: false,
        },
        normalizedOutcome: {
          state: "rejected",
          operatorMessage: "Upstream handoff is still blocked.",
          execType: "rejected",
          ordStatus: "rejected",
          rejectCode: "HANDOFF_BLOCKED",
          rejectReason: "upstream_handoff_blocked",
          leavesQty: null,
          filledQty: null,
          cumQty: null,
          avgFillPrice: null,
          reconciliationState: "blocked_before_gateway",
          gatewayTimestampMicros: isoToMicros(attemptedAt, 80_000),
          brokerTimestampMicros: null,
        },
      },
      attemptedAt,
    };
  }

  const issues = [
    !accountReference ? "accountReference missing" : null,
    !symbol ? "symbol missing" : null,
    !orderType ? "orderType missing" : null,
    !Number.isFinite(quantity) || quantity <= 0 ? "quantity invalid" : null,
  ].filter(Boolean) as string[];

  if (issues.length) {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "live_stubbed",
      operatorVerdict: "local gateway rejected packet",
      operatorMessage: "The local Rithmic gateway received the packet but rejected it because required broker-facing fields are still incomplete.",
      endpoint: "internal:rithmic-local-gateway",
      requestBody: packet.payload,
      responseBody: {
        ...baseResponse,
        transport: {
          accepted: false,
          brokerState: "rejected",
          retryable: false,
          reconciliationRequired: false,
        },
        normalizedOutcome: {
          state: "rejected",
          operatorMessage: "Required broker-facing fields are incomplete.",
          execType: "rejected",
          ordStatus: "rejected",
          rejectCode: "PACKET_VALIDATION_FAILED",
          rejectReason: "packet_validation_failed",
          leavesQty: 0,
          filledQty: 0,
          cumQty: 0,
          avgFillPrice: null,
          reconciliationState: "rejected_before_submit",
          gatewayTimestampMicros: isoToMicros(attemptedAt, 80_000),
          brokerTimestampMicros: null,
        },
        issues,
      },
      attemptedAt,
    };
  }

  if (selectedScenario === "transport_failed") {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "transport_error",
      operatorVerdict: "local gateway transport failure",
      operatorMessage: "The local Rithmic gateway simulated a downstream transport failure for this normalized packet.",
      endpoint: "internal:rithmic-local-gateway",
      requestBody: packet.payload,
      responseBody: {
        ...baseResponse,
        transport: {
          accepted: false,
          brokerState: "transport_failed",
          retryable: true,
          reconciliationRequired: true,
        },
        normalizedOutcome: {
          state: "transport_failed",
          operatorMessage: "Downstream transport failed before broker submit.",
          execType: "unavailable",
          ordStatus: "not_sent",
          rejectCode: "TRANSPORT_FAILED",
          rejectReason: "transport_failed_before_gateway",
          leavesQty: null,
          filledQty: null,
          cumQty: null,
          avgFillPrice: null,
          reconciliationState: "transport_retry_required",
          gatewayTimestampMicros: isoToMicros(attemptedAt, 80_000),
          brokerTimestampMicros: null,
        },
        lifecycleHints: {
          expectedStages: ["ack", "execution_report", "reconciliation"],
          nextAction: "restage_transport",
        },
      },
      attemptedAt,
    };
  }

  if (selectedScenario === "rejected") {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "live_stubbed",
      operatorVerdict: "local gateway rejected packet",
      operatorMessage: "The local Rithmic gateway simulated a broker-side rejection for the normalized packet.",
      endpoint: "internal:rithmic-local-gateway",
      requestBody: packet.payload,
      responseBody: {
        ...baseResponse,
        transport: {
          accepted: false,
          brokerState: "rejected",
          retryable: false,
          reconciliationRequired: false,
        },
        normalizedOutcome: {
          state: "rejected",
          operatorMessage: "Simulated broker-side reject.",
          execType: "rejected",
          ordStatus: "rejected",
          rejectCode: "RISK_REJECT",
          rejectReason: "simulated_risk_reject",
          leavesQty: 0,
          filledQty: 0,
          cumQty: 0,
          avgFillPrice: null,
          reconciliationState: "rejected_no_live_order",
          gatewayTimestampMicros: isoToMicros(attemptedAt, 80_000),
          brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
        },
        lifecycleHints: {
          expectedStages: ["ack", "execution_report", "reconciliation"],
          nextAction: "report_reject_and_stop",
        },
      },
      attemptedAt,
    };
  }

  if (selectedScenario === "uncertain") {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "live_stubbed",
      operatorVerdict: "local gateway uncertain state",
      operatorMessage: "The local Rithmic gateway simulated an uncertain submit state that requires reconciliation.",
      endpoint: "internal:rithmic-local-gateway",
      requestBody: packet.payload,
      responseBody: {
        ...baseResponse,
        transport: {
          accepted: true,
          brokerState: "uncertain",
          retryable: false,
          reconciliationRequired: true,
        },
        normalizedOutcome: {
          state: "uncertain",
          operatorMessage: "Await broker reconciliation.",
          execType: "pending",
          ordStatus: "unknown",
          rejectCode: null,
          rejectReason: null,
          leavesQty: quantity,
          filledQty: null,
          cumQty: null,
          avgFillPrice: null,
          reconciliationState: "manual_review_required",
          gatewayTimestampMicros: isoToMicros(attemptedAt, 80_000),
          brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
        },
        lifecycleHints: {
          expectedStages: ["ack", "execution_report", "reconciliation"],
          nextAction: "trigger_broker_state_sync",
        },
      },
      attemptedAt,
    };
  }

  if (selectedScenario === "uncertain_recovered") {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "live_stubbed",
      operatorVerdict: "local gateway uncertainty recovered",
      operatorMessage:
        "The local Rithmic gateway simulated an uncertain submit that later reconciled into a confirmed filled position with active protection.",
      endpoint: "internal:rithmic-local-gateway",
      requestBody: packet.payload,
      responseBody: {
        ...baseResponse,
        transport: {
          accepted: true,
          brokerState: "filled_after_recovery",
          retryable: false,
          reconciliationRequired: false,
        },
        normalizedOutcome: {
          state: "uncertain_recovered",
          operatorMessage: "Uncertain submit recovered into a confirmed filled position.",
          execType: "fill_after_recovery",
          ordStatus: "filled",
          rejectCode: null,
          rejectReason: null,
          leavesQty: 0,
          filledQty: executionSnapshot.primaryOrder.filledQty,
          cumQty: executionSnapshot.primaryOrder.cumQty,
          avgFillPrice: executionSnapshot.primaryOrder.avgFillPrice,
          reconciliationState: "filled_open_position",
          gatewayTimestampMicros: isoToMicros(attemptedAt, 80_000),
          brokerTimestampMicros: isoToMicros(attemptedAt, 245_000),
        },
        lifecycleHints: {
          expectedStages: ["ack", "execution_report", "reconciliation"],
          nextAction: "monitor_position_and_protection",
        },
      },
      attemptedAt,
    };
  }

  if (selectedScenario === "partial_fill") {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "live_stubbed",
      operatorVerdict: "local gateway partial fill",
      operatorMessage: "The local Rithmic gateway simulated a partial fill with a live residual order and active protection legs.",
      endpoint: "internal:rithmic-local-gateway",
      requestBody: packet.payload,
      responseBody: {
        ...baseResponse,
        transport: {
          accepted: true,
          brokerState: "partially_filled",
          retryable: false,
          reconciliationRequired: false,
        },
        downstreamContract: "rithmic_protocol_gateway_v1",
        nextLifecycle: ["ack", "execution_report", "position_sync"],
        normalizedOutcome: {
          state: "partial_fill",
          operatorMessage: "Simulated partial fill with residual working quantity.",
          execType: "partial_fill",
          ordStatus: "partially_filled",
          rejectCode: null,
          rejectReason: null,
          leavesQty: executionSnapshot.primaryOrder.leavesQty,
          filledQty: executionSnapshot.primaryOrder.filledQty,
          cumQty: executionSnapshot.primaryOrder.cumQty,
          avgFillPrice: executionSnapshot.primaryOrder.avgFillPrice,
          reconciliationState: "partial_fill_open_position",
          gatewayTimestampMicros: isoToMicros(attemptedAt, 80_000),
          brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
        },
        lifecycleHints: {
          expectedStages: ["ack", "execution_report", "reconciliation"],
          nextAction: "monitor_residual_order_and_protection",
        },
      },
      attemptedAt,
    };
  }

  if (selectedScenario === "transport_recovered") {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "live_stubbed",
      operatorVerdict: "local gateway transport recovered",
      operatorMessage:
        "The local Rithmic gateway simulated a failed transport that recovered into a confirmed live working order.",
      endpoint: "internal:rithmic-local-gateway",
      requestBody: packet.payload,
      responseBody: {
        ...baseResponse,
        transport: {
          accepted: true,
          brokerState: "submitted_after_recovery",
          retryable: false,
          reconciliationRequired: false,
        },
        normalizedOutcome: {
          state: "transport_recovered",
          operatorMessage: "Transport recovered and the order is now working on the broker lane.",
          execType: "new_after_recovery",
          ordStatus: "working",
          rejectCode: null,
          rejectReason: null,
          leavesQty: executionSnapshot.primaryOrder.leavesQty,
          filledQty: executionSnapshot.primaryOrder.filledQty,
          cumQty: executionSnapshot.primaryOrder.cumQty,
          avgFillPrice: executionSnapshot.primaryOrder.avgFillPrice,
          reconciliationState: "working_order_confirmed",
          gatewayTimestampMicros: isoToMicros(attemptedAt, 80_000),
          brokerTimestampMicros: isoToMicros(attemptedAt, 245_000),
        },
        lifecycleHints: {
          expectedStages: ["ack", "execution_report", "reconciliation"],
          nextAction: "monitor_working_order_and_protection",
        },
      },
      attemptedAt,
    };
  }

  if (selectedScenario === "filled") {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "live_stubbed",
      operatorVerdict: "local gateway filled order",
      operatorMessage: "The local Rithmic gateway simulated a full fill with the position now open and protected.",
      endpoint: "internal:rithmic-local-gateway",
      requestBody: packet.payload,
      responseBody: {
        ...baseResponse,
        transport: {
          accepted: true,
          brokerState: "filled",
          retryable: false,
          reconciliationRequired: false,
        },
        downstreamContract: "rithmic_protocol_gateway_v1",
        nextLifecycle: ["ack", "execution_report", "position_sync"],
        normalizedOutcome: {
          state: "filled",
          operatorMessage: "Simulated full fill with protection working.",
          execType: "fill",
          ordStatus: "filled",
          rejectCode: null,
          rejectReason: null,
          leavesQty: 0,
          filledQty: executionSnapshot.primaryOrder.filledQty,
          cumQty: executionSnapshot.primaryOrder.cumQty,
          avgFillPrice: executionSnapshot.primaryOrder.avgFillPrice,
          reconciliationState: "filled_open_position",
          gatewayTimestampMicros: isoToMicros(attemptedAt, 80_000),
          brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
        },
        lifecycleHints: {
          expectedStages: ["ack", "execution_report", "reconciliation"],
          nextAction: "monitor_position_and_protection",
        },
      },
      attemptedAt,
    };
  }

  if (selectedScenario === "flat_exit") {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "live_stubbed",
      operatorVerdict: "local gateway flat after exit",
      operatorMessage: "The local Rithmic gateway simulated a completed trade lifecycle that returned the account to flat.",
      endpoint: "internal:rithmic-local-gateway",
      requestBody: packet.payload,
      responseBody: {
        ...baseResponse,
        transport: {
          accepted: true,
          brokerState: "flat",
          retryable: false,
          reconciliationRequired: false,
        },
        downstreamContract: "rithmic_protocol_gateway_v1",
        nextLifecycle: ["ack", "execution_report", "reconciliation"],
        normalizedOutcome: {
          state: "flat_exit",
          operatorMessage: "Simulated full trade lifecycle back to flat.",
          execType: "fill",
          ordStatus: "filled",
          rejectCode: null,
          rejectReason: null,
          leavesQty: 0,
          filledQty: executionSnapshot.primaryOrder.filledQty,
          cumQty: executionSnapshot.primaryOrder.cumQty,
          avgFillPrice: executionSnapshot.primaryOrder.avgFillPrice,
          reconciliationState: "flat_after_exit",
          gatewayTimestampMicros: isoToMicros(attemptedAt, 80_000),
          brokerTimestampMicros: isoToMicros(attemptedAt, 175_000),
        },
        lifecycleHints: {
          expectedStages: ["ack", "execution_report", "reconciliation"],
          nextAction: "journal_trade_complete",
        },
      },
      attemptedAt,
    };
  }

  return {
    adapterId: packet.adapterId,
    signalId,
    correlationId: packet.correlationId,
    runState: "live_stubbed",
    operatorVerdict: "local gateway accepted packet",
    operatorMessage: "The local Rithmic gateway accepted the normalized packet and returned the first broker-shaped contract response.",
    endpoint: "internal:rithmic-local-gateway",
    requestBody: packet.payload,
    responseBody: {
      ...baseResponse,
      transport: {
        accepted: true,
        brokerState: "submitted",
        retryable: false,
        reconciliationRequired: false,
      },
      downstreamContract: "rithmic_protocol_gateway_v1",
      nextLifecycle: ["ack", "execution_report", "position_sync"],
      normalizedOutcome: {
        state: "submitted",
        operatorMessage: "Simulated broker accepted submit.",
        execType: "new",
        ordStatus: "working",
        rejectCode: null,
        rejectReason: null,
        leavesQty: quantity,
        filledQty: 0,
        cumQty: 0,
        avgFillPrice: null,
        reconciliationState: "working_order_confirmed",
        gatewayTimestampMicros: isoToMicros(attemptedAt, 80_000),
        brokerTimestampMicros: isoToMicros(attemptedAt, 120_000),
      },
      lifecycleHints: {
        expectedStages: ["ack", "execution_report", "reconciliation"],
        nextAction: "await_fill_or_flat",
      },
    },
    attemptedAt,
  };
}
