"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRightLeft,
  BadgeCheck,
  CandlestickChart,
  Cable,
  CheckCircle2,
  Database,
  GitBranch,
  Network,
  RadioTower,
  ShieldCheck,
  Split,
  Wallet,
  Waves,
  KeyRound,
  Link2,
} from "lucide-react";
import { SectionCard, MetricCard } from "@/components/automation/AutomationPrimitives";
import {
  futuresToneClasses,
  type FuturesConnectorOverview,
  type FuturesJournalEntry,
  type RithmicGatewayScenario,
} from "@/lib/futuresConnectors";

const errorRows = [
  ["Authentication", "Bad token, expired session, wrong environment, broker permission missing"],
  ["Account mapping", "Unknown account id, wrong routing profile, disabled connector"],
  ["Instrument mapping", "Unsupported symbol, expired contract, rollover mismatch, micro/mini confusion"],
  ["Risk rejection", "Quantity above cap, daily-loss lock, duplicate signal, venue paused"],
  ["Execution", "Rejected order, no market data, stale feed, connection down, protective order failure"],
];

function lifecycleStatusTone(status: "info" | "ready" | "warning" | "error") {
  return status === "info" ? "planned" : status;
}

type LifecycleExecutionHistoryRow = {
  eventType: string | null;
  orderRole: string | null;
  orderId: string | null;
  orderState: string | null;
  qty: number | null;
  price: number | null;
  brokerTimestampMicros: number | null;
};

type LifecycleProtectionOrderRow = {
  orderId: string | null;
  parentOrderId: string | null;
  groupId: string | null;
  role: string | null;
  execType: string | null;
  ordStatus: string | null;
  priceMode: string | null;
  priceValue: number | null;
  leavesQty: number | null;
  cumQty: number | null;
  brokerTimestampMicros: number | null;
};

type LifecycleReconciliationDrift = {
  severity: "ready" | "warning";
  message: string;
};

type LifecycleReconciliationTimelineRow = {
  step: number | null;
  label: string | null;
  primaryOrderState: string | null;
  positionState: string | null;
  workingOrderPresent: boolean | null;
  openPositionQty: number | null;
  reconciliationState: string | null;
  protectionSummary: {
    total: number | null;
    active: number | null;
    filled: number | null;
    cancelled: number | null;
  } | null;
  brokerTimestampMicros: number | null;
};

type LifecycleProtectionTimelineRow = {
  step: number | null;
  role: string | null;
  orderId: string | null;
  parentOrderId: string | null;
  groupId: string | null;
  orderState: string | null;
  execType: string | null;
  qty: number | null;
  priceMode: string | null;
  priceValue: number | null;
  brokerTimestampMicros: number | null;
};

type LifecycleRecoveryPlanRow = {
  step: number | null;
  action: string | null;
  detail: string | null;
  owner: string | null;
  state: string | null;
  brokerTimestampMicros: number | null;
};

function formatLifecycleLabel(value: string | null | undefined, fallback = "n/a") {
  return value ? value.replaceAll("_", " ") : fallback;
}

function formatLifecycleScalar(value: string | number | null | undefined, fallback = "n/a") {
  return value == null || value === "" ? fallback : String(value);
}

function getLifecycleExecutionHistory(payload: Record<string, unknown> | null | undefined): LifecycleExecutionHistoryRow[] {
  if (!payload || !Array.isArray(payload.executionHistory)) {
    return [];
  }

  return payload.executionHistory
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const item = row as Record<string, unknown>;
      return {
        eventType: typeof item.eventType === "string" ? item.eventType : null,
        orderRole: typeof item.orderRole === "string" ? item.orderRole : null,
        orderId: typeof item.orderId === "string" ? item.orderId : null,
        orderState: typeof item.orderState === "string" ? item.orderState : null,
        qty: typeof item.qty === "number" ? item.qty : null,
        price: typeof item.price === "number" ? item.price : null,
        brokerTimestampMicros:
          typeof item.brokerTimestampMicros === "number" ? item.brokerTimestampMicros : null,
      };
    })
    .filter((row): row is LifecycleExecutionHistoryRow => Boolean(row));
}

function getLifecycleProtectionOrders(payload: Record<string, unknown> | null | undefined): LifecycleProtectionOrderRow[] {
  if (!payload || !Array.isArray(payload.protectionOrders)) {
    return [];
  }

  return payload.protectionOrders
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const item = row as Record<string, unknown>;
      return {
        orderId: typeof item.orderId === "string" ? item.orderId : null,
        parentOrderId: typeof item.parentOrderId === "string" ? item.parentOrderId : null,
        groupId: typeof item.groupId === "string" ? item.groupId : null,
        role: typeof item.role === "string" ? item.role : null,
        execType: typeof item.execType === "string" ? item.execType : null,
        ordStatus: typeof item.ordStatus === "string" ? item.ordStatus : null,
        priceMode: typeof item.priceMode === "string" ? item.priceMode : null,
        priceValue: typeof item.priceValue === "number" ? item.priceValue : null,
        leavesQty: typeof item.leavesQty === "number" ? item.leavesQty : null,
        cumQty: typeof item.cumQty === "number" ? item.cumQty : null,
        brokerTimestampMicros:
          typeof item.brokerTimestampMicros === "number" ? item.brokerTimestampMicros : null,
      };
    })
    .filter((row): row is LifecycleProtectionOrderRow => Boolean(row));
}

function getLifecycleReconciliationTimeline(
  payload: Record<string, unknown> | null | undefined
): LifecycleReconciliationTimelineRow[] {
  if (!payload || !Array.isArray(payload.reconciliationTimeline)) {
    return [];
  }

  return payload.reconciliationTimeline
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const item = row as Record<string, unknown>;
      const protectionSummary =
        item.protectionSummary && typeof item.protectionSummary === "object"
          ? (item.protectionSummary as Record<string, unknown>)
          : null;

      return {
        step: typeof item.step === "number" ? item.step : null,
        label: typeof item.label === "string" ? item.label : null,
        primaryOrderState:
          typeof item.primaryOrderState === "string" ? item.primaryOrderState : null,
        positionState: typeof item.positionState === "string" ? item.positionState : null,
        workingOrderPresent:
          typeof item.workingOrderPresent === "boolean" ? item.workingOrderPresent : null,
        openPositionQty:
          typeof item.openPositionQty === "number" ? item.openPositionQty : null,
        reconciliationState:
          typeof item.reconciliationState === "string" ? item.reconciliationState : null,
        protectionSummary: protectionSummary
          ? {
              total: typeof protectionSummary.total === "number" ? protectionSummary.total : null,
              active: typeof protectionSummary.active === "number" ? protectionSummary.active : null,
              filled: typeof protectionSummary.filled === "number" ? protectionSummary.filled : null,
              cancelled:
                typeof protectionSummary.cancelled === "number"
                  ? protectionSummary.cancelled
                  : null,
            }
          : null,
        brokerTimestampMicros:
          typeof item.brokerTimestampMicros === "number" ? item.brokerTimestampMicros : null,
      };
    })
    .filter((row): row is LifecycleReconciliationTimelineRow => Boolean(row));
}

function getLifecycleProtectionTimeline(
  payload: Record<string, unknown> | null | undefined
): LifecycleProtectionTimelineRow[] {
  if (!payload || !Array.isArray(payload.protectionTimeline)) {
    return [];
  }

  return payload.protectionTimeline
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const item = row as Record<string, unknown>;
      return {
        step: typeof item.step === "number" ? item.step : null,
        role: typeof item.role === "string" ? item.role : null,
        orderId: typeof item.orderId === "string" ? item.orderId : null,
        parentOrderId: typeof item.parentOrderId === "string" ? item.parentOrderId : null,
        groupId: typeof item.groupId === "string" ? item.groupId : null,
        orderState: typeof item.orderState === "string" ? item.orderState : null,
        execType: typeof item.execType === "string" ? item.execType : null,
        qty: typeof item.qty === "number" ? item.qty : null,
        priceMode: typeof item.priceMode === "string" ? item.priceMode : null,
        priceValue: typeof item.priceValue === "number" ? item.priceValue : null,
        brokerTimestampMicros:
          typeof item.brokerTimestampMicros === "number" ? item.brokerTimestampMicros : null,
      };
    })
    .filter((row): row is LifecycleProtectionTimelineRow => Boolean(row));
}

function getLifecycleReconciliationDrift(args: {
  payload: Record<string, unknown> | null | undefined;
  protectionOrders: LifecycleProtectionOrderRow[];
}): LifecycleReconciliationDrift[] {
  const { payload, protectionOrders } = args;
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload.reconciliationWarnings)) {
    const warnings = payload.reconciliationWarnings
      .map((item) => (typeof item === "string" ? item : null))
      .filter((item): item is string => Boolean(item));
    const verdict =
      typeof payload.reconciliationVerdict === "string" ? payload.reconciliationVerdict : null;

    if (warnings.length) {
      return warnings.map((message) => ({
        severity: "warning" as const,
        message,
      }));
    }

    if (verdict === "aligned") {
      return [
        {
          severity: "ready",
          message:
            "Server-side reconciliation reports the current order, protection, and position state as aligned.",
        },
      ];
    }
  }

  const primaryOrderState =
    typeof payload.primaryOrderState === "string" ? payload.primaryOrderState : null;
  const reconciliationState =
    typeof payload.reconciliationState === "string" ? payload.reconciliationState : null;
  const positionState = typeof payload.positionState === "string" ? payload.positionState : null;
  const openPositionQty =
    typeof payload.openPositionQty === "number" ? payload.openPositionQty : null;
  const workingOrderPresent =
    typeof payload.workingOrderPresent === "boolean" ? payload.workingOrderPresent : null;
  const protectionConfig =
    payload.protection && typeof payload.protection === "object"
      ? (payload.protection as Record<string, unknown>)
      : null;
  const bracketEnabled =
    protectionConfig && typeof protectionConfig.bracketEnabled === "boolean"
      ? protectionConfig.bracketEnabled
      : false;

  const activeProtectionOrders = protectionOrders.filter((row) =>
    row.ordStatus === "working" || row.ordStatus === "new"
  );
  const drift: LifecycleReconciliationDrift[] = [];

  if (
    reconciliationState === "manual_review_required" ||
    reconciliationState === "transport_retry_required"
  ) {
    drift.push({
      severity: "warning",
      message: `Reconciliation is still open: ${formatLifecycleLabel(reconciliationState)}.`,
    });
  }

  if (
    (positionState === "open" || positionState === "open_partial") &&
    openPositionQty != null &&
    openPositionQty > 0 &&
    bracketEnabled &&
    activeProtectionOrders.length === 0
  ) {
    drift.push({
      severity: "warning",
      message: "Open position is visible, but no active protection legs are present.",
    });
  }

  if (
    (primaryOrderState === "working" || primaryOrderState === "partially_filled") &&
    workingOrderPresent === false
  ) {
    drift.push({
      severity: "warning",
      message: "Primary order still reads as working, but reconciliation says no working order is present.",
    });
  }

  if (
    (positionState === "flat" || positionState === "flat_after_exit") &&
    workingOrderPresent === true
  ) {
    drift.push({
      severity: "warning",
      message: "Position is flat, but a working order is still present and needs review.",
    });
  }

  if (
    primaryOrderState === "filled" &&
    openPositionQty != null &&
    openPositionQty === 0 &&
    positionState === "flat"
  ) {
    drift.push({
      severity: "warning",
      message: "Entry order is filled but the position is already flat; verify whether an exit lifecycle event was missed.",
    });
  }

  if (!drift.length) {
    drift.push({
      severity: "ready",
      message: "No reconciliation drift detected from the current simulated order, protection, and position state.",
    });
  }

  return drift;
}

function getLifecycleRecoveryPlan(
  payload: Record<string, unknown> | null | undefined
): LifecycleRecoveryPlanRow[] {
  if (!payload || !Array.isArray(payload.recoveryPlan)) {
    return [];
  }

  return payload.recoveryPlan
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const item = row as Record<string, unknown>;
      return {
        step: typeof item.step === "number" ? item.step : null,
        action: typeof item.action === "string" ? item.action : null,
        detail: typeof item.detail === "string" ? item.detail : null,
        owner: typeof item.owner === "string" ? item.owner : null,
        state: typeof item.state === "string" ? item.state : null,
        brokerTimestampMicros:
          typeof item.brokerTimestampMicros === "number" ? item.brokerTimestampMicros : null,
      };
    })
    .filter((row): row is LifecycleRecoveryPlanRow => Boolean(row));
}

export default function ConnectorFuturesPage() {
  const [overview, setOverview] = useState<FuturesConnectorOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [authTesting, setAuthTesting] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [tradovateConnectionBusy, setTradovateConnectionBusy] = useState<"save" | "save_test" | "clear" | null>(null);
  const [tradovateRetailConnectBusy, setTradovateRetailConnectBusy] = useState<"connect" | "clear" | null>(null);
  const [tradovateConnectionMessage, setTradovateConnectionMessage] = useState("");
  const [tradovateConnectionError, setTradovateConnectionError] = useState("");
  const [showTradovateAdvanced, setShowTradovateAdvanced] = useState(false);
  const [tradovateConnectionForm, setTradovateConnectionForm] = useState({
    environment: "demo",
    username: "",
    password: "",
    appId: "",
    appVersion: "1.0.0",
    cid: "",
    secret: "",
    accountIdOverride: "",
    accountNameOverride: "",
  });
  const [submitTesting, setSubmitTesting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [controlBusy, setControlBusy] = useState<string | null>(null);
  const [controlMessage, setControlMessage] = useState("");
  const [controlError, setControlError] = useState("");
  const [managedBindingBusy, setManagedBindingBusy] = useState<string | null>(null);
  const [managedBindingMessage, setManagedBindingMessage] = useState("");
  const [managedBindingError, setManagedBindingError] = useState("");
  const [managedSyncBusy, setManagedSyncBusy] = useState(false);
  const [managedSyncMessage, setManagedSyncMessage] = useState("");
  const [managedSyncError, setManagedSyncError] = useState("");
  const [rithmicSyncBusy, setRithmicSyncBusy] = useState(false);
  const [rithmicSyncMessage, setRithmicSyncMessage] = useState("");
  const [rithmicSyncError, setRithmicSyncError] = useState("");
  const [rithmicPreviewBusy, setRithmicPreviewBusy] = useState(false);
  const [rithmicPreviewMessage, setRithmicPreviewMessage] = useState("");
  const [rithmicPreviewError, setRithmicPreviewError] = useState("");
  const [rithmicSubmitBusy, setRithmicSubmitBusy] = useState(false);
  const [rithmicSubmitMessage, setRithmicSubmitMessage] = useState("");
  const [rithmicSubmitError, setRithmicSubmitError] = useState("");
  const [rithmicDispatchBusy, setRithmicDispatchBusy] = useState(false);
  const [rithmicDispatchMessage, setRithmicDispatchMessage] = useState("");
  const [rithmicDispatchError, setRithmicDispatchError] = useState("");
  const [rithmicTransportBusy, setRithmicTransportBusy] = useState(false);
  const [rithmicTransportMessage, setRithmicTransportMessage] = useState("");
  const [rithmicTransportError, setRithmicTransportError] = useState("");
  const [rithmicProtocolBusy, setRithmicProtocolBusy] = useState(false);
  const [rithmicProtocolMessage, setRithmicProtocolMessage] = useState("");
  const [rithmicProtocolError, setRithmicProtocolError] = useState("");
  const [rithmicProtocolScenario, setRithmicProtocolScenario] = useState<RithmicGatewayScenario>("submitted");
  const [rithmicLifecycleBusy, setRithmicLifecycleBusy] = useState<"replay" | "clear" | null>(null);
  const [rithmicLifecycleMessage, setRithmicLifecycleMessage] = useState("");
  const [rithmicLifecycleError, setRithmicLifecycleError] = useState("");
  const [rithmicStubBusy, setRithmicStubBusy] = useState(false);
  const [rithmicStubMessage, setRithmicStubMessage] = useState("");
  const [rithmicStubError, setRithmicStubError] = useState("");
  const [pageMode, setPageMode] = useState<"workspace" | "diagnostics">("workspace");
  const [journalCategoryFilter, setJournalCategoryFilter] = useState<"all" | FuturesJournalEntry["category"]>("all");
  const [journalVenueFilter, setJournalVenueFilter] = useState<"all" | FuturesJournalEntry["venue"]>("all");
  const [journalStatusFilter, setJournalStatusFilter] = useState<"all" | FuturesJournalEntry["status"]>("all");
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [managedRouteBusy, setManagedRouteBusy] = useState<string | null>(null);
  const [managedRouteMessage, setManagedRouteMessage] = useState("");
  const [managedRouteError, setManagedRouteError] = useState("");
  const [accountRouteSelections, setAccountRouteSelections] = useState<Record<string, string>>({});
  const [accountRiskSelections, setAccountRiskSelections] = useState<Record<string, string>>({});
  const [routeQuantityInputs, setRouteQuantityInputs] = useState<Record<string, string>>({});
  const [tradovateSyncRouteId, setTradovateSyncRouteId] = useState("tradovate-prop-demo");
  const [tradovateSyncRiskId, setTradovateSyncRiskId] = useState("risk-tradovate-prop-demo");
  const [rithmicSyncRouteId, setRithmicSyncRouteId] = useState("rithmic-prop-live");
  const [rithmicSyncRiskId, setRithmicSyncRiskId] = useState("risk-rithmic-prop-live");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/connector/futures", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error || "Failed to load futures connector overview.");
        }
        if (!cancelled) {
          setOverview(json);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError((nextError as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const adapters = overview?.adapters ?? [];
  const accounts = overview?.accounts ?? [];
  const riskProfiles = overview?.riskProfiles ?? [];
  const routingProfiles = overview?.routingProfiles ?? [];
  const sampleSignal = overview?.sampleSignal;
  const tradovateRuntime = overview?.adapterRuntime.find((item) => item.adapterId === "tradovate-direct") ?? null;
  const tradovateConnectionConfig = overview?.tradovateConnectionConfig ?? null;
  const tradovateRetailConnect = overview?.tradovateRetailConnect ?? null;
  const rithmicRuntime = overview?.adapterRuntime.find((item) => item.adapterId === "rithmic-direct") ?? null;
  const tradovateOrderPreview = overview?.tradovateOrderPreview ?? null;
  const tradovateSessionDiscovery = overview?.tradovateSessionDiscovery ?? null;
  const tradovateAccountDiscovery = overview?.tradovateAccountDiscovery ?? null;
  const tradovateBrokerState = overview?.tradovateBrokerState ?? null;
  const tradovateRouteBinding = overview?.tradovateRouteBinding ?? null;
  const tradovateLastSubmit = overview?.tradovateLastSubmit ?? null;
  const tradovateLastControl = overview?.tradovateLastControl ?? null;
  const managedProfileStore = overview?.managedProfileStore ?? null;
  const recentJournal = overview?.recentJournal ?? [];
  const rithmicSessionBlueprint = overview?.rithmicSessionBlueprint ?? null;
  const rithmicAccountDiscovery = overview?.rithmicAccountDiscovery ?? null;
  const rithmicRouteBinding = overview?.rithmicRouteBinding ?? null;
  const rithmicExecutionBlueprint = overview?.rithmicExecutionBlueprint ?? null;
  const rithmicOrderPreview = overview?.rithmicOrderPreview ?? null;
  const rithmicLastSubmitAttempt = overview?.rithmicLastSubmitAttempt ?? null;
  const rithmicLiveSubmitHandoff = overview?.rithmicLiveSubmitHandoff ?? null;
  const rithmicAdapterBoundary = overview?.rithmicAdapterBoundary ?? null;
  const rithmicLastDispatchAttempt = overview?.rithmicLastDispatchAttempt ?? null;
  const rithmicTransportPacket = overview?.rithmicTransportPacket ?? null;
  const rithmicLastTransportAttempt = overview?.rithmicLastTransportAttempt ?? null;
  const rithmicProtocolServiceConfig = overview?.rithmicProtocolServiceConfig ?? null;
  const rithmicLastProtocolServiceAttempt = overview?.rithmicLastProtocolServiceAttempt ?? null;
  const rithmicLatestLifecycleScenario = overview?.rithmicLatestLifecycleScenario ?? null;
  const rithmicSimulatedLifecycle = overview?.rithmicSimulatedLifecycle ?? [];
  const rithmicLastProtocolStubAttempt = overview?.rithmicLastProtocolStubAttempt ?? null;
  const filteredJournal = recentJournal.filter((entry) => {
    if (journalCategoryFilter !== "all" && entry.category !== journalCategoryFilter) return false;
    if (journalVenueFilter !== "all" && entry.venue !== journalVenueFilter) return false;
    if (journalStatusFilter !== "all" && entry.status !== journalStatusFilter) return false;
    return true;
  });
  const selectedJournalEntry =
    filteredJournal.find((entry) => entry.id === selectedJournalId) ?? filteredJournal[0] ?? null;

  useEffect(() => {
    if (!managedProfileStore) return;

    setAccountRouteSelections(
      Object.fromEntries(
        managedProfileStore.accounts.map((account) => [account.id, account.routeProfileIds[0] ?? ""])
      )
    );
    setAccountRiskSelections(
      Object.fromEntries(
        managedProfileStore.accounts.map((account) => [account.id, account.riskProfileId])
      )
    );
    setRouteQuantityInputs(
      Object.fromEntries(
        managedProfileStore.routingProfiles.map((route) => [route.id, String(route.defaultQuantity)])
      )
    );
  }, [managedProfileStore?.updatedAt]);

  useEffect(() => {
    if (!filteredJournal.length) {
      setSelectedJournalId(null);
      return;
    }

    if (!selectedJournalId || !filteredJournal.some((entry) => entry.id === selectedJournalId)) {
      setSelectedJournalId(filteredJournal[0].id);
    }
  }, [filteredJournal, selectedJournalId]);
  const futuresMetrics = [
    {
      icon: CandlestickChart,
      label: "Adapters",
      value: String(adapters.length || 0),
      detail: "Tradovate and Rithmic are the real first execution backends.",
    },
    {
      icon: Activity,
      label: "Routing Profiles",
      value: String(routingProfiles.length || 0),
      detail: "Initial venue + environment profiles for real futures order routing.",
    },
    {
      icon: Wallet,
      label: "Accounts",
      value: String(accounts.length || 0),
      detail: "Seeded futures account lanes with venue, environment, and risk binding.",
    },
    {
      icon: ShieldCheck,
      label: "Build First",
      value: overview?.strategicRecommendation.buildFirst ?? "Tradovate",
      detail: "Best direct path for first serious futures automation.",
    },
  ];
  const showDiagnostics = pageMode === "diagnostics";
  const tradovateConnectionTone =
    tradovateRuntime?.authStatus === "auth_ok"
      ? "ready"
      : tradovateRuntime?.authStatus === "missing_config"
        ? "warning"
        : "planned";
  const rithmicConnectionTone =
    (rithmicRuntime?.missingFields.length ?? 0) === 0 ? "ready" : "warning";
  const setupSteps = [
    {
      label: "Connect broker accounts",
      detail: "Sync Tradovate or Rithmic accounts into the workspace so every route and risk choice stays attached to a real lane.",
    },
    {
      label: "Bind route and risk",
      detail: "Choose the correct venue route, default quantity, and guardrails before any test order is allowed through.",
    },
    {
      label: "Verify venue health",
      detail: "Run auth or protocol checks so the connector shows whether the lane is genuinely ready or still blocked by config.",
    },
    {
      label: "Test safely before live flow",
      detail: "Use the Rithmic scenario runner and Tradovate test actions to watch execution truth before wiring real downstream transport.",
    },
  ];
  const managedTradovateAccounts =
    managedProfileStore?.accounts.filter((account) => account.venue === "tradovate") ?? [];
  const tradovateResolvedBindingReady = Boolean(
    tradovateRouteBinding?.managedAccountLabel && tradovateRouteBinding?.resolvedTradovateAccountId
  );
  const tradovateLastSubmitAccepted = Boolean(tradovateLastSubmit?.brokerAccepted);
  const tradovateBrokerLinkStatus = tradovateRetailConnect?.connected
    ? {
        tone: "ready" as const,
        label: "Broker linked",
        detail: `Tradovate is linked as ${tradovateRetailConnect.connectedUserName || "the current user"}.`,
      }
    : tradovateRetailConnect?.oauthConfigured
      ? {
          tone: "planned" as const,
          label: "Ready to connect",
          detail: "The retail broker-connect path is configured on this server. The next step is approving the Tradovate broker link.",
        }
      : tradovateConnectionConfig?.configuredFields.length
        ? {
            tone: "warning" as const,
            label: "Advanced fallback only",
            detail: "Direct API credentials are available for internal testing, but the public retail broker-connect path still needs OAuth setup.",
          }
        : {
            tone: "warning" as const,
            label: "Connect path still needed",
            detail: "This workspace still needs either Tradovate OAuth for retail connect or direct API credentials for internal testing.",
          };
  const tradovateAuthStepStatus =
    tradovateRuntime?.authStatus === "auth_ok"
      ? {
          tone: "ready" as const,
          label: "Login verified",
          detail: tradovateRuntime.lastAuthDetail,
        }
      : tradovateRuntime?.authStatus === "configured"
        ? {
            tone: "planned" as const,
            label: "Ready for test",
            detail: "Connection details are present. Run a login test so the lane can confirm the environment and bearer session.",
          }
        : tradovateRuntime?.authStatus === "auth_failed"
          ? {
              tone: "error" as const,
              label: "Login needs fixing",
              detail: tradovateRuntime.lastAuthDetail,
            }
          : {
              tone: "warning" as const,
              label: "Login not ready",
              detail: tradovateRuntime?.lastAuthDetail || "Broker auth has not been verified yet.",
            };
  const tradovateAccountStepStatus =
    tradovateAccountDiscovery && tradovateAccountDiscovery.accountCount > 0
      ? {
          tone: managedTradovateAccounts.length > 0 ? ("ready" as const) : ("planned" as const),
          label:
            managedTradovateAccounts.length > 0
              ? `${managedTradovateAccounts.length} account${managedTradovateAccounts.length === 1 ? "" : "s"} imported`
              : `${tradovateAccountDiscovery.accountCount} account${tradovateAccountDiscovery.accountCount === 1 ? "" : "s"} discovered`,
          detail:
            managedTradovateAccounts.length > 0
              ? "Tradovate accounts are already in the managed workspace store, ready for route and risk assignment."
              : "Tradovate can see broker accounts. Import them into the workspace so routing uses explicit managed lanes.",
        }
      : {
          tone: "warning" as const,
          label: "Accounts not synced yet",
          detail: "After broker login succeeds, sync Tradovate accounts so the workspace can bind routes and risk to real broker lanes.",
        };
  const tradovateBindingStepStatus = tradovateResolvedBindingReady
    ? {
        tone: "ready" as const,
        label: tradovateRouteBinding?.managedAccountLabel || "Lane bound",
        detail: `Orders currently resolve through ${tradovateRouteBinding?.managedAccountLabel || "the selected managed account"} on ${tradovateRouteBinding?.managedRouteLabel || "the configured route"}.`,
      }
    : {
        tone: managedTradovateAccounts.length > 0 ? ("planned" as const) : ("warning" as const),
        label: managedTradovateAccounts.length > 0 ? "Choose a lane" : "No managed lane yet",
        detail:
          managedTradovateAccounts.length > 0
            ? "Pick the exact managed account, route, and risk profile this connector should use before any live automation is trusted."
            : "Import broker accounts first, then bind the connector to the correct managed lane.",
      };
  const tradovateSafeOrderStepStatus = tradovateLastSubmitAccepted
    ? {
        tone: "ready" as const,
        label: "Safe submit completed",
        detail: tradovateLastSubmit?.operatorMessage || "A safe Tradovate order flow has already been exercised from this workspace.",
      }
    : tradovateResolvedBindingReady && tradovateRuntime?.authStatus === "auth_ok"
      ? {
          tone: "planned" as const,
          label: "Ready for safe test",
          detail: "The broker lane is connected, authenticated, and bound. The next move is a safe test order before any automation is trusted.",
        }
      : {
          tone: "warning" as const,
          label: "Not ready for order test",
          detail: "Finish broker connect, login verification, account sync, and lane binding before sending a safe test order.",
        };
  const tradovateOnboardingSteps = [
    {
      step: "1",
      title: "Connect broker",
      ...tradovateBrokerLinkStatus,
    },
    {
      step: "2",
      title: "Verify login",
      ...tradovateAuthStepStatus,
    },
    {
      step: "3",
      title: "Import accounts",
      ...tradovateAccountStepStatus,
    },
    {
      step: "4",
      title: "Choose lane",
      ...tradovateBindingStepStatus,
    },
    {
      step: "5",
      title: "Send safe test",
      ...tradovateSafeOrderStepStatus,
    },
  ];
  const tradovateSignalSourceSteps = [
    {
      title: "Broker connect first",
      detail: "Tradovate connects the execution account. You do not need TradingView details just to link the broker.",
    },
    {
      title: "TradingView comes later",
      detail: "Only add TradingView when you want webhook alerts to become a signal source for this connected broker lane.",
    },
    {
      title: "Keep the jobs separate",
      detail: "Broker link = account access and routing. Signal source = alert format, webhook, and strategy automation. They should not be mixed in one setup step.",
    },
  ];

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const connectStatus = params.get("tradovateConnect");
    const message = params.get("message");
    if (!connectStatus || !message) {
      return;
    }

    if (connectStatus === "connected") {
      setTradovateConnectionMessage(message);
      setTradovateConnectionError("");
    } else if (connectStatus === "error") {
      setTradovateConnectionError(message);
    }

    params.delete("tradovateConnect");
    params.delete("message");
    const next = params.toString();
    const nextUrl = `${window.location.pathname}${next ? `?${next}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    if (!tradovateConnectionConfig) {
      return;
    }

    setTradovateConnectionForm({
      environment:
        tradovateConnectionConfig.selectedEnvironment === "live"
          ? "live"
          : tradovateConnectionConfig.selectedEnvironment === "staging"
            ? "staging"
            : "demo",
      username: tradovateConnectionConfig.username ?? "",
      password: "",
      appId: tradovateConnectionConfig.appId ?? "",
      appVersion: tradovateConnectionConfig.appVersion ?? "1.0.0",
      cid: tradovateConnectionConfig.cid ?? "",
      secret: "",
      accountIdOverride: tradovateConnectionConfig.accountIdOverride ?? "",
      accountNameOverride: tradovateConnectionConfig.accountNameOverride ?? "",
    });
  }, [
    tradovateConnectionConfig?.selectedEnvironment,
    tradovateConnectionConfig?.username,
    tradovateConnectionConfig?.appId,
    tradovateConnectionConfig?.appVersion,
    tradovateConnectionConfig?.cid,
    tradovateConnectionConfig?.accountIdOverride,
    tradovateConnectionConfig?.accountNameOverride,
    tradovateConnectionConfig?.updatedAt,
  ]);

  const schemaRows = [
    ["Signal source", "kwantify runtime / imported strategy / optional webhook source"],
    ["Payload identity", "strategy id, version id, signal id, venue, account profile, environment"],
    ["Order intent", "symbol, side, contracts, type, tif, stop, target, trailing instructions"],
    ["Risk layer", "max contracts, duplicate lockout, session lock, kill switch, account cap"],
    ["Execution sync", "accepted, rejected, filled, partial, brackets, flat"],
    ["Journal", "every state change written to the futures connector lifecycle log"],
  ];

  async function saveTradovateConnection(runTestAfterSave = false) {
    try {
      setTradovateConnectionBusy(runTestAfterSave ? "save_test" : "save");
      setTradovateConnectionMessage("");
      setTradovateConnectionError("");

      const response = await fetch("/api/connector/futures/tradovate/connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tradovateConnectionForm),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to save the Tradovate connection.");
      }

      setTradovateConnectionMessage(
        `Tradovate connection saved for ${json.config?.username || "configured user"} in ${json.config?.selectedEnvironment || tradovateConnectionForm.environment} mode.`
      );
      await refreshOverview();

      if (runTestAfterSave) {
        await runTradovateAuthTest();
      }
    } catch (nextError) {
      setTradovateConnectionError((nextError as Error).message);
    } finally {
      setTradovateConnectionBusy(null);
    }
  }

  async function startTradovateRetailConnect() {
    try {
      setTradovateRetailConnectBusy("connect");
      setTradovateConnectionMessage("");
      setTradovateConnectionError("");
      if (!tradovateRetailConnect?.oauthConfigured) {
        const missing = tradovateRetailConnect?.missingFields?.length
          ? ` Missing server setup: ${tradovateRetailConnect.missingFields.join(", ")}.`
          : "";
        setTradovateConnectionError(
          `Retail Tradovate broker-connect is not enabled on this server yet.${missing} Use Advanced API Setup for internal testing until the OAuth app is configured.`
        );
        setTradovateRetailConnectBusy(null);
        return;
      }
      window.location.href = "/api/connector/futures/tradovate/oauth/start";
    } catch (nextError) {
      setTradovateConnectionError((nextError as Error).message);
      setTradovateRetailConnectBusy(null);
    }
  }

  async function clearTradovateConnection() {
    try {
      setTradovateConnectionBusy("clear");
      setTradovateConnectionMessage("");
      setTradovateConnectionError("");

      const response = await fetch("/api/connector/futures/tradovate/connection", {
        method: "DELETE",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to clear the saved Tradovate connection.");
      }

      setTradovateConnectionMessage(
        json.config?.source === "env"
          ? "Saved Tradovate connection cleared. This workspace is now falling back to server env credentials."
          : "Saved Tradovate connection cleared from local server storage."
      );
      await refreshOverview();
    } catch (nextError) {
      setTradovateConnectionError((nextError as Error).message);
    } finally {
      setTradovateConnectionBusy(null);
    }
  }

  async function clearTradovateRetailConnect() {
    try {
      setTradovateRetailConnectBusy("clear");
      setTradovateConnectionMessage("");
      setTradovateConnectionError("");

      const response = await fetch("/api/connector/futures/tradovate/oauth/connection", {
        method: "DELETE",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to clear the linked Tradovate broker connection.");
      }

      setTradovateConnectionMessage("Tradovate retail broker connection cleared from this workspace.");
      await refreshOverview();
    } catch (nextError) {
      setTradovateConnectionError((nextError as Error).message);
    } finally {
      setTradovateRetailConnectBusy(null);
    }
  }

  async function runTradovateAuthTest() {
    try {
      setAuthTesting(true);
      setAuthMessage("");
      setAuthError("");

      const response = await fetch("/api/connector/futures/tradovate/test-auth", {
        method: "POST",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.lastAuthDetail || json?.error || "Failed to test Tradovate auth.");
      }

      setAuthMessage(json.lastAuthDetail || "Tradovate auth succeeded.");
      const refreshed = await fetch("/api/connector/futures", { cache: "no-store" });
      const refreshedJson = await refreshed.json();
      if (refreshed.ok) {
        setOverview(refreshedJson);
      }
    } catch (nextError) {
      setAuthError((nextError as Error).message);
      const refreshed = await fetch("/api/connector/futures", { cache: "no-store" }).catch(() => null);
      if (refreshed && refreshed.ok) {
        const refreshedJson = await refreshed.json();
        setOverview(refreshedJson);
      }
    } finally {
      setAuthTesting(false);
    }
  }

  async function runTradovateSampleSubmit() {
    if (!sampleSignal) {
      setSubmitError("No sample futures signal is available to submit.");
      return;
    }

    try {
      setSubmitTesting(true);
      setSubmitMessage("");
      setSubmitError("");

      const response = await fetch("/api/connector/futures/tradovate/submit-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sampleSignal),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to submit Tradovate sample order.");
      }

      setSubmitMessage(
        json.submit?.brokerAccepted
          ? `Tradovate accepted ${json.submit.endpoint} for ${json.submit.signalId}.`
          : `Tradovate responded with ${json.submit?.operatorVerdict || json.submit?.failureReason || "a non-accepted result"}.`
      );

      const refreshed = await fetch("/api/connector/futures", { cache: "no-store" });
      const refreshedJson = await refreshed.json();
      if (refreshed.ok) {
        setOverview(refreshedJson);
      }
    } catch (nextError) {
      setSubmitError((nextError as Error).message);
    } finally {
      setSubmitTesting(false);
    }
  }

  async function refreshOverview() {
    const refreshed = await fetch("/api/connector/futures", { cache: "no-store" });
    const refreshedJson = await refreshed.json();
    if (refreshed.ok) {
      setOverview(refreshedJson);
    }
  }

  async function saveManagedAccountBinding(accountId: string) {
    const routeProfileId = accountRouteSelections[accountId];
    if (!routeProfileId) {
      setManagedBindingError("Select a managed route profile before saving the account binding.");
      return;
    }

    try {
      setManagedBindingBusy(accountId);
      setManagedBindingMessage("");
      setManagedBindingError("");

      const response = await fetch("/api/connector/futures/managed-profiles/account-binding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId,
          routeProfileId,
          riskProfileId: accountRiskSelections[accountId],
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to update the managed futures account binding.");
      }

      setManagedBindingMessage(`Managed futures account ${accountId} now points at ${routeProfileId}.`);
      await refreshOverview();
    } catch (nextError) {
      setManagedBindingError((nextError as Error).message);
    } finally {
      setManagedBindingBusy(null);
    }
  }

  async function saveManagedRouteProfile(routeProfileId: string) {
    const defaultQuantityRaw = routeQuantityInputs[routeProfileId];
    const defaultQuantity = Number(defaultQuantityRaw);

    if (!Number.isFinite(defaultQuantity) || defaultQuantity <= 0) {
      setManagedRouteError("Managed route default quantity must be a positive number.");
      return;
    }

    try {
      setManagedRouteBusy(routeProfileId);
      setManagedRouteMessage("");
      setManagedRouteError("");

      const response = await fetch("/api/connector/futures/managed-profiles/route-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ routeProfileId, defaultQuantity }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to update the managed futures route profile.");
      }

      setManagedRouteMessage(`Managed route ${routeProfileId} now defaults to ${defaultQuantity} contract${defaultQuantity === 1 ? "" : "s"}.`);
      await refreshOverview();
    } catch (nextError) {
      setManagedRouteError((nextError as Error).message);
    } finally {
      setManagedRouteBusy(null);
    }
  }

  async function syncTradovateDiscoveredAccounts() {
    try {
      setManagedSyncBusy(true);
      setManagedSyncMessage("");
      setManagedSyncError("");

      const response = await fetch("/api/connector/futures/managed-profiles/tradovate-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routeProfileId: tradovateSyncRouteId,
          riskProfileId: tradovateSyncRiskId,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to sync Tradovate discovered accounts into the managed store.");
      }

      setManagedSyncMessage(`Imported ${json.result?.importedAccounts ?? 0} Tradovate account${json.result?.importedAccounts === 1 ? "" : "s"} into the managed futures spine.`);
      await refreshOverview();
    } catch (nextError) {
      setManagedSyncError((nextError as Error).message);
    } finally {
      setManagedSyncBusy(false);
    }
  }

  async function syncRithmicDiscoveredAccounts() {
    try {
      setRithmicSyncBusy(true);
      setRithmicSyncMessage("");
      setRithmicSyncError("");

      const response = await fetch("/api/connector/futures/managed-profiles/rithmic-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routeProfileId: rithmicSyncRouteId,
          riskProfileId: rithmicSyncRiskId,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to sync Rithmic discovered accounts into the managed store.");
      }

      setRithmicSyncMessage(`Imported ${json.result?.importedAccounts ?? 0} Rithmic account${json.result?.importedAccounts === 1 ? "" : "s"} into the managed futures spine.`);
      await refreshOverview();
    } catch (nextError) {
      setRithmicSyncError((nextError as Error).message);
    } finally {
      setRithmicSyncBusy(false);
    }
  }

  async function runRithmicPreview() {
    if (!sampleSignal) {
      setRithmicPreviewError("No sample futures signal is available to preview.");
      return;
    }

    try {
      setRithmicPreviewBusy(true);
      setRithmicPreviewMessage("");
      setRithmicPreviewError("");

      const response = await fetch("/api/connector/futures/rithmic/preview-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sampleSignal),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to stage the Rithmic order preview.");
      }

      setRithmicPreviewMessage(
        json.binding?.error
          ? `Rithmic preview staged with a binding warning: ${json.binding.error}`
          : `Rithmic preview staged for ${json.preview?.accountId || "the selected account"} and written into the futures journal.`
      );
      await refreshOverview();
    } catch (nextError) {
      setRithmicPreviewError((nextError as Error).message);
    } finally {
      setRithmicPreviewBusy(false);
    }
  }

  async function runRithmicDispatchAttempt() {
    try {
      setRithmicDispatchBusy(true);
      setRithmicDispatchMessage("");
      setRithmicDispatchError("");

      const response = await fetch("/api/connector/futures/rithmic/stage-dispatch", {
        method: "POST",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to stage the Rithmic adapter dispatch.");
      }

      setRithmicDispatchMessage(
        json.dispatch?.dispatchState === "handoff_blocked"
          ? "Rithmic dispatch staging reached the adapter boundary, but the handoff is still blocked."
          : "Rithmic adapter-boundary dispatch was staged and written into the futures journal."
      );
      await refreshOverview();
    } catch (nextError) {
      setRithmicDispatchError((nextError as Error).message);
    } finally {
      setRithmicDispatchBusy(false);
    }
  }

  async function runRithmicTransportAttempt() {
    try {
      setRithmicTransportBusy(true);
      setRithmicTransportMessage("");
      setRithmicTransportError("");

      const response = await fetch("/api/connector/futures/rithmic/stage-transport", {
        method: "POST",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to stage the Rithmic transport packet.");
      }

      setRithmicTransportMessage(
        json.attempt?.transportState === "handoff_blocked"
          ? "Rithmic transport packet is still blocked by unresolved handoff requirements."
          : "Rithmic transport packet was staged successfully and recorded in the futures journal."
      );
      await refreshOverview();
    } catch (nextError) {
      setRithmicTransportError((nextError as Error).message);
    } finally {
      setRithmicTransportBusy(false);
    }
  }

  async function runRithmicProtocolServiceRunner() {
    try {
      setRithmicProtocolBusy(true);
      setRithmicProtocolMessage("");
      setRithmicProtocolError("");

      const response = await fetch("/api/connector/futures/rithmic/run-protocol-service", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scenario: rithmicProtocolScenario }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to run the Rithmic protocol-service runner.");
      }

      const runState = json.attempt?.runState;
      const lifecycleCount = Array.isArray(json.lifecycleEvents) ? json.lifecycleEvents.length : 0;
      setRithmicProtocolMessage(
        runState === "config_blocked"
          ? "Rithmic protocol-service runner is still blocked by configuration."
          : runState === "dry_run_staged"
            ? "Rithmic protocol-service dry run accepted the normalized packet."
            : runState === "live_stubbed"
              ? `Rithmic protocol-service runner returned the ${rithmicProtocolScenario.replaceAll("_", " ")} scenario and emitted ${lifecycleCount} lifecycle events.`
              : "Rithmic protocol-service runner completed with a normalized transport result."
      );
      await refreshOverview();
    } catch (nextError) {
      setRithmicProtocolError((nextError as Error).message);
    } finally {
      setRithmicProtocolBusy(false);
    }
  }

  async function runRithmicProtocolStubRunner() {
    try {
      setRithmicStubBusy(true);
      setRithmicStubMessage("");
      setRithmicStubError("");

      const response = await fetch("/api/connector/futures/rithmic/run-protocol-stub", {
        method: "POST",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to run the local Rithmic protocol stub.");
      }

      setRithmicStubMessage(
        json.result?.runState === "stub_blocked"
          ? "The local protocol stub saw the packet, but the upstream handoff is still blocked."
          : "The local protocol stub accepted the normalized packet contract."
      );
      await refreshOverview();
    } catch (nextError) {
      setRithmicStubError((nextError as Error).message);
    } finally {
      setRithmicStubBusy(false);
    }
  }

  async function replayRithmicLifecycleScenario() {
    try {
      setRithmicLifecycleBusy("replay");
      setRithmicLifecycleMessage("");
      setRithmicLifecycleError("");

      const response = await fetch("/api/connector/futures/rithmic/replay-lifecycle", {
        method: "POST",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to replay the latest Rithmic lifecycle scenario.");
      }

      const replayedScenario =
        typeof json.scenario === "string" ? json.scenario.replaceAll("_", " ") : "latest scenario";
      const lifecycleCount = Array.isArray(json.lifecycleEvents) ? json.lifecycleEvents.length : 0;
      setRithmicLifecycleMessage(
        `Replayed the ${replayedScenario} scenario and emitted ${lifecycleCount} lifecycle event${lifecycleCount === 1 ? "" : "s"}.`
      );
      await refreshOverview();
    } catch (nextError) {
      setRithmicLifecycleError((nextError as Error).message);
    } finally {
      setRithmicLifecycleBusy(null);
    }
  }

  async function clearRithmicLifecycleStream() {
    try {
      setRithmicLifecycleBusy("clear");
      setRithmicLifecycleMessage("");
      setRithmicLifecycleError("");

      const response = await fetch("/api/connector/futures/rithmic/clear-lifecycle", {
        method: "POST",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to clear the Rithmic lifecycle stream.");
      }

      const clearedCount = typeof json.clearedCount === "number" ? json.clearedCount : 0;
      setRithmicLifecycleMessage(
        clearedCount > 0
          ? `Cleared ${clearedCount} simulated lifecycle event${clearedCount === 1 ? "" : "s"} from the stream.`
          : "Lifecycle stream was already empty."
      );
      await refreshOverview();
    } catch (nextError) {
      setRithmicLifecycleError((nextError as Error).message);
    } finally {
      setRithmicLifecycleBusy(null);
    }
  }

  async function runRithmicSubmitAttempt() {
    if (!sampleSignal) {
      setRithmicSubmitError("No sample futures signal is available to stage a Rithmic submit attempt.");
      return;
    }

    try {
      setRithmicSubmitBusy(true);
      setRithmicSubmitMessage("");
      setRithmicSubmitError("");

      const response = await fetch("/api/connector/futures/rithmic/submit-attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sampleSignal),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to stage the Rithmic submit attempt.");
      }

      setRithmicSubmitMessage(json.attempt?.operatorMessage || "Rithmic submit attempt staged.");
      await refreshOverview();
    } catch (nextError) {
      setRithmicSubmitError((nextError as Error).message);
    } finally {
      setRithmicSubmitBusy(false);
    }
  }

  async function runTradovateControl(action: "cancel-order" | "liquidate-position", id: string) {
    try {
      setControlBusy(`${action}:${id}`);
      setControlMessage("");
      setControlError("");

      const response = await fetch(`/api/connector/futures/tradovate/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(action === "cancel-order" ? { orderId: id } : { positionId: id }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || `Failed to run Tradovate ${action}.`);
      }

      setControlMessage(
        json.control?.brokerAccepted
          ? `${action === "cancel-order" ? "Cancel" : "Flatten"} accepted for ${id}.`
          : `${action === "cancel-order" ? "Cancel" : "Flatten"} returned ${json.control?.operatorVerdict || json.control?.failureReason || "a non-accepted result"}.`
      );
      await refreshOverview();
    } catch (nextError) {
      setControlError((nextError as Error).message);
    } finally {
      setControlBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Workspace"
        title="Futures Connector Desk"
        action={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              onClick={() => setPageMode("workspace")}
              className={`rounded-full border px-4 py-2 text-[12px] font-semibold transition ${
                pageMode === "workspace"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              Operator
            </button>
            <button
              type="button"
              onClick={() => setPageMode("diagnostics")}
              className={`rounded-full border px-4 py-2 text-[12px] font-semibold transition ${
                pageMode === "diagnostics"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              Advanced
            </button>
          </div>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface/60 p-5">
              <div className="text-[22px] font-semibold text-foreground">Connect accounts, verify readiness, then test the lane safely.</div>
              <div className="mt-2 max-w-3xl text-[13px] leading-6 text-muted">
                Start with account setup, save the route you want this bridge to use, then run safe tests before trusting live order flow. Diagnostics stays here when we need to go deeper, but the default view is built for day-to-day operator use.
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  `Managed accounts: ${managedProfileStore?.accounts.length ?? accounts.length}`,
                  `Routes: ${managedProfileStore?.routingProfiles.length ?? routingProfiles.length}`,
                  `Tradovate accounts: ${tradovateAccountDiscovery?.accountCount ?? 0}`,
                  `Latest lifecycle events: ${rithmicSimulatedLifecycle.length}`,
                ].map((pill) => (
                  <span key={pill} className="rounded-full border border-border bg-panel px-3 py-1.5 text-[11px] text-muted">
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  <Cable className="h-4 w-4 text-primary" />
                  Tradovate
                </div>
                <div className={`mt-3 text-[18px] font-semibold ${futuresToneClasses(tradovateConnectionTone)}`}>
                  {tradovateRuntime?.authStatus ? formatLifecycleLabel(tradovateRuntime.authStatus) : "not checked yet"}
                </div>
                <div className="mt-2 text-[12px] text-muted">
                  {tradovateRuntime?.lastAuthDetail ||
                    "Best first direct futures lane. Connect, sync accounts, then verify auth before using sample submit or live order controls."}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void runTradovateAuthTest()}
                    disabled={authTesting}
                    className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[12px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {authTesting ? "Testing..." : "Test Login"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void syncTradovateDiscoveredAccounts()}
                    disabled={managedSyncBusy}
                    className="rounded-full border border-border bg-panel px-4 py-2 text-[12px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {managedSyncBusy ? "Syncing..." : "Sync Accounts"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  <RadioTower className="h-4 w-4 text-primary" />
                  Rithmic
                </div>
                <div className={`mt-3 text-[18px] font-semibold ${futuresToneClasses(rithmicConnectionTone)}`}>
                  {(rithmicRuntime?.missingFields.length ?? 0) === 0 ? "connector ready for tests" : "setup still needed"}
                </div>
                <div className="mt-2 text-[12px] text-muted">
                  {rithmicRuntime?.lastAuthDetail ||
                    "Professional second futures lane. Use account sync, route binding, and the scenario runner to harden the operator flow before real downstream wiring."}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void syncRithmicDiscoveredAccounts()}
                    disabled={rithmicSyncBusy}
                    className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[12px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {rithmicSyncBusy ? "Syncing..." : "Sync Accounts"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void runRithmicProtocolServiceRunner()}
                    disabled={rithmicProtocolBusy}
                    className="rounded-full border border-border bg-panel px-4 py-2 text-[12px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {rithmicProtocolBusy ? "Running..." : "Run Scenario"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Recommended Setup Flow</div>
              <div className="mt-3 space-y-3">
                {setupSteps.map((step, index) => (
                  <div key={step.label} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-3">
                    <div className="text-[12px] font-semibold text-foreground">
                      {index + 1}. {step.label}
                    </div>
                    <div className="mt-1 text-[12px] text-muted">{step.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">View Mode</div>
              <div className="mt-3 space-y-2 text-[12px] text-muted">
                <div className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2">
                  <span className="font-semibold text-foreground">Operator View:</span> account setup, venue health, safe tests, live broker state, and lifecycle monitoring.
                </div>
                <div className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2">
                  <span className="font-semibold text-foreground">Advanced:</span> contract blueprints, transport packets, handoff envelopes, and deeper execution internals.
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {futuresMetrics.map((metric) => (
          <MetricCard
            key={metric.label}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
          />
        ))}
      </div>

      <SectionCard eyebrow="Setup" title="Broker Accounts and Routing">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Workspace Status</div>
              {managedProfileStore ? (
                <>
                  <div className="mt-3 text-[14px] font-semibold text-sky-300">local persisted spine active</div>
                  <div className="mt-2 text-[12px] text-muted">
                    Accounts, routes, and risk bindings are saved into one workspace store so setup survives reloads and repeated test runs.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Kind: ${managedProfileStore.descriptor.kind.replaceAll("_", " ")}`,
                      `Routes: ${managedProfileStore.routingProfiles.length}`,
                      `Accounts: ${managedProfileStore.accounts.length}`,
                      `Updated: ${new Date(managedProfileStore.updatedAt).toLocaleString()}`,
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                    {managedProfileStore.descriptor.location}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">Managed futures profile storage is not available yet.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">What This Workspace Controls</div>
              <div className="mt-3 space-y-2">
                {(managedProfileStore?.notes ?? []).map((note) => (
                  <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            {managedBindingMessage ? (
              <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                {managedBindingMessage}
              </div>
            ) : null}
            {managedBindingError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {managedBindingError}
              </div>
            ) : null}
            {managedRouteMessage ? (
              <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                {managedRouteMessage}
              </div>
            ) : null}
            {managedRouteError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {managedRouteError}
              </div>
            ) : null}
            {managedSyncMessage ? (
              <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                {managedSyncMessage}
              </div>
            ) : null}
            {managedSyncError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {managedSyncError}
              </div>
            ) : null}
            {rithmicSyncMessage ? (
              <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                {rithmicSyncMessage}
              </div>
            ) : null}
            {rithmicSyncError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {rithmicSyncError}
              </div>
            ) : null}

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Import Tradovate Accounts</div>
              <div className="mt-2 text-[12px] text-muted">
                After broker login succeeds, import the discovered Tradovate accounts into the managed workspace so this connector uses explicit account, route, and risk bindings.
              </div>
              <div className="mt-3 grid gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Default route for imported accounts</div>
                <select
                  value={tradovateSyncRouteId}
                  onChange={(event) => setTradovateSyncRouteId(event.target.value)}
                  className="h-10 rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                >
                  {(managedProfileStore?.routingProfiles ?? [])
                    .filter((route) => route.venue === "tradovate")
                    .map((route) => (
                      <option key={route.id} value={route.id}>
                      {route.label}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Default risk profile</div>
                <select
                  value={tradovateSyncRiskId}
                  onChange={(event) => setTradovateSyncRiskId(event.target.value)}
                  className="h-10 rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                >
                  {riskProfiles.map((risk) => (
                    <option key={risk.id} value={risk.id}>
                      {risk.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void syncTradovateDiscoveredAccounts()}
                  disabled={managedSyncBusy}
                  className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[12px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {managedSyncBusy ? "Syncing..." : "Sync Tradovate Accounts"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Add Rithmic Accounts</div>
              <div className="mt-3 grid gap-2">
                <select
                  value={rithmicSyncRouteId}
                  onChange={(event) => setRithmicSyncRouteId(event.target.value)}
                  className="h-10 rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                >
                  {(managedProfileStore?.routingProfiles ?? [])
                    .filter((route) => route.venue === "rithmic")
                    .map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.label}
                      </option>
                    ))}
                </select>
                <select
                  value={rithmicSyncRiskId}
                  onChange={(event) => setRithmicSyncRiskId(event.target.value)}
                  className="h-10 rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                >
                  {riskProfiles
                    .filter((risk) => risk.id.includes("rithmic"))
                    .map((risk) => (
                      <option key={risk.id} value={risk.id}>
                        {risk.label}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => void syncRithmicDiscoveredAccounts()}
                  disabled={rithmicSyncBusy}
                  className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[12px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {rithmicSyncBusy ? "Syncing..." : "Sync Rithmic Accounts"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Recent Changes</div>
              <div className="mt-3 space-y-2">
                {(managedProfileStore?.auditTrail ?? []).length ? (
                  managedProfileStore!.auditTrail.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                      <div className="font-medium text-foreground">{entry.detail}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">
                        {entry.kind.replaceAll("_", " ")} · {new Date(entry.occurredAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    No managed futures config changes have been recorded yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Recent Activity</div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <select
                  value={journalCategoryFilter}
                  onChange={(event) => setJournalCategoryFilter(event.target.value as "all" | FuturesJournalEntry["category"])}
                  className="h-10 rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                >
                  <option value="all">All categories</option>
                  <option value="config">Config</option>
                  <option value="sync">Sync</option>
                  <option value="signal">Signal</option>
                  <option value="execution">Execution</option>
                  <option value="control">Control</option>
                </select>
                <select
                  value={journalVenueFilter}
                  onChange={(event) => setJournalVenueFilter(event.target.value as "all" | FuturesJournalEntry["venue"])}
                  className="h-10 rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                >
                  <option value="all">All venues</option>
                  <option value="system">System</option>
                  <option value="tradovate">Tradovate</option>
                  <option value="rithmic">Rithmic</option>
                  <option value="cqg">CQG</option>
                </select>
                <select
                  value={journalStatusFilter}
                  onChange={(event) => setJournalStatusFilter(event.target.value as "all" | FuturesJournalEntry["status"])}
                  className="h-10 rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="info">Info</option>
                  <option value="ready">Ready</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div className="mt-3 grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-2">
                  {filteredJournal.length ? (
                    filteredJournal.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedJournalId(entry.id)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          selectedJournalEntry?.id === entry.id
                            ? "border-primary/40 bg-primary/10"
                            : "border-border/70 bg-panel/70 hover:border-border"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-[13px] font-medium text-foreground">{entry.title}</div>
                            <div className="mt-1 line-clamp-2 text-[12px] text-muted">{entry.detail}</div>
                          </div>
                          <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${futuresToneClasses(
                            entry.status === "error"
                              ? "error"
                              : entry.status === "warning"
                                ? "warning"
                                : "ready"
                          )}`}>
                            {entry.status}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            `Category: ${entry.category}`,
                            `Venue: ${entry.venue}`,
                            new Date(entry.occurredAt).toLocaleString(),
                          ].map((pill) => (
                            <span key={`${entry.id}-${pill}`} className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] text-muted">
                              {pill}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-panel/40 px-3 py-4 text-[12px] text-muted">
                      No futures journal entries match the current filters.
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border/70 bg-panel/70 p-4">
                  {selectedJournalEntry ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-[14px] font-semibold text-foreground">{selectedJournalEntry.title}</div>
                            <div className="mt-1 text-[12px] text-muted">{selectedJournalEntry.detail}</div>
                          </div>
                          <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${futuresToneClasses(
                            selectedJournalEntry.status === "error"
                              ? "error"
                              : selectedJournalEntry.status === "warning"
                                ? "warning"
                                : "ready"
                          )}`}>
                            {selectedJournalEntry.status}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            `Category: ${selectedJournalEntry.category}`,
                            `Venue: ${selectedJournalEntry.venue}`,
                            `Account: ${selectedJournalEntry.accountId || "n/a"}`,
                            `Route: ${selectedJournalEntry.routeProfileId || "n/a"}`,
                            `Signal: ${selectedJournalEntry.signalId || "n/a"}`,
                            new Date(selectedJournalEntry.occurredAt).toLocaleString(),
                          ].map((pill) => (
                            <span key={`${selectedJournalEntry.id}-${pill}`} className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] text-muted">
                              {pill}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <div>
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Request</div>
                          <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-3 text-[11px] leading-6 text-foreground">
                            {JSON.stringify(selectedJournalEntry.requestBody ?? {}, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Response</div>
                          <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-3 text-[11px] leading-6 text-foreground">
                            {JSON.stringify(selectedJournalEntry.responseBody ?? {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[12px] text-muted">Select a journal entry to inspect the full request and response payloads.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {(managedProfileStore?.routingProfiles ?? []).map((route) => (
              <div key={route.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[13px] font-semibold text-foreground">{route.label}</div>
                <div className="mt-1 text-[12px] text-muted">
                  {route.venue} · {route.environment} · qty {route.defaultQuantity} · {route.quantityMode.replaceAll("_", " ")}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    `Orders: ${route.allowedOrderTypes.length}`,
                    `TIF: ${route.allowedTif.length}`,
                    route.supportsBrackets ? "Brackets on" : "Brackets off",
                    route.supportsTrailing ? "Trailing on" : "Trailing off",
                  ].map((pill) => (
                    <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                      {pill}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    value={routeQuantityInputs[route.id] ?? ""}
                    onChange={(event) =>
                      setRouteQuantityInputs((current) => ({
                        ...current,
                        [route.id]: event.target.value,
                      }))
                    }
                    className="h-10 w-24 rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    onClick={() => void saveManagedRouteProfile(route.id)}
                    disabled={managedRouteBusy === route.id}
                    className="rounded-full border border-border bg-panel px-3 py-2 text-[11px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {managedRouteBusy === route.id ? "Saving..." : "Save Qty"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(managedProfileStore?.accounts ?? []).map((account) => {
            const venueRoutes = (managedProfileStore?.routingProfiles ?? []).filter((route) => route.venue === account.venue);
            return (
              <div key={account.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[13px] font-semibold text-foreground">{account.label}</div>
                <div className="mt-1 text-[12px] text-muted">
                  {account.venue} · {account.environment} · {account.platformAccess}
                </div>
                <div className="mt-3">
                  <select
                    value={accountRouteSelections[account.id] ?? ""}
                    onChange={(event) =>
                      setAccountRouteSelections((current) => ({
                        ...current,
                        [account.id]: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                  >
                    <option value="">Select route</option>
                    {venueRoutes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3">
                  <select
                    value={accountRiskSelections[account.id] ?? account.riskProfileId}
                    onChange={(event) =>
                      setAccountRiskSelections((current) => ({
                        ...current,
                        [account.id]: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                  >
                    {riskProfiles.map((risk) => (
                      <option key={risk.id} value={risk.id}>
                        {risk.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-muted">Current risk: {account.riskProfileId}</div>
                  <button
                    type="button"
                    onClick={() => void saveManagedAccountBinding(account.id)}
                    disabled={managedBindingBusy === account.id}
                    className="rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {managedBindingBusy === account.id ? "Saving..." : "Save Binding"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {showDiagnostics ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard eyebrow="Futures" title="Execution Venue Lanes">
          <div className="space-y-3">
            {adapters.map((card) => (
              <div key={card.name} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[14px] font-semibold text-foreground">{card.name}</div>
                    <div className="mt-1 text-[12px] text-muted">{card.rationale}</div>
                  </div>
                  <span className="rounded-full border border-border bg-panel px-3 py-1 text-[11px] font-medium text-primary">
                    {card.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {card.capabilities.slice(0, 5).map((bullet) => (
                    <span key={bullet} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                      {bullet.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-muted">
                  Access: {card.accessModel.replaceAll("_", " ")}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

          <SectionCard eyebrow="Flow" title="Connector Lifecycle">
          <div className="grid gap-3">
            {[
              { icon: Cable, title: "Signal Intake", detail: "Native kwantify signal or imported external payload arrives in a normalized inbox." },
              { icon: Split, title: "Routing Policy", detail: "Connector resolves destination venue, account profile, symbol map, sizing mode, and risk rules." },
              { icon: ArrowRightLeft, title: "Order Dispatch", detail: "Tradovate or future Rithmic adapter sends the order and receives acknowledgement." },
              { icon: RadioTower, title: "Execution Sync", detail: "Accept / reject / fill / bracket attach / flat lifecycle updates stream back into kwantify." },
              { icon: Database, title: "Journal Truth", detail: "Every connector event is written into audit logs so the operator can review what happened." },
            ].map((step) => (
              <div key={step.title} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-center gap-2 text-muted">
                  <step.icon className="h-4 w-4 text-primary" />
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em]">{step.title}</div>
                </div>
                <div className="mt-3 text-[13px] text-foreground">{step.detail}</div>
              </div>
            ))}
          </div>
          </SectionCard>
        </div>
      ) : null}

      <SectionCard
        eyebrow="Tradovate"
        title="Tradovate Connection"
        action={
          <button
            type="button"
            onClick={() => void runTradovateAuthTest()}
            disabled={authTesting}
            className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[12px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authTesting ? "Testing..." : "Test Broker Login"}
          </button>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-border bg-surface/60 p-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Runtime Status</div>
            {tradovateRuntime ? (
              <>
                <div className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                  tradovateRuntime.authStatus === "auth_ok"
                    ? "ready"
                    : tradovateRuntime.authStatus === "configured"
                      ? "planned"
                      : tradovateRuntime.authStatus === "missing_config"
                        ? "warning"
                        : "error"
                )}`}>
                  {tradovateRuntime.authStatus.replaceAll("_", " ")}
                </div>
                <div className="mt-2 text-[12px] text-muted">{tradovateRuntime.lastAuthDetail}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    `Env: ${tradovateRuntime.selectedEnvironment}`,
                    `Configured: ${tradovateRuntime.configuredFields.length}`,
                    `Missing: ${tradovateRuntime.missingFields.length}`,
                    tradovateRuntime.lastAuthTestAt
                      ? `Last test: ${new Date(tradovateRuntime.lastAuthTestAt).toLocaleString()}`
                      : "Last test: never",
                  ].map((pill) => (
                    <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                      {pill}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-3 text-[12px] text-muted">No Tradovate runtime status is available yet.</div>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Retail Broker Connect</div>
                  <div className="mt-2 text-[12px] text-muted">
                    This is the paid-product path we actually want: connect Tradovate like a broker integration, sync accounts, bind route and risk, then test before going live.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    `Mode: OAuth / vendor`,
                    `Configured: ${tradovateRetailConnect?.oauthConfigured ? "yes" : "not yet"}`,
                    `Linked: ${tradovateRetailConnect?.connected ? "yes" : "no"}`,
                  ].map((pill) => (
                    <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                      {pill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-border/70 bg-panel/70 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    <Link2 className="h-4 w-4 text-primary" />
                    What This Connects
                  </div>
                  <div className="mt-3 space-y-2 text-[12px] text-muted">
                    <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                      <span className="font-semibold text-foreground">Broker link:</span> this connects Tradovate to kwantify. It is separate from TradingView alerts.
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                      <span className="font-semibold text-foreground">After connect:</span> we sync Tradovate accounts, let you choose the exact lane, then send a safe test order before automation.
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                      <span className="font-semibold text-foreground">If OAuth is not enabled yet:</span> the advanced API lane below is still available for internal testing while we finish the public broker-connect path.
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-panel/70 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Retail Connect Status</div>
                  <div className="mt-3 space-y-2 text-[12px] text-muted">
                    <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                      <span className="font-semibold text-foreground">Environment:</span> {tradovateRetailConnect?.selectedEnvironment || "live"}
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                      <span className="font-semibold text-foreground">Linked user:</span> {tradovateRetailConnect?.connectedUserName || "not linked yet"}
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                      <span className="font-semibold text-foreground">Missing setup:</span>{" "}
                      {tradovateRetailConnect?.missingFields.length ? tradovateRetailConnect.missingFields.join(", ") : "none"}
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                      <span className="font-semibold text-foreground">Token expiry:</span>{" "}
                      {tradovateRetailConnect?.tokenExpiresAt
                        ? new Date(tradovateRetailConnect.tokenExpiresAt).toLocaleString()
                        : "not linked yet"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void startTradovateRetailConnect()}
                  disabled={tradovateRetailConnectBusy !== null}
                  className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[12px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {tradovateRetailConnectBusy === "connect" ? "Redirecting..." : "Connect Tradovate"}
                </button>
                <button
                  type="button"
                  onClick={() => void clearTradovateRetailConnect()}
                  disabled={tradovateRetailConnectBusy !== null || !tradovateRetailConnect?.connected}
                  className="rounded-full border border-danger/30 bg-danger/10 px-4 py-2 text-[12px] font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {tradovateRetailConnectBusy === "clear" ? "Clearing..." : "Disconnect Broker"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTradovateAdvanced((current) => !current)}
                  className="rounded-full border border-border bg-panel px-4 py-2 text-[12px] font-semibold text-foreground"
                >
                  {showTradovateAdvanced ? "Hide Advanced API Setup" : "Show Advanced API Setup"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                {tradovateRetailConnect?.oauthConfigured
                  ? "Retail broker-connect is configured on this server. When you click Connect Tradovate, kwantify can redirect you into Tradovate's OAuth flow."
                  : "Retail broker-connect still needs Tradovate OAuth app credentials on the server. Until that is configured, use the Advanced API Setup lane below for internal testing only."}
              </div>

              {showTradovateAdvanced ? (
              <div className="mt-4 rounded-2xl border border-border/70 bg-panel/50 p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Advanced Direct API Setup
                </div>
                <div className="mt-2 text-[12px] text-muted">
                  This is the internal fallback lane. It uses direct Tradovate API credentials instead of the public retail broker-connect flow.
                </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Environment</div>
                  <select
                    value={tradovateConnectionForm.environment}
                    onChange={(event) =>
                      setTradovateConnectionForm((current) => ({
                        ...current,
                        environment: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                  >
                    <option value="demo">Demo</option>
                    <option value="live">Live</option>
                    <option value="staging">Staging</option>
                  </select>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Username</div>
                  <input
                    value={tradovateConnectionForm.username}
                    onChange={(event) =>
                      setTradovateConnectionForm((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                    placeholder="Tradovate username"
                  />
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Password</div>
                  <input
                    type="password"
                    value={tradovateConnectionForm.password}
                    onChange={(event) =>
                      setTradovateConnectionForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                    placeholder={
                      tradovateConnectionConfig?.passwordSaved ? "Leave blank to keep saved password" : "Tradovate password"
                    }
                  />
                  <div className="mt-2 text-[11px] text-muted">
                    Use your Tradovate login password or API-dedicated password if you created one.
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">API Key Name (App ID)</div>
                  <input
                    value={tradovateConnectionForm.appId}
                    onChange={(event) =>
                      setTradovateConnectionForm((current) => ({
                        ...current,
                        appId: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                    placeholder="The API key name you created in Tradovate"
                  />
                  <div className="mt-2 text-[11px] text-muted">
                    This is the human-readable API key name Tradovate shows when you create the key.
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">App Version</div>
                  <input
                    value={tradovateConnectionForm.appVersion}
                    onChange={(event) =>
                      setTradovateConnectionForm((current) => ({
                        ...current,
                        appVersion: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                    placeholder="1.0.0"
                  />
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">API Key ID (CID)</div>
                  <input
                    value={tradovateConnectionForm.cid}
                    onChange={(event) =>
                      setTradovateConnectionForm((current) => ({
                        ...current,
                        cid: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                    placeholder="The numeric API key ID from Tradovate"
                  />
                  <div className="mt-2 text-[11px] text-muted">
                    Tradovate calls this the <span className="font-semibold text-foreground">CID</span> in the access-token request.
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">API Key Secret</div>
                  <input
                    type="password"
                    value={tradovateConnectionForm.secret}
                    onChange={(event) =>
                      setTradovateConnectionForm((current) => ({
                        ...current,
                        secret: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                    placeholder={
                      tradovateConnectionConfig?.secretSaved ? "Leave blank to keep saved secret" : "The one-time API key secret from Tradovate"
                    }
                  />
                  <div className="mt-2 text-[11px] text-muted">
                    Tradovate only shows this when the key is created, so store it carefully before closing the broker modal.
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Account ID Override</div>
                  <input
                    value={tradovateConnectionForm.accountIdOverride}
                    onChange={(event) =>
                      setTradovateConnectionForm((current) => ({
                        ...current,
                        accountIdOverride: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                    placeholder="Optional fixed broker account id"
                  />
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Account Name Override</div>
                  <input
                    value={tradovateConnectionForm.accountNameOverride}
                    onChange={(event) =>
                      setTradovateConnectionForm((current) => ({
                        ...current,
                        accountNameOverride: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
                    placeholder="Optional fixed broker account name"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveTradovateConnection(false)}
                  disabled={tradovateConnectionBusy !== null}
                  className="rounded-full border border-border bg-panel px-4 py-2 text-[12px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {tradovateConnectionBusy === "save" ? "Saving..." : "Save Connection"}
                </button>
                <button
                  type="button"
                  onClick={() => void saveTradovateConnection(true)}
                  disabled={tradovateConnectionBusy !== null || authTesting}
                  className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[12px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {tradovateConnectionBusy === "save_test" ? "Saving..." : "Save And Test"}
                </button>
                <button
                  type="button"
                  onClick={() => void clearTradovateConnection()}
                  disabled={
                    tradovateConnectionBusy !== null ||
                    (!tradovateConnectionConfig?.storageLocation &&
                      tradovateConnectionConfig?.source !== "mixed" &&
                      tradovateConnectionConfig?.source !== "local_store")
                  }
                  className="rounded-full border border-danger/30 bg-danger/10 px-4 py-2 text-[12px] font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {tradovateConnectionBusy === "clear" ? "Clearing..." : "Clear Saved Connection"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                {tradovateConnectionConfig?.storageLocation
                  ? `Stored locally on this server at ${tradovateConnectionConfig.storageLocation}. Fine for internal admin setup now; later this should move to encrypted secret storage for public users.`
                  : "No local Tradovate connection file has been saved yet. Env fallback still works if it is already configured on the server."}
              </div>

              <div className="mt-3 rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                Best-practice connect flow: save the Tradovate API details, run auth test, sync accounts, bind the right route and risk profile, then use the safe sample submit before trusting live automation.
              </div>
              </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Tradovate Onboarding Progress</div>
              <div className="mt-3 space-y-3">
                {tradovateOnboardingSteps.map((item) => (
                  <div key={item.step} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[12px] font-semibold text-foreground">
                        {item.step}. {item.title}
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                          item.tone === "ready"
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                            : item.tone === "error"
                              ? "border-danger/30 bg-danger/10 text-danger"
                              : item.tone === "planned"
                                ? "border-sky-400/30 bg-sky-500/10 text-sky-300"
                                : "border-amber-400/30 bg-amber-500/10 text-amber-200"
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                    <div className="mt-2 text-[12px] text-muted">{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Signal Source Setup</div>
              <div className="mt-3 space-y-2 text-[12px] text-muted">
                {tradovateSignalSourceSteps.map((item) => (
                  <div key={item.title} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2">
                    <span className="font-semibold text-foreground">{item.title}:</span> {item.detail}
                  </div>
                ))}
              </div>
            </div>

            {showDiagnostics ? (
              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Expected Environment Variables</div>
                <div className="mt-3 space-y-2 text-[12px] text-muted">
                  {[
                    "TRADOVATE_PARTNER_USERNAME",
                    "TRADOVATE_PARTNER_PASSWORD",
                    "TRADOVATE_PARTNER_APP_ID",
                    "TRADOVATE_PARTNER_CID",
                    "TRADOVATE_PARTNER_SECRET",
                    "TRADOVATE_PARTNER_ENV",
                  ].map((item) => (
                    <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {tradovateConnectionMessage ? (
          <div className="mt-4 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
            {tradovateConnectionMessage}
          </div>
        ) : null}
        {tradovateConnectionError ? (
          <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
            {tradovateConnectionError}
          </div>
        ) : null}
        {authMessage ? (
          <div className="mt-4 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
            {authMessage}
          </div>
        ) : null}
        {authError ? (
          <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
            {authError}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard eyebrow="Rithmic" title="Rithmic Connection">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Runtime Status</div>
              {rithmicRuntime ? (
                <>
                  <div className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                    rithmicRuntime.authStatus === "configured"
                      ? "planned"
                      : rithmicRuntime.authStatus === "missing_config"
                        ? "warning"
                        : "ready"
                  )}`}>
                    {rithmicRuntime.authStatus.replaceAll("_", " ")}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">{rithmicRuntime.lastAuthDetail}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Env: ${rithmicRuntime.selectedEnvironment}`,
                      `Configured: ${rithmicRuntime.configuredFields.length}`,
                      `Missing: ${rithmicRuntime.missingFields.length}`,
                      `Flavor: ${rithmicSessionBlueprint?.preferredFlavor.replaceAll("_", " ") || "protocol api"}`,
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">No Rithmic runtime status is available yet.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Retail Setup Path</div>
              <div className="mt-3 space-y-2">
                {(rithmicSessionBlueprint?.onboardingSteps ?? []).map((step) => (
                  <div key={step} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">What This Lane Is For</div>
              <div className="mt-3 space-y-3">
                {(rithmicSessionBlueprint?.notes ?? []).map((note) => (
                  <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            {showDiagnostics ? (
              <>
                <div className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">API Flavor Choice</div>
                  <div className="mt-3 space-y-3">
                    {(rithmicSessionBlueprint?.flavors ?? []).map((flavor) => (
                      <div key={flavor.key} className="rounded-xl border border-border/70 bg-panel/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[13px] font-semibold text-foreground">{flavor.label}</div>
                            <div className="mt-1 text-[11px] text-muted">
                              {flavor.languageSurface} - {flavor.latencyProfile}
                            </div>
                          </div>
                          <span className={`rounded-full border border-border px-2.5 py-1 text-[11px] ${
                            flavor.key === rithmicSessionBlueprint?.preferredFlavor ? "bg-primary/10 text-primary" : "bg-background/70 text-muted"
                          }`}>
                            {flavor.key === rithmicSessionBlueprint?.preferredFlavor ? "preferred" : "available"}
                          </span>
                        </div>
                        <div className="mt-2 text-[12px] text-muted">{flavor.bestFor}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {flavor.serverSideFeatures.map((feature) => (
                            <span key={feature} className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] text-muted">
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Expected Environment Variables</div>
                  <div className="mt-3 space-y-2 text-[12px] text-muted">
                    {[
                      "RITHMIC_API_FLAVOR",
                      "RITHMIC_ENV",
                      "RITHMIC_USER_ID",
                      "RITHMIC_PASSWORD",
                      "RITHMIC_SYSTEM_NAME",
                      "RITHMIC_APP_NAME",
                      "RITHMIC_APP_VERSION",
                      "RITHMIC_FCM_ID",
                      "RITHMIC_IB_ID",
                    ].map((item) => (
                      <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Rithmic" title="Rithmic Account and Route">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Resolved Runtime Identity</div>
              {rithmicRouteBinding ? (
                <>
                  <div className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(rithmicRouteBinding.error ? "warning" : "ready")}`}>
                    {rithmicRouteBinding.error ? "binding blocked" : "binding scaffold ready"}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">
                    {rithmicRouteBinding.error || `Using ${rithmicRouteBinding.preferredFlavor.replaceAll("_", " ")} against ${rithmicRouteBinding.selectedEnvironment} with system ${rithmicRouteBinding.resolvedSystemName}.`}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Flavor: ${rithmicRouteBinding.preferredFlavor.replaceAll("_", " ")}`,
                      `System: ${rithmicRouteBinding.resolvedSystemName || "n/a"}`,
                      `User: ${rithmicRouteBinding.resolvedUserId || "n/a"}`,
                      `Source: ${rithmicRouteBinding.resolutionSource.replaceAll("_", " ")}`,
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">No Rithmic route binding is available yet.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Account Reference</div>
              <div className="mt-3 rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                {rithmicRouteBinding?.accountReference || "Not resolved yet"}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {[
                  `FCM: ${rithmicRouteBinding?.resolvedFcmId || "n/a"}`,
                  `IB: ${rithmicRouteBinding?.resolvedIbId || "n/a"}`,
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Managed Binding Truth</div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {[
                  `Managed account: ${rithmicRouteBinding?.managedAccountLabel || "n/a"}`,
                  `Managed route: ${rithmicRouteBinding?.managedRouteLabel || "n/a"}`,
                  `Managed risk: ${rithmicRouteBinding?.managedRiskProfileLabel || "n/a"}`,
                  `Broker ref: ${rithmicRouteBinding?.brokerAccountRef || "n/a"}`,
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/60 p-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Binding Notes</div>
            <div className="mt-3 space-y-2">
              {(rithmicRouteBinding?.notes ?? []).map((note) => (
                <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                  {note}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {showDiagnostics ? (
        <>
      <SectionCard eyebrow="Rithmic" title="Account Assumptions">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Inventory Status</div>
              {rithmicAccountDiscovery ? (
                <>
                  <div className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                    rithmicAccountDiscovery.error ? "warning" : "ready"
                  )}`}>
                    {rithmicAccountDiscovery.error ? "partially seeded" : `${rithmicAccountDiscovery.accountCount} account lanes modeled`}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">
                    {rithmicAccountDiscovery.error || "This is the first honest Rithmic account-inventory layer, mixing env-seeded identity with explicit planning lanes for test and paper deployment."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Env: ${rithmicAccountDiscovery.selectedEnvironment}`,
                      `Accounts: ${rithmicAccountDiscovery.accountCount}`,
                      rithmicAccountDiscovery.testedAt
                        ? `Seeded: ${new Date(rithmicAccountDiscovery.testedAt).toLocaleString()}`
                        : "Seeded: not yet",
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">No Rithmic account assumptions are available yet.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Why This Layer Exists</div>
              <div className="mt-3 space-y-2">
                {(rithmicAccountDiscovery?.notes ?? []).map((note) => (
                  <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(rithmicAccountDiscovery?.accounts ?? []).map((account) => (
              <div key={account.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-semibold text-foreground">{account.label}</div>
                    <div className="mt-1 text-[12px] text-muted">
                      {account.environment} · {account.routeMode.replaceAll("_", " ")} · {account.source.replaceAll("_", " ")}
                    </div>
                  </div>
                  <span className="rounded-full border border-border bg-panel px-3 py-1 text-[11px] font-medium text-muted">
                    {account.active == null ? "planned" : account.active ? "active" : "inactive"}
                  </span>
                </div>
                <div className="mt-2 text-[12px] text-muted">{account.firm || "No firm metadata yet."}</div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {[
                    `System: ${account.systemName || "n/a"}`,
                    `User: ${account.userId || "n/a"}`,
                    `FCM: ${account.fcmId || "n/a"}`,
                    `IB: ${account.ibId || "n/a"}`,
                  ].map((item) => (
                    <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Rithmic" title="Execution Journal Blueprint">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Execution Path</div>
              <div className="mt-3 space-y-2">
                {(rithmicExecutionBlueprint?.executionPath ?? []).map((step) => (
                  <div key={step} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {step}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Recovery Guarantees</div>
              <div className="mt-3 space-y-2">
                {(rithmicExecutionBlueprint?.recoveryGuarantees ?? []).map((item) => (
                  <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Required Journal Fields</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(rithmicExecutionBlueprint?.requiredJournalFields ?? []).map((field) => (
                  <span key={field} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(rithmicExecutionBlueprint?.lifecycleSteps ?? []).map((step) => (
              <div key={`${step.stage}:${step.label}`} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-semibold text-foreground">{step.label}</div>
                    <div className="mt-1 text-[12px] text-muted">{step.detail}</div>
                  </div>
                  <span className="rounded-full border border-border bg-panel px-3 py-1 text-[11px] font-medium text-muted">
                    {step.stage.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="mt-3 text-[11px] text-muted">Source of truth: {step.sourceOfTruth}</div>
              </div>
            ))}

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Design Notes</div>
              <div className="mt-3 space-y-2">
                {(rithmicExecutionBlueprint?.notes ?? []).map((note) => (
                  <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Rithmic"
        title="Order Translation Preview"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void runRithmicPreview()}
              disabled={rithmicPreviewBusy || !sampleSignal}
              className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[12px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rithmicPreviewBusy ? "Staging..." : "Stage Rithmic Preview"}
            </button>
            <button
              type="button"
              onClick={() => void runRithmicSubmitAttempt()}
              disabled={rithmicSubmitBusy || !sampleSignal}
              className="rounded-full border border-border bg-panel px-4 py-2 text-[12px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rithmicSubmitBusy ? "Preparing..." : "Stage Submit Attempt"}
            </button>
            <button
              type="button"
              onClick={() => void runRithmicDispatchAttempt()}
              disabled={rithmicDispatchBusy || !rithmicLiveSubmitHandoff}
              className="rounded-full border border-border bg-panel px-4 py-2 text-[12px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rithmicDispatchBusy ? "Dispatching..." : "Stage Adapter Dispatch"}
            </button>
            <button
              type="button"
              onClick={() => void runRithmicTransportAttempt()}
              disabled={rithmicTransportBusy || !rithmicTransportPacket}
              className="rounded-full border border-border bg-panel px-4 py-2 text-[12px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rithmicTransportBusy ? "Transporting..." : "Stage Transport Packet"}
            </button>
            <button
              type="button"
              onClick={() => void runRithmicProtocolServiceRunner()}
              disabled={rithmicProtocolBusy || !rithmicTransportPacket}
              className="rounded-full border border-border bg-panel px-4 py-2 text-[12px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rithmicProtocolBusy ? "Running..." : "Run Protocol Service"}
            </button>
            <button
              type="button"
              onClick={() => void runRithmicProtocolStubRunner()}
              disabled={rithmicStubBusy || !rithmicTransportPacket}
              className="rounded-full border border-border bg-panel px-4 py-2 text-[12px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rithmicStubBusy ? "Testing..." : "Run Local Stub Test"}
            </button>
          </div>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Preview Shape</div>
              {rithmicOrderPreview ? (
                <>
                  <div className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                    rithmicOrderPreview.usesBracketProtection ? "ready" : "planned"
                  )}`}>
                    {rithmicOrderPreview.usesBracketProtection ? "bracket-capable preview" : "base submit preview"}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">
                    {`Flavor ${rithmicOrderPreview.preferredFlavor.replaceAll("_", " ")} on ${rithmicOrderPreview.selectedEnvironment} for ${rithmicOrderPreview.accountReference}.`}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Route: ${rithmicOrderPreview.routeProfileId}`,
                      `Account: ${rithmicOrderPreview.accountId}`,
                      `Brackets: ${rithmicOrderPreview.usesBracketProtection ? "yes" : "no"}`,
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">No Rithmic order preview is available yet.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Managed Binding Used</div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {[
                  `Managed account: ${rithmicOrderPreview?.binding.managedAccountLabel || "n/a"}`,
                  `Managed route: ${rithmicOrderPreview?.binding.managedRouteLabel || "n/a"}`,
                  `Managed risk: ${rithmicOrderPreview?.binding.managedRiskProfileLabel || "n/a"}`,
                  `Broker ref: ${rithmicOrderPreview?.binding.brokerAccountRef || "n/a"}`,
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Execution Notes</div>
              <div className="mt-3 space-y-2">
                {(rithmicOrderPreview?.notes ?? []).map((note) => (
                  <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Expected Reject Classes</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(rithmicOrderPreview?.failureReasons ?? []).map((reason) => (
                  <span key={reason} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                    {reason.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            </div>

            {rithmicPreviewMessage ? (
              <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                {rithmicPreviewMessage}
              </div>
            ) : null}
            {rithmicPreviewError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {rithmicPreviewError}
              </div>
            ) : null}
            {rithmicSubmitMessage ? (
              <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                {rithmicSubmitMessage}
              </div>
            ) : null}
            {rithmicSubmitError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {rithmicSubmitError}
              </div>
            ) : null}
            {rithmicDispatchMessage ? (
              <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                {rithmicDispatchMessage}
              </div>
            ) : null}
            {rithmicDispatchError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {rithmicDispatchError}
              </div>
            ) : null}
            {rithmicTransportMessage ? (
              <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                {rithmicTransportMessage}
              </div>
            ) : null}
            {rithmicTransportError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {rithmicTransportError}
              </div>
            ) : null}
            {rithmicProtocolMessage ? (
              <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                {rithmicProtocolMessage}
              </div>
            ) : null}
            {rithmicProtocolError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {rithmicProtocolError}
              </div>
            ) : null}
            {rithmicStubMessage ? (
              <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                {rithmicStubMessage}
              </div>
            ) : null}
            {rithmicStubError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {rithmicStubError}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-panel/70 p-4">
            <div className="mb-3 text-[12px] text-muted">
              This is the kwantify-side preview envelope for the future Rithmic adapter submit path.
            </div>
            <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
              {JSON.stringify(rithmicOrderPreview?.body ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Rithmic" title="Last Submit Attempt">
        <div className="space-y-3">
          {rithmicLastSubmitAttempt ? (
            <>
              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Attempt Outcome</div>
                <div
                  className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                    rithmicLastSubmitAttempt.submitState === "binding_blocked" ? "warning" : "ready"
                  )}`}
                >
                  {rithmicLastSubmitAttempt.operatorVerdict}
                </div>
                <div className="mt-2 text-[12px] text-muted">{rithmicLastSubmitAttempt.operatorMessage}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    `Signal: ${rithmicLastSubmitAttempt.signalId}`,
                    `Route: ${rithmicLastSubmitAttempt.routeProfileId}`,
                    `Env: ${rithmicLastSubmitAttempt.selectedEnvironment}`,
                    `Flavor: ${rithmicLastSubmitAttempt.preferredFlavor.replaceAll("_", " ")}`,
                    `Submitted: ${new Date(rithmicLastSubmitAttempt.submittedAt).toLocaleString()}`,
                  ].map((pill) => (
                    <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                      {pill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Managed Binding Used</div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {[
                    `Managed account: ${rithmicLastSubmitAttempt.binding.managedAccountLabel || "n/a"}`,
                    `Managed route: ${rithmicLastSubmitAttempt.binding.managedRouteLabel || "n/a"}`,
                    `Managed risk: ${rithmicLastSubmitAttempt.binding.managedRiskProfileLabel || "n/a"}`,
                    `Broker ref: ${rithmicLastSubmitAttempt.binding.brokerAccountRef || "n/a"}`,
                  ].map((item) => (
                    <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-panel/70 p-4">
                <div className="mb-3 text-[12px] text-muted">
                  This is the staged Rithmic submit-attempt envelope that will become the first live adapter handoff contract.
                </div>
                <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
                  {JSON.stringify(rithmicLastSubmitAttempt.requestBody, null, 2)}
                </pre>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
              No Rithmic submit attempt has been staged yet.
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Rithmic" title="Live Submit Handoff">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Handoff Status</div>
              {rithmicLiveSubmitHandoff ? (
                <>
                  <div
                    className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                      rithmicLiveSubmitHandoff.operatorReady ? "ready" : "warning"
                    )}`}
                  >
                    {rithmicLiveSubmitHandoff.operatorReady ? "adapter boundary ready" : "boundary defined, implementation pending"}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">
                    {`Mode ${rithmicLiveSubmitHandoff.handoffMode.replaceAll("_", " ")} for ${rithmicLiveSubmitHandoff.preferredFlavor.replaceAll("_", " ")} in ${rithmicLiveSubmitHandoff.selectedEnvironment}.`}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Flavor: ${rithmicLiveSubmitHandoff.preferredFlavor.replaceAll("_", " ")}`,
                      `Mode: ${rithmicLiveSubmitHandoff.handoffMode.replaceAll("_", " ")}`,
                      `Ready: ${rithmicLiveSubmitHandoff.operatorReady ? "yes" : "no"}`,
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">Stage a Rithmic submit attempt first to derive the live handoff contract.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Required Credentials</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(rithmicLiveSubmitHandoff?.requiredCredentials ?? []).map((item) => (
                  <span key={item} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Missing Requirements</div>
              <div className="mt-3 space-y-2">
                {(rithmicLiveSubmitHandoff?.missingRequirements ?? []).length ? (
                  rithmicLiveSubmitHandoff!.missingRequirements.map((item) => (
                    <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                      {item}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-panel/40 px-3 py-3 text-[12px] text-muted">
                    No missing requirements recorded on the current handoff.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Delivery Notes</div>
              <div className="mt-3 space-y-2">
                {(rithmicLiveSubmitHandoff?.deliveryNotes ?? []).map((note) => (
                  <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-panel/70 p-4">
              <div className="mb-3 text-[12px] text-muted">
                This is the exact envelope the future Rithmic live adapter should accept, regardless of whether the implementation becomes protocol service, desktop SDK, or Diamond-specific.
              </div>
              <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
                {JSON.stringify(rithmicLiveSubmitHandoff?.requestEnvelope ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Rithmic" title="Adapter Boundary Runtime">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Boundary Status</div>
              {rithmicAdapterBoundary ? (
                <>
                  <div
                    className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                      rithmicAdapterBoundary.transportState === "blocked" ? "warning" : "ready"
                    )}`}
                  >
                    {rithmicAdapterBoundary.transportState.replaceAll("_", " ")}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">{rithmicAdapterBoundary.implementationStatus}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Mode: ${rithmicAdapterBoundary.handoffMode.replaceAll("_", " ")}`,
                      `Ready: ${rithmicAdapterBoundary.operatorReady ? "yes" : "no"}`,
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">Stage a Rithmic submit attempt first to derive the adapter boundary runtime.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Validation Issues</div>
              <div className="mt-3 space-y-2">
                {(rithmicAdapterBoundary?.validationIssues ?? []).length ? (
                  rithmicAdapterBoundary!.validationIssues.map((issue) => (
                    <div key={issue} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                      {issue}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-panel/40 px-3 py-3 text-[12px] text-muted">
                    No validation issues are recorded on the current adapter boundary.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Next Actions</div>
              <div className="mt-3 space-y-2">
                {(rithmicAdapterBoundary?.nextActions ?? []).map((item) => (
                  <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Accepted Envelope Shape</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(rithmicAdapterBoundary?.acceptedEnvelopeShape ?? []).map((item) => (
                  <span key={item} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-panel/70 p-4">
              <div className="mb-3 text-[12px] text-muted">
                This is the exact boundary contract the first real Rithmic transport implementation should consume.
              </div>
              <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
                {JSON.stringify(rithmicAdapterBoundary?.dispatchContract ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Rithmic" title="Last Dispatch Attempt">
        {rithmicLastDispatchAttempt ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div
                className={`text-[14px] font-semibold ${futuresToneClasses(
                  rithmicLastDispatchAttempt.dispatchState === "handoff_blocked" ? "warning" : "ready"
                )}`}
              >
                {rithmicLastDispatchAttempt.operatorVerdict}
              </div>
              <div className="mt-2 text-[12px] text-muted">{rithmicLastDispatchAttempt.operatorMessage}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  `Signal: ${rithmicLastDispatchAttempt.signalId}`,
                  `Mode: ${rithmicLastDispatchAttempt.handoffMode.replaceAll("_", " ")}`,
                  `State: ${rithmicLastDispatchAttempt.dispatchState.replaceAll("_", " ")}`,
                  `Dispatched: ${new Date(rithmicLastDispatchAttempt.dispatchedAt).toLocaleString()}`,
                ].map((pill) => (
                  <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-panel/70 p-4">
              <div className="mb-3 text-[12px] text-muted">Latest staged dispatch envelope and normalized adapter-boundary response.</div>
              <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
                {JSON.stringify(
                  {
                    requestEnvelope: rithmicLastDispatchAttempt.requestEnvelope,
                    responseBody: rithmicLastDispatchAttempt.responseBody,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
            No Rithmic adapter-boundary dispatch attempt has been staged yet.
          </div>
        )}
      </SectionCard>

      <SectionCard eyebrow="Rithmic" title="Transport Packet">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Packet Status</div>
              {rithmicTransportPacket ? (
                <>
                  <div
                    className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                      rithmicTransportPacket.packetState === "blocked" ? "warning" : "ready"
                    )}`}
                  >
                    {rithmicTransportPacket.packetState.replaceAll("_", " ")}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">
                    {`${rithmicTransportPacket.targetService} via ${rithmicTransportPacket.targetChannel} with correlation ${rithmicTransportPacket.correlationId}.`}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Mode: ${rithmicTransportPacket.handoffMode.replaceAll("_", " ")}`,
                      `Target: ${rithmicTransportPacket.targetService}`,
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">Stage a Rithmic submit attempt first to derive the transport packet.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Transport Notes</div>
              <div className="mt-3 space-y-2">
                {(rithmicTransportPacket?.notes ?? []).map((note) => (
                  <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-panel/70 p-4">
            <div className="mb-3 text-[12px] text-muted">
              This is the first transport-facing packet shape the future Rithmic protocol or SDK transport should consume.
            </div>
            <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
              {JSON.stringify(rithmicTransportPacket?.payload ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Rithmic" title="Last Transport Attempt">
        {rithmicLastTransportAttempt ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div
                className={`text-[14px] font-semibold ${futuresToneClasses(
                  rithmicLastTransportAttempt.transportState === "handoff_blocked" ? "warning" : "ready"
                )}`}
              >
                {rithmicLastTransportAttempt.operatorVerdict}
              </div>
              <div className="mt-2 text-[12px] text-muted">{rithmicLastTransportAttempt.operatorMessage}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  `Signal: ${rithmicLastTransportAttempt.signalId}`,
                  `Mode: ${rithmicLastTransportAttempt.handoffMode.replaceAll("_", " ")}`,
                  `Service: ${rithmicLastTransportAttempt.targetService}`,
                  `Channel: ${rithmicLastTransportAttempt.targetChannel}`,
                  `Correlation: ${rithmicLastTransportAttempt.correlationId}`,
                  `Attempted: ${new Date(rithmicLastTransportAttempt.attemptedAt).toLocaleString()}`,
                ].map((pill) => (
                  <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-panel/70 p-4">
              <div className="mb-3 text-[12px] text-muted">Latest staged transport payload and normalized transport-stub response.</div>
              <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
                {JSON.stringify(
                  {
                    payload: rithmicLastTransportAttempt.payload,
                    responseBody: rithmicLastTransportAttempt.responseBody,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
            No Rithmic transport attempt has been staged yet.
          </div>
        )}
      </SectionCard>

        </>
      ) : null}

      <SectionCard eyebrow="Rithmic" title="Rithmic Scenario Runner">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Runner Status</div>
              {rithmicProtocolServiceConfig ? (
                <>
                  <div
                    className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                      rithmicProtocolServiceConfig.operatorReady ? "ready" : "warning"
                    )}`}
                  >
                    {rithmicProtocolServiceConfig.mode.replaceAll("_", " ")}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">
                    {rithmicProtocolServiceConfig.endpoint
                      ? `${rithmicProtocolServiceConfig.endpoint} · timeout ${rithmicProtocolServiceConfig.timeoutMs}ms`
                      : "No protocol-service endpoint is configured yet."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Auth: ${rithmicProtocolServiceConfig.authMode}`,
                      `Ready: ${rithmicProtocolServiceConfig.operatorReady ? "yes" : "no"}`,
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">No protocol-service runner configuration is available yet.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Missing Requirements</div>
              <div className="mt-3 space-y-2">
                {(rithmicProtocolServiceConfig?.missingRequirements ?? []).length ? (
                  rithmicProtocolServiceConfig!.missingRequirements.map((item) => (
                    <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                      {item}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-panel/40 px-3 py-3 text-[12px] text-muted">
                    No protocol-service runner requirements are currently missing.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Gateway Scenario</div>
              <select
                value={rithmicProtocolScenario}
                onChange={(event) => setRithmicProtocolScenario(event.target.value as RithmicGatewayScenario)}
                className="mt-3 h-10 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-foreground outline-none"
              >
                <option value="submitted">Submitted</option>
                <option value="partial_fill">Partial Fill</option>
                <option value="filled">Filled</option>
                <option value="flat_exit">Flat After Exit</option>
                <option value="rejected">Rejected</option>
                <option value="uncertain">Uncertain</option>
                <option value="transport_failed">Transport Failed</option>
                <option value="uncertain_recovered">Uncertain Recovered</option>
                <option value="transport_recovered">Transport Recovered</option>
              </select>
              <div className="mt-2 text-[12px] text-muted">
                Pick the local-gateway outcome you want the protocol runner to simulate, so we can test the operator console against real lifecycle shapes.
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Runner Notes</div>
              <div className="mt-3 space-y-2">
                {(rithmicProtocolServiceConfig?.notes ?? []).map((note) => (
                  <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-panel/70 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">How To Use This Test Lane</div>
              <div className="mt-3 space-y-2 text-[12px] text-muted">
                {[
                  "Run a scenario after account sync and route binding are in place.",
                  "Use submitted, partial fill, filled, and flat-exit to validate the normal operator journey.",
                  "Use uncertain and transport recovery scenarios to see what the trader experiences when the lane loses certainty and then heals.",
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {showDiagnostics ? (
              <div className="rounded-2xl border border-border bg-panel/70 p-4">
                <div className="mb-3 text-[12px] text-muted">
                  The protocol-service runner consumes the normalized Rithmic transport packet and returns a broker-agnostic outcome back into the shared futures journal.
                </div>
                <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
                  {JSON.stringify(
                    {
                      mode: rithmicProtocolServiceConfig?.mode ?? null,
                      endpoint: rithmicProtocolServiceConfig?.endpoint ?? null,
                      authMode: rithmicProtocolServiceConfig?.authMode ?? null,
                      timeoutMs: rithmicProtocolServiceConfig?.timeoutMs ?? null,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Rithmic" title="Last Protocol Service Attempt">
        {rithmicLastProtocolServiceAttempt ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div
                className={`text-[14px] font-semibold ${futuresToneClasses(
                  rithmicLastProtocolServiceAttempt.runState === "transport_error"
                    ? "error"
                    : rithmicLastProtocolServiceAttempt.runState === "config_blocked"
                      ? "warning"
                      : "ready"
                )}`}
              >
                {rithmicLastProtocolServiceAttempt.operatorVerdict}
              </div>
              <div className="mt-2 text-[12px] text-muted">{rithmicLastProtocolServiceAttempt.operatorMessage}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  `Signal: ${rithmicLastProtocolServiceAttempt.signalId}`,
                  `Correlation: ${rithmicLastProtocolServiceAttempt.correlationId}`,
                  `State: ${rithmicLastProtocolServiceAttempt.runState.replaceAll("_", " ")}`,
                  `Endpoint: ${rithmicLastProtocolServiceAttempt.endpoint || "n/a"}`,
                  `Attempted: ${new Date(rithmicLastProtocolServiceAttempt.attemptedAt).toLocaleString()}`,
                ].map((pill) => (
                  <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            {showDiagnostics ? (
              <div className="rounded-2xl border border-border bg-panel/70 p-4">
                <div className="mb-3 text-[12px] text-muted">Latest protocol-service request and normalized runner response.</div>
                <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
                  {JSON.stringify(
                    {
                      requestBody: rithmicLastProtocolServiceAttempt.requestBody,
                      responseBody: rithmicLastProtocolServiceAttempt.responseBody,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
            No Rithmic protocol-service attempt has been recorded yet.
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Rithmic"
        title="Simulated Lifecycle Stream"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void replayRithmicLifecycleScenario()}
              disabled={rithmicLifecycleBusy !== null || !rithmicLatestLifecycleScenario}
              className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[12px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rithmicLifecycleBusy === "replay" ? "Replaying..." : "Replay Last Scenario"}
            </button>
            <button
              type="button"
              onClick={() => void clearRithmicLifecycleStream()}
              disabled={rithmicLifecycleBusy !== null || !rithmicSimulatedLifecycle.length}
              className="rounded-full border border-border bg-surface px-4 py-2 text-[12px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rithmicLifecycleBusy === "clear" ? "Clearing..." : "Clear Stream"}
            </button>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            `Events: ${rithmicSimulatedLifecycle.length}`,
            `Latest Scenario: ${rithmicLatestLifecycleScenario ? rithmicLatestLifecycleScenario.replaceAll("_", " ") : "none"}`,
            `Latest Correlation: ${rithmicSimulatedLifecycle[0]?.correlationId || "n/a"}`,
          ].map((pill) => (
            <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
              {pill}
            </span>
          ))}
        </div>
        {rithmicLifecycleMessage ? (
          <div className="mb-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
            {rithmicLifecycleMessage}
          </div>
        ) : null}
        {rithmicLifecycleError ? (
          <div className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
            {rithmicLifecycleError}
          </div>
        ) : null}
        {rithmicSimulatedLifecycle.length ? (
          <div className="space-y-3">
            {rithmicSimulatedLifecycle.map((event) => {
              const executionHistory = getLifecycleExecutionHistory(event.payload);
              const protectionOrders = getLifecycleProtectionOrders(event.payload);
              const reconciliationTimeline = getLifecycleReconciliationTimeline(event.payload);
              const protectionTimeline = getLifecycleProtectionTimeline(event.payload);
              const recoveryPlan = getLifecycleRecoveryPlan(event.payload);
              const reconciliationDrift = getLifecycleReconciliationDrift({
                payload: event.payload,
                protectionOrders,
              });
              const latestExecution = executionHistory[executionHistory.length - 1] ?? null;
              const eventSummaryPills = showDiagnostics
                ? [
                    `Primary State: ${formatLifecycleLabel(typeof event.payload?.primaryOrderState === "string" ? event.payload.primaryOrderState : null)}`,
                    `Protection Orders: ${protectionOrders.length}`,
                    `Exec History: ${executionHistory.length}`,
                    `Latest Exec Event: ${formatLifecycleLabel(latestExecution?.eventType)}`,
                    `Open Pos Qty: ${formatLifecycleScalar(typeof event.payload?.openPositionQty === "number" ? event.payload.openPositionQty : null)}`,
                    `Position State: ${formatLifecycleLabel(typeof event.payload?.positionState === "string" ? event.payload.positionState : null)}`,
                    `Drift: ${reconciliationDrift.some((item) => item.severity === "warning") ? "attention" : "clear"}`,
                    `Type: ${formatLifecycleLabel(event.eventType)}`,
                    `Signal: ${event.signalId}`,
                    `Correlation: ${event.correlationId}`,
                    `Broker Order: ${event.brokerOrderId || "n/a"}`,
                    `Client Order: ${event.clientOrderId || "n/a"}`,
                    `Parent Order: ${event.parentOrderId || "n/a"}`,
                    `Leaves: ${event.leavesQty ?? "n/a"}`,
                    `Filled: ${event.filledQty ?? "n/a"}`,
                    `Cum Qty: ${event.cumQty ?? "n/a"}`,
                    `Avg Fill: ${event.avgFillPrice ?? "n/a"}`,
                    `Exec Type: ${formatLifecycleLabel(event.execType)}`,
                    `Ord Status: ${formatLifecycleLabel(event.ordStatus)}`,
                    `Reject Code: ${event.rejectCode || "n/a"}`,
                    `Reject Reason: ${formatLifecycleLabel(event.rejectReason)}`,
                    `Reconcile: ${formatLifecycleLabel(event.reconciliationState)}`,
                    `Gateway µs: ${event.gatewayTimestampMicros ?? "n/a"}`,
                    `Broker µs: ${event.brokerTimestampMicros ?? "n/a"}`,
                    `Status: ${event.status}`,
                    `When: ${new Date(event.occurredAt).toLocaleString()}`,
                  ]
                : [
                    `Scenario: ${formatLifecycleLabel(event.outcome)}`,
                    `Position: ${formatLifecycleLabel(typeof event.payload?.positionState === "string" ? event.payload.positionState : null)}`,
                    `Qty: ${formatLifecycleScalar(typeof event.payload?.openPositionQty === "number" ? event.payload.openPositionQty : null)}`,
                    `Reconcile: ${formatLifecycleLabel(event.reconciliationState)}`,
                    `Latest Exec: ${formatLifecycleLabel(latestExecution?.eventType)}`,
                    `Drift: ${reconciliationDrift.some((item) => item.severity === "warning") ? "attention" : "clear"}`,
                    `Updated: ${new Date(event.occurredAt).toLocaleString()}`,
                  ];

              return (
                <div key={event.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className={`text-[14px] font-semibold ${futuresToneClasses(lifecycleStatusTone(event.status))}`}>
                        {formatLifecycleLabel(event.stage)}
                      </div>
                      <div className="mt-1 text-[12px] text-muted">{event.detail}</div>
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                      {formatLifecycleLabel(event.outcome)}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {eventSummaryPills.map((pill) => (
                      <span key={`${event.id}-${pill}`} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>

                  {executionHistory.length ? (
                    <div className="mt-3 rounded-2xl border border-border bg-panel/70 p-4">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">
                        Execution History Ladder
                      </div>
                      <div className="mt-3 space-y-2">
                        {executionHistory.map((row, index) => (
                          <div
                            key={`${event.id}-history-${index}-${row.eventType ?? "unknown"}`}
                            className="rounded-xl border border-border/70 bg-background/60 px-3 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-[12px] font-semibold text-foreground">
                                  {index + 1}. {formatLifecycleLabel(row.eventType, "unknown event")}
                                </div>
                                <div className="mt-1 text-[11px] text-muted">
                                  {formatLifecycleLabel(row.orderRole, "unknown role")} · {formatLifecycleLabel(row.orderState, "unknown state")}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  `Order ID: ${row.orderId || "n/a"}`,
                                  `Qty: ${formatLifecycleScalar(row.qty)}`,
                                  `Price: ${formatLifecycleScalar(row.price)}`,
                                  `Broker µs: ${formatLifecycleScalar(row.brokerTimestampMicros)}`,
                                ].map((pill) => (
                                  <span
                                    key={`${event.id}-history-pill-${index}-${pill}`}
                                    className="rounded-full border border-border bg-panel px-2.5 py-1 text-[10px] text-muted"
                                  >
                                    {pill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {reconciliationTimeline.length ? (
                    <div className="mt-3 rounded-2xl border border-border bg-panel/70 p-4">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">
                        State Progression Timeline
                      </div>
                      <div className="mt-3 space-y-2">
                        {reconciliationTimeline.map((row, index) => (
                          <div
                            key={`${event.id}-reconcile-${index}-${row.step ?? "unknown"}`}
                            className="rounded-xl border border-border/70 bg-background/60 px-3 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-[12px] font-semibold text-foreground">
                                  {formatLifecycleScalar(row.step, String(index + 1))}. {formatLifecycleLabel(row.label, "state change")}
                                </div>
                                <div className="mt-1 text-[11px] text-muted">
                                  {formatLifecycleLabel(row.primaryOrderState, "unknown order state")} · {formatLifecycleLabel(row.positionState, "unknown position state")}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  `Working Order: ${
                                    row.workingOrderPresent == null ? "unknown" : row.workingOrderPresent ? "yes" : "no"
                                  }`,
                                  `Open Qty: ${formatLifecycleScalar(row.openPositionQty)}`,
                                  `Reconcile: ${formatLifecycleLabel(row.reconciliationState)}`,
                                  `Protection Active: ${formatLifecycleScalar(row.protectionSummary?.active)}`,
                                  `Protection Filled: ${formatLifecycleScalar(row.protectionSummary?.filled)}`,
                                  `Protection Cancelled: ${formatLifecycleScalar(row.protectionSummary?.cancelled)}`,
                                  `Broker µs: ${formatLifecycleScalar(row.brokerTimestampMicros)}`,
                                ].map((pill) => (
                                  <span
                                    key={`${event.id}-reconcile-pill-${index}-${pill}`}
                                    className="rounded-full border border-border bg-panel px-2.5 py-1 text-[10px] text-muted"
                                  >
                                    {pill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {protectionTimeline.length ? (
                    <div className="mt-3 rounded-2xl border border-border bg-panel/70 p-4">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">
                        Protection Leg Timeline
                      </div>
                      <div className="mt-3 space-y-2">
                        {protectionTimeline.map((row, index) => (
                          <div
                            key={`${event.id}-protection-timeline-${index}-${row.step ?? "unknown"}`}
                            className="rounded-xl border border-border/70 bg-background/60 px-3 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-[12px] font-semibold text-foreground">
                                  {formatLifecycleScalar(row.step, String(index + 1))}. {formatLifecycleLabel(row.role, "protection leg")}
                                </div>
                                <div className="mt-1 text-[11px] text-muted">
                                  {formatLifecycleLabel(row.orderState, "unknown state")} · {formatLifecycleLabel(row.execType, "unknown exec type")}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  `Order ID: ${row.orderId || "n/a"}`,
                                  `Parent: ${row.parentOrderId || "n/a"}`,
                                  `Group: ${row.groupId || "n/a"}`,
                                  `Qty: ${formatLifecycleScalar(row.qty)}`,
                                  `Price Mode: ${formatLifecycleLabel(row.priceMode)}`,
                                  `Price: ${formatLifecycleScalar(row.priceValue)}`,
                                  `Broker µs: ${formatLifecycleScalar(row.brokerTimestampMicros)}`,
                                ].map((pill) => (
                                  <span
                                    key={`${event.id}-protection-timeline-pill-${index}-${pill}`}
                                    className="rounded-full border border-border bg-panel px-2.5 py-1 text-[10px] text-muted"
                                  >
                                    {pill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {recoveryPlan.length ? (
                    <div className="mt-3 rounded-2xl border border-border bg-panel/70 p-4">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">
                        Recovery Playbook
                      </div>
                      <div className="mt-3 space-y-2">
                        {recoveryPlan.map((row, index) => (
                          <div
                            key={`${event.id}-recovery-${index}-${row.step ?? "unknown"}`}
                            className="rounded-xl border border-border/70 bg-background/60 px-3 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-[12px] font-semibold text-foreground">
                                  {formatLifecycleScalar(row.step, String(index + 1))}. {formatLifecycleLabel(row.action, "recovery step")}
                                </div>
                                <div className="mt-1 text-[11px] text-muted">
                                  {row.detail || "No recovery detail provided."}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  `Owner: ${formatLifecycleLabel(row.owner)}`,
                                  `State: ${formatLifecycleLabel(row.state)}`,
                                  `Broker µs: ${formatLifecycleScalar(row.brokerTimestampMicros)}`,
                                ].map((pill) => (
                                  <span
                                    key={`${event.id}-recovery-pill-${index}-${pill}`}
                                    className="rounded-full border border-border bg-panel px-2.5 py-1 text-[10px] text-muted"
                                  >
                                    {pill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 rounded-2xl border border-border bg-panel/70 p-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Reconciliation Drift
                    </div>
                    <div className="mt-3 space-y-2">
                      {reconciliationDrift.map((item, index) => (
                        <div
                          key={`${event.id}-drift-${index}`}
                          className={`rounded-xl border px-3 py-2 text-[12px] ${
                            item.severity === "warning"
                              ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                              : "border-sky-400/25 bg-sky-400/10 text-sky-200"
                          }`}
                        >
                          {item.message}
                        </div>
                      ))}
                    </div>
                  </div>

                  {protectionOrders.length ? (
                    <div className="mt-3 rounded-2xl border border-border bg-panel/70 p-4">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">
                        Protection Order Reconciliation
                      </div>
                      <div className="mt-3 space-y-2">
                        {protectionOrders.map((row, index) => (
                          <div
                            key={`${event.id}-protection-${index}-${row.orderId ?? "unknown"}`}
                            className="rounded-xl border border-border/70 bg-background/60 px-3 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-[12px] font-semibold text-foreground">
                                  {index + 1}. {formatLifecycleLabel(row.role, "unknown protection leg")}
                                </div>
                                <div className="mt-1 text-[11px] text-muted">
                                  {formatLifecycleLabel(row.ordStatus, "unknown status")} · {formatLifecycleLabel(row.execType, "unknown exec type")}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  `Order ID: ${row.orderId || "n/a"}`,
                                  `Parent: ${row.parentOrderId || "n/a"}`,
                                  `Group: ${row.groupId || "n/a"}`,
                                  `Price Mode: ${formatLifecycleLabel(row.priceMode)}`,
                                  `Price: ${formatLifecycleScalar(row.priceValue)}`,
                                  `Leaves: ${formatLifecycleScalar(row.leavesQty)}`,
                                  `Cum Qty: ${formatLifecycleScalar(row.cumQty)}`,
                                  `Broker µs: ${formatLifecycleScalar(row.brokerTimestampMicros)}`,
                                ].map((pill) => (
                                  <span
                                    key={`${event.id}-protection-pill-${index}-${pill}`}
                                    className="rounded-full border border-border bg-panel px-2.5 py-1 text-[10px] text-muted"
                                  >
                                    {pill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {showDiagnostics && event.payload ? (
                    <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-background/80 p-3 text-[11px] leading-6 text-foreground">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
            No simulated lifecycle events have been emitted yet.
          </div>
        )}
      </SectionCard>

      {showDiagnostics ? (
        <>
      <SectionCard eyebrow="Rithmic" title="Last Local Stub Contract Test">
        {rithmicLastProtocolStubAttempt ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div
                className={`text-[14px] font-semibold ${futuresToneClasses(
                  rithmicLastProtocolStubAttempt.runState === "stub_blocked" ? "warning" : "ready"
                )}`}
              >
                {rithmicLastProtocolStubAttempt.operatorVerdict}
              </div>
              <div className="mt-2 text-[12px] text-muted">{rithmicLastProtocolStubAttempt.operatorMessage}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  `Signal: ${rithmicLastProtocolStubAttempt.signalId}`,
                  `Correlation: ${rithmicLastProtocolStubAttempt.correlationId}`,
                  `State: ${rithmicLastProtocolStubAttempt.runState.replaceAll("_", " ")}`,
                  `Attempted: ${new Date(rithmicLastProtocolStubAttempt.attemptedAt).toLocaleString()}`,
                ].map((pill) => (
                  <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-panel/70 p-4">
              <div className="mb-3 text-[12px] text-muted">Latest local stub contract-test request and normalized stub response.</div>
              <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
                {JSON.stringify(
                  {
                    requestBody: rithmicLastProtocolStubAttempt.requestBody,
                    responseBody: rithmicLastProtocolStubAttempt.responseBody,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
            No local Rithmic protocol stub test has been recorded yet.
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard eyebrow="Accounts" title="Futures Account Inventory">
          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-semibold text-foreground">{account.label}</div>
                    <div className="mt-1 text-[12px] text-muted">
                      {account.firm} - {account.venue} - {account.environment}
                    </div>
                  </div>
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${futuresToneClasses(account.tone)}`}>
                    {account.status.replaceAll("_", " ")}
                  </div>
                </div>
                <div className="mt-2 text-[12px] text-muted">{account.detail}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    `Access: ${account.platformAccess}`,
                    `Connection: ${account.connectionState}`,
                    `Routes: ${account.routeProfileIds.length}`,
                    `Risk: ${account.riskProfileId}`,
                  ].map((pill) => (
                    <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Risk" title="First Risk Profiles">
          <div className="space-y-3">
            {riskProfiles.map((profile) => (
              <div key={profile.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[14px] font-semibold text-foreground">{profile.label}</div>
                <div className="mt-2 text-[12px] text-muted">{profile.notes}</div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {[
                    `Max / order: ${profile.maxContractsPerOrder}`,
                    `Max open: ${profile.maxOpenPositions}`,
                    `Dedup: ${profile.duplicateWindowSeconds}s`,
                    `Session: ${profile.sessionWindow}`,
                  ].map((row) => (
                    <div key={row} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                      {row}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard eyebrow="Schema" title="Signal and Routing Contract">
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-[13px]">
              <thead className="border-b border-border bg-surface/70 text-[11px] uppercase tracking-[0.2em] text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Layer</th>
                  <th className="px-4 py-3 text-left font-medium">What We Need</th>
                </tr>
              </thead>
              <tbody>
                {schemaRows.map(([label, detail]) => (
                  <tr key={label} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{label}</td>
                    <td className="px-4 py-3 text-muted">{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Research" title="What The Official Docs Change">
          <div className="space-y-3">
            {(overview?.strategicRecommendation.why ?? []).map((detail, index) => (
              <div key={`why-${index}`} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  Point {index + 1}
                </div>
                <div className="mt-2 text-[13px] text-foreground">{detail}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard eyebrow="Adapters" title="Environment and Access Notes">
          <div className="space-y-3">
            {adapters.map((adapter) => (
              <div key={`env-${adapter.id}`} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[14px] font-semibold text-foreground">{adapter.name}</div>
                <div className="mt-1 text-[12px] text-muted">{adapter.rationale}</div>
                <div className="mt-3 grid gap-2">
                  {adapter.environments.map((environment) => (
                    <div key={`${adapter.id}-${environment.label}`} className="rounded-xl border border-border/70 bg-panel/70 p-3">
                      <div className="text-[12px] font-semibold text-foreground">{environment.label}</div>
                      <div className="mt-1 text-[11px] text-muted">
                        {environment.apiBase ? `API: ${environment.apiBase}` : "API endpoint depends on provider access"}
                      </div>
                      <div className="mt-1 text-[11px] text-muted">
                        {environment.websocket
                          ? `WS: ${environment.websocket}`
                          : "WebSocket / session endpoint depends on provider access"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Errors" title="Failure Classes We Must Handle">
          <div className="space-y-3">
            {errorRows.map(([title, detail]) => (
              <div key={title} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  {title}
                </div>
                <div className="mt-2 text-[13px] text-foreground">{detail}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Sample" title="First Futures Signal Shape">
        <div className="rounded-2xl border border-border bg-panel/70 p-4">
          <div className="mb-3 text-[12px] text-muted">
            This is the normalized futures signal contract we should build the first real adapter against.
          </div>
          <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
            {JSON.stringify(sampleSignal, null, 2)}
          </pre>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Tradovate" title="Native Order Translation Preview">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Execution Path</div>
              {tradovateOrderPreview ? (
                <>
                  <div className="mt-3 text-[14px] font-semibold text-foreground">{tradovateOrderPreview.endpoint}</div>
                  <div className="mt-1 text-[12px] text-muted">
                    {tradovateOrderPreview.usesBrackets
                      ? "This signal is eligible for native placeOSO translation with stop and target bracket legs."
                      : "This signal currently translates to a plain placeOrder payload."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Adapter: ${tradovateOrderPreview.adapterId}`,
                      `Brackets: ${tradovateOrderPreview.usesBrackets ? "yes" : "no"}`,
                      `Account spec: ${tradovateOrderPreview.accountSpecHint}`,
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">Tradovate order translation preview is not available yet.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Notes</div>
              <div className="mt-3 space-y-2">
                {(tradovateOrderPreview?.notes ?? []).map((note) => (
                  <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Failure Reasons To Normalize</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(tradovateOrderPreview?.failureReasons ?? []).map((reason) => (
                  <span key={reason} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-panel/70 p-4">
            <div className="mb-3 text-[12px] text-muted">
              This is the first real Tradovate payload shape we should route, journal, and map into broker-state outcomes.
            </div>
            <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
              {JSON.stringify(tradovateOrderPreview?.body ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Tradovate" title="Session Discovery">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Authenticated Lane</div>
              {tradovateSessionDiscovery ? (
                <>
                  <div className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                    tradovateSessionDiscovery.authStatus === "auth_ok"
                      ? "ready"
                      : tradovateSessionDiscovery.authStatus === "missing_config"
                        ? "warning"
                        : "error"
                  )}`}>
                    {tradovateSessionDiscovery.authStatus.replaceAll("_", " ")}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">{tradovateSessionDiscovery.accountManagementScope}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Env: ${tradovateSessionDiscovery.selectedEnvironment}`,
                      tradovateSessionDiscovery.authenticatedUser?.userName
                        ? `User: ${tradovateSessionDiscovery.authenticatedUser.userName}`
                        : "User: unavailable",
                      tradovateSessionDiscovery.testedAt
                        ? `Tested: ${new Date(tradovateSessionDiscovery.testedAt).toLocaleString()}`
                        : "Tested: never",
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">Tradovate session discovery is not available yet.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Environment Endpoints</div>
              <div className="mt-3 space-y-2 text-[12px] text-muted">
                {[
                  `API Base: ${tradovateSessionDiscovery?.apiBase ?? "n/a"}`,
                  `User WS: ${tradovateSessionDiscovery?.userWebsocket ?? "n/a"}`,
                  `Market Data WS: ${tradovateSessionDiscovery?.marketDataWebsocket ?? "n/a"}`,
                  `Client Access: ${tradovateSessionDiscovery?.clientAccess ?? "n/a"}`,
                  `Admin Dashboard: ${tradovateSessionDiscovery?.adminDashboard ?? "n/a"}`,
                ].map((line) => (
                  <div key={line} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/60 p-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">What This Unlocks Next</div>
            <div className="mt-3 space-y-2">
              {(tradovateSessionDiscovery?.notes ?? []).map((note) => (
                <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                  {note}
                </div>
              ))}
              {tradovateSessionDiscovery?.error ? (
                <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                  {tradovateSessionDiscovery.error}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </SectionCard>

        </>
      ) : null}

      <SectionCard eyebrow="Tradovate" title="Tradovate Accounts">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Discovered Inventory</div>
              {tradovateAccountDiscovery ? (
                <>
                  <div className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                    tradovateAccountDiscovery.authStatus === "auth_ok"
                      ? "ready"
                      : tradovateAccountDiscovery.authStatus === "missing_config"
                        ? "warning"
                        : "error"
                  )}`}>
                    {tradovateAccountDiscovery.accountCount} account{tradovateAccountDiscovery.accountCount === 1 ? "" : "s"}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">
                    {tradovateAccountDiscovery.error
                      ? tradovateAccountDiscovery.error
                      : "This is the real Tradovate account inventory surface we should bind to kwantify routing profiles."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Env: ${tradovateAccountDiscovery.selectedEnvironment}`,
                      tradovateAccountDiscovery.testedAt
                        ? `Tested: ${new Date(tradovateAccountDiscovery.testedAt).toLocaleString()}`
                        : "Tested: never",
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">Tradovate account discovery is not available yet.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">What Comes Next</div>
              <div className="mt-3 space-y-2">
                {(tradovateAccountDiscovery?.notes ?? []).map((note) => (
                  <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(tradovateAccountDiscovery?.accounts ?? []).length ? (
              tradovateAccountDiscovery?.accounts.map((account) => (
                <div key={account.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[14px] font-semibold text-foreground">
                        {account.name || `Tradovate Account ${account.id}`}
                      </div>
                      <div className="mt-1 text-[12px] text-muted">
                        id {account.id} - type {account.accountType || "unknown"} - active {account.active == null ? "unknown" : account.active ? "yes" : "no"}
                      </div>
                    </div>
                    <span className="rounded-full border border-border bg-panel px-3 py-1 text-[11px] font-medium text-muted">
                      readonly {account.readonly == null ? "unknown" : account.readonly ? "yes" : "no"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {[
                      `Risk category: ${account.riskCategoryId || "n/a"}`,
                      `Auto liq: ${account.autoLiqProfileId || "n/a"}`,
                      `Clearing house: ${account.clearingHouseId || "n/a"}`,
                      `Eval size: ${account.evaluationSize ?? "n/a"}`,
                    ].map((item) => (
                      <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
                No Tradovate accounts discovered yet.
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard eyebrow="Tradovate" title="Tradovate Account Binding">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Resolved Submit Account</div>
              {tradovateRouteBinding ? (
                <>
                  <div
                    className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                      tradovateRouteBinding.error ? "error" : "ready"
                    )}`}
                  >
                    {tradovateRouteBinding.error ? "binding blocked" : "binding ready"}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">
                    {tradovateRouteBinding.error
                      ? tradovateRouteBinding.error
                      : `Resolved to account ${tradovateRouteBinding.resolvedTradovateAccountName || tradovateRouteBinding.resolvedTradovateAccountId}.`}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Env: ${tradovateRouteBinding.selectedEnvironment}`,
                      `Source: ${tradovateRouteBinding.resolutionSource.replaceAll("_", " ")}`,
                      `Account spec: ${tradovateRouteBinding.accountSpec || "n/a"}`,
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">Tradovate route binding is not available yet.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Binding Notes</div>
              <div className="mt-3 space-y-2">
                {(tradovateRouteBinding?.notes ?? []).map((note) => (
                  <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Managed Binding Truth</div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {[
                  `Managed account: ${tradovateRouteBinding?.managedAccountLabel || "n/a"}`,
                  `Managed route: ${tradovateRouteBinding?.managedRouteLabel || "n/a"}`,
                  `Managed risk: ${tradovateRouteBinding?.managedRiskProfileLabel || "n/a"}`,
                  `Broker account ref: ${tradovateRouteBinding?.brokerAccountRef || "n/a"}`,
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Tradovate"
          title="Tradovate Safe Test Orders"
          action={
            <button
              type="button"
              onClick={() => void runTradovateSampleSubmit()}
              disabled={submitTesting || !sampleSignal}
              className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[12px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitTesting ? "Submitting..." : "Run Sample Submit"}
            </button>
          }
        >
          <div className="space-y-3">
            {tradovateLastSubmit ? (
              <>
                <div className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Broker Outcome</div>
                  <div
                    className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                      tradovateLastSubmit.brokerAccepted ? "ready" : "warning"
                    )}`}
                  >
                    {tradovateLastSubmit.brokerAccepted ? "accepted" : tradovateLastSubmit.operatorVerdict}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">
                    {tradovateLastSubmit.operatorMessage ||
                      `HTTP ${tradovateLastSubmit.responseStatus} from ${tradovateLastSubmit.endpoint}.`}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Signal: ${tradovateLastSubmit.signalId}`,
                      `Route: ${tradovateLastSubmit.routeProfileId}`,
                      `Env: ${tradovateLastSubmit.selectedEnvironment}`,
                      `Submitted: ${new Date(tradovateLastSubmit.submittedAt).toLocaleString()}`,
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Managed Binding Used</div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {[
                      `Managed account: ${tradovateLastSubmit.binding.managedAccountLabel || "n/a"}`,
                      `Managed route: ${tradovateLastSubmit.binding.managedRouteLabel || "n/a"}`,
                      `Managed risk: ${tradovateLastSubmit.binding.managedRiskProfileLabel || "n/a"}`,
                      `Broker account ref: ${tradovateLastSubmit.binding.brokerAccountRef || "n/a"}`,
                    ].map((item) => (
                      <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {showDiagnostics ? (
                  <div className="rounded-2xl border border-border bg-panel/70 p-4">
                    <div className="mb-3 text-[12px] text-muted">
                      This is the exact Tradovate request body we most recently attempted to submit.
                    </div>
                    <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
                      {JSON.stringify(tradovateLastSubmit.requestBody, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
                No Tradovate submit has been attempted yet.
              </div>
            )}
            {submitMessage ? (
              <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                {submitMessage}
              </div>
            ) : null}
            {submitError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {submitError}
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Tradovate" title="Tradovate Live Orders and Positions">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Positions and Working Orders</div>
              {tradovateBrokerState ? (
                <>
                  <div
                    className={`mt-3 text-[14px] font-semibold ${futuresToneClasses(
                      tradovateBrokerState.error ? "warning" : "ready"
                    )}`}
                  >
                    {tradovateBrokerState.error
                      ? "state unavailable"
                      : `${tradovateBrokerState.positions.length} position${tradovateBrokerState.positions.length === 1 ? "" : "s"} · ${tradovateBrokerState.workingOrders.length} working order${tradovateBrokerState.workingOrders.length === 1 ? "" : "s"}`}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">
                    {tradovateBrokerState.error || "This is the first broker-truth pull we can reconcile against kwantify route and journal state."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      `Env: ${tradovateBrokerState.selectedEnvironment}`,
                      tradovateBrokerState.fetchedAt
                        ? `Fetched: ${new Date(tradovateBrokerState.fetchedAt).toLocaleString()}`
                        : "Fetched: never",
                    ].map((pill) => (
                      <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {pill}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[12px] text-muted">Tradovate broker state is not available yet.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Why This Matters</div>
              <div className="mt-3 space-y-2">
                {(tradovateBrokerState?.notes ?? []).map((note) => (
                  <div key={note} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            {controlMessage ? (
              <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                {controlMessage}
              </div>
            ) : null}
            {controlError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {controlError}
              </div>
            ) : null}

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Latest Control Binding</div>
              {tradovateLastControl ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {[
                    `Action: ${tradovateLastControl.action.replaceAll("_", " ")}`,
                    `Managed account: ${tradovateLastControl.binding.managedAccountLabel || "n/a"}`,
                    `Managed route: ${tradovateLastControl.binding.managedRouteLabel || "n/a"}`,
                    `Managed risk: ${tradovateLastControl.binding.managedRiskProfileLabel || "n/a"}`,
                    `Broker account ref: ${tradovateLastControl.binding.brokerAccountRef || "n/a"}`,
                    `Occurred: ${new Date(tradovateLastControl.occurredAt).toLocaleString()}`,
                  ].map((item) => (
                    <div key={item} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[11px] text-muted">
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-[12px] text-muted">No live Tradovate control action has been recorded yet.</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Open Positions</div>
              <div className="mt-3 space-y-2">
                {(tradovateBrokerState?.positions ?? []).length ? (
                  tradovateBrokerState?.positions.map((position) => (
                    <div key={position.id} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                      <div className="flex items-center justify-between gap-3">
                        <div>account {position.accountId} · net {position.netPos ?? "n/a"} @ {position.netPrice ?? "n/a"}</div>
                        <button
                          type="button"
                          onClick={() => void runTradovateControl("liquidate-position", position.id)}
                          disabled={controlBusy === `liquidate-position:${position.id}`}
                          className="rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-[11px] font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {controlBusy === `liquidate-position:${position.id}` ? "Flattening..." : "Flatten"}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    No open positions discovered.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Working Orders</div>
              <div className="mt-3 space-y-2">
                {(tradovateBrokerState?.workingOrders ?? []).length ? (
                  tradovateBrokerState?.workingOrders.map((order) => (
                    <div key={order.id} className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                      <div className="flex items-center justify-between gap-3">
                        <div>{order.symbol || "unknown"} · {order.action || "n/a"} · {order.orderType || "n/a"} · qty {order.orderQty ?? "n/a"}</div>
                        <button
                          type="button"
                          onClick={() => void runTradovateControl("cancel-order", order.id)}
                          disabled={controlBusy === `cancel-order:${order.id}`}
                          className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {controlBusy === `cancel-order:${order.id}` ? "Cancelling..." : "Cancel"}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-border/70 bg-panel/70 px-3 py-2 text-[12px] text-muted">
                    No working orders discovered.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {showDiagnostics ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard eyebrow="Inbox" title="Queued Futures Commands">
          <div className="space-y-3">
            {(overview?.queuedCommands ?? []).map((command) => (
              <div key={command.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-foreground">
                      {command.signal.signalId} - {command.signal.symbol}
                    </div>
                    <div className="mt-1 text-[12px] text-muted">
                      {command.signal.side} {command.signal.quantity} - {command.signal.orderType} - {command.accountId}
                    </div>
                  </div>
                  <div className="rounded-full border border-border bg-panel px-3 py-1 text-[11px] font-medium text-muted">
                    {command.status}
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-muted">
                  Route: {command.routeProfileId} - Adapter: {command.adapterId}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

          <SectionCard eyebrow="Journal" title="Signal Intake Journal">
          <div className="space-y-3">
            {(overview?.signalInbox ?? []).map((event) => (
              <div key={event.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-foreground">
                      {event.signalId} - {event.stage.toUpperCase()}
                    </div>
                    <div className="mt-1 text-[12px] text-muted">{event.detail}</div>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-2 text-[11px] text-muted">
                  {event.accountId} - {new Date(event.occurredAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          </SectionCard>
        </div>
      ) : null}

      {showDiagnostics ? (
      <SectionCard eyebrow="What Ships" title="Futures Connector Foundations To Build First">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: Network,
              title: "Broker Connections",
              detail: "Tradovate auth, environment mode, account list, connection health, reconnect state.",
            },
            {
              icon: GitBranch,
              title: "Routing Profiles",
              detail: "Map strategy family, account, venue, quantity policy, and bracket defaults.",
            },
            {
              icon: Waves,
              title: "Multi-Account Fanout",
              detail: "Send one approved signal into many prop or broker accounts with safe multipliers.",
            },
            {
              icon: Database,
              title: "Signal Inbox + Journal",
              detail: "Raw payload, parsed order intent, routing result, broker response, and final state.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="flex items-center gap-2 text-muted">
                <item.icon className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">{item.title}</span>
              </div>
              <div className="mt-3 text-[13px] text-foreground">{item.detail}</div>
            </div>
          ))}
        </div>
      </SectionCard>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-[13px] text-danger">{error}</div>
      ) : null}
      {loading ? <div className="text-[12px] text-muted">Loading futures connector research...</div> : null}
    </div>
  );
}


