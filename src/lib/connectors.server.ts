import { CFD_DEFAULT_PORTAL_BASE_URL } from "@/lib/connectors";
import type {
  CfdDeadLetterAdminRequest,
  CfdConnectorAdminRequest,
  CfdValidationUpdateRequest,
  CfdClaimAckRequest,
  CfdClaimRequest,
  CfdRecoveredCommandStatusRequest,
  CfdConnectorAdminEvent,
  CfdConnectionHistoryRow,
  CfdDeadLetterCommand,
  CfdConnectorOverview,
  CfdConnectorRecord,
  CfdConnectorAuthMode,
  CfdConnectorStage,
  CfdErrorCatalogEntry,
  CfdExecutionReportPayload,
  CfdHeartbeatEvent,
  CfdLicenseSlot,
  CfdMailboxCommand,
  CfdNormalizedAction,
  CfdPairingRequest,
  CfdPairingResponse,
  CfdRevokeConnectorResponse,
  CfdRouteProfile,
  CfdRecoveredCommandStatusResponse,
  CfdRotateSecretResponse,
  CfdSignalLogEntry,
  CfdSignalPayload,
  CfdSymbolMapping,
  CfdConnectorRuntimeState,
  ConnectorTone,
} from "@/lib/connectors";
import {
  getCfdConnectorStoreDescriptor,
  readPersistedCfdConnectorState,
  resetPersistedCfdConnectorState,
  writePersistedCfdConnectorState,
} from "@/lib/cfdConnectorStore";
import { CFD_CONNECTOR_SCHEMA_VERSION as CFD_SCHEMA_VERSION } from "@/lib/connectors";
import type { RouteActor } from "@/lib/serverAuth";
type CfdRuntimeState = CfdConnectorRuntimeState;

type CfdAdminActor = Pick<RouteActor, "userId" | "label">;
const LOCAL_DEV_ACTOR: CfdAdminActor = { userId: "local-dev", label: "local-dev" };

const CFD_CONNECTOR_HEARTBEAT_STALE_MS = 90_000;
const CFD_COMMAND_CLAIM_TTL_MS = 20_000;
const CFD_COMMAND_MAX_RETRIES = 3;
const CFD_COMMAND_MAX_AGE_MS = 10 * 60_000;
const CFD_SYNTHETIC_TEST_COOLDOWN_MS = 20_000;
const CFD_SYNTHETIC_TEST_MAX_AGE_MS = 60_000;
const CFD_SYNTHETIC_TEST_STOP_POINTS = 40;
const CFD_SYNTHETIC_TEST_TARGET_POINTS = 80;

const errorCatalog: CfdErrorCatalogEntry[] = [
  {
    scope: "signal",
    code: "payload_invalid",
    title: "Malformed signal payload",
    detail: "Signal body is missing required fields, has an invalid side, or uses an unsupported order type.",
    operatorAction: "Reject at intake, show the validation error in Connector > CFDs, and do not enqueue the command.",
  },
  {
    scope: "routing",
    code: "connector_missing",
    title: "Unknown connector",
    detail: "The signal references a connector or account that is not registered in the connector registry.",
    operatorAction: "Review the KWANT ID / account binding in the route profile before resending the signal.",
  },
  {
    scope: "auth",
    code: "auth_invalid",
    title: "Connector authentication failed",
    detail: "The MT5 seat is using a missing, stale, or incorrect shared secret when calling the connector runtime.",
    operatorAction: "Copy the latest secret into the EA settings, confirm the correct KWANT ID is attached, then run Test Connection again.",
  },
  {
    scope: "auth",
    code: "auth_refresh_required",
    title: "Secret refresh required",
    detail: "The backend rotated the connector secret and the MT5 terminal has not authenticated with the new value yet.",
    operatorAction: "Update the EA secret, restart the seat if needed, and verify the next heartbeat is healthy before allowing live routing.",
  },
  {
    scope: "terminal",
    code: "heartbeat_stale",
    title: "EA heartbeat stale",
    detail: "The EA has not checked in within the expected polling window and may be offline or blocked.",
    operatorAction: "Inspect the MT5 terminal, allowed URL list, and whether the EA is still attached to the chart.",
  },
  {
    scope: "terminal",
    code: "url_not_whitelisted",
    title: "Allowed URL missing",
    detail: "MT5 WebRequest is likely blocked because the kwantify connector URL is not on the allowed URL list.",
    operatorAction: "Open MT5 options, add the kwantify connector URL to the WebRequest allow-list, then run Test Connection again.",
  },
  {
    scope: "terminal",
    code: "algo_trading_disabled",
    title: "Algo trading disabled",
    detail: "The EA cannot submit local orders because MT5 algo trading is disabled at the terminal or chart level.",
    operatorAction: "Enable Algo Trading, confirm the EA is still attached to the chart, and rerun the synthetic test signal.",
  },
  {
    scope: "execution",
    code: "invalid_stops",
    title: "Broker rejected SL/TP",
    detail: "The stop or target is not valid for the symbol, distance rules, or current market state.",
    operatorAction: "Check broker stop distance rules, symbol mapping, and whether points are being translated correctly.",
  },
  {
    scope: "execution",
    code: "invalid_volume",
    title: "Broker rejected volume",
    detail: "The submitted lot size does not satisfy broker min lot, max lot, or step-size constraints for this symbol.",
    operatorAction: "Check the connector symbol map, route sizing, and broker lot-step rules before retrying the command.",
  },
  {
    scope: "execution",
    code: "market_closed",
    title: "Market closed or session unavailable",
    detail: "The terminal could not execute because the symbol was outside tradable hours or the CFD market session was closed.",
    operatorAction: "Confirm the broker session for this symbol and avoid resending until the instrument is tradable again.",
  },
  {
    scope: "execution",
    code: "no_prices",
    title: "No live prices available",
    detail: "MT5 could not submit the order because the symbol had no current bid/ask price or the feed was stale.",
    operatorAction: "Check that the chart is subscribed, the market is open, and the broker feed is updating before retrying.",
  },
  {
    scope: "execution",
    code: "trade_disabled",
    title: "Trading disabled for symbol or account",
    detail: "The broker or terminal refused order submission because trading is disabled for the account or symbol.",
    operatorAction: "Inspect broker permissions, symbol trade mode, and account restrictions before sending more live commands.",
  },
  {
    scope: "mapping",
    code: "symbol_map_missing",
    title: "Symbol mapping missing",
    detail: "The platform symbol has no terminal symbol configured for the chosen MT5 connector.",
    operatorAction: "Add the missing symbol map before allowing the route profile to arm.",
  },
  {
    scope: "recovery",
    code: "dead_letter_queue",
    title: "Dead-letter queue needs review",
    detail: "One or more commands exhausted their claim retries and now require an intentional operator decision.",
    operatorAction: "Review the dead-letter commands on the seat page and decide whether to retry intentionally or dismiss after inspection.",
  },
];

const samplePayload: CfdSignalPayload = {
  schemaVersion: CFD_SCHEMA_VERSION,
  signalId: "sig_20260523_094500_open_drive_v8",
  strategyId: "open_drive_0945",
  versionId: "v8",
  connectorId: "mt5-demo-main",
  accountId: "mt5-demo-128473",
  symbol: "NAS100",
  command: "buy",
  side: "buy",
  quantityMode: "lots",
  quantity: 0.5,
  orderType: "market",
  stopLoss: 40,
  takeProfit: 80,
  timestamp: "2026-05-23T09:45:00.000Z",
  volumeInterpretation: "lots",
  riskValue: 0.5,
  comment: "KWANT:open_drive_0945:v8",
};

const seedState: CfdRuntimeState = {
  connectors: [
    {
      id: "mt5-demo-main",
      kwantId: "KW88763665614933",
      ownerUserId: null,
      ownerLabel: null,
      label: "MT5 Demo Main",
      broker: "Pepperstone",
      server: "Pepperstone-Demo",
      accountLabel: "Primary CFD Demo",
      accountNumber: "128473",
      mode: "demo",
      status: "Ready",
      tone: "ready",
      transport: "webrequest_pull",
      heartbeatState: "healthy",
      lastHeartbeatAt: new Date(Date.now() - 18_000).toISOString(),
      pollIntervalMs: 3000,
      eaVersion: "kwant-ea/0.1.0",
      chartSymbol: "NAS100",
      pendingSignals: 1,
      detail: "Primary MT5 bridge for NAS100 and XAUUSD demo routing while the connector stack is being hardened.",
      pairingStatus: "paired",
      authMode: "shared_secret",
      terminalInstanceId: "pepperstone-demo-terminal-01",
      terminalAlias: "Karen NAS100 Demo",
      pairingCode: "PAIR-8876-331",
      secretHint: "kw_...A91X",
      lastPairedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      lastAuthenticatedAt: new Date(Date.now() - 18_000).toISOString(),
      healthChecks: [
        { id: "algo", label: "Algo Trading", status: "pass", detail: "Terminal reports algo trading enabled." },
        { id: "auth", label: "Connector Auth", status: "pass", detail: "Shared-secret handshake has been accepted for this terminal." },
        { id: "url", label: "Allowed URL", status: "pass", detail: "Kwantify connector endpoint is whitelisted in MT5." },
        { id: "dll", label: "DLL Imports", status: "warn", detail: "Not required for the initial WebRequest bridge, keep disabled unless the bridge design changes." },
        { id: "symbol", label: "Symbol Mapping", status: "pass", detail: "NAS100 and XAUUSD maps exist for this terminal." },
      ],
    },
    {
      id: "mt5-live-secondary",
      kwantId: "KW88763665614932",
      ownerUserId: null,
      ownerLabel: null,
      label: "MT5 Live Secondary",
      broker: "IC Markets",
      server: "ICMarketsSC-MT5-2",
      accountLabel: "Live CFD Pilot",
      accountNumber: "774231",
      mode: "live",
      status: "Planned",
      tone: "planned",
      transport: "webrequest_pull",
      heartbeatState: "offline",
      lastHeartbeatAt: null,
      pollIntervalMs: 3000,
      eaVersion: "kwant-ea/unpaired",
      chartSymbol: "GER40",
      pendingSignals: 0,
      detail: "Reserved live connector slot. Keep inactive until routing, risk, and MT5 pairing are verified on demo first.",
      pairingStatus: "pending",
      authMode: "shared_secret",
      terminalInstanceId: null,
      terminalAlias: null,
      pairingCode: "PAIR-8876-442",
      secretHint: "kw_...UNPAIRED",
      lastPairedAt: null,
      lastAuthenticatedAt: null,
      healthChecks: [
        { id: "pairing", label: "Pairing", status: "unknown", detail: "Terminal not paired yet." },
        { id: "auth", label: "Connector Auth", status: "unknown", detail: "Shared secret not issued until the pairing code is redeemed." },
        { id: "url", label: "Allowed URL", status: "unknown", detail: "Needs MT5 host-side whitelist setup." },
        { id: "symbol", label: "Symbol Mapping", status: "warn", detail: "Only GER40 map drafted; lot-size rules still need confirming." },
      ],
    },
  ],
  routeProfiles: [
    {
      id: "cfd-open-drive-demo",
      name: "Open Drive Demo Route",
      connectorId: "mt5-demo-main",
      strategyScope: "open_drive_0945 v8",
      source: "kwantify",
      symbol: "NAS100",
      terminalSymbol: "NAS100.a",
      sidePolicy: "long_short",
      sizingMode: "fixed_lots",
      sizingValue: 0.5,
      duplicateWindowSeconds: 20,
      maxOpenPositions: 1,
      reductionPolicy: "hedging_only",
      minReductionLot: 0.2,
      minRemainingLot: 0.2,
      stopMode: "points",
      targetMode: "points",
    },
    {
      id: "cfd-gold-breakout-demo",
      name: "Gold Breakout Demo Route",
      connectorId: "mt5-demo-main",
      strategyScope: "gold_breakout_v1",
      source: "kwantify",
      symbol: "XAUUSD",
      terminalSymbol: "XAUUSD.a",
      sidePolicy: "long_short",
      sizingMode: "fixed_lots",
      sizingValue: 0.1,
      duplicateWindowSeconds: 30,
      maxOpenPositions: 1,
      reductionPolicy: "disabled",
      minReductionLot: null,
      minRemainingLot: null,
      stopMode: "points",
      targetMode: "points",
    },
  ],
  symbolMappings: [
    {
      id: "map-nas100-demo",
      connectorId: "mt5-demo-main",
      platformSymbol: "NAS100",
      terminalSymbol: "NAS100.a",
      minLot: 0.1,
      lotStep: 0.1,
      maxLot: 10,
      note: "Pepperstone demo uses the .a suffix and accepts 0.1 lot steps.",
    },
    {
      id: "map-xau-demo",
      connectorId: "mt5-demo-main",
      platformSymbol: "XAUUSD",
      terminalSymbol: "XAUUSD.a",
      minLot: 0.01,
      lotStep: 0.01,
      maxLot: 25,
      note: "Gold symbol carries .a suffix on this broker.",
    },
  ],
  signalInbox: [
    {
      id: crypto.randomUUID(),
      signalId: "sig_20260523_093000_healthcheck",
      connectorId: "mt5-demo-main",
      strategyId: "connector_smoke",
      stage: "executed",
      tone: "ready",
      detail: "Health-check buy and close sequence completed cleanly on the demo connector.",
      occurredAt: new Date(Date.now() - 16 * 60_000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      signalId: "sig_20260523_094500_open_drive_v8",
      connectorId: "mt5-demo-main",
      strategyId: "open_drive_0945",
      stage: "queued",
      tone: "warning",
      detail: "Waiting for the MT5 EA to claim the pending command from the mailbox.",
      occurredAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    },
  ],
  heartbeatEvents: [
    {
      connectorId: "mt5-demo-main",
      kwantId: "KW88763665614933",
      authToken: "kwsec_demo_main_v1",
      occurredAt: new Date(Date.now() - 18_000).toISOString(),
      latencyMs: 184,
      terminalStatus: "ready",
      chartSymbol: "NAS100",
      eaVersion: "kwant-ea/0.1.0",
      pendingSignals: 1,
    },
  ],
  pendingCommands: [
    {
      id: crypto.randomUUID(),
      schemaVersion: CFD_SCHEMA_VERSION,
      connectorId: "mt5-demo-main",
      kwantId: "KW88763665614933",
      routeProfileId: "cfd-open-drive-demo",
      signal: samplePayload,
      action: "open_long",
      terminalSymbol: "NAS100.a",
      commandName: "buy",
      entryInstruction: { mode: "points", value: null },
      quantityMode: "lots",
      normalizedQuantity: 0.5,
      volumeInterpretation: "lots",
      riskValue: 0.5,
      sizingMode: "fixed_lots",
      sizingValue: 0.5,
      stopMode: "points",
      targetMode: "points",
      stopInstruction: { mode: "points", value: 40 },
      targetInstruction: { mode: "points", value: 80 },
      duplicateWindowSeconds: 20,
      maxOpenPositions: 1,
      reductionPolicy: "hedging_only",
      minReductionLot: 0.2,
      minRemainingLot: 0.2,
      magic: 810001,
      comment: "KWANT:open_drive_0945:v8:buy",
      createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      claimedAt: null,
      claimToken: null,
      claimExpiresAt: null,
      acknowledgedAt: null,
      retryCount: 0,
    },
  ],
  deadLetterCommands: [],
  executionReports: [
    {
      connectorId: "mt5-demo-main",
      kwantId: "KW88763665614933",
      authToken: "kwsec_demo_main_v1",
      signalId: "sig_20260523_093000_healthcheck",
      status: "filled",
      occurredAt: new Date(Date.now() - 15 * 60_000).toISOString(),
      terminalSymbol: "NAS100.a",
      orderTicket: "5481029",
      positionTicket: "5481029",
      executedPrice: 29476.2,
      stopLoss: 29436.2,
      takeProfit: 29556.2,
      terminalComment: "KWANT:connector_smoke:v1",
    },
  ],
  licenseSlots: [],
  adminEvents: [
    {
      id: crypto.randomUUID(),
      connectorId: "mt5-demo-main",
      kwantId: "KW88763665614933",
      action: "paired",
      detail: "Primary demo seat paired with Karen NAS100 Demo terminal.",
      actor: "system/bootstrap",
      occurredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  connectorSecrets: {
    "mt5-demo-main": "kwsec_demo_main_v1",
    "mt5-live-secondary": "kwsec_live_secondary_v1",
  },
};

const globalForConnectors = globalThis as typeof globalThis & {
  __kwantifyCfdRuntimeState?: CfdRuntimeState;
  __kwantifyCfdRuntimeStatePromise?: Promise<CfdRuntimeState>;
};

function cloneSeedState() {
  const initial = structuredClone(seedState);
  initial.licenseSlots = buildLicenseSlots(initial.connectors);
  return initial;
}

function mergeByKey<T extends Record<string, unknown>>(
  seeded: T[],
  persisted: T[] | undefined,
  key: keyof T
) {
  if (!persisted?.length) return seeded;

  const persistedMap = new Map(persisted.map((item) => [String(item[key]), item]));
  const merged = seeded.map((seededItem) => ({
    ...seededItem,
    ...(persistedMap.get(String(seededItem[key])) ?? {}),
  }));

  for (const persistedItem of persisted) {
    const persistedKey = String(persistedItem[key]);
    if (!merged.some((seededItem) => String(seededItem[key]) === persistedKey)) {
      merged.push(persistedItem);
    }
  }

  return merged;
}

function hydrateState(persisted?: Partial<CfdRuntimeState> | null): CfdRuntimeState {
  const seeded = cloneSeedState();
  if (!persisted) return seeded;

  const hydrated: CfdRuntimeState = {
    connectors: seeded.connectors.map((seededConnector) => {
      const persistedConnector = persisted.connectors?.find((item) => item.id === seededConnector.id);
      return persistedConnector
        ? {
            ...seededConnector,
            ...persistedConnector,
            kwantId: seededConnector.kwantId,
            healthChecks:
              persistedConnector.healthChecks && persistedConnector.healthChecks.length
                ? persistedConnector.healthChecks
                : seededConnector.healthChecks,
          }
        : seededConnector;
    }),
    routeProfiles: mergeByKey(seeded.routeProfiles, persisted.routeProfiles, "id"),
    symbolMappings: mergeByKey(seeded.symbolMappings, persisted.symbolMappings, "id"),
    signalInbox: persisted.signalInbox ?? seeded.signalInbox,
    heartbeatEvents: persisted.heartbeatEvents ?? seeded.heartbeatEvents,
    pendingCommands: persisted.pendingCommands ?? seeded.pendingCommands,
    deadLetterCommands: persisted.deadLetterCommands ?? seeded.deadLetterCommands,
    executionReports: persisted.executionReports ?? seeded.executionReports,
    licenseSlots: mergeByKey(seeded.licenseSlots, persisted.licenseSlots, "kwantId"),
    adminEvents: persisted.adminEvents ?? seeded.adminEvents,
    connectorSecrets: {
      ...seeded.connectorSecrets,
      ...(persisted.connectorSecrets ?? {}),
    },
  };

  refreshLicenseSlotSessions(hydrated);
  return hydrated;
}

async function persistState(state: CfdRuntimeState) {
  await writePersistedCfdConnectorState(state);
}

async function persistStateBestEffort(state: CfdRuntimeState) {
  try {
    await persistState(state);
  } catch (error) {
    console.warn("[connectors.server] Persist skipped because the CFD store backend was unavailable.", error);
  }
}

async function loadStateFromDisk() {
  try {
    const parsed = await readPersistedCfdConnectorState();
    if (!parsed) {
      const initial = cloneSeedState();
      await persistStateBestEffort(initial);
      return initial;
    }

    const hydrated = hydrateState(parsed);
    return hydrated;
  } catch (error) {
    console.warn("[connectors.server] CFD state hydration fell back to seed state.", error);
    const fallback = cloneSeedState();
    await persistStateBestEffort(fallback);
    return fallback;
  }
}

async function resetStateForTesting() {
  const initial = cloneSeedState();
  globalForConnectors.__kwantifyCfdRuntimeState = initial;
  globalForConnectors.__kwantifyCfdRuntimeStatePromise = Promise.resolve(initial);
  await resetPersistedCfdConnectorState(initial);
  return initial;
}

async function getState() {
  if (getCfdConnectorStoreDescriptor().kind === "supabase_snapshot") {
    return loadStateFromDisk();
  }

  if (globalForConnectors.__kwantifyCfdRuntimeState) {
    return globalForConnectors.__kwantifyCfdRuntimeState;
  }

  if (!globalForConnectors.__kwantifyCfdRuntimeStatePromise) {
    globalForConnectors.__kwantifyCfdRuntimeStatePromise = loadStateFromDisk().then((state) => {
      globalForConnectors.__kwantifyCfdRuntimeState = state;
      return state;
    });
  }

  return globalForConnectors.__kwantifyCfdRuntimeStatePromise;
}

function sweepExpiredClaims(state: CfdRuntimeState) {
  const nowMs = Date.now();
  let mutated = false;

  for (let index = state.pendingCommands.length - 1; index >= 0; index -= 1) {
    const command = state.pendingCommands[index];
    const signalTimestampMs = Number.isNaN(Date.parse(command.signal.timestamp))
      ? 0
      : new Date(command.signal.timestamp).getTime();
    const createdAtMs = Number.isNaN(Date.parse(command.createdAt))
      ? 0
      : new Date(command.createdAt).getTime();
    const freshnessReferenceMs = signalTimestampMs > 0 ? signalTimestampMs : createdAtMs;

    const maxAgeMs =
      command.signal.strategyId === "connector_test" ? CFD_SYNTHETIC_TEST_MAX_AGE_MS : CFD_COMMAND_MAX_AGE_MS;

    if (freshnessReferenceMs > 0 && nowMs - freshnessReferenceMs > maxAgeMs && !command.acknowledgedAt) {
      const isSyntheticTest = command.signal.strategyId === "connector_test";
      const expiredMessage = isSyntheticTest
        ? "Synthetic MT5 test command expired before the terminal claimed it. A fresh test can be sent now."
        : "Mailbox command expired before safe execution and was dropped instead of being sent late.";
      const expiredDetail = isSyntheticTest
        ? `Synthetic MT5 test command for ${command.terminalSymbol} expired before the terminal claimed it and was cleared automatically.`
        : `Stale command for ${command.terminalSymbol} expired in the mailbox and was rejected instead of being executed late.`;

      mutated = true;
      state.pendingCommands.splice(index, 1);
      state.executionReports.unshift({
        connectorId: command.connectorId,
        kwantId: command.kwantId,
        authToken: "",
        signalId: command.signal.signalId,
        status: "rejected",
        occurredAt: new Date().toISOString(),
        terminalSymbol: command.terminalSymbol,
        errorCode: "command_expired",
        errorMessage: expiredMessage,
        terminalComment: command.comment,
      });
      state.signalInbox.unshift({
        id: crypto.randomUUID(),
        signalId: command.signal.signalId,
        connectorId: command.connectorId,
        strategyId: command.signal.strategyId,
        stage: "rejected",
        tone: "error",
        detail: expiredDetail,
        occurredAt: new Date().toISOString(),
      });
      continue;
    }

    if (command.acknowledgedAt) continue;
    if (!command.claimedAt || !command.claimExpiresAt) continue;
    if (new Date(command.claimExpiresAt).getTime() > nowMs) continue;

    mutated = true;
    command.claimedAt = null;
    command.claimToken = null;
    command.claimExpiresAt = null;
    command.acknowledgedAt = null;
    command.retryCount += 1;

    if (command.retryCount >= CFD_COMMAND_MAX_RETRIES) {
      const deadLetteredAt = new Date().toISOString();
      state.deadLetterCommands.unshift({
        ...command,
        deadLetteredAt,
        deadLetterReason: `Claim lease expired ${command.retryCount} times without terminal progress.`,
      });
      state.pendingCommands.splice(index, 1);
      state.signalInbox.unshift({
        id: crypto.randomUUID(),
        signalId: command.signal.signalId,
        connectorId: command.connectorId,
        strategyId: command.signal.strategyId,
        stage: "dead_letter",
        tone: "error",
        detail: `Command for ${command.terminalSymbol} moved to dead-letter after ${command.retryCount} expired claim attempts.`,
        occurredAt: deadLetteredAt,
      });
      continue;
    }

    state.signalInbox.unshift({
      id: crypto.randomUUID(),
      signalId: command.signal.signalId,
      connectorId: command.connectorId,
      strategyId: command.signal.strategyId,
      stage: "queued",
      tone: "warning",
      detail: `Claim lease expired for ${command.terminalSymbol}. Command returned to the mailbox for retry ${command.retryCount}.`,
      occurredAt: new Date().toISOString(),
    });
  }

  return mutated;
}

function buildHistoryForKwantId(
  kwantId: string,
  connector?: CfdConnectorRecord,
  status: "active" | "closed" = "closed",
  offsetDays = 0,
  durationHours = 5
): CfdConnectionHistoryRow {
  const connectedFrom = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000 - durationHours * 60 * 60 * 1000);
  const connectedTo = status === "active" ? null : new Date(connectedFrom.getTime() + durationHours * 60 * 60 * 1000);
  return {
    id: crypto.randomUUID(),
    kwantId,
    accountNumber: connector?.accountNumber ?? String(64520 + offsetDays),
    broker: connector?.broker ?? "Hola Prime Ltd",
    accountType: connector?.mode === "live" ? "Live" : "Demo",
    platform: "MT5",
    eaVersion: connector?.eaVersion ?? "kwant-ea/unpaired",
    connectedFrom: connectedFrom.toISOString(),
    connectedTo: connectedTo ? connectedTo.toISOString() : null,
    status,
  };
}

function buildLicenseSlots(connectors: CfdConnectorRecord[]): CfdLicenseSlot[] {
  const primary = connectors[0];
  const secondary = connectors[1];
  const kwantIds = [
    "KW88763665614933",
    "KW88763665614931",
    "KW88763665614932",
    "KW88763665614934",
    "KW88763665614935",
    "KW88763665614936",
    "KW88763665614937",
    "KW88763665614938",
    "KW88763665614939",
    "88763665614940",
  ];

  return kwantIds.map((kwantId, index) => {
    const sessions =
      index === 0 && primary
        ? [{ ...primary, kwantId }]
        : index === 2 && secondary
          ? [{ ...secondary, kwantId }]
          : [];

    const history =
      index === 0
        ? [
            buildHistoryForKwantId(kwantId, { ...primary, kwantId }, "active", 0, 18),
            buildHistoryForKwantId(kwantId, { ...primary, kwantId }, "closed", 1, 17),
            buildHistoryForKwantId(kwantId, { ...primary, kwantId }, "closed", 2, 5),
          ]
        : index === 2
          ? [
              buildHistoryForKwantId(kwantId, { ...secondary, kwantId }, "closed", 3, 7),
              buildHistoryForKwantId(kwantId, { ...secondary, kwantId }, "closed", 5, 6),
            ]
          : [];

    return {
      id: `license-slot-${index + 1}`,
      kwantId,
      activeConnections: sessions.length,
      maxConnections: 10,
      sessions,
      history,
    };
  });
}

function toneForStage(stage: CfdSignalLogEntry["stage"]): ConnectorTone {
  switch (stage) {
    case "executed":
    case "reduced":
    case "closed":
      return "ready";
    case "rejected":
    case "dead_letter":
      return "error";
    case "queued":
    case "claimed":
      return "warning";
    default:
      return "live";
  }
}

function heartbeatState(lastHeartbeatAt: string | null) {
  if (!lastHeartbeatAt) return "offline" as const;
  const ageMs = Date.now() - new Date(lastHeartbeatAt).getTime();
  if (ageMs > CFD_CONNECTOR_HEARTBEAT_STALE_MS) return "stale" as const;
  return "healthy" as const;
}

function dynamicHealthChecks(connector: CfdConnectorRecord, nextState: ReturnType<typeof heartbeatState>) {
  return connector.healthChecks.map((check) => {
    if (check.id === "pairing") {
      if (connector.pairingStatus === "revoked") {
        return {
          ...check,
          status: "fail" as const,
          detail: "Connector seat has been revoked and now requires a fresh pairing flow.",
        };
      }
      if (connector.pairingStatus === "paired") {
        return {
          ...check,
          status: "pass" as const,
          detail: "Terminal pairing is active for this MT5 seat.",
        };
      }
      return {
        ...check,
        status: "warn" as const,
        detail: "Terminal is not paired yet, so this seat cannot heartbeat or claim commands.",
      };
    }

    if (check.id === "auth") {
      if (connector.pairingStatus === "revoked") {
        return {
          ...check,
          status: "fail" as const,
          detail: "Connector auth is blocked until the seat is paired again with a fresh secret.",
        };
      }
      if (connector.pairingStatus !== "paired") {
        return {
          ...check,
          status: "unknown" as const,
          detail: "Shared secret stays inactive until the connector has been paired.",
        };
      }
      if (!connector.lastAuthenticatedAt) {
        return {
          ...check,
          status: "warn" as const,
          detail: "Terminal has not authenticated with the newest secret yet.",
        };
      }
      return {
        ...check,
        status: "pass" as const,
        detail: "Shared-secret handshake has been accepted for this terminal.",
      };
    }

    if (check.id === "url") {
      if (connector.pairingStatus === "revoked") {
        return {
          ...check,
          status: "warn" as const,
          detail: "Re-pair this seat before validating MT5 URL whitelist health again.",
        };
      }
      if (connector.pairingStatus !== "paired") {
        return {
          ...check,
          status: "unknown" as const,
          detail: "Needs MT5 host-side whitelist setup before the bridge can start polling.",
        };
      }
      return {
        ...check,
        status: "pass" as const,
        detail: "Kwantify connector endpoint is whitelisted in MT5.",
      };
    }

    if (check.id === "algo") {
      if (nextState === "offline" || nextState === "stale") {
        return {
          ...check,
          status: "warn" as const,
          detail: "Terminal heartbeat is not healthy, so algo state should be checked on the MT5 host.",
        };
      }
    }

    return check;
  });
}

function enrichConnector(connector: CfdConnectorRecord, state: CfdRuntimeState): CfdConnectorRecord {
  const latestHeartbeat = state.heartbeatEvents.find((event) => event.connectorId === connector.id);
  const pendingSignals = state.pendingCommands.filter(
    (command) => command.connectorId === connector.id
  ).length;
  const nextHeartbeatAt = latestHeartbeat?.occurredAt ?? connector.lastHeartbeatAt;
  const nextState = heartbeatState(nextHeartbeatAt);
  const authRotatedNeedsRefresh = connector.pairingStatus === "paired" && !connector.lastAuthenticatedAt;
  const retryHot = state.pendingCommands.some(
    (command) => command.connectorId === connector.id && command.retryCount >= 2
  );

  return {
    ...connector,
    lastHeartbeatAt: nextHeartbeatAt,
    lastAuthenticatedAt: latestHeartbeat?.occurredAt ?? connector.lastAuthenticatedAt,
    heartbeatState: nextState,
    pendingSignals,
    healthChecks: dynamicHealthChecks(
      {
        ...connector,
        lastHeartbeatAt: nextHeartbeatAt,
        lastAuthenticatedAt: latestHeartbeat?.occurredAt ?? connector.lastAuthenticatedAt,
      },
      nextState
    ),
    tone:
      connector.pairingStatus === "revoked"
        ? "error"
        : authRotatedNeedsRefresh
          ? "warning"
          : retryHot
            ? "warning"
            : connector.tone === "planned"
        ? "planned"
        : nextState === "healthy"
          ? "ready"
          : nextState === "stale"
            ? "warning"
            : "error",
    status:
      connector.pairingStatus === "revoked"
        ? "Revoked"
        : authRotatedNeedsRefresh
          ? "Auth refresh required"
          : retryHot
            ? "Command retries building"
            : connector.status === "Planned"
        ? "Planned"
        : nextState === "healthy"
          ? "Connected"
          : nextState === "stale"
            ? "Stale heartbeat"
            : "Offline",
  };
}

function validateConnectorAuth(state: CfdRuntimeState, connector: CfdConnectorRecord, authToken: string) {
  const expected = state.connectorSecrets[connector.id];
  if (!authToken) {
    return "authToken is required.";
  }
  if (!expected || expected !== authToken) {
    return "authToken is invalid for this connector.";
  }
  if (connector.pairingStatus !== "paired") {
    return "connector is not paired for live bridge authentication yet.";
  }
  return null;
}

function ensureConnectorOwner(
  state: CfdRuntimeState,
  connector: CfdConnectorRecord,
  actor: CfdAdminActor
) {
  if (!connector.ownerUserId) {
    connector.ownerUserId = actor.userId;
    connector.ownerLabel = actor.label;

    appendAdminEvent(state, {
      connectorId: connector.id,
      kwantId: connector.kwantId,
      action: "claimed_owner",
      detail: "Seat linked automatically when the first protected operator action ran.",
      actor: actor.label,
      occurredAt: new Date().toISOString(),
    });

    refreshLicenseSlotSessions(state);

    return { ok: true as const, claimed: true };
  }

  if (connector.ownerUserId !== actor.userId) {
    return {
      ok: false as const,
      error: `This connector seat is owned by ${connector.ownerLabel ?? "another user"}.`,
    };
  }

  if (connector.ownerLabel !== actor.label) {
    connector.ownerLabel = actor.label;
  }

  refreshLicenseSlotSessions(state);
  return { ok: true as const, claimed: false };
}

export async function claimCfdConnectorOwnership(payload: unknown, actor: CfdAdminActor = LOCAL_DEV_ACTOR) {
  const state = await getState();
  const request = normalizeConnectorAdminRequest(payload);

  if (!request.connectorId || !request.kwantId) {
    return { ok: false, error: "connectorId and kwantId are required." };
  }

  const connector = state.connectors.find((item) => item.id === request.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== request.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  if (connector.ownerUserId && connector.ownerUserId !== actor.userId) {
    return {
      ok: false,
      error: `This connector seat is owned by ${connector.ownerLabel ?? "another user"}.`,
    };
  }

  connector.ownerUserId = actor.userId;
  connector.ownerLabel = actor.label;
  const claimedAt = new Date().toISOString();
  refreshLicenseSlotSessions(state);

  appendAdminEvent(state, {
    connectorId: connector.id,
    kwantId: connector.kwantId,
    action: "claimed_owner",
    detail: "Seat ownership claimed by the current operator.",
    actor: actor.label,
    occurredAt: claimedAt,
  });
  await persistStateBestEffort(state);

  return {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    connectorId: connector.id,
    kwantId: connector.kwantId,
    claimedAt,
    ownerUserId: connector.ownerUserId,
    ownerLabel: connector.ownerLabel,
  };
}

export async function getCfdConnectorOverview() {
  const state = await getState();
  if (sweepExpiredClaims(state)) {
    await persistState(state);
  }
  refreshLicenseSlotSessions(state);

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: CFD_SCHEMA_VERSION,
    destination: "MetaTrader 5",
    source: "kwantify",
    store: getCfdConnectorStoreDescriptor(),
    connectors: state.connectors.map((connector) => enrichConnector(connector, state)),
    routeProfiles: state.routeProfiles,
    symbolMappings: state.symbolMappings,
    signalInbox: [...state.signalInbox].sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt)).slice(0, 14),
    errorCatalog,
    samplePayload,
    pendingCommands: [...state.pendingCommands].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 8),
    deadLetterCommands: [...state.deadLetterCommands]
      .sort((a, b) => +new Date(b.deadLetteredAt) - +new Date(a.deadLetteredAt))
      .slice(0, 8),
    executionReports: [...state.executionReports].sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt)).slice(0, 12),
    licenseSlots: state.licenseSlots,
    adminEvents: [...state.adminEvents].sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt)).slice(0, 16),
  };
}

export async function getCfdLicenseSlotByKwantId(kwantId: string) {
  const state = await getState();
  refreshLicenseSlotSessions(state);
  return state.licenseSlots.find((slot) => slot.kwantId === kwantId) ?? null;
}

function refreshLicenseSlotSessions(state: CfdRuntimeState) {
  state.licenseSlots = state.licenseSlots.map((slot) => ({
    ...slot,
    sessions: state.connectors
      .filter((connector) => connector.kwantId === slot.kwantId)
      .map((connector) => enrichConnector(connector, state)),
    activeConnections: state.connectors.filter((connector) => connector.kwantId === slot.kwantId).length,
  }));
}

function normalizePineDelimitedMessage(
  rawMessage: string,
  state: CfdRuntimeState,
  overrides?: Partial<CfdSignalPayload>
): CfdSignalPayload {
  const tokens = rawMessage
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (tokens.length < 3) {
    return {
      schemaVersion: CFD_SCHEMA_VERSION,
      signalId: "",
      strategyId: "pine_raw_ingress",
      versionId: "v1",
      connectorId: "",
      accountId: "",
      symbol: "",
      command: "buy",
      side: "buy",
      quantityMode: "lots",
      quantity: 0,
      orderType: "market",
      stopLoss: null,
      takeProfit: null,
      timestamp: new Date().toISOString(),
      rawMessage,
    };
  }

  const [licenseIdToken, commandToken, symbolToken, ...parameterTokens] = tokens;
  const kwantId = licenseIdToken.trim();
  const rawCommand = commandToken.trim().toLowerCase();
  const commandAliasMap: Record<string, CfdSignalPayload["command"]> = {
    "cl+ol": "closelongopenlong",
    "cl+os": "closelongopenshort",
    "cs+ol": "closeshortopenlong",
    "cs+os": "closeshortopenshort",
    "cls+ol": "closelongshortopenlong",
    "cls+os": "closelongshortopenshort",
  };
  const command = (commandAliasMap[rawCommand] ?? rawCommand) as CfdSignalPayload["command"];
  const symbol = symbolToken.trim();
  const connector = state.connectors.find((item) => item.kwantId === kwantId);

  const parameterMap = new Map<string, string>();
  for (const token of parameterTokens) {
    const equalsIndex = token.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = token.slice(0, equalsIndex).trim().toLowerCase();
    const value = token.slice(equalsIndex + 1).trim();
    if (key) {
      parameterMap.set(key, value);
    }
  }

  const asNumber = (key: string) => {
    const value = parameterMap.get(key);
    if (value == null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  let quantity = 0;
  let riskValue: number | null = null;
  let volumeInterpretation: CfdSignalPayload["volumeInterpretation"] = "lots";

  const volumeParsers: Array<[string, CfdSignalPayload["volumeInterpretation"]]> = [
    ["vol_lots", "lots"],
    ["vol_dollar", "dollar_loss"],
    ["vol_pct_bal_loss", "pct_balance_loss"],
    ["vol_pct_eq_loss", "pct_equity_loss"],
    ["vol_pct_bal_margin", "pct_balance_margin"],
  ];

  for (const [key, interpretation] of volumeParsers) {
    const value = asNumber(key);
    if (value != null) {
      quantity = value;
      riskValue = value;
      volumeInterpretation = interpretation;
      break;
    }
  }

  const legacyRisk = asNumber("risk");
  if (legacyRisk != null && quantity === 0) {
    quantity = legacyRisk;
    riskValue = legacyRisk;
    volumeInterpretation = "lots";
  }

  const stopLoss =
    asNumber("sl_pips") ??
    asNumber("sl_price") ??
    asNumber("sl_pct") ??
    asNumber("sl");
  const takeProfit =
    asNumber("tp_pips") ??
    asNumber("tp_price") ??
    asNumber("tp_pct") ??
    asNumber("tp");

  const side =
    command === "buy" ||
    command === "buystop" ||
    command === "buylimit" ||
    command === "closeshortopenlong" ||
    command === "closelongopenlong" ||
    command === "closelongshortopenlong" ||
    command === "cancellongbuystop" ||
    command === "cancellongbuylimit"
      ? "buy"
      : command === "sell" ||
          command === "sellstop" ||
          command === "selllimit" ||
          command === "closelongopenshort" ||
          command === "closeshortopenshort" ||
          command === "closelongshortopenshort" ||
          command === "cancelshortsellstop" ||
          command === "cancelshortselllimit"
        ? "sell"
        : command === "closelongpct" || command === "closeshortpct" || command === "closelongvol" || command === "closeshortvol"
          ? "reduce"
          : command === "closelong" || command === "closeshort" || command === "closelongshort"
            ? "close"
            : "flatten";

  const orderType =
    command === "buylimit" || command === "selllimit" || command === "cancellongbuylimit" || command === "cancelshortselllimit"
      ? "limit"
      : command === "buystop" || command === "sellstop" || command === "cancellongbuystop" || command === "cancelshortsellstop"
        ? "stop"
        : "market";

  return {
    schemaVersion: overrides?.schemaVersion ?? CFD_SCHEMA_VERSION,
    signalId:
      overrides?.signalId ??
      `${kwantId}_${command}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    strategyId: overrides?.strategyId ?? "pine_raw_ingress",
    versionId: overrides?.versionId ?? "v1",
    connectorId: overrides?.connectorId ?? connector?.id ?? "",
    accountId: overrides?.accountId ?? connector?.accountNumber ?? "",
    symbol: overrides?.symbol ?? symbol,
    command,
    side,
    quantityMode: "lots",
    quantity,
    orderType,
    stopLoss,
    takeProfit,
    timestamp: overrides?.timestamp ?? new Date().toISOString(),
    riskValue,
    volumeInterpretation,
    entryPrice: asNumber("entry_price"),
    entryPips: asNumber("entry_pips") ?? asNumber("pending"),
    entryPercent: asNumber("entry_pct"),
    spreadFilter: asNumber("spread"),
    accountFilter: asNumber("accfilter"),
    breakevenAt: asNumber("betrigger"),
    breakevenOffset: asNumber("beoffset"),
    trailingTrigger: asNumber("trailtrig"),
    trailingDistance: asNumber("traildist"),
    trailingStep: asNumber("trailstep"),
    atrTimeframe: asNumber("atrtimeframe"),
    atrPeriod: asNumber("atrperiod"),
    atrMultiplier: asNumber("atrmultiplier"),
    atrShift: asNumber("atrshift"),
    atrTrigger: asNumber("atrtrigger"),
    secret: parameterMap.get("secret") ?? undefined,
    rawMessage,
    comment: parameterMap.get("comment") ?? overrides?.comment,
  };
}

function normalizeSignal(payload: unknown, state: CfdRuntimeState): CfdSignalPayload {
  if (typeof payload === "string") {
    return normalizePineDelimitedMessage(payload, state);
  }

  const body = payload as Partial<CfdSignalPayload>;
  const rawMessageCandidate =
    typeof (body as { raw?: unknown }).raw === "string"
      ? String((body as { raw?: string }).raw)
      : typeof (body as { message?: unknown }).message === "string"
        ? String((body as { message?: string }).message)
        : typeof (body as { signal?: unknown }).signal === "string"
          ? String((body as { signal?: string }).signal)
          : null;

  if (rawMessageCandidate && !body.command && !body.connectorId) {
    return normalizePineDelimitedMessage(rawMessageCandidate, state, body);
  }

  const rawCommand = String(body.command ?? "").trim().toLowerCase();
  const rawSide = String(body.side ?? "").trim().toLowerCase();
  const command = (
    rawCommand ||
    (rawSide === "buy"
      ? "buy"
      : rawSide === "sell"
        ? "sell"
        : rawSide === "reduce"
          ? "closelongvol"
          : rawSide === "close"
            ? "closelongshort"
            : rawSide === "flatten"
              ? "closeall"
              : "buy")
  ) as CfdSignalPayload["command"];
  const side =
    rawSide === "buy" || rawSide === "sell" || rawSide === "reduce" || rawSide === "close" || rawSide === "flatten"
      ? rawSide
      : command === "buy" ||
          command === "buystop" ||
          command === "buylimit" ||
          command === "closelongopenlong" ||
          command === "closeshortopenlong" ||
          command === "closelongshortopenlong" ||
          command === "cancellongbuystop" ||
          command === "cancellongbuylimit"
        ? "buy"
        : command === "sell" ||
            command === "sellstop" ||
            command === "selllimit" ||
            command === "closelongopenshort" ||
            command === "closeshortopenshort" ||
            command === "closelongshortopenshort" ||
            command === "cancelshortsellstop" ||
            command === "cancelshortselllimit"
          ? "sell"
          : command === "closelongpct" || command === "closeshortpct" || command === "closelongvol" || command === "closeshortvol"
            ? "reduce"
            : command === "closelong" || command === "closeshort" || command === "closelongshort"
              ? "close"
              : "flatten";
  return {
    schemaVersion: String(body.schemaVersion ?? CFD_SCHEMA_VERSION).trim(),
    signalId: String(body.signalId ?? "").trim(),
    strategyId: String(body.strategyId ?? "").trim(),
    versionId: String(body.versionId ?? "").trim(),
    connectorId: String(body.connectorId ?? "").trim(),
    accountId: String(body.accountId ?? "").trim(),
    symbol: String(body.symbol ?? "").trim(),
    command,
    side,
    quantityMode: (body.quantityMode as CfdSignalPayload["quantityMode"]) ?? "lots",
    quantity: Number(body.quantity ?? 0),
    orderType: (body.orderType as CfdSignalPayload["orderType"]) ?? "market",
    stopLoss: body.stopLoss == null ? null : Number(body.stopLoss),
    takeProfit: body.takeProfit == null ? null : Number(body.takeProfit),
    timestamp: String(body.timestamp ?? "").trim(),
    riskValue: body.riskValue == null ? null : Number(body.riskValue),
    volumeInterpretation: body.volumeInterpretation ?? "lots",
    entryPrice: body.entryPrice == null ? null : Number(body.entryPrice),
    entryPips: body.entryPips == null ? null : Number(body.entryPips),
    entryPercent: body.entryPercent == null ? null : Number(body.entryPercent),
    spreadFilter: body.spreadFilter == null ? null : Number(body.spreadFilter),
    accountFilter: body.accountFilter == null ? null : Number(body.accountFilter),
    breakevenAt: body.breakevenAt == null ? null : Number(body.breakevenAt),
    breakevenOffset: body.breakevenOffset == null ? null : Number(body.breakevenOffset),
    trailingTrigger: body.trailingTrigger == null ? null : Number(body.trailingTrigger),
    trailingDistance: body.trailingDistance == null ? null : Number(body.trailingDistance),
    trailingStep: body.trailingStep == null ? null : Number(body.trailingStep),
    atrTimeframe: body.atrTimeframe == null ? null : Number(body.atrTimeframe),
    atrPeriod: body.atrPeriod == null ? null : Number(body.atrPeriod),
    atrMultiplier: body.atrMultiplier == null ? null : Number(body.atrMultiplier),
    atrShift: body.atrShift == null ? null : Number(body.atrShift),
    atrTrigger: body.atrTrigger == null ? null : Number(body.atrTrigger),
    secret: body.secret ? String(body.secret) : undefined,
    rawMessage: body.rawMessage ? String(body.rawMessage) : undefined,
    comment: body.comment ? String(body.comment) : undefined,
  };
}

function isPendingCommand(command: CfdSignalPayload["command"]) {
  return (
    command === "buystop" ||
    command === "buylimit" ||
    command === "sellstop" ||
    command === "selllimit" ||
    command === "cancellongbuystop" ||
    command === "cancellongbuylimit" ||
    command === "cancelshortsellstop" ||
    command === "cancelshortselllimit"
  );
}

function isEntryCommand(command: CfdSignalPayload["command"]) {
  return (
    command === "buy" ||
    command === "sell" ||
    command === "closelongopenlong" ||
    command === "closelongopenshort" ||
    command === "closeshortopenlong" ||
    command === "closeshortopenshort" ||
    command === "closelongshortopenlong" ||
    command === "closelongshortopenshort" ||
    isPendingCommand(command)
  );
}

function isCloseFamilyCommand(command: CfdSignalPayload["command"]) {
  return (
    command === "closeall" ||
    command === "closelong" ||
    command === "closeshort" ||
    command === "closelongshort" ||
    command === "closelongpct" ||
    command === "closeshortpct" ||
    command === "closelongvol" ||
    command === "closeshortvol"
  );
}

function isModifyCommand(command: CfdSignalPayload["command"]) {
  return (
    command === "newsltplong" ||
    command === "newsltpshort" ||
    command === "newsltpbuystop" ||
    command === "newsltpbuylimit" ||
    command === "newsltpsellstop" ||
    command === "newsltpselllimit"
  );
}

function validateSignal(signal: CfdSignalPayload, state: CfdRuntimeState) {
  const errors: string[] = [];
  const connector = state.connectors.find((item) => item.id === signal.connectorId);
  const routeProfile = connector
    ? state.routeProfiles.find(
        (profile) => profile.connectorId === signal.connectorId && profile.symbol.toUpperCase() === signal.symbol.toUpperCase()
      )
    : undefined;
  const mapping = connector
    ? state.symbolMappings.find(
        (item) => item.connectorId === connector.id && item.platformSymbol.toUpperCase() === signal.symbol.toUpperCase()
      )
    : undefined;

  if (signal.schemaVersion !== CFD_SCHEMA_VERSION) {
    errors.push(`schemaVersion must match ${CFD_SCHEMA_VERSION}.`);
  }
  if (!signal.signalId) errors.push("signalId is required.");
  if (!signal.strategyId) errors.push("strategyId is required.");
  if (!signal.versionId) errors.push("versionId is required.");
  if (!connector) errors.push("connectorId does not match a registered CFD connector.");
  if (!signal.accountId) errors.push("accountId is required.");
  if (!signal.symbol) errors.push("symbol is required.");
  if (!signal.command) errors.push("command is required.");
  if (!["lots"].includes(signal.quantityMode)) errors.push("quantityMode is invalid.");
  if (!["market", "limit", "stop"].includes(signal.orderType)) errors.push("orderType is invalid.");
  if (isEntryCommand(signal.command) || signal.command === "closelongvol" || signal.command === "closeshortvol") {
    if (!(signal.quantity > 0)) errors.push("quantity must be greater than 0 for this command.");
  }
  if (!signal.timestamp || Number.isNaN(Date.parse(signal.timestamp))) errors.push("timestamp must be a valid ISO date.");
  if (isPendingCommand(signal.command)) {
    const entryFields = [signal.entryPrice, signal.entryPips, signal.entryPercent].filter((value) => value != null);
    if (entryFields.length !== 1) {
      errors.push("Pending commands require exactly one entry field: entryPrice, entryPips, or entryPercent.");
    }
  }
  if (isCloseFamilyCommand(signal.command) && (signal.stopLoss != null || signal.takeProfit != null)) {
    errors.push("Close and cancel commands cannot carry stopLoss or takeProfit.");
  }
  if ((signal.command === "eaoff" || signal.command === "eaon" || signal.command === "closealleaoff") && signal.quantity > 0) {
    errors.push("EA management commands do not use quantity.");
  }
  if (isModifyCommand(signal.command) && signal.stopLoss == null && signal.takeProfit == null) {
    errors.push("Modify commands require stopLoss or takeProfit.");
  }

  if (connector) {
    if (isEntryCommand(signal.command) || signal.command === "closelongvol" || signal.command === "closeshortvol") {
      if (!mapping) {
        errors.push("No symbol mapping exists for this connector and platform symbol.");
      } else {
        if (signal.quantity < mapping.minLot || signal.quantity > mapping.maxLot) {
          errors.push(`quantity must fit the lot constraints for ${mapping.terminalSymbol}.`);
        }
        const steps = (signal.quantity - mapping.minLot) / mapping.lotStep;
        if (!Number.isInteger(Math.round(steps)) || Math.abs(steps - Math.round(steps)) > 1e-9) {
          errors.push(`quantity must align to the ${mapping.lotStep} lot step for ${mapping.terminalSymbol}.`);
        }
      }
    }
  }

  if (routeProfile) {
    if (
      routeProfile.sidePolicy === "long_only" &&
      [
        "sell",
        "sellstop",
        "selllimit",
        "closelongopenshort",
        "closeshortopenshort",
        "closelongshortopenshort",
        "cancelshortsellstop",
        "cancelshortselllimit",
        "closeshort",
        "closeshortpct",
        "closeshortvol",
        "newsltpshort",
        "newsltpsellstop",
        "newsltpselllimit",
      ].includes(signal.command)
    ) {
      errors.push("route profile is long_only and cannot open short positions.");
    }
    if (
      routeProfile.sidePolicy === "short_only" &&
      [
        "buy",
        "buystop",
        "buylimit",
        "closelongopenlong",
        "closeshortopenlong",
        "closelongshortopenlong",
        "cancellongbuystop",
        "cancellongbuylimit",
        "closelong",
        "closelongpct",
        "closelongvol",
        "newsltplong",
        "newsltpbuystop",
        "newsltpbuylimit",
      ].includes(signal.command)
    ) {
      errors.push("route profile is short_only and cannot open long positions.");
    }
    if (
      ["closelongpct", "closeshortpct", "closelongvol", "closeshortvol"].includes(signal.command) &&
      routeProfile.reductionPolicy === "disabled"
    ) {
      errors.push("route profile does not allow partial reduction on this connector lane.");
    }
    if (["closelongvol", "closeshortvol"].includes(signal.command) && routeProfile.reductionPolicy !== "disabled") {
      if (routeProfile.minReductionLot != null && signal.quantity < routeProfile.minReductionLot) {
        errors.push(`reduce quantity must be at least ${routeProfile.minReductionLot} lots for this route.`);
      }
    }
  }

  const duplicate = state.signalInbox.find((item) => item.signalId === signal.signalId && item.stage !== "rejected");
  if (duplicate) {
    errors.push("signalId already exists in the connector inbox.");
  }

  return errors;
}

function normalizeAction(signal: CfdSignalPayload): CfdNormalizedAction {
  switch (signal.command) {
    case "buy":
      return "open_long";
    case "sell":
      return "open_short";
    case "buystop":
      return "place_buy_stop";
    case "buylimit":
      return "place_buy_limit";
    case "sellstop":
      return "place_sell_stop";
    case "selllimit":
      return "place_sell_limit";
    case "closelongopenlong":
      return "close_long_open_long";
    case "closelongopenshort":
      return "close_long_open_short";
    case "closeshortopenlong":
      return "close_short_open_long";
    case "closeshortopenshort":
      return "close_short_open_short";
    case "closelongshortopenlong":
      return "close_long_short_open_long";
    case "closelongshortopenshort":
      return "close_long_short_open_short";
    case "cancellongbuystop":
      return "cancel_long_place_buy_stop";
    case "cancellongbuylimit":
      return "cancel_long_place_buy_limit";
    case "cancelshortsellstop":
      return "cancel_short_place_sell_stop";
    case "cancelshortselllimit":
      return "cancel_short_place_sell_limit";
    case "closeall":
      return "close_all";
    case "cancellong":
      return "cancel_long_pending";
    case "cancelshort":
      return "cancel_short_pending";
    case "closelong":
      return "close_long_positions";
    case "closeshort":
      return "close_short_positions";
    case "closelongshort":
      return "close_long_short_positions";
    case "closelongpct":
      return "partial_close_long_pct";
    case "closeshortpct":
      return "partial_close_short_pct";
    case "closelongvol":
      return "partial_close_long_volume";
    case "closeshortvol":
      return "partial_close_short_volume";
    case "newsltplong":
      return "modify_long_positions";
    case "newsltpshort":
      return "modify_short_positions";
    case "newsltpbuystop":
      return "modify_buy_stop_orders";
    case "newsltpbuylimit":
      return "modify_buy_limit_orders";
    case "newsltpsellstop":
      return "modify_sell_stop_orders";
    case "newsltpselllimit":
      return "modify_sell_limit_orders";
    case "eaoff":
      return "disable_ea";
    case "eaon":
      return "enable_ea";
    case "closealleaoff":
      return "close_all_and_disable_ea";
    default:
      return signal.side === "reduce"
        ? "partial_close_position"
        : signal.side === "close"
          ? "close_position"
          : signal.side === "flatten"
            ? "flatten_all"
            : "open_long";
  }
}

export async function ingestCfdSignal(payload: unknown) {
  const state = await getState();
  const signal = normalizeSignal(payload, state);
  const occurredAt = new Date().toISOString();
  const errors = validateSignal(signal, state);

  if (!signal.connectorId && signal.rawMessage) {
    errors.unshift("License ID does not map to a registered CFD connector seat.");
  }

  const connector = signal.connectorId ? state.connectors.find((item) => item.id === signal.connectorId) : undefined;
  if (signal.secret) {
    if (!connector) {
      errors.unshift("secret cannot be validated because the connector seat could not be resolved.");
    } else {
      const expectedSecret = state.connectorSecrets[connector.id];
      if (!expectedSecret || expectedSecret !== signal.secret) {
        errors.unshift("secret does not match this connector seat.");
      }
    }
  }

  if (errors.length > 0) {
    const rejectedEntry: CfdSignalLogEntry = {
      id: crypto.randomUUID(),
      signalId: signal.signalId || `invalid-${crypto.randomUUID()}`,
      connectorId: signal.connectorId || "unknown",
      strategyId: signal.strategyId || "unknown",
      stage: "rejected",
      tone: "error",
      detail: errors.join(" "),
      occurredAt,
    };
    state.signalInbox.unshift(rejectedEntry);
    await persistState(state);

    return {
      ok: false,
      error: "Signal validation failed.",
      details: errors,
      entry: rejectedEntry,
    };
  }

  const stagedFlow: CfdConnectorStage[] = ["received", "validated", "queued"];
  const received: CfdSignalLogEntry[] = stagedFlow.map((stage) => ({
    id: crypto.randomUUID(),
    signalId: signal.signalId,
    connectorId: signal.connectorId,
    strategyId: signal.strategyId,
    stage,
    tone: toneForStage(stage),
    detail:
      stage === "received"
        ? `Signal accepted from kwantify for ${signal.symbol} ${signal.side}.`
        : stage === "validated"
          ? "Signal passed connector schema, route profile, and symbol-map checks."
          : "Signal placed into the CFD mailbox for the MT5 EA to claim.",
    occurredAt,
  }));

  const routeProfile = state.routeProfiles.find(
    (profile) => profile.connectorId === signal.connectorId && profile.symbol.toUpperCase() === signal.symbol.toUpperCase()
  );
  const resolvedConnector = state.connectors.find((item) => item.id === signal.connectorId)!;

  if (!routeProfile) {
    const rejectedEntry: CfdSignalLogEntry = {
      id: crypto.randomUUID(),
      signalId: signal.signalId,
      connectorId: signal.connectorId,
      strategyId: signal.strategyId,
      stage: "rejected",
      tone: "error",
      detail: "No route profile is configured for this connector and symbol.",
      occurredAt,
    };
    state.signalInbox.unshift(rejectedEntry);
    await persistState(state);

    return {
      ok: false,
      error: "Signal routing failed.",
      details: ["No route profile is configured for this connector and symbol."],
      entry: rejectedEntry,
    };
  }

  const command: CfdMailboxCommand = {
    id: crypto.randomUUID(),
    schemaVersion: CFD_SCHEMA_VERSION,
    connectorId: signal.connectorId,
    kwantId: resolvedConnector.kwantId,
    routeProfileId: routeProfile.id,
    signal,
    action: normalizeAction(signal),
    terminalSymbol: routeProfile.terminalSymbol,
    commandName: signal.command,
    entryInstruction: {
      mode: signal.entryPrice != null ? "price" : signal.entryPercent != null ? "percentage" : signal.entryPips != null ? "pips" : "points",
      value: signal.entryPrice ?? signal.entryPercent ?? signal.entryPips ?? null,
    },
    quantityMode: signal.quantityMode,
    normalizedQuantity: signal.quantity,
    volumeInterpretation: signal.volumeInterpretation ?? "lots",
    riskValue: signal.riskValue ?? signal.quantity,
    sizingMode: routeProfile.sizingMode,
    sizingValue: routeProfile.sizingValue,
    stopMode: routeProfile.stopMode,
    targetMode: routeProfile.targetMode,
    stopInstruction: {
      mode:
        signal.stopLoss === 0 && (signal.command === "newsltplong" || signal.command === "newsltpshort")
          ? "breakeven"
          : signal.rawMessage && signal.stopLoss != null
            ? signal.rawMessage.includes("sl_price=")
              ? "price"
              : signal.rawMessage.includes("sl_pct=")
                ? "percentage"
                : "pips"
            : routeProfile.stopMode === "points"
              ? "pips"
              : routeProfile.stopMode,
      value: signal.stopLoss,
    },
    targetInstruction: {
      mode:
        signal.rawMessage && signal.takeProfit != null
          ? signal.rawMessage.includes("tp_price=")
            ? "price"
            : signal.rawMessage.includes("tp_pct=")
              ? "percentage"
              : "pips"
          : routeProfile.targetMode === "points"
            ? "pips"
            : routeProfile.targetMode,
      value: signal.takeProfit,
    },
    duplicateWindowSeconds: routeProfile.duplicateWindowSeconds,
    maxOpenPositions: routeProfile.maxOpenPositions,
    reductionPolicy: routeProfile.reductionPolicy,
    minReductionLot: routeProfile.minReductionLot,
    minRemainingLot: routeProfile.minRemainingLot,
    magic: 810000 + state.pendingCommands.length + state.executionReports.length + 1,
    // Keep the default comment strategy-stable so reverse/close flows can scope by strategy.
    comment: signal.comment || `KWANT:${signal.strategyId}:${signal.versionId}`,
    createdAt: occurredAt,
    claimedAt: null,
    claimToken: null,
    claimExpiresAt: null,
    acknowledgedAt: null,
    retryCount: 0,
  };

  state.pendingCommands.unshift(command);
  state.signalInbox.unshift(...received.reverse());
  await persistState(state);

  return {
    ok: true,
    signal,
    entries: received,
    command,
  };
}

function normalizeClaimRequest(payload: unknown): CfdClaimRequest {
  const body = payload && typeof payload === "object" ? (payload as Partial<CfdClaimRequest>) : {};
  return {
    connectorId: String(body.connectorId ?? "").trim(),
    kwantId: String(body.kwantId ?? "").trim(),
    authToken: String(body.authToken ?? "").trim(),
    maxCommands: body.maxCommands == null ? 1 : Number(body.maxCommands),
  };
}

function normalizeClaimAckRequest(payload: unknown): CfdClaimAckRequest {
  const body = payload && typeof payload === "object" ? (payload as Partial<CfdClaimAckRequest>) : {};
  return {
    connectorId: String(body.connectorId ?? "").trim(),
    kwantId: String(body.kwantId ?? "").trim(),
    authToken: String(body.authToken ?? "").trim(),
    signalId: String(body.signalId ?? "").trim(),
    claimToken: String(body.claimToken ?? "").trim(),
  };
}

function normalizeRecoveredCommandStatusRequest(payload: unknown): CfdRecoveredCommandStatusRequest {
  const body =
    payload && typeof payload === "object" ? (payload as Partial<CfdRecoveredCommandStatusRequest>) : {};
  return {
    connectorId: String(body.connectorId ?? "").trim(),
    kwantId: String(body.kwantId ?? "").trim(),
    authToken: String(body.authToken ?? "").trim(),
    signalId: String(body.signalId ?? "").trim(),
  };
}

export async function claimNextCfdCommands(payload: unknown) {
  const state = await getState();
  if (sweepExpiredClaims(state)) {
    await persistStateBestEffort(state);
  }
  const request = normalizeClaimRequest(payload);

  if (!request.connectorId || !request.kwantId) {
    return { ok: false, error: "connectorId and kwantId are required." };
  }

  const connector = state.connectors.find((item) => item.id === request.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== request.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const authError = validateConnectorAuth(state, connector, request.authToken);
  if (authError) {
    return { ok: false, error: authError };
  }

  const available = state.pendingCommands
    .filter((command) => command.connectorId === request.connectorId && !command.claimedAt)
    .slice(0, Math.max(1, request.maxCommands ?? 1));

  const claimedAt = new Date().toISOString();
  for (const command of available) {
    command.claimedAt = claimedAt;
    command.claimToken = crypto.randomUUID();
    command.claimExpiresAt = new Date(Date.now() + CFD_COMMAND_CLAIM_TTL_MS).toISOString();
    command.acknowledgedAt = null;
    state.signalInbox.unshift({
      id: crypto.randomUUID(),
      signalId: command.signal.signalId,
      connectorId: command.connectorId,
      strategyId: command.signal.strategyId,
      stage: "claimed",
      tone: "warning",
      detail: `MT5 EA claimed the command for ${command.terminalSymbol}.`,
      occurredAt: claimedAt,
    });
  }

  if (available.length > 0) {
    await persistStateBestEffort(state);
  }

  return {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    claimedAt,
    commands: available.map((command) => ({
      ...command,
      signalId: command.signal.signalId,
      strategyId: command.signal.strategyId,
      accountId: command.signal.accountId,
      symbol: command.signal.symbol,
      side: command.signal.side,
      orderType: command.signal.orderType,
      quantity: command.signal.quantity,
    })),
  };
}

export async function acknowledgeClaimedCfdCommand(payload: unknown) {
  const state = await getState();
  if (sweepExpiredClaims(state)) {
    await persistStateBestEffort(state);
  }
  const request = normalizeClaimAckRequest(payload);

  if (!request.connectorId || !request.kwantId || !request.signalId || !request.claimToken) {
    return { ok: false, error: "connectorId, kwantId, signalId, and claimToken are required." };
  }

  const connector = state.connectors.find((item) => item.id === request.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== request.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const authError = validateConnectorAuth(state, connector, request.authToken);
  if (authError) {
    return { ok: false, error: authError };
  }

  const command = state.pendingCommands.find(
    (item) => item.connectorId === request.connectorId && item.signal.signalId === request.signalId
  );
  if (!command) {
    const knownSignalEntry = state.signalInbox.find(
      (item) => item.connectorId === request.connectorId && item.signalId === request.signalId
    );
    const existingReport = state.executionReports.find(
      (item) => item.connectorId === request.connectorId && item.signalId === request.signalId
    );
    const matchingAdminEvent = state.adminEvents.find(
      (item) =>
        item.connectorId === request.connectorId &&
        item.action === "test_signal" &&
        item.detail.includes(request.signalId)
    );

    if (!knownSignalEntry && !existingReport && !matchingAdminEvent) {
      return { ok: false, error: "No pending command exists for this signalId." };
    }

    const acknowledgedAt = new Date().toISOString();
    state.signalInbox.unshift({
      id: crypto.randomUUID(),
      signalId: request.signalId,
      connectorId: request.connectorId,
      strategyId: knownSignalEntry?.strategyId ?? "connector_test",
      stage: "claimed",
      tone: "warning",
      detail: `MT5 EA acknowledged a claim for ${request.signalId} after the command had already moved out of the pending mailbox.`,
      occurredAt: acknowledgedAt,
    });
    await persistStateBestEffort(state);

    return {
      ok: true,
      schemaVersion: CFD_SCHEMA_VERSION,
      acknowledgedAt,
      command: null,
      recoveredFromRace: true,
    };
  }
  if (!command.claimToken || command.claimToken !== request.claimToken) {
    return { ok: false, error: "claimToken is invalid or stale for this command." };
  }
  if (!command.claimExpiresAt || new Date(command.claimExpiresAt).getTime() <= Date.now()) {
    return { ok: false, error: "claimToken has already expired for this command." };
  }

  const acknowledgedAt = new Date().toISOString();
  command.acknowledgedAt = acknowledgedAt;

  state.signalInbox.unshift({
    id: crypto.randomUUID(),
    signalId: command.signal.signalId,
    connectorId: command.connectorId,
    strategyId: command.signal.strategyId,
    stage: "claimed",
    tone: "warning",
    detail: `MT5 EA acknowledged claim token ${request.claimToken.slice(0, 8)} for ${command.terminalSymbol}.`,
    occurredAt: acknowledgedAt,
  });
  await persistStateBestEffort(state);

  return {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    acknowledgedAt,
    command,
  };
}

export async function getCfdRecoveredCommandStatus(payload: unknown): Promise<
  CfdRecoveredCommandStatusResponse | { ok: false; error: string }
> {
  const state = await getState();
  if (sweepExpiredClaims(state)) {
    await persistStateBestEffort(state);
  }
  const request = normalizeRecoveredCommandStatusRequest(payload);

  if (!request.connectorId || !request.kwantId || !request.signalId) {
    return { ok: false, error: "connectorId, kwantId, and signalId are required." };
  }

  const connector = state.connectors.find((item) => item.id === request.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== request.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const authError = validateConnectorAuth(state, connector, request.authToken);
  if (authError) {
    return { ok: false, error: authError };
  }

  const pendingCommand = state.pendingCommands.find(
    (item) => item.connectorId === request.connectorId && item.signal.signalId === request.signalId
  );
  if (pendingCommand) {
    const status: CfdRecoveredCommandStatusResponse["status"] = pendingCommand.acknowledgedAt
      ? "acknowledged_on_server"
      : "pending_on_server";
    return {
      ok: true,
      schemaVersion: CFD_SCHEMA_VERSION,
      connectorId: request.connectorId,
      kwantId: request.kwantId,
      signalId: request.signalId,
      status,
      canClearRecoveredCommand: !pendingCommand.acknowledgedAt,
      detail: pendingCommand.acknowledgedAt
        ? "Server still has this command acknowledged and in flight."
        : "Server still has this command pending in the mailbox, so the EA can clear its stale local latch and resume polling.",
      lastKnownStage: pendingCommand.acknowledgedAt ? "claimed" : "queued",
    };
  }

  const deadLetterCommand = state.deadLetterCommands.find(
    (item) => item.connectorId === request.connectorId && item.signal.signalId === request.signalId
  );
  if (deadLetterCommand) {
    return {
      ok: true,
      schemaVersion: CFD_SCHEMA_VERSION,
      connectorId: request.connectorId,
      kwantId: request.kwantId,
      signalId: request.signalId,
      status: "dead_lettered",
      canClearRecoveredCommand: true,
      detail: "Server already moved this command to dead-letter, so the local recovered latch can be cleared.",
      lastKnownStage: "dead_letter",
    };
  }

  const executionReport = state.executionReports.find(
    (item) => item.connectorId === request.connectorId && item.signalId === request.signalId
  );
  if (executionReport) {
    return {
      ok: true,
      schemaVersion: CFD_SCHEMA_VERSION,
      connectorId: request.connectorId,
      kwantId: request.kwantId,
      signalId: request.signalId,
      status: "reported_terminal_outcome",
      canClearRecoveredCommand: true,
      detail: `Server already recorded terminal outcome '${executionReport.status}' for this signal.`,
      lastKnownStage:
        executionReport.status === "rejected"
          ? "rejected"
          : executionReport.status === "closed"
            ? "closed"
            : executionReport.status === "reduced"
              ? "reduced"
              : "executed",
      lastKnownReportStatus: executionReport.status,
    };
  }

  const signalEntry = state.signalInbox.find(
    (item) => item.connectorId === request.connectorId && item.signalId === request.signalId
  );
  if (signalEntry) {
    return {
      ok: true,
      schemaVersion: CFD_SCHEMA_VERSION,
      connectorId: request.connectorId,
      kwantId: request.kwantId,
      signalId: request.signalId,
      status: "missing_on_server",
      canClearRecoveredCommand: true,
      detail: `Server no longer has a live command for this signal. Last known stage was '${signalEntry.stage}'.`,
      lastKnownStage: signalEntry.stage,
    };
  }

  return {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    connectorId: request.connectorId,
    kwantId: request.kwantId,
    signalId: request.signalId,
    status: "missing_on_server",
    canClearRecoveredCommand: true,
    detail: "Server has no live command or recorded outcome for this signal, so the recovered latch can be cleared.",
  };
}

function normalizeExecutionReport(payload: unknown): CfdExecutionReportPayload {
  const body = payload && typeof payload === "object" ? (payload as Partial<CfdExecutionReportPayload>) : {};
  return {
    connectorId: String(body.connectorId ?? "").trim(),
    kwantId: String(body.kwantId ?? "").trim(),
    authToken: String(body.authToken ?? "").trim(),
    signalId: String(body.signalId ?? "").trim(),
    status: (body.status as CfdExecutionReportPayload["status"]) ?? "accepted",
    occurredAt:
      body.occurredAt && !Number.isNaN(Date.parse(body.occurredAt)) ? body.occurredAt : new Date().toISOString(),
    terminalSymbol: String(body.terminalSymbol ?? "").trim(),
    orderTicket: body.orderTicket ? String(body.orderTicket) : undefined,
    positionTicket: body.positionTicket ? String(body.positionTicket) : undefined,
    executedPrice: body.executedPrice == null ? undefined : Number(body.executedPrice),
    remainingVolume: body.remainingVolume == null ? undefined : Number(body.remainingVolume),
    stopLoss: body.stopLoss == null ? undefined : Number(body.stopLoss),
    takeProfit: body.takeProfit == null ? undefined : Number(body.takeProfit),
    errorCode: body.errorCode ? String(body.errorCode) : undefined,
    errorMessage: body.errorMessage ? String(body.errorMessage) : undefined,
    terminalComment: body.terminalComment ? String(body.terminalComment) : undefined,
  };
}

export async function recordCfdExecutionReport(payload: unknown) {
  const state = await getState();
  if (sweepExpiredClaims(state)) {
    await persistStateBestEffort(state);
  }
  const report = normalizeExecutionReport(payload);

  if (!report.connectorId || !report.kwantId || !report.signalId) {
    return { ok: false, error: "connectorId, kwantId, and signalId are required." };
  }

  const connector = state.connectors.find((item) => item.id === report.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== report.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const authError = validateConnectorAuth(state, connector, report.authToken);
  if (authError) {
    return { ok: false, error: authError };
  }

  const commandIndex = state.pendingCommands.findIndex(
    (command) => command.connectorId === report.connectorId && command.signal.signalId === report.signalId
  );
  const command = commandIndex === -1 ? null : state.pendingCommands[commandIndex];
  const knownSignalEntry = state.signalInbox.find(
    (item) => item.connectorId === report.connectorId && item.signalId === report.signalId
  );
  state.executionReports.unshift(report);

  const stage: CfdConnectorStage =
    report.status === "rejected"
      ? "rejected"
      : report.status === "closed"
        ? "closed"
        : report.status === "reduced"
          ? "reduced"
          : "executed";

  state.signalInbox.unshift({
    id: crypto.randomUUID(),
    signalId: report.signalId,
    connectorId: report.connectorId,
    strategyId: command?.signal.strategyId ?? knownSignalEntry?.strategyId ?? "connector_runtime",
    stage,
    tone: toneForStage(stage),
      detail:
        report.status === "accepted"
          ? `Terminal accepted ${report.terminalSymbol} command with ticket ${report.orderTicket ?? "pending"}.`
          : report.status === "placed"
            ? `Terminal placed a pending order on ${report.terminalSymbol} at ${report.executedPrice ?? "the requested entry"}.`
          : report.status === "filled"
            ? `Terminal filled ${report.terminalSymbol} at ${report.executedPrice ?? "unknown price"}.`
            : report.status === "shadow_armed"
              ? `Terminal armed shadow protection for ${report.terminalSymbol}${report.stopLoss != null || report.takeProfit != null ? ` (SL ${report.stopLoss ?? "off"} / TP ${report.takeProfit ?? "off"})` : ""}.`
              : report.status === "shadow_triggered"
                ? `Terminal triggered shadow protection on ${report.terminalSymbol}${report.errorCode ? ` (${report.errorCode})` : ""}.`
            : report.status === "reduced"
              ? `Terminal partially reduced ${report.terminalSymbol}${report.remainingVolume != null ? ` to ${report.remainingVolume} lots remaining` : ""}${report.errorCode ? ` (${report.errorCode})` : ""}.`
              : report.status === "closed"
                ? `Terminal closed the position for ${report.terminalSymbol}.`
                : report.status === "modified"
                  ? `Terminal modified protection on ${report.terminalSymbol}.`
                  : report.status === "cancelled"
                    ? `Terminal cancelled pending orders for ${report.terminalSymbol}.`
                    : report.status === "disabled"
                      ? "Terminal disabled this EA lane."
                      : report.status === "enabled"
                        ? "Terminal enabled this EA lane."
                        : `Terminal rejected the command${report.errorCode ? ` (${report.errorCode})` : ""}.`,
    occurredAt: report.occurredAt,
  });

  if (
    report.status === "filled" ||
    report.status === "placed" ||
    report.status === "shadow_armed" ||
    report.status === "shadow_triggered" ||
    report.status === "reduced" ||
    report.status === "rejected" ||
    report.status === "closed" ||
    report.status === "modified" ||
    report.status === "cancelled" ||
    report.status === "disabled" ||
    report.status === "enabled"
  ) {
    if (commandIndex !== -1) {
      state.pendingCommands.splice(commandIndex, 1);
    }
  }
  await persistStateBestEffort(state);

  return {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    report,
    command,
  };
}

export async function recordCfdHeartbeat(payload: unknown) {
  const state = await getState();
  if (sweepExpiredClaims(state)) {
    await persistStateBestEffort(state);
  }
  const body = payload && typeof payload === "object" ? (payload as Partial<CfdHeartbeatEvent>) : {};
  const connectorId = String(body.connectorId ?? "").trim();
  const kwantId = String(body.kwantId ?? "").trim();

  const authToken = String(body.authToken ?? "").trim();

  if (!connectorId || !kwantId) {
    return { ok: false, error: "connectorId and kwantId are required." };
  }

  const connector = state.connectors.find((item) => item.id === connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const authError = validateConnectorAuth(state, connector, authToken);
  if (authError) {
    return { ok: false, error: authError };
  }

  const heartbeat: CfdHeartbeatEvent = {
    connectorId,
    kwantId,
    authToken,
    occurredAt: body.occurredAt && !Number.isNaN(Date.parse(body.occurredAt))
      ? body.occurredAt
      : new Date().toISOString(),
    latencyMs: Number(body.latencyMs ?? 0),
    terminalStatus: body.terminalStatus === "busy" || body.terminalStatus === "offline" ? body.terminalStatus : "ready",
    chartSymbol: String(body.chartSymbol ?? connector.chartSymbol),
    eaVersion: String(body.eaVersion ?? connector.eaVersion),
    pendingSignals: Number(body.pendingSignals ?? connector.pendingSignals),
    lastErrorCode: body.lastErrorCode ? String(body.lastErrorCode) : undefined,
    lastErrorMessage: body.lastErrorMessage ? String(body.lastErrorMessage) : undefined,
  };

  state.heartbeatEvents = [heartbeat, ...state.heartbeatEvents.filter((item) => item.connectorId !== connectorId)];

  connector.lastHeartbeatAt = heartbeat.occurredAt;
  connector.lastAuthenticatedAt = heartbeat.occurredAt;
  connector.eaVersion = heartbeat.eaVersion;
  connector.chartSymbol = heartbeat.chartSymbol;
  connector.pendingSignals = heartbeat.pendingSignals;
  refreshLicenseSlotSessions(state);
  await persistStateBestEffort(state);

  return {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    heartbeat,
    connector: enrichConnector(connector, state),
  };
}

function normalizePairingRequest(payload: unknown): CfdPairingRequest {
  const body = payload && typeof payload === "object" ? (payload as Partial<CfdPairingRequest>) : {};
  return {
    connectorId: String(body.connectorId ?? "").trim(),
    kwantId: String(body.kwantId ?? "").trim(),
    pairingCode: String(body.pairingCode ?? "").trim(),
    terminalInstanceId: String(body.terminalInstanceId ?? "").trim(),
    terminalAlias: String(body.terminalAlias ?? "").trim(),
    eaVersion: String(body.eaVersion ?? "").trim(),
    chartSymbol: String(body.chartSymbol ?? "").trim(),
  };
}

function normalizeConnectorAdminRequest(payload: unknown): CfdConnectorAdminRequest {
  const body = payload && typeof payload === "object" ? (payload as Partial<CfdConnectorAdminRequest>) : {};
  return {
    connectorId: String(body.connectorId ?? "").trim(),
    kwantId: String(body.kwantId ?? "").trim(),
  };
}

function normalizeDeadLetterAdminRequest(payload: unknown): CfdDeadLetterAdminRequest {
  const body = payload && typeof payload === "object" ? (payload as Partial<CfdDeadLetterAdminRequest>) : {};
  return {
    connectorId: String(body.connectorId ?? "").trim(),
    kwantId: String(body.kwantId ?? "").trim(),
    commandId: String(body.commandId ?? "").trim(),
  };
}

function normalizeValidationUpdateRequest(payload: unknown): CfdValidationUpdateRequest {
  const body = payload as Partial<CfdValidationUpdateRequest>;
  return {
    connectorId: String(body.connectorId ?? "").trim(),
    kwantId: String(body.kwantId ?? "").trim(),
    checkTitle: String(body.checkTitle ?? "").trim(),
    outcome: body.outcome === "needs_work" ? "needs_work" : "passed",
    note: body.note ? String(body.note).trim() : undefined,
  };
}

function makeSecretForConnector(connectorId: string) {
  return `kwsec_${connectorId}_${crypto.randomUUID().slice(0, 8)}`;
}

function makeSecretHint(secret: string) {
  return `${secret.slice(0, 5)}...${secret.slice(-4)}`;
}

function makePairingCode() {
  return `PAIR-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(100 + Math.random() * 900)}`;
}

function normalizePortalBaseUrl(value?: string | null) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return CFD_DEFAULT_PORTAL_BASE_URL;
  return trimmed.replace(/\/+$/, "");
}

function buildSyntheticCfdTestSignal(
  connector: CfdConnectorRecord,
  routeProfile: CfdRouteProfile
): CfdSignalPayload {
  return {
    schemaVersion: CFD_SCHEMA_VERSION,
    signalId: `test_${connector.id}_${Date.now()}`,
    strategyId: "connector_test",
    versionId: "v1",
    connectorId: connector.id,
    accountId: connector.accountNumber,
    symbol: routeProfile.symbol,
    command: routeProfile.sidePolicy === "short_only" ? "sell" : "buy",
    side: routeProfile.sidePolicy === "short_only" ? "sell" : "buy",
    quantityMode: "lots",
    quantity: routeProfile.sizingMode === "fixed_lots" ? routeProfile.sizingValue : 0.1,
    orderType: "market",
    stopLoss: routeProfile.stopMode === "points" ? CFD_SYNTHETIC_TEST_STOP_POINTS : null,
    takeProfit: routeProfile.targetMode === "points" ? CFD_SYNTHETIC_TEST_TARGET_POINTS : null,
    timestamp: new Date().toISOString(),
    volumeInterpretation: "lots",
    riskValue: routeProfile.sizingMode === "fixed_lots" ? routeProfile.sizingValue : 0.1,
    comment: `KWANT:connector_test:${connector.kwantId}`,
  };
}

function appendAdminEvent(
  state: CfdRuntimeState,
  event: Omit<CfdConnectorAdminEvent, "id" | "occurredAt"> & { occurredAt?: string }
) {
  state.adminEvents.unshift({
    id: crypto.randomUUID(),
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    ...event,
  });
}

export async function pairCfdConnector(payload: unknown) {
  const state = await getState();
  const request = normalizePairingRequest(payload);

  if (!request.connectorId || !request.kwantId || !request.pairingCode || !request.terminalInstanceId || !request.terminalAlias) {
    return { ok: false, error: "connectorId, kwantId, pairingCode, terminalInstanceId, and terminalAlias are required." };
  }

  const connector = state.connectors.find((item) => item.id === request.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== request.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const pairingMatches =
    connector.pairingCode === request.pairingCode ||
    request.pairingCode === request.kwantId;

  if (!pairingMatches) {
    return { ok: false, error: "pairingCode is invalid for this connector." };
  }

  const pairedAt = new Date().toISOString();
  connector.pairingStatus = "paired";
  connector.terminalInstanceId = request.terminalInstanceId;
  connector.terminalAlias = request.terminalAlias;
  connector.lastPairedAt = pairedAt;
  connector.eaVersion = request.eaVersion || connector.eaVersion;
  connector.chartSymbol = request.chartSymbol || connector.chartSymbol;
  const authToken = state.connectorSecrets[connector.id] ?? "";

  const response: CfdPairingResponse = {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    connectorId: connector.id,
    kwantId: connector.kwantId,
    pairingStatus: connector.pairingStatus,
    authMode: connector.authMode as CfdConnectorAuthMode,
    authToken,
    secretHint: connector.secretHint,
    terminalInstanceId: connector.terminalInstanceId ?? request.terminalInstanceId,
    terminalAlias: connector.terminalAlias ?? request.terminalAlias,
    pairedAt,
  };

  appendAdminEvent(state, {
    connectorId: connector.id,
    kwantId: connector.kwantId,
    action: "paired",
    detail: `Seat paired to terminal ${connector.terminalAlias ?? request.terminalAlias}.`,
    actor: "operator/pair-flow",
    occurredAt: pairedAt,
  });

  refreshLicenseSlotSessions(state);
  await persistStateBestEffort(state);
  return response;
}

export async function rotateCfdConnectorSecret(payload: unknown, actor: CfdAdminActor = LOCAL_DEV_ACTOR) {
  const state = await getState();
  const request = normalizeConnectorAdminRequest(payload);

  if (!request.connectorId || !request.kwantId) {
    return { ok: false, error: "connectorId and kwantId are required." };
  }

  const connector = state.connectors.find((item) => item.id === request.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== request.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const ownership = ensureConnectorOwner(state, connector, actor);
  if (!ownership.ok) {
    return { ok: false, error: ownership.error };
  }

  const nextSecret = makeSecretForConnector(connector.id);
  state.connectorSecrets[connector.id] = nextSecret;
  connector.secretHint = makeSecretHint(nextSecret);
  connector.lastAuthenticatedAt = null;

  const rotatedAt = new Date().toISOString();
  refreshLicenseSlotSessions(state);

  const response: CfdRotateSecretResponse = {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    connectorId: connector.id,
    kwantId: connector.kwantId,
    secretHint: connector.secretHint,
    rotatedAt,
  };

  appendAdminEvent(state, {
    connectorId: connector.id,
    kwantId: connector.kwantId,
    action: "rotate_secret",
    detail: "Shared secret rotated. MT5 must authenticate again with the new secret.",
    actor: actor.label,
    occurredAt: rotatedAt,
  });
  await persistState(state);

  return response;
}

export async function revokeCfdConnector(payload: unknown, actor: CfdAdminActor = LOCAL_DEV_ACTOR) {
  const state = await getState();
  const request = normalizeConnectorAdminRequest(payload);

  if (!request.connectorId || !request.kwantId) {
    return { ok: false, error: "connectorId and kwantId are required." };
  }

  const connector = state.connectors.find((item) => item.id === request.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== request.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const ownership = ensureConnectorOwner(state, connector, actor);
  if (!ownership.ok) {
    return { ok: false, error: ownership.error };
  }

  connector.pairingStatus = "revoked";
  connector.terminalInstanceId = null;
  connector.terminalAlias = null;
  connector.lastAuthenticatedAt = null;
  connector.pairingCode = makePairingCode();
  connector.secretHint = "kw_...REVOKED";
  state.connectorSecrets[connector.id] = makeSecretForConnector(connector.id);

  const revokedAt = new Date().toISOString();
  refreshLicenseSlotSessions(state);

  const response: CfdRevokeConnectorResponse = {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    connectorId: connector.id,
    kwantId: connector.kwantId,
    pairingStatus: connector.pairingStatus,
    pairingCode: connector.pairingCode,
    revokedAt,
  };

  appendAdminEvent(state, {
    connectorId: connector.id,
    kwantId: connector.kwantId,
    action: "revoked",
    detail: "Connector revoked and issued a fresh pairing code for re-onboarding.",
    actor: actor.label,
    occurredAt: revokedAt,
  });
  await persistState(state);

  return response;
}

export async function releaseCfdConnectorOwnership(payload: unknown, actor: CfdAdminActor = LOCAL_DEV_ACTOR) {
  const state = await getState();
  const request = normalizeConnectorAdminRequest(payload);

  if (!request.connectorId || !request.kwantId) {
    return { ok: false, error: "connectorId and kwantId are required." };
  }

  const connector = state.connectors.find((item) => item.id === request.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== request.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const ownership = ensureConnectorOwner(state, connector, actor);
  if (!ownership.ok) {
    return { ok: false, error: ownership.error };
  }

  connector.ownerUserId = null;
  connector.ownerLabel = null;
  const releasedAt = new Date().toISOString();
  refreshLicenseSlotSessions(state);

  appendAdminEvent(state, {
    connectorId: connector.id,
    kwantId: connector.kwantId,
    action: "released_owner",
    detail: "Seat ownership released. The next authenticated operator can claim this connector.",
    actor: actor.label,
    occurredAt: releasedAt,
  });
  await persistState(state);

  return {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    connectorId: connector.id,
    kwantId: connector.kwantId,
    releasedAt,
  };
}

export async function retryDeadLetterCfdCommand(payload: unknown, actor: CfdAdminActor = LOCAL_DEV_ACTOR) {
  const state = await getState();
  const request = normalizeDeadLetterAdminRequest(payload);

  if (!request.connectorId || !request.kwantId || !request.commandId) {
    return { ok: false, error: "connectorId, kwantId, and commandId are required." };
  }

  const connector = state.connectors.find((item) => item.id === request.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== request.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const ownership = ensureConnectorOwner(state, connector, actor);
  if (!ownership.ok) {
    return { ok: false, error: ownership.error };
  }

  const commandIndex = state.deadLetterCommands.findIndex(
    (item) => item.id === request.commandId && item.connectorId === request.connectorId
  );
  if (commandIndex === -1) {
    return { ok: false, error: "Unknown dead-letter command." };
  }

  const deadLetter = state.deadLetterCommands[commandIndex];
  const requeuedAt = new Date().toISOString();
  const command: CfdMailboxCommand = {
    ...deadLetter,
    claimedAt: null,
    claimToken: null,
    claimExpiresAt: null,
    acknowledgedAt: null,
    retryCount: 0,
  };

  state.deadLetterCommands.splice(commandIndex, 1);
  state.pendingCommands.unshift(command);
  state.signalInbox.unshift({
    id: crypto.randomUUID(),
    signalId: command.signal.signalId,
    connectorId: command.connectorId,
    strategyId: command.signal.strategyId,
    stage: "queued",
    tone: "warning",
    detail: `Dead-letter command for ${command.terminalSymbol} was re-queued intentionally by the operator.`,
    occurredAt: requeuedAt,
  });
  await persistState(state);

  return {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    command,
    retriedAt: requeuedAt,
  };
}

export async function dismissDeadLetterCfdCommand(payload: unknown, actor: CfdAdminActor = LOCAL_DEV_ACTOR) {
  const state = await getState();
  const request = normalizeDeadLetterAdminRequest(payload);

  if (!request.connectorId || !request.kwantId || !request.commandId) {
    return { ok: false, error: "connectorId, kwantId, and commandId are required." };
  }

  const connector = state.connectors.find((item) => item.id === request.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== request.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const ownership = ensureConnectorOwner(state, connector, actor);
  if (!ownership.ok) {
    return { ok: false, error: ownership.error };
  }

  const commandIndex = state.deadLetterCommands.findIndex(
    (item) => item.id === request.commandId && item.connectorId === request.connectorId
  );
  if (commandIndex === -1) {
    return { ok: false, error: "Unknown dead-letter command." };
  }

  const [deadLetter] = state.deadLetterCommands.splice(commandIndex, 1);
  const dismissedAt = new Date().toISOString();
  state.signalInbox.unshift({
    id: crypto.randomUUID(),
    signalId: deadLetter.signal.signalId,
    connectorId: deadLetter.connectorId,
    strategyId: deadLetter.signal.strategyId,
    stage: "dead_letter",
    tone: "warning",
    detail: `Dead-letter command for ${deadLetter.terminalSymbol} was dismissed by the operator after review.`,
    occurredAt: dismissedAt,
  });
  await persistState(state);

  return {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    commandId: deadLetter.id,
    dismissedAt,
  };
}

export async function __resetCfdConnectorStateForTesting() {
  return await resetStateForTesting();
}

export async function __getCfdConnectorStateForTesting() {
  return await getState();
}

export function __getCfdConnectorStateFilePathForTesting() {
  return getCfdConnectorStoreDescriptor().location;
}

export async function __reloadCfdConnectorStateFromDiskForTesting() {
  globalForConnectors.__kwantifyCfdRuntimeState = undefined;
  globalForConnectors.__kwantifyCfdRuntimeStatePromise = undefined;
  return await getState();
}

export async function runCfdConnectorTest(payload: unknown, actor: CfdAdminActor = LOCAL_DEV_ACTOR) {
  const state = await getState();
  const request = normalizeConnectorAdminRequest(payload);

  if (!request.connectorId || !request.kwantId) {
    return { ok: false, error: "connectorId and kwantId are required." };
  }

  const connector = state.connectors.find((item) => item.id === request.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== request.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const ownership = ensureConnectorOwner(state, connector, actor);
  if (!ownership.ok) {
    return { ok: false, error: ownership.error };
  }

  const checkedAt = new Date().toISOString();
  const effectiveConnector = enrichConnector(connector, state);
  const routeCount = state.routeProfiles.filter((profile) => profile.connectorId === connector.id).length;
  const mappingCount = state.symbolMappings.filter((mapping) => mapping.connectorId === connector.id).length;
  const hasSecret = Boolean(state.connectorSecrets[connector.id]);

  let outcome: "pass" | "warn" | "fail" = "pass";
  const messages: string[] = [];

  if (effectiveConnector.pairingStatus !== "paired") {
    outcome = "fail";
    messages.push("Seat is not paired.");
  }
  if (!hasSecret) {
    outcome = "fail";
    messages.push("Shared secret is missing.");
  }
  if (effectiveConnector.heartbeatState !== "healthy") {
    outcome = outcome === "fail" ? "fail" : "warn";
    messages.push(
      effectiveConnector.heartbeatState === "stale"
        ? "Heartbeat is stale."
        : "No healthy heartbeat is present."
    );
  }
  if (!routeCount) {
    outcome = outcome === "fail" ? "fail" : "warn";
    messages.push("No route profiles are attached.");
  }
  if (!mappingCount) {
    outcome = outcome === "fail" ? "fail" : "warn";
    messages.push("No symbol mappings are attached.");
  }

  if (!messages.length) {
    messages.push("Seat is paired, authenticated recently, and has active route/mapping coverage.");
  }

  appendAdminEvent(state, {
    connectorId: connector.id,
    kwantId: connector.kwantId,
    action: "test_connection",
    detail: `Connection test ${outcome}: ${messages.join(" ")}`,
    actor: actor.label,
    occurredAt: checkedAt,
  });
  await persistStateBestEffort(state);

  return {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    checkedAt,
    outcome,
    connector: enrichConnector(connector, state),
    detail: messages.join(" "),
    routeCount,
    mappingCount,
  };
}

export async function sendCfdConnectorTestSignal(
  payload: unknown,
  actor: CfdAdminActor = LOCAL_DEV_ACTOR,
  options?: {
    requestBaseUrl?: string | null;
    preferConnectorPortal?: boolean;
  }
) {
  const state = await getState();
  if (sweepExpiredClaims(state)) {
    await persistStateBestEffort(state);
  }
  const request = normalizeConnectorAdminRequest(payload);

  if (!request.connectorId || !request.kwantId) {
    return { ok: false, error: "connectorId and kwantId are required." };
  }

  const connector = state.connectors.find((item) => item.id === request.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== request.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const ownership = ensureConnectorOwner(state, connector, actor);
  if (!ownership.ok) {
    return { ok: false, error: ownership.error };
  }

  const routeProfile = state.routeProfiles.find((profile) => profile.connectorId === connector.id);
  if (!routeProfile) {
    return { ok: false, error: "No route profile exists for this connector." };
  }

  const inFlightSyntheticCommand = state.pendingCommands.find((command) => {
    return command.connectorId === connector.id && command.signal.strategyId === "connector_test";
  });

  if (inFlightSyntheticCommand) {
    return {
      ok: false,
      error: `A synthetic MT5 test signal is already in flight for ${inFlightSyntheticCommand.terminalSymbol}. Wait for that test to resolve before sending another one.`,
    };
  }

  const nowMs = Date.now();
  const recentSyntheticActivity = state.signalInbox.find((entry) => {
    if (entry.connectorId !== connector.id) return false;
    if (entry.strategyId !== "connector_test") return false;
    if (entry.stage !== "received") return false;
    const occurredAtMs = new Date(entry.occurredAt).getTime();
    if (!Number.isFinite(occurredAtMs)) return false;
    return nowMs - occurredAtMs < CFD_SYNTHETIC_TEST_COOLDOWN_MS;
  });

  if (recentSyntheticActivity) {
    return {
      ok: false,
      error: "A synthetic MT5 test signal was already sent very recently. Wait a few seconds before sending another one.",
    };
  }

  const syntheticSignal = buildSyntheticCfdTestSignal(connector, routeProfile);
  const connectorPortalBaseUrl = normalizePortalBaseUrl(CFD_DEFAULT_PORTAL_BASE_URL);
  const requestBaseUrl = normalizePortalBaseUrl(options?.requestBaseUrl);

  let result:
    | Awaited<ReturnType<typeof ingestCfdSignal>>
    | { ok: true; schemaVersion: string; signalId: string; command: CfdMailboxCommand; forwardedTo: string };

  if (
    options?.preferConnectorPortal &&
    requestBaseUrl &&
    requestBaseUrl !== connectorPortalBaseUrl
  ) {
    const response = await fetch(`${connectorPortalBaseUrl}/api/connector/cfds/signals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(syntheticSignal),
      cache: "no-store",
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        error:
          json && typeof json === "object" && "error" in json && typeof json.error === "string"
            ? json.error
            : `Remote connector backend rejected the test signal with ${response.status}.`,
      };
    }

    result = {
      ok: true,
      schemaVersion: CFD_SCHEMA_VERSION,
      signalId: syntheticSignal.signalId,
      command: {
        id: typeof json?.command?.id === "string" ? json.command.id : crypto.randomUUID(),
        schemaVersion: CFD_SCHEMA_VERSION,
        connectorId: connector.id,
        kwantId: connector.kwantId,
        routeProfileId: routeProfile.id,
        signal: syntheticSignal,
        action: routeProfile.sidePolicy === "short_only" ? "open_short" : "open_long",
        terminalSymbol: routeProfile.terminalSymbol,
        commandName: routeProfile.sidePolicy === "short_only" ? "sell" : "buy",
        entryInstruction: { mode: "points", value: null },
        quantityMode: "lots",
        normalizedQuantity: Number(syntheticSignal.quantity),
        volumeInterpretation: syntheticSignal.volumeInterpretation ?? "lots",
        riskValue: syntheticSignal.riskValue ?? null,
        sizingMode: routeProfile.sizingMode,
        sizingValue: routeProfile.sizingValue,
        stopMode: routeProfile.stopMode,
        targetMode: routeProfile.targetMode,
        stopInstruction: { mode: "points", value: syntheticSignal.stopLoss },
        targetInstruction: { mode: "points", value: syntheticSignal.takeProfit },
        duplicateWindowSeconds: routeProfile.duplicateWindowSeconds,
        maxOpenPositions: routeProfile.maxOpenPositions,
        reductionPolicy: routeProfile.reductionPolicy,
        minReductionLot: routeProfile.minReductionLot,
        minRemainingLot: routeProfile.minRemainingLot,
        magic: 810001,
        comment: syntheticSignal.comment ?? "",
        claimedAt: null,
        claimToken: null,
        claimExpiresAt: null,
        acknowledgedAt: null,
        createdAt: syntheticSignal.timestamp,
        retryCount: 0,
      },
      forwardedTo: connectorPortalBaseUrl,
    };
  } else {
    result = await ingestCfdSignal(syntheticSignal);
  }

  if (!result.ok) {
    return result;
  }

  appendAdminEvent(state, {
    connectorId: connector.id,
    kwantId: connector.kwantId,
    action: "test_signal",
    detail:
      "forwardedTo" in result
        ? `Forwarded synthetic test signal ${syntheticSignal.signalId} to ${result.forwardedTo} for ${routeProfile.terminalSymbol}.`
        : `Queued synthetic test signal ${syntheticSignal.signalId} for ${routeProfile.terminalSymbol}.`,
    actor: actor.label,
    occurredAt: new Date().toISOString(),
  });
  await persistStateBestEffort(state);

  return {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    signalId: syntheticSignal.signalId,
    routeProfileId: routeProfile.id,
    command: result.command,
    forwardedTo: "forwardedTo" in result ? result.forwardedTo : null,
  };
}

export async function recordCfdValidationUpdate(payload: unknown, actor: CfdAdminActor = LOCAL_DEV_ACTOR) {
  const state = await getState();
  const request = normalizeValidationUpdateRequest(payload);

  if (!request.connectorId || !request.kwantId || !request.checkTitle) {
    return { ok: false, error: "connectorId, kwantId, and checkTitle are required." };
  }

  const connector = state.connectors.find((item) => item.id === request.connectorId);
  if (!connector) {
    return { ok: false, error: "Unknown connectorId." };
  }
  if (connector.kwantId !== request.kwantId) {
    return { ok: false, error: "KWANT ID does not match the registered connector." };
  }
  const ownership = ensureConnectorOwner(state, connector, actor);
  if (!ownership.ok) {
    return { ok: false, error: ownership.error };
  }

  const occurredAt = new Date().toISOString();
  appendAdminEvent(state, {
    connectorId: connector.id,
    kwantId: connector.kwantId,
    action: "validation_update",
    detail: `${request.outcome === "passed" ? "Validation passed" : "Validation needs work"}: ${request.checkTitle}${
      request.note ? ` - ${request.note}` : ""
    }`,
    actor: actor.label,
    occurredAt,
  });
  await persistState(state);

  return {
    ok: true,
    schemaVersion: CFD_SCHEMA_VERSION,
    occurredAt,
    outcome: request.outcome,
    checkTitle: request.checkTitle,
  };
}




