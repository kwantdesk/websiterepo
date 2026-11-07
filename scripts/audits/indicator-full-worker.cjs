const fs = require('fs');
const crypto = require('crypto');
const sourceFingerprint = crypto.createHash('sha256').update(['src/components/ChartIndicatorsControl.tsx','src/components/indicators/IndicatorPaletteSection.tsx','src/components/ui/IndicatorNumericSlider.tsx','src/lib/chartIndicatorConfig.ts','src/lib/indicatorDedicatedControlKeys.ts','src/lib/indicatorSettingAvailability.ts'].map(p=>fs.readFileSync(p,'utf8')).join('\n')).digest('hex');
const { JSDOM } = require('../../tmp/indicator-audit-runtime/node_modules/jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:4337', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MutationObserver', 'localStorage'])
    global[key] = dom.window[key];
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.fetch = async()=>{throw new Error('Network disabled in isolated indicator audit')};
global.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = () => ({ matches: false, addEventListener() { }, removeEventListener() { } });
global.ResizeObserver = class {
    observe() { }
    unobserve() { }
    disconnect() { }
};
global.requestAnimationFrame = window.requestAnimationFrame.bind(window);
global.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
HTMLElement.prototype.scrollIntoView = function () { };
HTMLElement.prototype.attachEvent = function () { };
HTMLElement.prototype.detachEvent = function () { };
const errors = [];
console.error = (...args) => { errors.push(args.map(String).join(' ')); };
const report = [];
const detail = process.env.AUDIT_VARIANT ? 'dialog-' + process.env.AUDIT_VARIANT : 'dialog-detail';
const out = process.env.AUDIT_OUTPUT_FILE || 'docs/audits/2026-11-07-indicator-full-audit/' + detail + '/' + process.env.AUDIT_ONLY + (process.env.AUDIT_OUTPUT_SUFFIX ?? '') + '.json';
fs.mkdirSync('docs/audits/2026-11-07-indicator-full-audit/' + detail, { recursive: true });
require(process.env.AUDIT_BUNDLE || (process.env.AUDIT_VARIANT === 'after' ? '../../tmp/indicator-full-settings-unit/audit.cjs' : '../../tmp/indicator-full-settings-unit/audit-baseline.cjs')).runAudit(report, item => { fs.writeFileSync(out, JSON.stringify({ sourceFingerprint, capturedAt: new Date().toISOString(), method: 'React DOM interaction tests in isolated JSDOM; proves settings event/save wiring, not browser visuals or live outputs', indicators: report, errors }, null, 2)); console.log(item.id, item.checks.length, 'checks', item.checks.filter(x => x.status === 'no saved change' || x.status === 'interaction error').length, 'to review'); }).then(() => { console.log('DONE', report.length); process.exit(0); }).catch(error => { console.log(error); process.exit(1); });
