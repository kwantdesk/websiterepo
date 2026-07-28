import TradeSyncerWorkspace from "@/components/trade-syncer/TradeSyncerWorkspace";
import { getTradeSyncerOverview } from "@/lib/tradeSyncer.server";

export default async function TradeSyncerDashboardPage() {
  const overview = await getTradeSyncerOverview();
  return <TradeSyncerWorkspace overview={overview} />;
}
