const fs = require('fs');
const { JSDOM } = require('../../tmp/indicator-audit-runtime/node_modules/jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:4337', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MutationObserver', 'localStorage'])
    global[key] = dom.window[key];
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
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
console.error = () => { };
require('../../tmp/indicator-settings-unit/lifecycle.cjs').runLifecycle().then(rows => { fs.writeFileSync('docs/audits/2026-11-04-indicator-controls/library-lifecycle.json', JSON.stringify(rows, null, 2)); console.log(rows.length, 'lifecycle records', rows.filter(r => r.status === 'failed').length, 'failures'); process.exit(0); }).catch(error => { console.log(error); process.exit(1); });
