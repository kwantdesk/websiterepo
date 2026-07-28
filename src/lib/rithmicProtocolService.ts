import type {
  RithmicGatewayScenario,
  RithmicProtocolServiceAttemptResult,
  RithmicProtocolServiceConfig,
  RithmicTransportPacket,
} from "@/lib/futuresConnectors";
import { runLocalRithmicProtocolGateway } from "@/lib/rithmicProtocolGateway";

function getProtocolServiceMode(): "local_gateway" | "env_missing" | "dry_run" | "live_stub" {
  const endpoint = process.env.RITHMIC_PROTOCOL_SERVICE_URL?.trim();
  const rawMode = process.env.RITHMIC_PROTOCOL_SERVICE_MODE?.trim().toLowerCase();
  if (rawMode === "local_gateway") return "local_gateway";
  if (!endpoint) return "local_gateway";
  if (rawMode === "live_stub") return "live_stub";
  return "dry_run";
}

export function getRithmicProtocolServiceConfig(): RithmicProtocolServiceConfig {
  const rawEndpoint = process.env.RITHMIC_PROTOCOL_SERVICE_URL?.trim() || null;
  const token = process.env.RITHMIC_PROTOCOL_SERVICE_TOKEN?.trim() || "";
  const timeoutMs = Number(process.env.RITHMIC_PROTOCOL_SERVICE_TIMEOUT_MS || 8000);
  const mode = getProtocolServiceMode();
  const endpoint = mode === "local_gateway" ? "internal:rithmic-local-gateway" : rawEndpoint;

  const missingRequirements = [
    !endpoint ? "RITHMIC_PROTOCOL_SERVICE_URL missing" : null,
    mode === "live_stub" && !token ? "RITHMIC_PROTOCOL_SERVICE_TOKEN missing for live_stub mode" : null,
  ].filter(Boolean) as string[];

  return {
    adapterId: "rithmic-direct",
    mode,
    endpoint,
    authMode: token ? "bearer" : "none",
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000,
    operatorReady: missingRequirements.length === 0,
    missingRequirements,
    notes:
      mode === "local_gateway"
        ? [
            "Local gateway mode routes the normalized packet into kwantify's internal protocol gateway contract.",
            "This is the default serious test lane before an external protocol gateway is introduced.",
          ]
        : mode === "env_missing"
        ? [
            "The protocol-service runner is not configured yet.",
            "Set a service URL to move from planning state into a real runner boundary.",
          ]
        : mode === "dry_run"
          ? [
              "Dry-run mode proves packet delivery shape without requiring a live downstream service.",
              "Switch to live_stub mode only when a service endpoint is ready to accept the packet contract.",
            ]
          : [
              "Live-stub mode will POST the normalized packet to the configured protocol-service endpoint.",
              "The downstream service should respond with normalized submit outcomes so the futures journal can stay broker-agnostic.",
            ],
  };
}

export async function runRithmicProtocolService(args: {
  packet: RithmicTransportPacket;
  scenario?: RithmicGatewayScenario;
}): Promise<RithmicProtocolServiceAttemptResult> {
  const { packet, scenario } = args;
  const config = getRithmicProtocolServiceConfig();
  const attemptedAt = new Date().toISOString();
  const signalId =
    typeof packet.payload.requestEnvelope === "object" &&
    packet.payload.requestEnvelope &&
    typeof (packet.payload.requestEnvelope as Record<string, unknown>).signalId === "string"
      ? String((packet.payload.requestEnvelope as Record<string, unknown>).signalId)
      : "unknown-signal";

  if (packet.packetState === "blocked" || !config.operatorReady) {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "config_blocked",
      operatorVerdict: "protocol runner blocked",
      operatorMessage: "The protocol-service runner cannot proceed until the packet and runner configuration are both ready.",
      endpoint: config.endpoint,
      requestBody: packet.payload,
      responseBody: {
        packetState: packet.packetState,
        runnerMissing: config.missingRequirements,
      },
      attemptedAt,
    };
  }

  if (config.mode === "local_gateway") {
    return runLocalRithmicProtocolGateway({ packet, scenario });
  }

  if (config.mode === "dry_run") {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "dry_run_staged",
      operatorVerdict: "protocol dry run staged",
      operatorMessage: "The normalized transport packet is ready and the protocol-service runner dry run accepted the payload shape.",
      endpoint: config.endpoint,
      requestBody: packet.payload,
      responseBody: {
        dryRun: true,
        accepted: true,
        targetService: packet.targetService,
        targetChannel: packet.targetChannel,
      },
      attemptedAt,
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    const response = await fetch(config.endpoint!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.authMode === "bearer"
          ? { Authorization: `Bearer ${process.env.RITHMIC_PROTOCOL_SERVICE_TOKEN!.trim()}` }
          : {}),
      },
      body: JSON.stringify(packet.payload),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    const json = await response.json().catch(() => null);
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "live_stubbed",
      operatorVerdict: response.ok ? "protocol service reached" : "protocol service responded with failure",
      operatorMessage: response.ok
        ? "The protocol-service runner delivered the normalized packet to the configured endpoint."
        : `The protocol-service endpoint responded with HTTP ${response.status}.`,
      endpoint: config.endpoint,
      requestBody: packet.payload,
      responseBody: {
        httpStatus: response.status,
        body: json,
      },
      attemptedAt,
    };
  } catch (error) {
    return {
      adapterId: packet.adapterId,
      signalId,
      correlationId: packet.correlationId,
      runState: "transport_error",
      operatorVerdict: "protocol transport error",
      operatorMessage: error instanceof Error ? error.message : "Unknown protocol-service transport error.",
      endpoint: config.endpoint,
      requestBody: packet.payload,
      responseBody: null,
      attemptedAt,
    };
  }
}
