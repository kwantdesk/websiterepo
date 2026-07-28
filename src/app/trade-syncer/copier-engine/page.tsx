import TradeSyncerCopierEngineWorkspace from "@/components/trade-syncer/TradeSyncerCopierEngineWorkspace";
import { getTradeSyncerOverview } from "@/lib/tradeSyncer.server";

export default async function TradeSyncerCopierEnginePage() {
  const overview = await getTradeSyncerOverview();

  return (
    <TradeSyncerCopierEngineWorkspace
      accounts={overview.accounts}
      syncGroups={overview.syncGroups}
      templates={overview.templates}
    />
  );
}
