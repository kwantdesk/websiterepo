import TradeSyncerTemplatesWorkspace from "@/components/trade-syncer/TradeSyncerTemplatesWorkspace";
import { getTradeSyncerOverview } from "@/lib/tradeSyncer.server";

export default async function TradeSyncerTemplatesPage() {
  const overview = await getTradeSyncerOverview();

  return <TradeSyncerTemplatesWorkspace templates={overview.templates} />;
}
