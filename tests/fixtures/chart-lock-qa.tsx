import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Chart from '@/components/Chart';
import { createDrawing, type Drawing } from '@/lib/chartDrawTools';
import { defaultChartSettings } from '@/lib/chartSettings';
import { PrecisionToolsStore } from '@/chart/precision-tools/store';
import { createDefaultConfigs } from '@/chart/precision-tools/defaults';
import { savePrecisionDocument } from '@/chart/precision-tools/persistence';

const start = 1793700000000;
const candles = Array.from({ length: 180 }, (_, i) => ({ timestamp: start + i * 60000, open: 20000 + Math.sin(i / 10) * 5, high: 20008 + Math.sin(i / 10) * 5, low: 19992 + Math.sin(i / 10) * 5, close: 20001 + Math.sin(i / 10) * 5, volume: 100 }));
for (const chartId of ['lock-a:NQ', 'lock-b:NQ']) {
  const store = new PrecisionToolsStore('default-workspace', chartId);
  const config = createDefaultConfigs().find(c => c.toolId === 'precision-line')!;
  store.createDraft('precision-line', config, { time: start + 110 * 60000, logicalIndex: 110, price: 19996 });
  store.updateDraft(d => ({ ...d, anchors: [{ time: start + 110 * 60000, logicalIndex: 110, price: 19996 }, { time: start + 150 * 60000, logicalIndex: 150, price: 19996 }] }));
  store.commitDraft();
  savePrecisionDocument({ schemaVersion: 1, workspaceId: 'default-workspace', chartId, objects: store.getSnapshot().objects, savedAt: Date.now() });
}
function Pane({ id }: { id: string }) {
  const [locked, setLocked] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>(() => [createDrawing('trendLine', [{ time: (start + 110 * 60000) / 1000, price: 20003 }, { time: (start + 150 * 60000) / 1000, price: 20006 }])]);
  return <section data-pane={id} style={{ width: 'min(720px,100vw)', height: 640, position: 'relative' }}>
    <button data-lock={id} aria-pressed={locked} onClick={() => setLocked(v => !v)}>Lock drawings</button>
    <div style={{ height: 600 }}><Chart instrument="NQ" chartInstanceId={id} candles={candles} timeframe="1m" settings={defaultChartSettings} drawingsLocked={locked} chartingDrawings={drawings} onChartingDrawingsChange={setDrawings} /></div>
    <output data-drawings={id} style={{ display: 'none' }}>{JSON.stringify(drawings)}</output>
  </section>;
}
createRoot(document.getElementById('root')!).render(<div style={{ display: 'flex', flexWrap: 'wrap' }}><Pane id="lock-a" /><Pane id="lock-b" /></div>);
