import type {
  RithmicAdapterBoundary,
  RithmicLiveSubmitHandoff,
  RithmicTransportAttemptResult,
  RithmicTransportPacket,
} from "@/lib/futuresConnectors";

function buildCorrelationId(signalId: string, handoffMode: RithmicLiveSubmitHandoff["handoffMode"]) {
  const safeSignal = signalId.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `rithmic-${handoffMode}-${safeSignal}-${Date.now()}`;
}

export function buildRithmicTransportPacket(args: {
  handoff: RithmicLiveSubmitHandoff;
  boundary: RithmicAdapterBoundary;
}): RithmicTransportPacket {
  const { handoff, boundary } = args;
  const signalId =
    typeof handoff.requestEnvelope.signalId === "string" ? handoff.requestEnvelope.signalId : "unknown-signal";
  const correlationId = buildCorrelationId(signalId, handoff.handoffMode);

  const targetService =
    handoff.handoffMode === "protocol_service"
      ? "rithmic-protocol-gateway"
      : handoff.handoffMode === "desktop_sdk"
        ? "rithmic-desktop-bridge"
        : "rithmic-diamond-runner";

  const targetChannel =
    handoff.handoffMode === "protocol_service"
      ? "protocol.submit"
      : handoff.handoffMode === "desktop_sdk"
        ? "desktop.submit"
        : "colo.submit";

  const packetState: RithmicTransportPacket["packetState"] =
    boundary.transportState === "blocked" ? "blocked" : "packet_ready";

  return {
    adapterId: handoff.adapterId,
    handoffMode: handoff.handoffMode,
    targetService,
    targetChannel,
    correlationId,
    packetState,
    payload: {
      correlationId,
      deliveryMode: handoff.handoffMode,
      requestEnvelope: handoff.requestEnvelope,
      expectedOutcomes: ["submitted", "partial_fill", "filled", "flat_exit", "rejected", "uncertain", "transport_failed"],
      credentialsRequired: handoff.requiredCredentials,
    },
    notes:
      packetState === "blocked"
        ? [
            "Packet shape is defined, but dispatch should not continue until the handoff issues are cleared.",
            "Keep the transport packet contract stable even while the real broker transport is still stubbed.",
          ]
        : [
            "This packet is the first transport-facing seam for the future Rithmic implementation.",
            "The real protocol or SDK transport should consume this packet shape and return normalized submit outcomes.",
          ],
  };
}

export function runRithmicTransportStub(args: {
  handoff: RithmicLiveSubmitHandoff;
  boundary: RithmicAdapterBoundary;
  packet: RithmicTransportPacket;
}): RithmicTransportAttemptResult {
  const { handoff, boundary, packet } = args;
  const signalId =
    typeof handoff.requestEnvelope.signalId === "string" ? handoff.requestEnvelope.signalId : "unknown-signal";
  const attemptedAt = new Date().toISOString();

  const transportState: RithmicTransportAttemptResult["transportState"] =
    packet.packetState === "blocked" ? "handoff_blocked" : "transport_stubbed";

  return {
    adapterId: handoff.adapterId,
    signalId,
    handoffMode: handoff.handoffMode,
    correlationId: packet.correlationId,
    transportState,
    operatorVerdict: transportState === "handoff_blocked" ? "transport blocked" : "transport packet staged",
    operatorMessage:
      transportState === "handoff_blocked"
        ? "The Rithmic transport packet could not be dispatched because the handoff still has unresolved validation issues."
        : `The ${packet.targetService} packet was staged successfully. The real transport implementation should now consume this exact payload shape and publish normalized broker outcomes back into the futures journal.`,
    targetService: packet.targetService,
    targetChannel: packet.targetChannel,
    payload: packet.payload,
    responseBody: {
      packetState: packet.packetState,
      validationIssues: boundary.validationIssues,
      nextActions: boundary.nextActions,
      deliveryTarget: {
        targetService: packet.targetService,
        targetChannel: packet.targetChannel,
      },
    },
    attemptedAt,
  };
}
