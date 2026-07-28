export const FUTURES_CONNECTOR_SCHEMA_VERSION = "kwantify-futures-connector/v0.1";

export type FuturesVenueKey = "tradovate" | "rithmic" | "cqg";
export type FuturesAdapterStatus = "build_first" | "build_next" | "later" | "reference_only";
export type FuturesEnvironment = "demo" | "live" | "staging" | "test";
export type FuturesAccessModel =
  | "tradovate_retail_api"
  | "tradovate_partner_api"
  | "rithmic_dev_kit"
  | "terminal_shell";
export type RithmicApiFlavor = "api_plus" | "protocol_api" | "diamond";
export type FuturesOrderType =
  | "market"
  | "limit"
  | "stop"
  | "stop_limit"
  | "trailing_stop"
  | "trailing_stop_limit";
export type FuturesTimeInForce = "day" | "gtc" | "gtd" | "ioc" | "fok";
export type FuturesSide = "buy" | "sell";
export type FuturesProtectionMode = "ticks" | "price" | "percentage" | "none";
export type FuturesQuantityMode = "contracts" | "fixed_contracts" | "multiplier" | "risk_fixed_dollar";
export type FuturesEventStage =
  | "received"
  | "validated"
  | "queued"
  | "routed"
  | "submitted"
  | "accepted"
  | "partially_filled"
  | "filled"
  | "cancelled"
  | "rejected"
  | "flat";
export type FuturesCapabilityKey =
  | "rest_auth"
  | "websocket_auth"
  | "market_data_ws"
  | "order_placement"
  | "order_cancel"
  | "order_modify"
  | "oso"
  | "oco"
  | "server_side_brackets"
  | "server_side_trailing"
  | "account_creation"
  | "account_risk_controls"
  | "position_sync"
  | "symbol_metadata_lookup"
  | "execution_reports"
  | "conformance_required";

export type FuturesConnectorTone = "live" | "ready" | "planned" | "warning" | "error";
export type FuturesConnectionState = "connected" | "stale" | "offline" | "planned";
export type FuturesAccountStatus = "ready" | "auth_required" | "build_first" | "build_next" | "planned";
export type FuturesSignalStage = "received" | "validated" | "queued" | "submitted" | "accepted" | "rejected";

export type FuturesDocSource = {
  label: string;
  url: string;
  note: string;
};

export type FuturesConnectorAdapterProfile = {
  id: string;
  venue: FuturesVenueKey;
  name: string;
  status: FuturesAdapterStatus;
  rationale: string;
  accessModel: FuturesAccessModel;
  capabilities: FuturesCapabilityKey[];
  environments: {
    label: string;
    kind: FuturesEnvironment;
    apiBase?: string;
    websocket?: string;
    marketDataBase?: string;
  }[];
  requirements: string[];
  docs: FuturesDocSource[];
};

export type FuturesRoutingProfile = {
  id: string;
  label: string;
  adapterId: string;
  venue: FuturesVenueKey;
  environment: FuturesEnvironment;
  quantityMode: FuturesQuantityMode;
  defaultQuantity: number;
  allowedOrderTypes: FuturesOrderType[];
  allowedTif: FuturesTimeInForce[];
  supportsBrackets: boolean;
  supportsTrailing: boolean;
  notes: string;
};

export type FuturesRiskProfile = {
  id: string;
  label: string;
  maxContractsPerOrder: number;
  maxOpenPositions: number;
  duplicateWindowSeconds: number;
  sessionWindow: string;
  killSwitchReady: boolean;
  notes: string;
};

export type FuturesAccountRecord = {
  id: string;
  venue: FuturesVenueKey;
  environment: FuturesEnvironment;
  brokerAccountRef?: string;
  label: string;
  firm: string;
  platformAccess: string;
  status: FuturesAccountStatus;
  tone: FuturesConnectorTone;
  connectionState: FuturesConnectionState;
  riskProfileId: string;
  routeProfileIds: string[];
  lastSyncAt: string | null;
  detail: string;
};

export type FuturesConnectorStoreDescriptor = {
  kind: "file_json";
  location: string;
};

export type FuturesManagedProfileStore = {
  descriptor: FuturesConnectorStoreDescriptor;
  updatedAt: string;
  routingProfiles: FuturesRoutingProfile[];
  accounts: FuturesAccountRecord[];
  notes: string[];
  auditTrail: FuturesManagedProfileAuditEntry[];
  journal: FuturesJournalEntry[];
};

export type FuturesManagedProfileAuditEntry = {
  id: string;
  kind:
    | "account_binding_updated"
    | "route_profile_updated"
    | "tradovate_accounts_synced"
    | "rithmic_accounts_synced";
  detail: string;
  occurredAt: string;
};

export type FuturesJournalEntry = {
  id: string;
  category: "config" | "sync" | "signal" | "execution" | "control";
  venue: FuturesVenueKey | "system";
  title: string;
  detail: string;
  accountId: string | null;
  routeProfileId: string | null;
  signalId: string | null;
  status: "info" | "ready" | "warning" | "error";
  requestBody: Record<string, unknown> | null;
  responseBody: Record<string, unknown> | null;
  occurredAt: string;
};

export type FuturesConnectorSignalIntent = {
  schemaVersion: string;
  signalId: string;
  strategyId: string;
  versionId: string;
  venue: FuturesVenueKey;
  accountId: string;
  symbol: string;
  side: FuturesSide;
  quantityMode: FuturesQuantityMode;
  quantity: number;
  orderType: FuturesOrderType;
  limitPrice: number | null;
  stopPrice: number | null;
  tif: FuturesTimeInForce;
  stopLoss: {
    mode: FuturesProtectionMode;
    value: number | null;
  };
  takeProfit: {
    mode: FuturesProtectionMode;
    value: number | null;
  };
  trail?: {
    trigger: number | null;
    distance: number | null;
    step: number | null;
  };
  timestamp: string;
  comment?: string;
};

export type FuturesQueuedCommand = {
  id: string;
  adapterId: string;
  routeProfileId: string;
  accountId: string;
  signal: FuturesConnectorSignalIntent;
  createdAt: string;
  status: "queued" | "submitted" | "done";
};

export type FuturesAuthStatus = "configured" | "missing_config" | "auth_ok" | "auth_failed";

export type FuturesAdapterRuntimeStatus = {
  adapterId: string;
  adapterName: string;
  authStatus: FuturesAuthStatus;
  selectedEnvironment: FuturesEnvironment;
  configuredFields: string[];
  missingFields: string[];
  lastAuthTestAt: string | null;
  lastAuthDetail: string;
};

export type TradovateConnectionConfigSummary = {
  adapterId: string;
  source: "env" | "local_store" | "mixed" | "missing";
  selectedEnvironment: FuturesEnvironment;
  username: string;
  appId: string;
  appVersion: string;
  cid: string;
  accountIdOverride: string | null;
  accountNameOverride: string | null;
  passwordSaved: boolean;
  secretSaved: boolean;
  configuredFields: string[];
  missingFields: string[];
  updatedAt: string | null;
  storageLocation: string | null;
  notes: string[];
};

export type TradovateRetailConnectStatus = {
  adapterId: string;
  connectMode: "oauth_vendor";
  selectedEnvironment: FuturesEnvironment;
  oauthConfigured: boolean;
  connected: boolean;
  missingFields: string[];
  authorizationUrl: string | null;
  redirectUri: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  connectedUserName: string | null;
  storageLocation: string | null;
  notes: string[];
};

export type TradovateSessionDiscovery = {
  adapterId: string;
  authStatus: FuturesAuthStatus;
  selectedEnvironment: FuturesEnvironment;
  apiBase: string;
  userWebsocket: string;
  marketDataWebsocket: string;
  clientAccess: string;
  adminDashboard: string | null;
  accountManagementScope: string;
  authenticatedUser: {
    userId: string | null;
    name: string | null;
    userName: string | null;
  } | null;
  notes: string[];
  testedAt: string | null;
  error: string | null;
};

export type TradovateDiscoveredAccount = {
  id: string;
  name: string | null;
  accountType: string | null;
  active: boolean | null;
  riskCategoryId: string | null;
  autoLiqProfileId: string | null;
  clearingHouseId: string | null;
  evaluationSize: number | null;
  readonly: boolean | null;
};

export type TradovateAccountDiscovery = {
  adapterId: string;
  authStatus: FuturesAuthStatus;
  selectedEnvironment: FuturesEnvironment;
  accountCount: number;
  accounts: TradovateDiscoveredAccount[];
  notes: string[];
  testedAt: string | null;
  error: string | null;
};

export type TradovateRouteBinding = {
  adapterId: string;
  routeProfileId: string;
  accountId: string;
  selectedEnvironment: FuturesEnvironment;
  brokerAccountRef: string | null;
  resolvedTradovateAccountId: string | null;
  resolvedTradovateAccountName: string | null;
  accountSpec: string | null;
  resolutionSource:
    | "managed_account_ref"
    | "connection_account_id"
    | "connection_account_name"
    | "first_active_account"
    | "unresolved";
  managedAccountLabel: string | null;
  managedRouteLabel: string | null;
  managedRiskProfileLabel: string | null;
  notes: string[];
  error: string | null;
};

export type TradovatePositionSnapshot = {
  id: string;
  accountId: string;
  contractId: string | null;
  netPos: number | null;
  netPrice: number | null;
  bought: number | null;
  sold: number | null;
  timestamp: string | null;
};

export type TradovateWorkingOrderSnapshot = {
  id: string;
  accountId: string | null;
  contractId: string | null;
  symbol: string | null;
  action: string | null;
  orderType: string | null;
  orderQty: number | null;
  price: number | null;
  stopPrice: number | null;
  isAutomated: boolean | null;
  status: string | null;
};

export type TradovateBrokerState = {
  adapterId: string;
  selectedEnvironment: FuturesEnvironment;
  authStatus: FuturesAuthStatus;
  positions: TradovatePositionSnapshot[];
  workingOrders: TradovateWorkingOrderSnapshot[];
  fetchedAt: string | null;
  notes: string[];
  error: string | null;
};

export type RithmicRouteBinding = {
  adapterId: string;
  routeProfileId: string;
  accountId: string;
  selectedEnvironment: FuturesEnvironment;
  preferredFlavor: RithmicApiFlavor;
  resolvedSystemName: string | null;
  resolvedUserId: string | null;
  resolvedFcmId: string | null;
  resolvedIbId: string | null;
  brokerAccountRef: string | null;
  accountReference: string | null;
  resolutionSource: "managed_account_ref" | "env_credentials" | "unresolved";
  managedAccountLabel: string | null;
  managedRouteLabel: string | null;
  managedRiskProfileLabel: string | null;
  notes: string[];
  error: string | null;
};

export type RithmicFlavorBlueprint = {
  key: RithmicApiFlavor;
  label: string;
  languageSurface: string;
  latencyProfile: string;
  bestFor: string;
  serverSideFeatures: string[];
};

export type RithmicSessionBlueprint = {
  adapterId: string;
  authStatus: FuturesAuthStatus;
  selectedEnvironment: FuturesEnvironment;
  preferredFlavor: RithmicApiFlavor;
  configuredFields: string[];
  missingFields: string[];
  flavors: RithmicFlavorBlueprint[];
  onboardingSteps: string[];
  notes: string[];
  error: string | null;
};

export type RithmicDiscoveredAccount = {
  id: string;
  label: string;
  environment: FuturesEnvironment;
  firm: string | null;
  fcmId: string | null;
  ibId: string | null;
  systemName: string | null;
  userId: string | null;
  routeMode: "single_account" | "copy_group" | "prop_lane";
  readonly: boolean | null;
  active: boolean | null;
  source: "env_seed" | "planning_seed";
};

export type RithmicAccountDiscovery = {
  adapterId: string;
  authStatus: FuturesAuthStatus;
  selectedEnvironment: FuturesEnvironment;
  accountCount: number;
  accounts: RithmicDiscoveredAccount[];
  notes: string[];
  testedAt: string | null;
  error: string | null;
};

export type RithmicLifecycleBlueprintStep = {
  stage: FuturesEventStage;
  label: string;
  detail: string;
  sourceOfTruth: string;
};

export type RithmicExecutionBlueprint = {
  adapterId: string;
  preferredFlavor: RithmicApiFlavor;
  selectedEnvironment: FuturesEnvironment;
  executionPath: string[];
  requiredJournalFields: string[];
  recoveryGuarantees: string[];
  lifecycleSteps: RithmicLifecycleBlueprintStep[];
  notes: string[];
};

export type RithmicOrderPreview = {
  adapterId: string;
  preferredFlavor: RithmicApiFlavor;
  selectedEnvironment: FuturesEnvironment;
  routeProfileId: string;
  accountId: string;
  accountReference: string;
  binding: {
    managedAccountLabel: string | null;
    managedRouteLabel: string | null;
    managedRiskProfileLabel: string | null;
    brokerAccountRef: string | null;
  };
  usesBracketProtection: boolean;
  body: Record<string, unknown>;
  notes: string[];
  failureReasons: string[];
};

export type RithmicSubmitAttemptState = "binding_blocked" | "ready_for_dev_kit" | "staged_for_submit";

export type RithmicSubmitAttemptResult = {
  adapterId: string;
  routeProfileId: string;
  accountId: string;
  signalId: string;
  preferredFlavor: RithmicApiFlavor;
  selectedEnvironment: FuturesEnvironment;
  localGatewayReady: boolean;
  binding: RithmicRouteBinding;
  requestBody: Record<string, unknown>;
  submitState: RithmicSubmitAttemptState;
  operatorVerdict: string;
  operatorMessage: string;
  responseBody: Record<string, unknown> | null;
  submittedAt: string;
};

export type RithmicLiveSubmitHandoff = {
  adapterId: string;
  preferredFlavor: RithmicApiFlavor;
  selectedEnvironment: FuturesEnvironment;
  handoffMode: "protocol_service" | "desktop_sdk" | "colo_binary";
  operatorReady: boolean;
  missingRequirements: string[];
  requiredCredentials: string[];
  deliveryNotes: string[];
  requestEnvelope: Record<string, unknown>;
};

export type RithmicAdapterBoundary = {
  adapterId: string;
  handoffMode: "protocol_service" | "desktop_sdk" | "colo_binary";
  transportState: "blocked" | "boundary_ready" | "transport_stubbed";
  operatorReady: boolean;
  implementationStatus: string;
  nextActions: string[];
  validationIssues: string[];
  acceptedEnvelopeShape: string[];
  dispatchContract: Record<string, unknown>;
};

export type RithmicDispatchAttemptResult = {
  adapterId: string;
  signalId: string;
  handoffMode: "protocol_service" | "desktop_sdk" | "colo_binary";
  dispatchState: "handoff_blocked" | "boundary_ready" | "transport_stubbed";
  operatorVerdict: string;
  operatorMessage: string;
  requestEnvelope: Record<string, unknown>;
  responseBody: Record<string, unknown> | null;
  dispatchedAt: string;
};

export type RithmicTransportPacket = {
  adapterId: string;
  handoffMode: "protocol_service" | "desktop_sdk" | "colo_binary";
  targetService: string;
  targetChannel: string;
  correlationId: string;
  packetState: "blocked" | "packet_ready";
  payload: Record<string, unknown>;
  notes: string[];
};

export type RithmicTransportAttemptResult = {
  adapterId: string;
  signalId: string;
  handoffMode: "protocol_service" | "desktop_sdk" | "colo_binary";
  correlationId: string;
  transportState: "handoff_blocked" | "packet_ready" | "transport_stubbed";
  operatorVerdict: string;
  operatorMessage: string;
  targetService: string;
  targetChannel: string;
  payload: Record<string, unknown>;
  responseBody: Record<string, unknown> | null;
  attemptedAt: string;
};

export type RithmicGatewayScenario =
  | "submitted"
  | "partial_fill"
  | "filled"
  | "flat_exit"
  | "rejected"
  | "uncertain"
  | "transport_failed"
  | "uncertain_recovered"
  | "transport_recovered";

export type RithmicSimulatedLifecycleStage = "ack" | "execution_report" | "reconciliation";

export type RithmicSimulatedLifecycleEvent = {
  id: string;
  signalId: string;
  correlationId: string;
  stage: RithmicSimulatedLifecycleStage;
  eventType: string;
  outcome: string;
  detail: string;
  status: "info" | "ready" | "warning" | "error";
  brokerOrderId: string | null;
  clientOrderId: string | null;
  parentOrderId: string | null;
  leavesQty: number | null;
  filledQty: number | null;
  cumQty: number | null;
  avgFillPrice: number | null;
  execType: string | null;
  ordStatus: string | null;
  rejectCode: string | null;
  rejectReason: string | null;
  reconciliationState: string | null;
  gatewayTimestampMicros: number | null;
  brokerTimestampMicros: number | null;
  occurredAt: string;
  payload: Record<string, unknown> | null;
};

export type RithmicProtocolServiceConfig = {
  adapterId: string;
  mode: "local_gateway" | "env_missing" | "dry_run" | "live_stub";
  endpoint: string | null;
  authMode: "none" | "bearer";
  timeoutMs: number;
  operatorReady: boolean;
  missingRequirements: string[];
  notes: string[];
};

export type RithmicProtocolServiceAttemptResult = {
  adapterId: string;
  signalId: string;
  correlationId: string;
  runState: "config_blocked" | "dry_run_staged" | "live_stubbed" | "transport_error";
  operatorVerdict: string;
  operatorMessage: string;
  endpoint: string | null;
  requestBody: Record<string, unknown>;
  responseBody: Record<string, unknown> | null;
  attemptedAt: string;
};

export type RithmicProtocolStubAttemptResult = {
  adapterId: string;
  signalId: string;
  correlationId: string;
  runState: "stub_blocked" | "stub_accepted";
  operatorVerdict: string;
  operatorMessage: string;
  requestBody: Record<string, unknown>;
  responseBody: Record<string, unknown> | null;
  attemptedAt: string;
};

export type FuturesExecutionEvent = {
  id: string;
  venue: FuturesVenueKey;
  accountId: string;
  signalId: string;
  stage: FuturesEventStage;
  detail: string;
  occurredAt: string;
};

export type FuturesConnectorOverview = {
  generatedAt: string;
  schemaVersion: string;
  managedProfileStore: FuturesManagedProfileStore;
  recentJournal: FuturesJournalEntry[];
  adapters: FuturesConnectorAdapterProfile[];
  accounts: FuturesAccountRecord[];
  riskProfiles: FuturesRiskProfile[];
  routingProfiles: FuturesRoutingProfile[];
  sampleSignal: FuturesConnectorSignalIntent;
  queuedCommands: FuturesQueuedCommand[];
  signalInbox: FuturesExecutionEvent[];
  executionJournalPreview: FuturesExecutionEvent[];
  adapterRuntime: FuturesAdapterRuntimeStatus[];
  tradovateConnectionConfig: TradovateConnectionConfigSummary;
  tradovateRetailConnect: TradovateRetailConnectStatus;
  tradovateSessionDiscovery: TradovateSessionDiscovery;
  tradovateAccountDiscovery: TradovateAccountDiscovery;
  tradovateBrokerState: TradovateBrokerState;
  tradovateRouteBinding: TradovateRouteBinding;
  tradovateOrderPreview: TradovateOrderPreview;
  tradovateLastSubmit: TradovateSubmitResult | null;
  tradovateLastControl: TradovateControlResult | null;
  rithmicSessionBlueprint: RithmicSessionBlueprint;
  rithmicAccountDiscovery: RithmicAccountDiscovery;
  rithmicRouteBinding: RithmicRouteBinding;
  rithmicExecutionBlueprint: RithmicExecutionBlueprint;
  rithmicOrderPreview: RithmicOrderPreview;
  rithmicLastSubmitAttempt: RithmicSubmitAttemptResult | null;
  rithmicLiveSubmitHandoff: RithmicLiveSubmitHandoff | null;
  rithmicAdapterBoundary: RithmicAdapterBoundary | null;
  rithmicLastDispatchAttempt: RithmicDispatchAttemptResult | null;
  rithmicTransportPacket: RithmicTransportPacket | null;
  rithmicLastTransportAttempt: RithmicTransportAttemptResult | null;
  rithmicProtocolServiceConfig: RithmicProtocolServiceConfig | null;
  rithmicLastProtocolServiceAttempt: RithmicProtocolServiceAttemptResult | null;
  rithmicLatestLifecycleScenario: RithmicGatewayScenario | null;
  rithmicSimulatedLifecycle: RithmicSimulatedLifecycleEvent[];
  rithmicLastProtocolStubAttempt: RithmicProtocolStubAttemptResult | null;
  strategicRecommendation: {
    buildFirst: string;
    buildNext: string;
    why: string[];
  };
};

export type TradovateOrderLegPreview = {
  action: "Buy" | "Sell";
  orderType: "Market" | "Limit" | "Stop" | "StopLimit";
  price?: number;
  stopPrice?: number;
};

export type TradovateOrderPreview = {
  adapterId: string;
  endpoint: "/order/placeOrder" | "/order/placeOSO";
  usesBrackets: boolean;
  accountSpecHint: string;
  body: Record<string, unknown>;
  notes: string[];
  failureReasons: string[];
};

export type TradovateSubmitResult = {
  adapterId: string;
  routeProfileId: string;
  accountId: string;
  signalId: string;
  endpoint: "/order/placeOrder" | "/order/placeOSO";
  selectedEnvironment: FuturesEnvironment;
  binding: TradovateRouteBinding;
  requestBody: Record<string, unknown>;
  responseStatus: number;
  ok: boolean;
  brokerAccepted: boolean;
  failureReason: string | null;
  failureText: string | null;
  operatorVerdict: string;
  operatorMessage: string;
  responseBody: Record<string, unknown> | null;
  submittedAt: string;
};

export type TradovateControlResult = {
  adapterId: string;
  action: "cancel_order" | "liquidate_position";
  selectedEnvironment: FuturesEnvironment;
  targetId: string;
  requestBody: Record<string, unknown>;
  responseStatus: number;
  ok: boolean;
  brokerAccepted: boolean;
  failureReason: string | null;
  failureText: string | null;
  operatorVerdict: string;
  operatorMessage: string;
  binding: {
    managedAccountId: string | null;
    managedAccountLabel: string | null;
    managedRouteLabel: string | null;
    managedRiskProfileLabel: string | null;
    brokerAccountRef: string | null;
  };
  responseBody: Record<string, unknown> | null;
  occurredAt: string;
};

export function futuresToneClasses(tone: FuturesConnectorTone) {
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
