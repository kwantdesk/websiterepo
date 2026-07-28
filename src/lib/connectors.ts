export type ConnectorTone = "live" | "ready" | "planned" | "warning" | "error";
export const CFD_CONNECTOR_SCHEMA_VERSION = "kwantify-cfd-connector/v1.2";

export type CfdConnectorStage =
  | "received"
  | "validated"
  | "queued"
  | "claimed"
  | "executed"
  | "reduced"
  | "rejected"
  | "closed"
  | "dead_letter";

export const CFD_DEFAULT_PORTAL_BASE_URL = "https://www.kwantify.co";

export type CfdHeartbeatState = "healthy" | "stale" | "offline";
export type CfdHealthStatus = "pass" | "warn" | "fail" | "unknown";
export type CfdQuantityMode = "lots";
export type CfdSignalCommand =
  | "buy"
  | "sell"
  | "buystop"
  | "buylimit"
  | "sellstop"
  | "selllimit"
  | "closelongopenlong"
  | "closelongopenshort"
  | "closeshortopenlong"
  | "closeshortopenshort"
  | "closelongshortopenlong"
  | "closelongshortopenshort"
  | "cancellongbuystop"
  | "cancellongbuylimit"
  | "cancelshortsellstop"
  | "cancelshortselllimit"
  | "closeall"
  | "cancellong"
  | "cancelshort"
  | "closelong"
  | "closeshort"
  | "closelongshort"
  | "closelongpct"
  | "closeshortpct"
  | "closelongvol"
  | "closeshortvol"
  | "newsltplong"
  | "newsltpshort"
  | "newsltpbuystop"
  | "newsltpbuylimit"
  | "newsltpsellstop"
  | "newsltpselllimit"
  | "eaoff"
  | "eaon"
  | "closealleaoff";
export type CfdNormalizedAction =
  | "open_long"
  | "open_short"
  | "place_buy_stop"
  | "place_buy_limit"
  | "place_sell_stop"
  | "place_sell_limit"
  | "close_long_open_long"
  | "close_long_open_short"
  | "close_short_open_long"
  | "close_short_open_short"
  | "close_long_short_open_long"
  | "close_long_short_open_short"
  | "cancel_long_place_buy_stop"
  | "cancel_long_place_buy_limit"
  | "cancel_short_place_sell_stop"
  | "cancel_short_place_sell_limit"
  | "close_all"
  | "cancel_long_pending"
  | "cancel_short_pending"
  | "close_long_positions"
  | "close_short_positions"
  | "close_long_short_positions"
  | "partial_close_long_pct"
  | "partial_close_short_pct"
  | "partial_close_long_volume"
  | "partial_close_short_volume"
  | "modify_long_positions"
  | "modify_short_positions"
  | "modify_buy_stop_orders"
  | "modify_buy_limit_orders"
  | "modify_sell_stop_orders"
  | "modify_sell_limit_orders"
  | "disable_ea"
  | "enable_ea"
  | "close_all_and_disable_ea"
  | "partial_close_position"
  | "close_position"
  | "flatten_all";
export type CfdPairingStatus = "paired" | "pending" | "unpaired" | "revoked";
export type CfdConnectorAuthMode = "shared_secret";
export type CfdProtectionInstruction = {
  mode: "price" | "points" | "pips" | "percentage" | "breakeven";
  value: number | null;
};
export type CfdEntryInstruction = {
  mode: "price" | "points" | "pips" | "percentage";
  value: number | null;
};
export type CfdVolumeInterpretation =
  | "lots"
  | "dollar_loss"
  | "pct_balance_lots"
  | "pct_balance_margin"
  | "pct_balance_loss"
  | "pct_equity_loss";

export type CfdHealthCheck = {
  id: string;
  label: string;
  status: CfdHealthStatus;
  detail: string;
};

export type CfdConnectorRecord = {
  id: string;
  kwantId: string;
  ownerUserId: string | null;
  ownerLabel: string | null;
  label: string;
  broker: string;
  server: string;
  accountLabel: string;
  accountNumber: string;
  mode: "demo" | "live";
  status: string;
  tone: ConnectorTone;
  transport: "webrequest_pull";
  heartbeatState: CfdHeartbeatState;
  lastHeartbeatAt: string | null;
  pollIntervalMs: number;
  eaVersion: string;
  chartSymbol: string;
  pendingSignals: number;
  detail: string;
  pairingStatus: CfdPairingStatus;
  authMode: CfdConnectorAuthMode;
  terminalInstanceId: string | null;
  terminalAlias: string | null;
  pairingCode: string;
  secretHint: string;
  lastPairedAt: string | null;
  lastAuthenticatedAt: string | null;
  healthChecks: CfdHealthCheck[];
};

export type CfdConnectionHistoryRow = {
  id: string;
  kwantId: string;
  accountNumber: string;
  broker: string;
  accountType: "Demo" | "Live";
  platform: "MT5";
  eaVersion: string;
  connectedFrom: string;
  connectedTo: string | null;
  status: "active" | "closed";
};

export type CfdLicenseSlot = {
  id: string;
  kwantId: string;
  activeConnections: number;
  maxConnections: number;
  sessions: CfdConnectorRecord[];
  history: CfdConnectionHistoryRow[];
};

export type CfdConnectorAdminEvent = {
  id: string;
  connectorId: string;
  kwantId: string;
  action:
    | "paired"
    | "claimed_owner"
    | "rotate_secret"
    | "revoked"
    | "released_owner"
    | "test_connection"
    | "test_signal"
    | "validation_update";
  detail: string;
  actor: string;
  occurredAt: string;
};

export type CfdValidationUpdateRequest = {
  connectorId: string;
  kwantId: string;
  checkTitle: string;
  outcome: "passed" | "needs_work";
  note?: string;
};

export type CfdRouteProfile = {
  id: string;
  name: string;
  connectorId: string;
  strategyScope: string;
  source: "kwantify";
  symbol: string;
  terminalSymbol: string;
  sidePolicy: "long_short" | "long_only" | "short_only";
  sizingMode: "fixed_lots" | "risk_percent";
  sizingValue: number;
  duplicateWindowSeconds: number;
  maxOpenPositions: number;
  reductionPolicy: "disabled" | "hedging_only";
  minReductionLot: number | null;
  minRemainingLot: number | null;
  stopMode: "price" | "points";
  targetMode: "price" | "points";
};

export type CfdSymbolMapping = {
  id: string;
  connectorId: string;
  platformSymbol: string;
  terminalSymbol: string;
  minLot: number;
  lotStep: number;
  maxLot: number;
  note: string;
};

export type CfdSignalPayload = {
  schemaVersion: string;
  signalId: string;
  strategyId: string;
  versionId: string;
  connectorId: string;
  accountId: string;
  symbol: string;
  command: CfdSignalCommand;
  side: "buy" | "sell" | "reduce" | "close" | "flatten";
  quantityMode: CfdQuantityMode;
  quantity: number;
  orderType: "market" | "limit" | "stop";
  stopLoss: number | null;
  takeProfit: number | null;
  timestamp: string;
  riskValue?: number | null;
  volumeInterpretation?: CfdVolumeInterpretation;
  entryPrice?: number | null;
  entryPips?: number | null;
  entryPercent?: number | null;
  spreadFilter?: number | null;
  accountFilter?: number | null;
  breakevenAt?: number | null;
  breakevenOffset?: number | null;
  trailingTrigger?: number | null;
  trailingDistance?: number | null;
  trailingStep?: number | null;
  atrTimeframe?: number | null;
  atrPeriod?: number | null;
  atrMultiplier?: number | null;
  atrShift?: number | null;
  atrTrigger?: number | null;
  secret?: string;
  rawMessage?: string;
  comment?: string;
};

export type CfdMailboxCommand = {
  id: string;
  schemaVersion: string;
  connectorId: string;
  kwantId: string;
  routeProfileId: string;
  signal: CfdSignalPayload;
  action: CfdNormalizedAction;
  terminalSymbol: string;
  commandName: CfdSignalCommand;
  entryInstruction: CfdEntryInstruction;
  quantityMode: CfdQuantityMode;
  normalizedQuantity: number;
  volumeInterpretation: CfdVolumeInterpretation;
  riskValue: number | null;
  sizingMode: CfdRouteProfile["sizingMode"];
  sizingValue: number;
  stopMode: CfdRouteProfile["stopMode"];
  targetMode: CfdRouteProfile["targetMode"];
  stopInstruction: CfdProtectionInstruction;
  targetInstruction: CfdProtectionInstruction;
  duplicateWindowSeconds: number;
  maxOpenPositions: number;
  reductionPolicy: CfdRouteProfile["reductionPolicy"];
  minReductionLot: CfdRouteProfile["minReductionLot"];
  minRemainingLot: CfdRouteProfile["minRemainingLot"];
  magic: number;
  comment: string;
  createdAt: string;
  claimedAt: string | null;
  claimToken: string | null;
  claimExpiresAt: string | null;
  acknowledgedAt: string | null;
  retryCount: number;
};

export type CfdDeadLetterCommand = CfdMailboxCommand & {
  deadLetteredAt: string;
  deadLetterReason: string;
};

export type CfdSignalLogEntry = {
  id: string;
  signalId: string;
  connectorId: string;
  strategyId: string;
  stage: CfdConnectorStage;
  tone: ConnectorTone;
  detail: string;
  occurredAt: string;
};

export type CfdHeartbeatEvent = {
  connectorId: string;
  kwantId: string;
  authToken: string;
  occurredAt: string;
  latencyMs: number;
  terminalStatus: "ready" | "busy" | "offline";
  chartSymbol: string;
  eaVersion: string;
  pendingSignals: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
};

export type CfdClaimRequest = {
  connectorId: string;
  kwantId: string;
  authToken: string;
  maxCommands?: number;
};

export type CfdClaimAckRequest = {
  connectorId: string;
  kwantId: string;
  authToken: string;
  signalId: string;
  claimToken: string;
};

export type CfdRecoveredCommandStatusRequest = {
  connectorId: string;
  kwantId: string;
  authToken: string;
  signalId: string;
};

export type CfdRecoveredCommandStatusResponse = {
  ok: true;
  schemaVersion: string;
  connectorId: string;
  kwantId: string;
  signalId: string;
  status:
    | "pending_on_server"
    | "acknowledged_on_server"
    | "dead_lettered"
    | "reported_terminal_outcome"
    | "missing_on_server";
  canClearRecoveredCommand: boolean;
  detail: string;
  lastKnownStage?: string;
  lastKnownReportStatus?: CfdExecutionReportStatus;
};

export type CfdPairingRequest = {
  connectorId: string;
  kwantId: string;
  pairingCode: string;
  terminalInstanceId: string;
  terminalAlias: string;
  eaVersion: string;
  chartSymbol: string;
};

export type CfdPairingResponse = {
  ok: true;
  schemaVersion: string;
  connectorId: string;
  kwantId: string;
  pairingStatus: CfdPairingStatus;
  authMode: CfdConnectorAuthMode;
  authToken: string;
  secretHint: string;
  terminalInstanceId: string;
  terminalAlias: string;
  pairedAt: string;
};

export type CfdConnectorAdminRequest = {
  connectorId: string;
  kwantId: string;
};

export type CfdDeadLetterAdminRequest = {
  connectorId: string;
  kwantId: string;
  commandId: string;
};

export type CfdRotateSecretResponse = {
  ok: true;
  schemaVersion: string;
  connectorId: string;
  kwantId: string;
  secretHint: string;
  rotatedAt: string;
};

export type CfdRevokeConnectorResponse = {
  ok: true;
  schemaVersion: string;
  connectorId: string;
  kwantId: string;
  pairingStatus: CfdPairingStatus;
  pairingCode: string;
  revokedAt: string;
};

export type CfdExecutionReportStatus =
  | "accepted"
  | "placed"
  | "filled"
  | "shadow_armed"
  | "shadow_triggered"
  | "reduced"
  | "rejected"
  | "closed"
  | "modified"
  | "cancelled"
  | "disabled"
  | "enabled";

export type CfdExecutionReportPayload = {
  connectorId: string;
  kwantId: string;
  authToken: string;
  signalId: string;
  status: CfdExecutionReportStatus;
  occurredAt: string;
  terminalSymbol: string;
  orderTicket?: string;
  positionTicket?: string;
  executedPrice?: number;
  remainingVolume?: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  errorCode?: string;
  errorMessage?: string;
  terminalComment?: string;
};

export type CfdErrorCatalogEntry = {
  scope: string;
  code: string;
  title: string;
  detail: string;
  operatorAction: string;
};

export type CfdConnectorOverview = {
  generatedAt: string;
  schemaVersion: string;
  destination: string;
  source: string;
  store: {
    kind: "file_json" | "supabase_snapshot";
    location: string;
    namespace?: string;
    table?: string;
  };
  connectors: CfdConnectorRecord[];
  routeProfiles: CfdRouteProfile[];
  symbolMappings: CfdSymbolMapping[];
  signalInbox: CfdSignalLogEntry[];
  errorCatalog: CfdErrorCatalogEntry[];
  samplePayload: CfdSignalPayload;
  pendingCommands: CfdMailboxCommand[];
  deadLetterCommands: CfdDeadLetterCommand[];
  executionReports: CfdExecutionReportPayload[];
  licenseSlots: CfdLicenseSlot[];
  adminEvents: CfdConnectorAdminEvent[];
};

export type CfdConnectorRuntimeState = {
  connectors: CfdConnectorRecord[];
  routeProfiles: CfdRouteProfile[];
  symbolMappings: CfdSymbolMapping[];
  signalInbox: CfdSignalLogEntry[];
  heartbeatEvents: CfdHeartbeatEvent[];
  pendingCommands: CfdMailboxCommand[];
  deadLetterCommands: CfdDeadLetterCommand[];
  executionReports: CfdExecutionReportPayload[];
  licenseSlots: CfdLicenseSlot[];
  adminEvents: CfdConnectorAdminEvent[];
  connectorSecrets: Record<string, string>;
};

export type CfdConnectorSeatRow = {
  connectorId: string;
  kwantId: string;
  ownerUserId: string | null;
  ownerLabel: string | null;
  label: string;
  broker: string;
  server: string;
  accountLabel: string;
  accountNumber: string;
  mode: "demo" | "live";
  status: string;
  tone: ConnectorTone;
  transport: "webrequest_pull";
  heartbeatState: CfdHeartbeatState;
  lastHeartbeatAt: string | null;
  pollIntervalMs: number;
  eaVersion: string;
  chartSymbol: string;
  pendingSignals: number;
  detail: string;
  pairingStatus: CfdPairingStatus;
  authMode: CfdConnectorAuthMode;
  terminalInstanceId: string | null;
  terminalAlias: string | null;
  pairingCode: string;
  secretHint: string;
  lastPairedAt: string | null;
  lastAuthenticatedAt: string | null;
};

export type CfdConnectorRouteProfileRow = CfdRouteProfile;

export type CfdConnectorSymbolMappingRow = CfdSymbolMapping;

export type CfdConnectorSignalEventRow = {
  id: string;
  signalId: string;
  connectorId: string;
  strategyId: string;
  stage: CfdConnectorStage;
  tone: ConnectorTone;
  detail: string;
  occurredAt: string;
};

export type CfdConnectorMailboxCommandRow = CfdMailboxCommand;

export type CfdConnectorDeadLetterCommandRow = CfdDeadLetterCommand;

export type CfdConnectorExecutionReportRow = CfdExecutionReportPayload & {
  reportId: string;
};

export type CfdConnectorAdminEventRow = CfdConnectorAdminEvent;

export type CfdConnectorHeartbeatRow = CfdHeartbeatEvent & {
  heartbeatId: string;
};

export type CfdConnectorConnectionHistoryRow = CfdConnectionHistoryRow;

export type CfdConnectorSecretRow = {
  connectorId: string;
  secret: string;
};

export type CfdConnectorNormalizedState = {
  seats: CfdConnectorSeatRow[];
  routeProfiles: CfdConnectorRouteProfileRow[];
  symbolMappings: CfdConnectorSymbolMappingRow[];
  signalEvents: CfdConnectorSignalEventRow[];
  heartbeats: CfdConnectorHeartbeatRow[];
  mailboxCommands: CfdConnectorMailboxCommandRow[];
  deadLetterCommands: CfdConnectorDeadLetterCommandRow[];
  executionReports: CfdConnectorExecutionReportRow[];
  adminEvents: CfdConnectorAdminEventRow[];
  connectionHistory: CfdConnectorConnectionHistoryRow[];
  connectorSecrets: CfdConnectorSecretRow[];
};

export function connectorToneClasses(tone: ConnectorTone) {
  switch (tone) {
    case "live":
      return "text-primary";
    case "ready":
      return "text-sky-300";
    case "warning":
      return "text-amber-300";
    case "error":
      return "text-danger";
    default:
      return "text-muted";
  }
}
