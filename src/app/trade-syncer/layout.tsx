import type { ReactNode } from "react";
import TradeSyncerShell from "@/components/trade-syncer/TradeSyncerShell";

export default function TradeSyncerLayout({ children }: { children: ReactNode }) {
  return <TradeSyncerShell>{children}</TradeSyncerShell>;
}
