"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import {
  TradeSyncerField,
  TradeSyncerModal,
  TradeSyncerSelect,
} from "@/components/trade-syncer/TradeSyncerControls";
import type { TradeSyncerAccountRecord, TradeSyncerVenue } from "@/lib/tradeSyncer";
import type { TradeSyncerOverviewMetric } from "@/lib/tradeSyncer.server";
import type { FuturesAccountRecord, FuturesRoutingProfile } from "@/lib/futuresConnectors";

const NO_MANAGED_LANE = "__none__";
const accountSetupSteps = ["Select Platform", "Connection Method", "Credentials"] as const;
type AccountSetupStep = (typeof accountSetupSteps)[number];

type PlatformCard = {
  id: TradeSyncerVenue;
  title: string;
  detail: string;
  environment: "Demo" | "Live" | "Staging";
  label: string;
  brokerAccountRef: string;
  status: "ready" | "planned";
  defaultSymbols: string[];
  connectionOptions: Array<{
    id: string;
    title: string;
    detail: string;
    recommended?: boolean;
  }>;
};

const platformCards: PlatformCard[] = [
  {
    id: "tradovate",
    title: "Tradovate",
    detail: "Retail futures and prop-style fanout through the direct futures stack.",
    environment: "Demo",
    label: "Tradovate-Demo-Lead",
    brokerAccountRef: "SIM778201",
    status: "ready",
    defaultSymbols: ["MNQ", "NQ", "MES"],
    connectionOptions: [
      {
        id: "oauth",
        title: "Broker Connect",
        detail: "Retail-style broker connect flow. Best path for subscribers.",
        recommended: true,
      },
      {
        id: "api",
        title: "Advanced API",
        detail: "Manual partner/API credentials for internal ops or fallback testing.",
      },
    ],
  },
  {
    id: "rithmic",
    title: "Rithmic",
    detail: "Low-latency futures lane for serious operators and prop-style routing.",
    environment: "Live",
    label: "Rithmic-Sim-Lead",
    brokerAccountRef: "RIT-MNQ-01",
    status: "ready",
    defaultSymbols: ["MNQ", "NQ", "M2K"],
    connectionOptions: [
      {
        id: "gateway",
        title: "Gateway Session",
        detail: "Link a managed gateway lane and let kwantify control the sync lifecycle.",
        recommended: true,
      },
      {
        id: "manual",
        title: "Manual Seat Mapping",
        detail: "Attach an existing managed seat and operator alias for controlled testing.",
      },
    ],
  },
  {
    id: "metatrader5",
    title: "MetaTrader 5",
    detail: "Terminal bridge lane for CFD or broker terminals that need an EA-side adapter.",
    environment: "Demo",
    label: "MT5-Lead",
    brokerAccountRef: "MT5-0001",
    status: "planned",
    defaultSymbols: ["NAS100", "US30", "XAUUSD"],
    connectionOptions: [
      {
        id: "terminal-bridge",
        title: "Terminal Bridge",
        detail: "Install the kwantify bridge in the terminal and pair it to this account.",
        recommended: true,
      },
    ],
  },
  {
    id: "metatrader4",
    title: "MetaTrader 4",
    detail: "Legacy terminal bridge path for brokers that still need MT4 account copying.",
    environment: "Demo",
    label: "MT4-Lead",
    brokerAccountRef: "MT4-0001",
    status: "planned",
    defaultSymbols: ["NAS100", "US30", "XAUUSD"],
    connectionOptions: [
      {
        id: "terminal-bridge",
        title: "Terminal Bridge",
        detail: "Pair the MT4 account through a bridge adapter and symbol map.",
        recommended: true,
      },
    ],
  },
  {
    id: "ctrader",
    title: "cTrader",
    detail: "Copy-trading path for cTrader-style broker accounts.",
    environment: "Live",
    label: "cTrader-Lead",
    brokerAccountRef: "CTR-1001",
    status: "planned",
    defaultSymbols: ["NAS100", "US100", "XAUUSD"],
    connectionOptions: [
      {
        id: "open-api",
        title: "Open API Connect",
        detail: "Direct account authorization flow once the cTrader lane is enabled.",
        recommended: true,
      },
    ],
  },
  {
    id: "dxtrade",
    title: "DXtrade",
    detail: "Adapter lane for funded/broker environments that expose DXtrade logins.",
    environment: "Live",
    label: "DXtrade-Lead",
    brokerAccountRef: "DX-1001",
    status: "planned",
    defaultSymbols: ["US100", "US30", "XAUUSD"],
    connectionOptions: [
      {
        id: "web-adapter",
        title: "Adapter Connect",
        detail: "Platform adapter path with login and symbol-policy verification.",
        recommended: true,
      },
    ],
  },
  {
    id: "matchtrader",
    title: "Match-Trader",
    detail: "Planned browser-platform adapter for retail and prop broker copies.",
    environment: "Live",
    label: "MatchTrader-Lead",
    brokerAccountRef: "MATCH-1001",
    status: "planned",
    defaultSymbols: ["US100", "GER40", "XAUUSD"],
    connectionOptions: [
      {
        id: "web-adapter",
        title: "Adapter Connect",
        detail: "Account linking path once the Match-Trader adapter is enabled.",
        recommended: true,
      },
    ],
  },
  {
    id: "tradelocker",
    title: "TradeLocker",
    detail: "Planned adapter path for modern prop dashboards and browser-native broker lanes.",
    environment: "Live",
    label: "TradeLocker-Lead",
    brokerAccountRef: "TL-1001",
    status: "planned",
    defaultSymbols: ["US100", "US30", "XAUUSD"],
    connectionOptions: [
      {
        id: "web-adapter",
        title: "Adapter Connect",
        detail: "Attach the account through the TradeLocker adapter and sync policies after validation.",
        recommended: true,
      },
    ],
  },
  {
    id: "projectx",
    title: "ProjectX",
    detail: "Planned futures adapter lane for specialized prop or broker infrastructure.",
    environment: "Live",
    label: "ProjectX-Lead",
    brokerAccountRef: "PX-1001",
    status: "planned",
    defaultSymbols: ["MNQ", "NQ", "ES"],
    connectionOptions: [
      {
        id: "adapter",
        title: "Venue Adapter",
        detail: "Managed venue adapter once ProjectX account support is enabled.",
        recommended: true,
      },
    ],
  },
  {
    id: "quantower",
    title: "Quantower",
    detail: "Desktop execution adapter for users who want a platform-side sync seat.",
    environment: "Live",
    label: "Quantower-Lead",
    brokerAccountRef: "QW-1001",
    status: "planned",
    defaultSymbols: ["MNQ", "NQ", "MES"],
    connectionOptions: [
      {
        id: "desktop-adapter",
        title: "Desktop Adapter",
        detail: "Attach the desktop seat, then bind the managed lane once the adapter is verified.",
        recommended: true,
      },
    ],
  },
];

function normalizeAccountSetupStep(value: string | null): AccountSetupStep {
  if (value === "Connection Method" || value === "Credentials") {
    return value;
  }
  return "Select Platform";
}

function normalizeVenue(value: string | null): TradeSyncerVenue | null {
  const matched = platformCards.find((card) => card.id === value);
  return matched?.id ?? null;
}

function buildPlatformPreset(platformId: TradeSyncerVenue) {
  const preset = platformCards.find((card) => card.id === platformId);
  if (!preset) {
    return null;
  }
  return {
    venue: preset.id,
    environment: preset.environment,
    label: preset.label,
    brokerAccountRef: preset.brokerAccountRef,
    server: "",
    terminalAlias: "",
    notes: "",
  };
}

const detailCards = [
  {
    icon: CheckCircle2,
    title: "Overview",
    text: "Broker, balance, equity, environment, timezone, and operator label should be visible without opening a drawer.",
  },
  {
    icon: SlidersHorizontal,
    title: "Account Management",
    text: "Editable account label, password/token refresh actions, and whether balance should be considered in follower sizing.",
  },
  {
    icon: ShieldCheck,
    title: "Equity Protector",
    text: "Minimum equity, maximum equity, and emergency disable/flatten thresholds should live at the account level.",
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function toDisplayVenue(venue: string) {
  const venueLabels: Record<string, string> = {
    tradovate: "Tradovate",
    rithmic: "Rithmic",
    metatrader5: "MetaTrader 5",
    metatrader4: "MetaTrader 4",
    ctrader: "cTrader",
    dxtrade: "DXtrade",
    matchtrader: "Match-Trader",
    tradelocker: "TradeLocker",
    projectx: "ProjectX",
    quantower: "Quantower",
  };
  return venueLabels[venue] ?? venue.charAt(0).toUpperCase() + venue.slice(1);
}

function toDisplayConnection(state: TradeSyncerAccountRecord["connectionState"]) {
  switch (state) {
    case "connected":
      return "Connected";
    case "needs_reauth":
      return "Needs Re-auth";
    case "draft":
      return "Draft";
    default:
      return "Review";
  }
}

function toDisplaySyncStatus(status: TradeSyncerAccountRecord["syncStatus"]) {
  switch (status) {
    case "enabled":
      return "Enabled";
    case "paused":
      return "Paused";
    default:
      return "Review";
  }
}

function toDisplayManagedBinding(params: {
  account: TradeSyncerAccountRecord;
  managedAccounts: FuturesAccountRecord[];
}) {
  const managedAccount = params.managedAccounts.find(
    (item) => item.id === params.account.managedFuturesAccountId
  );

  if (!params.account.managedFuturesAccountId) {
    return "Not bound";
  }

  return managedAccount?.label ?? "Binding stale";
}

function TradeSyncerAccountsWorkspaceContent({
  accounts,
  metrics,
  managedFuturesAccounts,
  managedFuturesRoutingProfiles,
}: {
  accounts: TradeSyncerAccountRecord[];
  metrics: TradeSyncerOverviewMetric[];
  managedFuturesAccounts: FuturesAccountRecord[];
  managedFuturesRoutingProfiles: FuturesRoutingProfile[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modal = searchParams.get("modal");
  const selectedAccount = searchParams.get("account") ?? accounts[0]?.id;
  const activeTab = searchParams.get("tab") ?? "Overview";
  const result = searchParams.get("result");
  const tradovateConnect = searchParams.get("tradovateConnect");
  const connectMessage = searchParams.get("message");
  const requestedSetupStep = normalizeAccountSetupStep(searchParams.get("step"));
  const requestedVenue = normalizeVenue(searchParams.get("venue"));
  const requestedConnectionMethod = searchParams.get("connectionMethod");
  const currentAccount = accounts.find((account) => account.id === selectedAccount) ?? accounts[0];
  const detailTabs = detailCards
    .map((card) => card.title)
    .concat("Managed Futures Binding", "Trading Symbols");
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [connectionMethod, setConnectionMethod] = useState("oauth");
  const [bindingForm, setBindingForm] = useState<{ managedFuturesAccountId: string }>({
    managedFuturesAccountId: NO_MANAGED_LANE,
  });
  const [accountForm, setAccountForm] = useState({
    ...(buildPlatformPreset(requestedVenue ?? "tradovate") ?? buildPlatformPreset("tradovate")!),
    username: "",
    password: "",
  });
  const effectiveVenue = requestedVenue ?? accountForm.venue;
  const effectiveConnectionMethod = requestedConnectionMethod ?? connectionMethod;
  const selectedPlatform = platformCards.find((card) => card.id === effectiveVenue) ?? platformCards[0];
  const selectedConnectionOption =
    selectedPlatform.connectionOptions.find((option) => option.id === effectiveConnectionMethod) ??
    selectedPlatform.connectionOptions[0];

  const buildAccountModalHref = (overrides: {
    step?: AccountSetupStep;
    venue?: TradeSyncerVenue;
    connectionMethod?: string;
    result?: string | null;
  } = {}) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("modal", "add-account");
    if (selectedAccount) {
      params.set("account", selectedAccount);
    }
    if (activeTab) {
      params.set("tab", activeTab);
    }
    params.set("step", overrides.step ?? requestedSetupStep);
    params.set("venue", overrides.venue ?? effectiveVenue);
    params.set("connectionMethod", overrides.connectionMethod ?? effectiveConnectionMethod);
    if (overrides.result) {
      params.set("result", overrides.result);
    } else {
      params.delete("result");
    }
    return `/trade-syncer/accounts?${params.toString()}`;
  };
  const addAccountCloseHref = `/trade-syncer/accounts?account=${encodeURIComponent(currentAccount?.id ?? accounts[0]?.id ?? "")}&tab=${encodeURIComponent(activeTab)}`;
  const tradovateBrokerConnectHref =
    selectedPlatform.id === "tradovate"
      ? `/api/connector/futures/tradovate/oauth/start?redirectTo=${encodeURIComponent(
          buildAccountModalHref({
            step: "Credentials",
            venue: "tradovate",
            connectionMethod: "oauth",
          })
        )}&source=trade_syncer`
      : null;

  useEffect(() => {
    if (modal === "bind-managed" && currentAccount) {
      setBindingForm({
        managedFuturesAccountId: currentAccount.managedFuturesAccountId ?? NO_MANAGED_LANE,
      });
    }
    if (modal === "add-account") {
      setSubmitError(null);
      setTestMessage(null);
    }
  }, [modal, currentAccount?.id, currentAccount?.managedFuturesAccountId]);

  useEffect(() => {
    if (modal !== "add-account") {
      return;
    }
    if (requestedVenue) {
      const preset = buildPlatformPreset(requestedVenue);
      if (preset && accountForm.venue !== requestedVenue) {
        setAccountForm((current) => ({
          ...current,
          ...preset,
        }));
      }
    }
  }, [modal, requestedVenue, accountForm.venue]);

  useEffect(() => {
    if (modal !== "add-account") {
      return;
    }
    const targetPlatform = platformCards.find((card) => card.id === (requestedVenue ?? accountForm.venue)) ?? platformCards[0];
    const nextConnectionMethod =
      targetPlatform.connectionOptions.find((option) => option.id === requestedConnectionMethod)?.id ??
      targetPlatform.connectionOptions.find((option) => option.recommended)?.id ??
      targetPlatform.connectionOptions[0]?.id ??
      "oauth";
    if (connectionMethod !== nextConnectionMethod) {
      setConnectionMethod(nextConnectionMethod);
    }
  }, [modal, requestedVenue, requestedConnectionMethod, accountForm.venue, connectionMethod]);

  if (!currentAccount) {
    return null;
  }

  const venueManagedAccounts = managedFuturesAccounts.filter((account) => account.venue === currentAccount.venue);
  const currentManagedAccount = managedFuturesAccounts.find(
    (account) => account.id === currentAccount.managedFuturesAccountId
  );
  const currentManagedRoute = currentManagedAccount
    ? managedFuturesRoutingProfiles.find((route) => route.id === currentManagedAccount.routeProfileIds[0]) ?? null
    : null;
  const bindingOptions = ["None"].concat(venueManagedAccounts.map((account) => account.label));

  const resolvedBindingValue =
    bindingForm.managedFuturesAccountId === NO_MANAGED_LANE
      ? ""
      : bindingForm.managedFuturesAccountId;

  const applyPlatformPreset = (platformId: TradeSyncerVenue) => {
    const preset = buildPlatformPreset(platformId);
    if (!preset) {
      return;
    }
    setAccountForm((current) => ({
      ...current,
      ...preset,
    }));
  };

  const handleManagedBindingSave = () => {
    setSubmitError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/trade-syncer/accounts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: currentAccount.id,
            managedFuturesAccountId: resolvedBindingValue || null,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to save managed futures binding.");
        }
        router.push(
          `/trade-syncer/accounts?account=${encodeURIComponent(currentAccount.id)}&tab=${encodeURIComponent(activeTab)}&result=binding-saved`
        );
        router.refresh();
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : "Failed to save managed futures binding."
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-border bg-panel px-6 py-6">
        <div>
          <div className="text-[24px] font-semibold tracking-tight text-foreground">Accounts</div>
          <div className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            Connect, label, and govern the broker accounts that can join a sync group. This should feel clean and operational, not buried in settings noise.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/trade-syncer/accounts?account=${encodeURIComponent(currentAccount.id)}&tab=Managed%20Futures%20Binding&modal=bind-managed`}
            className="rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
          >
            Bind Managed Lane
          </Link>
          <Link
            href="/trade-syncer/accounts?modal=test-login"
            className="rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
          >
            Test Login
          </Link>
          <Link
            href="/trade-syncer/accounts?modal=add-account"
            className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-on-primary"
          >
            Add Account
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-border bg-panel px-5 py-4">
            <div className="text-[12px] text-muted">{metric.label}</div>
            <div className="mt-4 text-[18px] font-semibold text-foreground">{metric.value}</div>
            <div className="mt-2 text-[12px] text-muted">{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-border bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
          <div>
            <div className="text-[18px] font-semibold text-foreground">Connected Accounts</div>
            <div className="mt-1 text-[12px] text-muted">This is the inventory page: simple, scan-first, and easy to edit.</div>
          </div>
          <div className="rounded-xl border border-border bg-background/40 px-3.5 py-2 text-[12px] text-muted">
            Tradovate / Rithmic / future venue adapters
          </div>
        </div>
        <div className="overflow-x-auto px-6 py-4">
          <table className="min-w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
              <tr className="border-b border-border">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Account</th>
                <th className="pb-3 pr-4 font-medium">Platform</th>
                <th className="pb-3 pr-4 font-medium">Balance</th>
                <th className="pb-3 pr-4 font-medium">Managed lane</th>
                <th className="pb-3 pr-4 font-medium">Connection</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-border/60 last:border-0">
                  <td className="py-4 pr-4 font-medium text-foreground">{account.label}</td>
                  <td className="py-4 pr-4 text-muted">{account.brokerAccountRef}</td>
                  <td className="py-4 pr-4 text-muted">{toDisplayVenue(account.venue)}</td>
                  <td className="py-4 pr-4 text-muted">{formatCurrency(account.balance)}</td>
                  <td className="py-4 pr-4 text-muted">
                    {toDisplayManagedBinding({ account, managedAccounts: managedFuturesAccounts })}
                  </td>
                  <td className="py-4 pr-4 text-muted">{toDisplayConnection(account.connectionState)}</td>
                  <td className="py-4 pr-4 text-muted">{toDisplaySyncStatus(account.syncStatus)}</td>
                  <td className="py-4">
                    <Link
                      href={`/trade-syncer/accounts?account=${encodeURIComponent(account.id)}&tab=Overview`}
                      className="rounded-xl border border-border bg-background/40 px-3 py-1.5 text-[12px] text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-semibold text-foreground">Account Detail</div>
            <div className="mt-1 text-[12px] text-muted">{currentAccount.label} / {toDisplayVenue(currentAccount.venue)} / {currentAccount.brokerAccountRef}</div>
          </div>
          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background/40 p-1">
            {detailTabs.map((tab) => {
              const active = activeTab === tab;
              return (
                <Link
                  key={tab}
                  href={`/trade-syncer/accounts?account=${encodeURIComponent(currentAccount.id)}&tab=${encodeURIComponent(tab)}`}
                  className={`rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"
                  }`}
                >
                  {tab}
                </Link>
              );
            })}
          </div>
        </div>

        {activeTab === "Managed Futures Binding" ? (
          <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium text-foreground">Managed Futures Binding</div>
                <div className="mt-2 text-[12px] leading-6 text-muted">
                  Explicitly map this Trade Syncer account onto a futures connector managed lane so dispatch preview and later live fanout stop relying on loose broker-account guesses.
                </div>
              </div>
              <Link
                href={`/trade-syncer/accounts?account=${encodeURIComponent(currentAccount.id)}&tab=Managed%20Futures%20Binding&modal=bind-managed`}
                className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-on-primary"
              >
                {currentManagedAccount ? "Rebind Lane" : "Bind Lane"}
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border bg-panel px-4 py-3 text-[12px] text-muted">
                Lane: <span className="text-foreground">{currentManagedAccount?.label ?? "Not bound"}</span>
              </div>
              <div className="rounded-xl border border-border bg-panel px-4 py-3 text-[12px] text-muted">
                Route: <span className="text-foreground">{currentManagedRoute?.label ?? "No route attached"}</span>
              </div>
              <div className="rounded-xl border border-border bg-panel px-4 py-3 text-[12px] text-muted">
                Venue: <span className="text-foreground">{toDisplayVenue(currentAccount.venue)}</span>
              </div>
              <div className="rounded-xl border border-border bg-panel px-4 py-3 text-[12px] text-muted">
                Matching lanes: <span className="text-foreground">{venueManagedAccounts.length}</span>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-panel px-4 py-3 text-[12px] leading-6 text-muted">
              {currentManagedAccount
                ? `This account is currently bound to ${currentManagedAccount.label}${currentManagedRoute ? ` on ${currentManagedRoute.label}` : ""}.`
                : "No managed futures lane is attached yet, so dispatch preview will stay in review even if the route profile itself exists."}
            </div>
          </div>
        ) : activeTab === "Trading Symbols" ? (
          <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
            <div className="text-[13px] font-medium text-foreground">Trading Symbols</div>
            <div className="mt-2 text-[12px] leading-6 text-muted">
              Search, enable/disable symbols, and apply min/max lot rules per instrument before the account joins a sync group.
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {currentAccount.enabledSymbols.map((symbol) => (
                <label key={symbol} className="flex items-center justify-between rounded-xl border border-border bg-panel px-4 py-3 text-[13px]">
                  <span className="text-foreground">{symbol}</span>
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--color-primary)]" />
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {detailCards
              .filter((card) => card.title === activeTab)
              .map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className="rounded-3xl border border-border bg-background/40 p-6 xl:col-span-3">
                    <div className="flex items-center gap-2 text-[18px] font-semibold text-foreground">
                      <Icon className="h-5 w-5 text-primary" />
                      {card.title}
                    </div>
                    <div className="mt-3 text-[13px] leading-6 text-muted">{card.text}</div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-border bg-panel px-4 py-3 text-[12px] text-muted">Balance: {formatCurrency(currentAccount.balance)}</div>
                      <div className="rounded-xl border border-border bg-panel px-4 py-3 text-[12px] text-muted">Connection: {toDisplayConnection(currentAccount.connectionState)}</div>
                      <div className="rounded-xl border border-border bg-panel px-4 py-3 text-[12px] text-muted">Status: {toDisplaySyncStatus(currentAccount.syncStatus)}</div>
                      <div className="rounded-xl border border-border bg-panel px-4 py-3 text-[12px] text-muted">Timezone: {currentAccount.timezone}</div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {modal === "add-account" ? (
        <TradeSyncerModal
          title="Add Account"
          description="Mirror the broker onboarding flow here, then link the account into a copier group once the login is healthy."
          onClose={() => router.push(addAccountCloseHref)}
          closeHref={addAccountCloseHref}
        >
          {submitError ? (
            <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/5 p-4 text-[13px] leading-6 text-danger">
              {submitError}
            </div>
          ) : null}
          {tradovateConnect ? (
            <div
              className={`mb-4 rounded-2xl border p-4 text-[13px] leading-6 ${
                tradovateConnect === "connected"
                  ? "border-primary/20 bg-primary/5 text-primary"
                  : "border-danger/20 bg-danger/5 text-danger"
              }`}
            >
              {connectMessage ||
                (tradovateConnect === "connected"
                  ? "Tradovate broker connect linked successfully."
                  : "Tradovate broker connect could not be completed.")}
            </div>
          ) : null}
          {testMessage ? (
            <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-primary">
              {testMessage}
            </div>
          ) : null}
          {result ? (
            <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-primary">
              {result === "test-ok"
                ? "Connection test passed. Account discovery and venue handshake are ready for the next step."
                : result === "connect-error"
                  ? "The account could not be saved. Check the required fields and try again."
                : "Account linked in draft mode. The next real build will persist this and show live health immediately in the table."}
            </div>
          ) : null}
          <div className="mb-5 inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background/40 p-1">
            {accountSetupSteps.map((step) => {
              const active = requestedSetupStep === step;
              return (
                <Link
                  key={step}
                  href={buildAccountModalHref({ step })}
                  className={`rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"
                  }`}
                >
                  {step}
                </Link>
              );
            })}
          </div>
          <div className="mb-4 rounded-2xl border border-border bg-background/40 p-4 text-[12px] leading-6 text-muted">
            <span className="text-foreground">{selectedPlatform.title}</span>: {selectedPlatform.detail}{" "}
            {selectedPlatform.status === "ready"
              ? "This lane is part of the active copy-trading backbone."
              : "This lane is being prepared as a subscriber onboarding path and will save as a draft connection until the live adapter is wired."}
          </div>
          {requestedSetupStep === "Select Platform" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {platformCards.map((card) => {
                const selected = effectiveVenue === card.id;
                const recommendedConnectionMethod =
                  card.connectionOptions.find((option) => option.recommended)?.id ??
                  card.connectionOptions[0]?.id ??
                  "oauth";
                return (
                  <Link
                    key={card.id}
                    href={buildAccountModalHref({
                      step: "Connection Method",
                      venue: card.id,
                      connectionMethod: recommendedConnectionMethod,
                    })}
                    className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                      selected
                        ? "border-primary/40 bg-primary/10"
                        : "border-border bg-background/40 hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-foreground">{card.title}</div>
                      <div
                        className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                          card.status === "ready"
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-border text-muted"
                        }`}
                      >
                        {card.status === "ready" ? "Live lane" : "Planned"}
                      </div>
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-muted">{card.detail}</div>
                  </Link>
                );
              })}
            </div>
          ) : requestedSetupStep === "Connection Method" ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {selectedPlatform.connectionOptions.map((option) => {
                  const selected = effectiveConnectionMethod === option.id;
                  return (
                    <Link
                      key={option.id}
                      href={buildAccountModalHref({
                        step: "Connection Method",
                        connectionMethod: option.id,
                      })}
                      className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                        selected
                          ? "border-primary/40 bg-primary/10"
                          : "border-border bg-background/40 hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-foreground">{option.title}</div>
                        {option.recommended ? (
                          <div className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-primary">
                            Recommended
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[12px] leading-5 text-muted">{option.detail}</div>
                    </Link>
                  );
                })}
              </div>
              <div className="rounded-2xl border border-border bg-panel px-4 py-3 text-[12px] leading-6 text-muted">
                <span className="text-foreground">Connection path:</span>{" "}
                {selectedConnectionOption?.detail ?? "Select a connection method to continue."}
              </div>
              {selectedPlatform.id === "tradovate" && selectedConnectionOption?.id === "oauth" ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] leading-6 text-primary">
                  Broker Connect should feel like PickMyTrade here: we send you to Tradovate to log in, then bring you back to this Trade Syncer flow with the broker session linked.
                </div>
              ) : null}
            </div>
          ) : (
            selectedPlatform.id === "tradovate" && selectedConnectionOption?.id === "oauth" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-primary">
                  Click <span className="font-semibold text-foreground">Connect to Tradovate</span>. We will forward you to Tradovate to sign in, then return you to this account setup flow with the broker connection linked.
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/40 p-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
                      What you do
                    </div>
                    <div className="mt-3 space-y-2 text-[12px] leading-6 text-muted">
                      <div>1. Click the connect button below.</div>
                      <div>2. Sign in on Tradovate.</div>
                      <div>3. Tradovate sends you back here.</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/40 p-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
                      What kwantify stores
                    </div>
                    <div className="mt-3 space-y-2 text-[12px] leading-6 text-muted">
                      <div>OAuth broker session for the connected user</div>
                      <div>Environment selection from the Tradovate OAuth app</div>
                      <div>Returned broker identity for later account sync and lane binding</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-panel px-4 py-3 text-[12px] leading-6 text-muted">
                  <span className="text-foreground">Why this path matters:</span> this is the retail broker-connect flow we want long term. Advanced API stays as the internal fallback while the partner/OAuth lane matures.
                </div>
              </div>
            ) : (
            <form
              id="trade-syncer-add-account-form"
              action="/api/trade-syncer/accounts"
              method="post"
              className="space-y-4"
            >
              <input type="hidden" name="redirectTo" value="/trade-syncer/accounts" />
              <input type="hidden" name="redirectAccountId" value={currentAccount.id} />
              <input type="hidden" name="redirectTab" value={activeTab} />
              <input type="hidden" name="redirectResult" value="connected" />
              <input type="hidden" name="venue" value={selectedPlatform.id} />
              <input
                type="hidden"
                name="connectionState"
                value={selectedPlatform.id === "tradovate" || selectedPlatform.id === "rithmic" ? "connected" : "draft"}
              />
              <input
                type="hidden"
                name="syncStatus"
                value={selectedPlatform.id === "tradovate" || selectedPlatform.id === "rithmic" ? "review" : "paused"}
              />
              <input
                type="hidden"
                name="healthNote"
                value={
                  selectedPlatform.id === "tradovate" || selectedPlatform.id === "rithmic"
                    ? `${toDisplayVenue(selectedPlatform.id)} account linked through ${selectedConnectionOption.title}. Run entitlement and account checks before attaching it to a live copier.`
                    : `${toDisplayVenue(selectedPlatform.id)} path saved in draft mode through ${selectedConnectionOption.title}. This venue still needs its adapter/bridge before live subscriber copying.`
                }
              />
              <input type="hidden" name="enabledSymbols" value={selectedPlatform.defaultSymbols.join(",")} />
              <div className="grid gap-4 md:grid-cols-2">
              <TradeSyncerSelect
                label="Platform"
                name="platformDisplay"
                options={platformCards.map((card) => card.title)}
                value={selectedPlatform.title}
                onChange={(next) => {
                  const matched = platformCards.find((card) => card.title === next);
                  if (matched) {
                    applyPlatformPreset(matched.id);
                  }
                }}
              />
              <TradeSyncerSelect
                label="Environment"
                name="environment"
                options={["Demo", "Live", "Staging"]}
                value={accountForm.environment}
                onChange={(next) =>
                  setAccountForm((current) => ({
                    ...current,
                    environment: next as typeof current.environment,
                  }))
                }
              />
              <TradeSyncerField name="label" label="Account Label" placeholder="Tradovate-Demo-Lead" value={accountForm.label} onChange={(next) => setAccountForm((current) => ({ ...current, label: next }))} />
              <TradeSyncerField name="brokerAccountRef" label="Login / Account ID" placeholder="SIM778201" value={accountForm.brokerAccountRef} onChange={(next) => setAccountForm((current) => ({ ...current, brokerAccountRef: next }))} />
              {(selectedPlatform.id === "metatrader5" ||
                selectedPlatform.id === "metatrader4" ||
                selectedPlatform.id === "quantower") ? (
                <>
                  <TradeSyncerField name="terminalAlias" label="Terminal Alias" placeholder="Karen NAS100 Demo" value={accountForm.terminalAlias} onChange={(next) => setAccountForm((current) => ({ ...current, terminalAlias: next }))} />
                  <TradeSyncerField name="server" label="Server / Broker" placeholder="Pepperstone-Demo01" value={accountForm.server} onChange={(next) => setAccountForm((current) => ({ ...current, server: next }))} />
                  <TradeSyncerField name="username" label="Bridge Username" placeholder="Broker or terminal login" value={accountForm.username} onChange={(next) => setAccountForm((current) => ({ ...current, username: next }))} />
                  <TradeSyncerField name="password" label="Bridge Secret" placeholder="Pairing code or bridge secret" type="password" value={accountForm.password} onChange={(next) => setAccountForm((current) => ({ ...current, password: next }))} />
                </>
              ) : (
                <>
                  <TradeSyncerField name="username" label="Username" placeholder="Broker username" value={accountForm.username} onChange={(next) => setAccountForm((current) => ({ ...current, username: next }))} />
                  <TradeSyncerField name="password" label="Password / Secret" placeholder="Password or access token" type="password" value={accountForm.password} onChange={(next) => setAccountForm((current) => ({ ...current, password: next }))} />
                  <TradeSyncerField name="server" label="Server / Workspace" placeholder="Optional server or workspace label" value={accountForm.server} onChange={(next) => setAccountForm((current) => ({ ...current, server: next }))} />
                  <TradeSyncerField name="notes" label="Operator Notes" placeholder="Optional desk note for this subscriber account" value={accountForm.notes} onChange={(next) => setAccountForm((current) => ({ ...current, notes: next }))} />
                </>
              )}
              </div>
              <div className="rounded-2xl border border-border bg-panel px-4 py-3 text-[12px] leading-6 text-muted">
                <span className="text-foreground">What happens next:</span>{" "}
                {selectedPlatform.id === "tradovate" && selectedConnectionOption?.id === "api"
                  ? "Use the Advanced API lane for the current Tradovate operator path. This account will save as the copier identity while the direct Tradovate credentials stay in the managed futures connection layer."
                  : selectedPlatform.status === "ready"
                  ? `Test the ${selectedConnectionOption?.title ?? "connection"} path, save the account, then attach it as a master or follower inside Copier Engine.`
                  : `Save this as a draft subscriber account now. The UI path is ready, but the live ${selectedPlatform.title} adapter still needs backend work before it can join active copy execution.`}
              </div>
            </form>
            )
          )}
          <div className="mt-5 flex gap-3">
            {requestedSetupStep === "Credentials" ? (
              selectedPlatform.id === "tradovate" && selectedConnectionOption?.id === "oauth" && tradovateBrokerConnectHref ? (
              <>
                <Link
                  href={buildAccountModalHref({
                    step: "Connection Method",
                    venue: "tradovate",
                    connectionMethod: "oauth",
                    result: null,
                  })}
                  className="flex-1 rounded-xl border border-border bg-background/40 py-3 text-center text-[13px] text-foreground"
                >
                  Back
                </Link>
                <Link
                  href={tradovateBrokerConnectHref}
                  className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary"
                >
                  Connect to Tradovate
                </Link>
              </>
              ) : (
              <>
                <Link
                  href={buildAccountModalHref({ step: "Credentials", result: "test-ok" })}
                  className="flex-1 rounded-xl border border-border bg-background/40 py-3 text-center text-[13px] text-foreground"
                >
                  {selectedPlatform.status === "ready" ? "Test Connection" : "Preview Path"}
                </Link>
                <button
                  type="submit"
                  form="trade-syncer-add-account-form"
                  className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary"
                >
                  {selectedPlatform.id === "tradovate" && selectedConnectionOption?.id === "api"
                    ? "Save Advanced API Account"
                    : selectedPlatform.status === "ready"
                      ? "Connect Account"
                      : "Save Draft Account"}
                </button>
              </>
              )
            ) : (
              selectedPlatform.id === "tradovate" && selectedConnectionOption?.id === "oauth" && tradovateBrokerConnectHref ? (
              <>
                <Link
                  href={buildAccountModalHref({
                    step: "Select Platform",
                    venue: "tradovate",
                    connectionMethod: "oauth",
                    result: null,
                  })}
                  className="flex-1 rounded-xl border border-border bg-background/40 py-3 text-center text-[13px] text-foreground"
                >
                  Back
                </Link>
                <Link
                  href={tradovateBrokerConnectHref}
                  className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary"
                >
                  Connect to Tradovate
                </Link>
              </>
              ) : (
              <>
                <Link
                  href={buildAccountModalHref({
                    step: requestedSetupStep === "Select Platform" ? "Connection Method" : "Credentials",
                  })}
                  className="flex-1 rounded-xl border border-border bg-background/40 py-3 text-center text-[13px] text-foreground"
                >
                  {requestedSetupStep === "Select Platform" ? "Choose Platform" : "Continue"}
                </Link>
                <Link
                  href={buildAccountModalHref({
                    step: requestedSetupStep === "Select Platform" ? "Connection Method" : "Credentials",
                  })}
                  className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary"
                >
                  {requestedSetupStep === "Select Platform" ? "Next Step" : "Use Connection Path"}
                </Link>
              </>
              )
            )}
          </div>
        </TradeSyncerModal>
      ) : null}

      {modal === "test-login" ? (
        <TradeSyncerModal
          title="Test Login"
          description="Run the first broker health check before attaching this account to any live sync group."
          onClose={() => router.push(`/trade-syncer/accounts?account=${encodeURIComponent(currentAccount.id)}&tab=${encodeURIComponent(activeTab)}`)}
        >
          {result ? (
            <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-primary">
              {result === "checked"
                ? "Broker auth responded normally. This is the right moment to import the account into a copier group."
                : "Account marked healthy for operator review."}
            </div>
          ) : null}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-primary">
            Connection status: ready to test. Next version should validate auth, account discovery, and symbol entitlement here.
          </div>
          <div className="mt-5 flex gap-3">
            <Link
              href={`/trade-syncer/accounts?modal=test-login&account=${encodeURIComponent(currentAccount.id)}&tab=${encodeURIComponent(activeTab)}&result=checked`}
              className="flex-1 rounded-xl border border-border bg-background/40 py-3 text-center text-[13px] text-foreground"
            >
              Run Check
            </Link>
            <Link
              href={`/trade-syncer/accounts?modal=test-login&account=${encodeURIComponent(currentAccount.id)}&tab=${encodeURIComponent(activeTab)}&result=healthy`}
              className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary"
            >
              Mark Healthy
            </Link>
          </div>
        </TradeSyncerModal>
      ) : null}

      {modal === "bind-managed" ? (
        <TradeSyncerModal
          title="Bind Managed Futures Lane"
          description="Attach this Trade Syncer account to the managed futures account that should receive translated dispatch intents."
          onClose={() =>
            router.push(`/trade-syncer/accounts?account=${encodeURIComponent(currentAccount.id)}&tab=Managed%20Futures%20Binding`)
          }
        >
          {submitError ? (
            <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/5 p-4 text-[13px] leading-6 text-danger">
              {submitError}
            </div>
          ) : null}
          {result === "binding-saved" ? (
            <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-primary">
              Managed futures binding saved. Dispatch preview can now promote this account out of review when the rest of the follower state is healthy.
            </div>
          ) : null}
          <div className="grid gap-4">
            <TradeSyncerSelect
              label="Managed Lane"
              options={bindingOptions}
              value={
                managedFuturesAccounts.find((account) => account.id === resolvedBindingValue)?.label ?? "None"
              }
              onChange={(next) => {
                const matched = venueManagedAccounts.find((account) => account.label === next);
                setBindingForm({ managedFuturesAccountId: matched?.id ?? NO_MANAGED_LANE });
              }}
            />
            <div className="rounded-2xl border border-border bg-background/40 p-4 text-[13px] leading-6 text-muted">
              {resolvedBindingValue
                ? (() => {
                    const matched = managedFuturesAccounts.find((account) => account.id === resolvedBindingValue);
                    const route = matched
                      ? managedFuturesRoutingProfiles.find((item) => item.id === matched.routeProfileIds[0]) ?? null
                      : null;
                    return matched
                      ? `${matched.label} / ${matched.environment.toUpperCase()} / ${matched.platformAccess}${route ? ` / ${route.label}` : ""}`
                      : "Selected lane is missing from the managed futures store.";
                  })()
                : "No lane selected. Leave this empty if the account should stay detached for now."}
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <Link
              href={`/trade-syncer/accounts?account=${encodeURIComponent(currentAccount.id)}&tab=Managed%20Futures%20Binding`}
              className="flex-1 rounded-xl border border-border bg-background/40 py-3 text-center text-[13px] text-foreground"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleManagedBindingSave}
              disabled={isPending}
              className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save Binding"}
            </button>
          </div>
        </TradeSyncerModal>
      ) : null}
    </div>
  );
}

export default function TradeSyncerAccountsWorkspace(props: {
  accounts: TradeSyncerAccountRecord[];
  metrics: TradeSyncerOverviewMetric[];
  managedFuturesAccounts: FuturesAccountRecord[];
  managedFuturesRoutingProfiles: FuturesRoutingProfile[];
}) {
  return (
    <Suspense fallback={null}>
      <TradeSyncerAccountsWorkspaceContent {...props} />
    </Suspense>
  );
}
