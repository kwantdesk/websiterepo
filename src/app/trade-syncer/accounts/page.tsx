import TradeSyncerAccountsWorkspace from "@/components/trade-syncer/TradeSyncerAccountsWorkspace";
import { getTradeSyncerOverview } from "@/lib/tradeSyncer.server";

export default async function TradeSyncerAccountsPage() {
  const overview = await getTradeSyncerOverview();

  return (
    <TradeSyncerAccountsWorkspace
      accounts={overview.accounts}
      metrics={overview.accountMetrics}
      managedFuturesAccounts={overview.managedFuturesAccounts}
      managedFuturesRoutingProfiles={overview.managedFuturesRoutingProfiles}
    />
  );
}
