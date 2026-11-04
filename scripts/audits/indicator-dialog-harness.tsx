import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Control from '@/components/ChartIndicatorsControl';
import { CHART_INDICATOR_CATALOG, CHART_INDICATOR_CATEGORIES } from '@/lib/chartIndicatorCatalog';
import { defaultIndicatorSettings, normalizeStoredIndicator } from '@/lib/chartIndicatorConfig';
import { defaultChartSettings } from '@/lib/chartSettings';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
export async function runAudit(report: any, onProgress: any) {
    const catalogue = CHART_INDICATOR_CATEGORIES.flatMap(category => CHART_INDICATOR_CATALOG.filter(item => item.category === category));
    const host = document.createElement('div');
    document.body.append(host);
    let root = createRoot(host), state: any = [], revision = 0;
    const render = async (def: any, initial?: any) => {
        state = initial ?? [{ instanceId: 'audit', indicatorId: def.id, enabled: true, settings: defaultIndicatorSettings(def.id) }];
        revision++;
        await act(async () => { root.render(<Control key={revision} instrument="NQ" broker="Paper Trading" timeframe="1m" chartInstanceId="isolated-settings-audit" indicators={state} chartSettings={defaultChartSettings} settingsOpenRequest={{ instanceId: 'audit', requestId: revision }} onChange={next => { state = next.map(normalizeStoredIndicator); }}/>); await tick(); });
    };
    const dialog = () => document.querySelector('[data-indicator-settings-dialog]')!;
    const click = async (el: any) => { await act(async () => { el.click(); await tick(); }); };
    const save = async (def: any) => { await click(document.querySelector(`[aria-label="Save ${def.name} settings"]`)); };
    const tabs = () => Array.from(dialog()?.querySelectorAll('[data-indicator-settings-tabs=sections] >button[aria-pressed]') ?? []) as HTMLElement[];
    const goTab = async (name: string) => { const [route, expandedLabel] = name.split(' >> '); const [outer, inner] = route.split(' / '); const tab = tabs().find(el => el.textContent === outer); if (tab)
        await click(tab); if (inner) {
        const sub = Array.from(dialog().querySelectorAll('[data-indicator-settings-tabs=profile]>button')).find(el => el.textContent === inner);
        if (sub)
            await click(sub);
    } if (expandedLabel) {
        const button = Array.from(dialog().querySelectorAll('button[aria-expanded=false]:not([aria-haspopup])')).find(el => el.textContent?.trim() === expandedLabel);
        if (button)
            await click(button);
    } };
    const controls = () => Array.from(dialog()?.querySelectorAll('input,textarea,select,button') ?? []).filter((el: any) => !el.closest('[data-indicator-settings-tabs]') && !el.getAttribute('aria-label')?.startsWith('Save ') && !el.getAttribute('aria-label')?.startsWith('Close '));
    const meta = (el: any) => ({ tag: el.tagName, type: el.type, role: el.getAttribute('role'), popup: el.getAttribute('aria-haspopup'), pressed: el.getAttribute('aria-pressed'), label: el.getAttribute('aria-label') ?? el.closest('label')?.textContent?.trim() ?? el.textContent?.trim() ?? '', value: el.value, disabled: el.disabled });
    for (const def of catalogue.filter(d => !process.env.AUDIT_ONLY || d.id === process.env.AUDIT_ONLY)) {
        const item: any = { id: def.id, name: def.name, category: def.category, sections: [], checks: [], errors: [] };
        try {
            await render(def);
            let sectionNames = tabs().map(el => el.textContent!);
            if (!sectionNames.length)
                sectionNames.push('General');
            const expanded: string[] = [];
            for (const section of sectionNames) {
                await goTab(section);
                const nested = Array.from(dialog().querySelectorAll('[data-indicator-settings-tabs=profile]>button')).map(el => el.textContent!);
                expanded.push(...(nested.length ? nested.map(name => section + ' / ' + name) : [section]));
            }
            sectionNames = [];
            for (const path of expanded) {
                await goTab(path);
                sectionNames.push(path);
                const expanders = Array.from(dialog().querySelectorAll('button[aria-expanded=false]:not([aria-haspopup])')).map(el => el.textContent?.trim()).filter(Boolean);
                sectionNames.push(...expanders.map(label => path + ' >> ' + label));
            }
            for (const section of sectionNames) {
                await goTab(section);
                item.sections.push(section);
                let snapshots = controls().map(meta);
                for (let index = 0; index < snapshots.length; index++) {
                    if (process.env.AUDIT_CONTROL_FILTER && !new RegExp(process.env.AUDIT_CONTROL_FILTER, 'i').test(snapshots[index].label))
                        continue;
                    await render(def);
                    await goTab(section);
                    const el: any = controls()[index], m = meta(el);
                    console.log('CONTROL', def.id, section, index, m.label);
                    if (process.env.AUDIT_DROPDOWNS_ONLY && m.popup !== 'listbox' && m.tag !== 'SELECT')
                        continue;
                    if (m.disabled) {
                        item.checks.push({ ...m, section, status: 'disabled at defaults' });
                        continue;
                    }
                    const domBefore = dialog().textContent;
                    const before = JSON.parse(JSON.stringify(state));
                    const storageBefore = JSON.stringify({ ...localStorage });
                    let status = 'untested', optionCount = 0;
                    try {
                        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                            if (el.type === 'checkbox') {
                                await click(el);
                            }
                            else if (['number', 'range', 'text', 'time', 'date', 'color'].includes(el.type) || el.tagName === 'TEXTAREA') {
                                let value = el.value;
                                if (['number', 'range'].includes(el.type)) {
                                    const step = el.type === 'range' ? (Number(el.max) - Number(el.min)) / 4 : Number(el.step) || 1, min = el.min === '' ? -Infinity : Number(el.min), max = el.max === '' ? Infinity : Number(el.max), n = Number(value);
                                    value = String(n + step <= max ? n + step : n - step >= min ? n - step : n);
                                }
                                else if (el.type === 'color')
                                    value = value.toLowerCase() === '#12ab34' ? '#654321' : '#12ab34';
                                else if (el.type === 'time')
                                    value = value === '01:00' ? '02:00' : '01:00';
                                else if (el.type === 'date')
                                    value = '2026-10-30';
                                else if (/expirations|YYYY-MM-DD/i.test(m.label))
                                    value = '2026-11-04';
                                else if (/time|HH:mm/i.test(m.label))
                                    value = '01:00';
                                else
                                    value = value === 'Audit check' ? 'Audit alternate' : 'Audit check';
                                await act(async () => { el.focus(); await tick(); });
                                await act(async () => { Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new window.Event('input', { bubbles: true })); el.dispatchEvent(new window.Event('change', { bubbles: true })); await tick(); });
                                await act(async () => { el.blur(); await tick(); });
                            }
                            else {
                                item.checks.push({ ...m, section, status: 'non-setting input' });
                                continue;
                            }
                        }
                        else if (m.popup === 'listbox') {
                            await click(el);
                            const options = Array.from(document.querySelectorAll('[role="option"]')) as HTMLElement[];
                            optionCount = options.length;
                            if (process.env.AUDIT_ALL_OPTIONS) {
                                const choices = options.filter(option => option.getAttribute('aria-disabled') !== 'true').map(option => option.textContent?.trim());
                                const optionChecks: any[] = [];
                                for (const label of choices) {
                                    await render(def);
                                    await goTab(section);
                                    const field: any = controls()[index];
                                    await click(field);
                                    const choice = Array.from(document.querySelectorAll('[role="option"]')).find(option => option.textContent?.trim() === label) as HTMLElement;
                                    if (choice?.getAttribute('aria-selected') === 'true') {
                                        optionChecks.push({ label, status: 'already selected' });
                                        continue;
                                    }
                                    const old = JSON.parse(JSON.stringify(state)), storage = JSON.stringify({ ...localStorage });
                                    await click(choice);
                                    await save(def);
                                    const keys = Array.from(new Set([...Object.keys(old[0].settings ?? {}), ...Object.keys(state[0].settings ?? {})])).filter(key => old[0].settings?.[key] !== state[0].settings?.[key]);
                                    optionChecks.push({ label, status: keys.length || storage !== JSON.stringify({ ...localStorage }) ? 'saved change' : 'no saved change', changedKeys: keys });
                                }
                                item.checks.push({ ...m, section, status: 'all dropdown options exercised', optionChecks });
                                continue;
                            }
                            const alt = options.find(option => option.getAttribute('aria-selected') !== 'true' && option.getAttribute('aria-disabled') !== 'true');
                            if (!alt) {
                                item.checks.push({ ...m, section, status: 'no alternative option', optionCount });
                                continue;
                            }
                            await click(alt);
                        }
                        else if (el.tagName === 'SELECT') {
                            if (process.env.AUDIT_ALL_OPTIONS) {
                                const choices = Array.from(el.options).filter((option: any) => !option.disabled).map((option: any) => ({ value: option.value, label: option.textContent }));
                                const optionChecks: any[] = [];
                                for (const choice of choices) {
                                    await render(def);
                                    await goTab(section);
                                    const field: any = controls()[index];
                                    if (field.value === choice.value) {
                                        optionChecks.push({ ...choice, status: 'already selected' });
                                        continue;
                                    }
                                    const old = JSON.parse(JSON.stringify(state));
                                    await act(async () => { field.value = choice.value; field.dispatchEvent(new window.Event('change', { bubbles: true })); await tick(); });
                                    await save(def);
                                    const keys = Array.from(new Set([...Object.keys(old[0].settings ?? {}), ...Object.keys(state[0].settings ?? {})])).filter(key => old[0].settings?.[key] !== state[0].settings?.[key]);
                                    optionChecks.push({ ...choice, status: keys.length ? 'saved change' : 'no saved change', changedKeys: keys });
                                }
                                item.checks.push({ ...m, section, status: 'all dropdown options exercised', optionChecks });
                                continue;
                            }
                            const alt = Array.from(el.options).find((option: any) => !option.disabled && option.value !== el.value) as any;
                            if (!alt) {
                                continue;
                            }
                            await act(async () => { el.value = alt.value; el.dispatchEvent(new window.Event('change', { bubbles: true })); await tick(); });
                        }
                        else if (/^#[0-9A-F]{6}$/i.test(el.textContent?.trim() ?? '')) {
                            await click(el);
                            const field: any = document.querySelector('[data-kwant-color-popover] input');
                            await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(field, '12AB34'); field.dispatchEvent(new window.Event('input', { bubbles: true })); await tick(); });
                        }
                        else {
                            await click(el);
                        }
                        const feedbackChanged = dialog()?.textContent !== domBefore;
                        if (!dialog()) {
                            item.checks.push({ ...m, section, status: 'dialog navigation action' });
                            continue;
                        }
                        await save(def);
                        const after = JSON.parse(JSON.stringify(state));
                        const sharedChanged = storageBefore !== JSON.stringify({ ...localStorage });
                        const changed = JSON.stringify(Object.entries(before[0].settings ?? {}).sort()) !== JSON.stringify(Object.entries(after[0].settings ?? {}).sort()) || before[0].enabled !== after[0].enabled || sharedChanged;
                        const keys = Array.from(new Set([...Object.keys(before[0].settings ?? {}), ...Object.keys(after[0].settings ?? {})])).filter(key => before[0].settings?.[key] !== after[0].settings?.[key]);
                        status = changed ? 'saved change' : feedbackChanged ? 'UI feedback; no setting change' : 'no saved change';
                        item.checks.push({ ...m, section, status, feedbackChanged, sharedChanged, changedKeys: keys, enabledChanged: before[0].enabled !== after[0].enabled, optionCount });
                    }
                    catch (error: any) {
                        item.checks.push({ ...m, section, status: 'interaction error', error: error.message });
                    }
                }
            }
        }
        catch (error: any) {
            item.errors.push(error.message);
        }
        report.push(item);
        onProgress(item);
    }
    await act(async () => root.unmount());
    return report;
}
