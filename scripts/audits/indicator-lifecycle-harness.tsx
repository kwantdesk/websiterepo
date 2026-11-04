import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Control from '@/components/ChartIndicatorsControl';
import { CHART_INDICATOR_CATALOG, CHART_INDICATOR_CATEGORIES, type ChartIndicatorInstance } from '@/lib/chartIndicatorCatalog';
import { normalizeStoredIndicator } from '@/lib/chartIndicatorConfig';
import { defaultChartSettings } from '@/lib/chartSettings';
const tick = () => new Promise(r => setTimeout(r, 0));
export async function runLifecycle() {
    const report: any[] = [];
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    let state: ChartIndicatorInstance[] = [];
    const click = async (el: any) => { if (!el)
        throw Error('Missing lifecycle control'); await act(async () => { el.click(); await tick(); }); };
    const byAria = (name: string) => Array.from(document.querySelectorAll('button')).find(el => el.getAttribute('aria-label') === name);
    function App({ instrument }: {
        instrument: string;
    }) { const [items, setItems] = useState<ChartIndicatorInstance[]>([]); state = items; return <Control instrument={instrument} broker="Paper Trading" timeframe="1m" chartInstanceId="isolated-lifecycle-audit" indicators={items} chartSettings={defaultChartSettings} onChange={next => setItems(next.map(normalizeStoredIndicator))}/>; }
    for (const category of CHART_INDICATOR_CATEGORIES)
        for (const def of CHART_INDICATOR_CATALOG.filter(d => d.category === category)) {
            const instrument = category === 'Options Flow' ? 'QQQ' : 'NQ';
            const record: any = { id: def.id, name: def.name, instrument };
            try {
                await act(async () => { root.render(<App key={def.id} instrument={instrument}/>); await tick(); });
                await click(byAria('Chart indicators'));
                await click(Array.from(document.querySelectorAll('button')).find(el => el.textContent?.trim() === 'Add'));
                const add = byAria('Add ' + def.name) as HTMLButtonElement;
                if (!add) {
                    if (def.id === 'source-code-indicator') {
                        record.status = 'internal saved-script adapter; intentionally absent from library';
                        report.push(record);
                        continue;
                    }
                    throw Error('Library card missing');
                }
                if (add.disabled) {
                    record.status = 'unavailable for instrument';
                    record.reason = add.closest('[title]')?.getAttribute('title');
                    report.push(record);
                    continue;
                }
                let draw: any;
                const observe = (event: any) => draw = event.detail;
                window.addEventListener('kwantdesk:activate-chart-drawing', observe);
                await click(add);
                window.removeEventListener('kwantdesk:activate-chart-drawing', observe);
                if (def.id === 'custom-draw-on-volume-profile') {
                    if (draw?.tool !== 'fixedRangeVolumeProfile')
                        throw Error('Draw-on Add did not arm the placement tool');
                    record.status = 'drawing placement armed';
                    report.push(record);
                    continue;
                }
                if (!state.some(i => i.indicatorId === def.id && i.enabled))
                    throw Error('Add did not create enabled instance');
                record.added = true;
                const close = byAria('Close indicator library');
                if (close)
                    await click(close);
                const settingsClose = byAria('Close ' + def.name + ' settings');
                if (settingsClose)
                    await click(settingsClose);
                const trigger = byAria('Chart indicators');
                if (trigger?.getAttribute('aria-expanded') !== 'true')
                    await click(trigger);
                await click(document.querySelector('button[title="Indicator on"]'));
                if (state[0]?.enabled !== false)
                    throw Error('Disable did not reach host state');
                record.disabled = true;
                await click(document.querySelector('button[title="Indicator off"]'));
                if (Boolean(state[0]?.enabled) !== true)
                    throw Error('Enable did not reach host state');
                record.enabled = true;
                await click(document.querySelector('button[title="Remove"]'));
                if (state.length)
                    throw Error('Remove left an instance');
                record.removed = true;
                record.status = 'passed';
            }
            catch (error: any) {
                record.status = 'failed';
                record.error = error.message;
            }
            report.push(record);
            console.log(def.id, record.status);
        }
    await act(async () => root.unmount());
    return report;
}
