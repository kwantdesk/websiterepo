import type { RithmicProtocolStubAttemptResult, RithmicTransportPacket } from "@/lib/futuresConnectors";

export function handleRithmicProtocolStubPacket(args: {
  packet: RithmicTransportPacket;
}): RithmicProtocolStubAttemptResult {
  const { packet } = args;
  const attemptedAt = new Date().toISOString();
  const signalId =
    typeof packet.payload.requestEnvelope === "object" &&
    packet.payload.requestEnvelope &&
    typeof (packet.payload.requestEnvelope as Record<string, unknown>).signalId === "string"
      ? String((packet.payload.requestEnvelope as Record<string, unknown>).signalId)
      : "unknown-signal";

  if (packet.packetState === "blocked") {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "stub_blocked",
      operatorVerdict: "stub blocked",
      operatorMessage: "The local protocol stub refused the packet because the upstream handoff is still blocked.",
      requestBody: packet.payload,
      responseBody: {
        accepted: false,
        reason: "packet_blocked",
      },
      attemptedAt,
    };
  }

  return {
    adapterId: packet.adapterId,
    signalId,
    correlationId: packet.correlationId,
    runState: "stub_accepted",
    operatorVerdict: "stub contract accepted",
    operatorMessage: "The local protocol stub accepted the normalized packet contract. The transport envelope is now stable enough for a downstream gateway to implement.",
    requestBody: packet.payload,
    responseBody: {
      accepted: true,
      downstreamContract: "normalized_protocol_packet",
      targetService: packet.targetService,
      targetChannel: packet.targetChannel,
      correlationId: packet.correlationId,
      normalizedOutcomeShape: {
        states: ["submitted", "partial_fill", "filled", "flat_exit", "rejected", "uncertain", "transport_failed"],
        requiredFields: ["signalId", "correlationId", "brokerState", "operatorMessage"],
      },
    },
    attemptedAt,
  };
}
