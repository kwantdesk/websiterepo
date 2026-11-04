"use client";

import { memo, useCallback, useMemo, type ComponentType } from "react";
import type { GexMapEmbedState, GexMapWorkspaceProps } from "./GexMapWorkspace";

type Props = {
  Surface: ComponentType<GexMapWorkspaceProps | undefined>;
  paneId: string;
  timeZone: string;
  market: "ES" | "NQ";
  persistedState: GexMapEmbedState | null;
  onStateChange: (paneId: string, state: GexMapEmbedState) => void;
  replayActive: boolean;
  replaySessionDate: string;
  replayTimestampMs: number;
};

/** Chart ticks may update the host without rebuilding an unchanged strike ladder. */
function WorkspaceGexMapPane({ Surface, paneId, timeZone, market, persistedState, onStateChange,
  replayActive, replaySessionDate, replayTimestampMs }: Props) {
  const handleStateChange = useCallback((state: GexMapEmbedState) => onStateChange(paneId, state), [onStateChange, paneId]);
  const externalReplay = useMemo(() => replayActive ? {
    active: true, sessionDate: replaySessionDate, timestampMs: replayTimestampMs,
  } : null, [replayActive, replaySessionDate, replayTimestampMs]);
  return <Surface timeZone={timeZone} market={market} enableDealerModel
    persistedState={persistedState} onStateChange={handleStateChange} externalReplay={externalReplay} />;
}

export default memo(WorkspaceGexMapPane);
