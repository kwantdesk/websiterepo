import TradeSyncerLogsWorkspace from "@/components/trade-syncer/TradeSyncerLogsWorkspace";
import { getTradeSyncerOverview } from "@/lib/tradeSyncer.server";

export default async function TradeSyncerCopierLogsPage() {
  const overview = await getTradeSyncerOverview();

  return (
    <TradeSyncerLogsWorkspace
      accounts={overview.accounts}
      followerRepairView={overview.followerRepairView}
      logs={overview.logs}
      syncGroups={overview.syncGroups}
    />
  );
}
