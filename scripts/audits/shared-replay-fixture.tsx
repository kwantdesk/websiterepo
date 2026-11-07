import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Chart from "@/components/Chart";
import GexMapWorkspace from "@/components/gex-map/GexMapWorkspace";
import WorkspaceGexMapPane from "@/components/gex-map/WorkspaceGexMapPane";
import { useBounceGexMapMirror } from "@/components/gex-map/useBounceGexMapMirror";
import { defaultChartSettings } from "@/lib/chartSettings";
import { defaultIndicatorSettings } from "@/lib/chartIndicatorConfig";
import { replayCandlesAtClock } from "@/lib/replayChartHistory";
import { replayCausalTrades } from "@/lib/replayIndicatorSafety";
import { projectionFixture } from "../../tests/fixtures/bounceProjection";
import type { Candle } from "@/lib/backtester";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

const f = projectionFixture();
f.payload.frames = f.payload.frames.map((frame, index) => ({ ...frame,
  updates: frame.updates.map(row => ({ ...row, call: row.call * (index + 1), put: row.put * (index + 1), net: row.net * (index + 1) })) }));
const prints: InstitutionalTrade[] = f.payload.candles.flatMap((bar, i) => [1000, 20000, 45000].map((offset, j) => {
  const price = 20000 + i + j * .25, volume = j + 1, bidVolume = j === 1 ? volume : 0, askVolume = j === 1 ? 0 : volume;
  return { timestamp: bar.timestamp + offset, recordIndex: i * 3 + j, eventId: `${i}-${j}`, open: price, high: price,
    low: price, close: price, volume, trades: 1, bidVolume, askVolume, delta: askVolume - bidVolume,
    aggressor: j === 1 ? "SELL" : "BUY", sideSemanticsVersion: 2 };
}));
const bars = f.payload.candles.map((bar, i) => ({ ...bar, open: 20000 + i, high: 20000 + i + .5, low: 20000 + i,
  close: 20000 + i + .5, volume: 6, trades: 3, bidVolume: 2, askVolume: 4, delta: 2 }));
const study = (id: string) => ({ instanceId: id, indicatorId: id, enabled: true, settings: defaultIndicatorSettings(id) });
const bounce = study("bounce-levels");
bounce.settings = { ...bounce.settings, sourceTicker: "QQQ", gexMapMirror: true, linkGexMapSettings: true };
const normal = [study("volume"), study("cumulative-volume-delta"), study("delta-bar"), bounce];
const footprint = [study("deep-print-footprint")];
const persisted = { surfaceVersion: 2 as const, panels: [{ id: "left", symbol: "QQQ" as const, greekMode: "GAMMA" as const }],
  viewMode: "full" as const, stepMinutes: 1, expiryScope: "FRONT_EXPIRY" as const, representation: "PER_ONE_DOLLAR_MOVE" as const };
function Fixture() {
  const [state, setState] = useState({ offset: 1220000, zone: "Australia/Brisbane", future: false });
  (window as any).setSharedReplay = setState;
  (window as any).sharedPayload = f.payload;
  const clock = f.start + state.offset;
  const tape = useMemo(() => replayCausalTrades(prints, clock), [clock]);
  const candles = useMemo(() => replayCandlesAtClock(bars.filter(bar => bar.timestamp <= clock), tape, clock, 60000, false), [clock, tape]);
  const candleRef = useRef<Candle[]>(candles); candleRef.current = candles;
  const mirror = useBounceGexMapMirror({ enabled: true, instrument: "NQ", timeframe: "1m", settings: bounce.settings, timestampMs: clock, candles: candleRef });
  return <>
    <output>{JSON.stringify({ clock, zone: state.zone, candles, tapeCount: tape.length,
      bounce: mirror.snapshot && { time: mirror.snapshot.snapshotTimeMs, levels: mirror.snapshot.levels.map(row => [row.sourceStrike, row.signedExposure]),
        times: mirror.snapshot.exposureField.map(slice => slice.timestamp) } })}</output>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 420px", height: 650 }}>
      {[normal, footprint].map((indicators, i) => <section key={i} style={{ position: "relative", minWidth: 0 }}>
        <Chart instrument="NQ" chartInstanceId={`shared-replay-${i}`} candles={candles} marketTrades={tape}
          timeframe="1m" settings={{ ...defaultChartSettings, timezone: state.zone }} indicators={indicators}
          replayTimestampMs={clock} orderFlowHistoryReady={true} marketIsActive={false} />
      </section>)}
      <section style={{ position: "relative", minWidth: 0 }} key={String(state.future)}>
        <WorkspaceGexMapPane Surface={GexMapWorkspace} paneId="replay-map" market="NQ" timeZone={state.zone}
          persistedState={{ ...persisted, timeHorizon: state.future ? "future" : "present" }} onStateChange={() => {}}
          replayActive={true} replaySessionDate="2026-11-03" replayTimestampMs={clock} />
      </section>
    </div>
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
