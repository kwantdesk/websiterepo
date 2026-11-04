import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Control from '@/components/ChartIndicatorsControl';
import { CHART_INDICATOR_CATALOG } from '@/lib/chartIndicatorCatalog';
import { defaultIndicatorSettings, INDICATOR_NUMERIC_SETTINGS, normalizeStoredIndicator } from '@/lib/chartIndicatorConfig';
import { defaultChartSettings } from '@/lib/chartSettings';
const tick = () => new Promise(r => setTimeout(r, 0)), same = (a: any, b: any) => JSON.stringify(Object.entries(a.settings ?? {}).sort()) === JSON.stringify(Object.entries(b.settings ?? {}).sort()) && a.enabled === b.enabled;
export async function runPersistence() { const host = document.createElement('div'); document.body.append(host); const root = createRoot(host), rows: any[] = []; let revision = 0; for (const def of CHART_INDICATOR_CATALOG) {
    const base = normalizeStoredIndicator({ instanceId: 'audit-' + def.id, indicatorId: def.id, enabled: true, settings: defaultIndicatorSettings(def.id) });
    const numeric = (INDICATOR_NUMERIC_SETTINGS[def.id] ?? []).find(n => typeof base.settings?.[n.key] === 'number');
    let patch = {};
    if (numeric) {
        const value = Number(base.settings?.[numeric.key]);
        patch = { [numeric.key]: value + (numeric.step ?? 1) <= numeric.max ? value + (numeric.step ?? 1) : numeric.min };
    }
    else {
        const key = Object.keys(base.settings ?? {}).find(k => typeof base.settings?.[k] === 'boolean' && !/version|stable|Source/i.test(k));
        if (key)
            patch = { [key]: !base.settings?.[key] };
    }
    const expected = normalizeStoredIndicator({ ...base, settings: { ...base.settings, ...patch } });
    const record: any = { id: def.id, status: 'passed', phases: [] };
    try {
        for (const phase of ['save', 'JSON restore / reopen']) {
            revision++;
            const input = JSON.parse(JSON.stringify(expected));
            let received: any = input, calls = 0, saveEvents = 0;
            await act(async () => { root.render(<Control key={revision} instrument="NQ" broker="Paper Trading" timeframe="1m" chartInstanceId="isolated-persistence-audit" indicators={[input]} chartSettings={defaultChartSettings} settingsOpenRequest={{ instanceId: input.instanceId, requestId: revision }} onChange={next => { calls++; received = next.map(normalizeStoredIndicator)[0]; }}/>); await tick(); });
            const save = document.querySelector(`[aria-label="Save ${def.name} settings"]`) as HTMLButtonElement;
            if (!save)
                throw Error('Missing Save action');
            const observe = () => saveEvents++;
            window.addEventListener('kwantdesk:preferences-changed', observe);
            await act(async () => { save.click(); await tick(); });
            window.removeEventListener('kwantdesk:preferences-changed', observe);
            if (!saveEvents || !received || !same(expected, received))
                throw Error(phase + ' changed persisted settings');
            const close = document.querySelector(`[aria-label="Close ${def.name} settings"]`) as HTMLButtonElement;
            await act(async () => { close.click(); await tick(); });
            if (document.querySelector('[data-indicator-settings-dialog]'))
                throw Error('Saved dialog did not close');
            record.phases.push(phase);
        }
    }
    catch (error: any) {
        record.status = 'failed';
        record.error = error.message;
    }
    rows.push(record);
    console.log(def.id, record.status);
} await act(async () => root.unmount()); return rows; }
