import type {
  RithmicAdapterBoundary,
  RithmicDispatchAttemptResult,
  RithmicLiveSubmitHandoff,
} from "@/lib/futuresConnectors";

export function buildRithmicAdapterBoundary(args: {
  handoff: RithmicLiveSubmitHandoff;
}): RithmicAdapterBoundary {
  const { handoff } = args;
  const validationIssues = [...handoff.missingRequirements];

  const transportState: RithmicAdapterBoundary["transportState"] = !handoff.operatorReady
    ? "blocked"
    : "transport_stubbed";

  const implementationStatus =
    transportState === "blocked"
      ? "binding and credential issues still need to be cleared before a live adapter can consume this handoff."
      : handoff.handoffMode === "protocol_service"
        ? "boundary is ready for the first protocol-service transport implementation."
        : handoff.handoffMode === "desktop_sdk"
          ? "boundary is ready for a desktop SDK bridge, but the transport process still needs to be built."
          : "boundary is ready for a colo-style binary bridge, but the low-latency transport layer still needs to be built.";

  const nextActions = !handoff.operatorReady
    ? [
        "resolve every missing requirement on the current handoff",
        "confirm the managed broker account reference and runtime credentials",
        "restage the submit attempt so the adapter boundary receives a clean envelope",
      ]
    : handoff.handoffMode === "protocol_service"
      ? [
          "implement protocol-service request serialization",
          "attach request/response correlation ids",
          "persist broker ack/reject into the shared futures journal",
        ]
      : handoff.handoffMode === "desktop_sdk"
        ? [
            "stand up the desktop bridge host process",
            "serialize the handoff into the SDK bridge transport",
            "capture broker execution events back into the shared futures journal",
          ]
        : [
            "define the colocated binary transport boundary",
            "attach microsecond-safe event timestamps",
            "write the Diamond-side broker lifecycle back into the shared futures journal",
          ];

  return {
    adapterId: handoff.adapterId,
    handoffMode: handoff.handoffMode,
    transportState,
    operatorReady: handoff.operatorReady,
    implementationStatus,
    nextActions,
    validationIssues,
    acceptedEnvelopeShape: [
      "routeProfileId",
      "accountId",
      "signalId",
      "accountReference",
      "requestBody",
      "selectedEnvironment",
      "preferredFlavor",
      "handoffMode",
    ],
    dispatchContract: {
      handoffMode: handoff.handoffMode,
      delivery: "one request envelope in, one normalized submit outcome out",
      expectedOutcomeStates: ["submitted", "partial_fill", "filled", "flat_exit", "rejected", "uncertain", "transport_failed"],
      requestEnvelope: handoff.requestEnvelope,
    },
  };
}

export function stageRithmicTransportDispatch(args: {
  handoff: RithmicLiveSubmitHandoff;
  boundary: RithmicAdapterBoundary;
}): RithmicDispatchAttemptResult {
  const { handoff, boundary } = args;
  const now = new Date().toISOString();
  const signalId =
    typeof handoff.requestEnvelope.signalId === "string" ? handoff.requestEnvelope.signalId : "unknown-signal";

  const dispatchState: RithmicDispatchAttemptResult["dispatchState"] =
    boundary.transportState === "blocked"
      ? "handoff_blocked"
      : boundary.transportState === "boundary_ready"
        ? "boundary_ready"
        : "transport_stubbed";

  const operatorVerdict =
    dispatchState === "handoff_blocked"
      ? "handoff blocked"
      : dispatchState === "boundary_ready"
        ? "adapter boundary ready"
        : "transport staged";

  const operatorMessage =
    dispatchState === "handoff_blocked"
      ? "The Rithmic adapter boundary rejected the staged handoff because required binding or credential truth is still missing."
      : dispatchState === "boundary_ready"
        ? "The Rithmic adapter boundary accepted the handoff shape and is ready for the first real transport implementation."
        : "The Rithmic handoff was accepted by the adapter boundary and staged through the current transport stub for future live wiring.";

  return {
    adapterId: handoff.adapterId,
    signalId,
    handoffMode: handoff.handoffMode,
    dispatchState,
    operatorVerdict,
    operatorMessage,
    requestEnvelope: handoff.requestEnvelope,
    responseBody: {
      handoffAccepted: dispatchState !== "handoff_blocked",
      transportState: boundary.transportState,
      validationIssues: boundary.validationIssues,
      nextActions: boundary.nextActions,
    },
    dispatchedAt: now,
  };
}
