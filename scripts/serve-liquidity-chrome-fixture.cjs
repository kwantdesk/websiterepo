// Local-only visual QA: actual map markup/styles/select builder, synthetic
// canvas and in-memory themes. No provider, API, account or storage writes.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..', 'public');
const main = fs.readFileSync(path.join(root, 'heatmap-app/src/main.js'), 'utf8');
const selectBuilder = main.slice(main.indexOf('  #enhanceInspectorSelects() {'), main.indexOf('  #syncCustomSelect(id) {'))
  .replace('#enhanceInspectorSelects()', 'function enhanceInspectorSelects()');
const fixture = `<script type="module">
import {createInspectorDialog} from '/heatmap-app/src/inspector-dialog.js';
import {setWebsiteThemeColors,applyUiTheme} from '/heatmap-app/src/ui-themes.js';
const $=id=>document.getElementById(id),all=selector=>[...document.querySelectorAll(selector)];
${selectBuilder}
enhanceInspectorSelects();
const dialog=$('inspector'),controller=createInspectorDialog({dialog,title:$('inspectorTitle')});
const open=panel=>{const mapping={settings:'settingsPanel',signals:'signalsPanel',depth:'depthPanel'};all('.inspector-panel').forEach(p=>p.classList.toggle('active',p.id===mapping[panel]));controller.open(panel==='settings'?'Liquidity Map settings':panel);};
$('settingsButton').onclick=()=>open('settings');
all('[data-panel-shortcut]').forEach(b=>b.onclick=()=>open(b.dataset.panelShortcut));
$('panelCollapse').onclick=controller.close;
$('instrumentTabList').innerHTML='<button class="instrument-tab active" role="tab" aria-selected="true"><strong>NQZ6 · CME</strong></button>';
all('.chart-loading-overlay,.loading-overlay').forEach(n=>n.style.display='none');
const dark={background:'#09090b',foreground:'#fafafa',panel:'#0c0c0e',card:'#0f0f12',surface:'#18181b',border:'#27272a',muted:'#71717a',primary:'#00f5a0',secondary:'#6366f1',danger:'#ef4444',chartBackground:'#09090b'};
const light={background:'#f8fafc',foreground:'#111827',panel:'#ffffff',card:'#f1f5f9',surface:'#eef2f6',border:'#cbd5e1',muted:'#526077',primary:'#2563eb',secondary:'#0e7490',danger:'#dc2626',chartBackground:'#f8fafc'};
const theme=value=>{setWebsiteThemeColors(value);applyUiTheme();const canvas=$('heatmapCanvas');canvas.width=1200;canvas.height=600;const c=canvas.getContext('2d');c.fillStyle=value.background;c.fillRect(0,0,1200,600);for(let i=0;i<10;i++){c.fillStyle=i%2?'#8055b5':'#176b86';c.fillRect(i*100,80+i*30,240,8);}c.fillStyle=value.foreground;c.font='14px sans-serif';c.fillText('ISOLATED STYLE TEST — synthetic chart, no market feed',30,40);};
const controls=document.createElement('div');controls.style.cssText='position:fixed;bottom:5px;left:10px;z-index:1000;display:flex;gap:6px';
for(const [name,value] of [['Dark fixture',dark],['Light fixture',light]]){const button=document.createElement('button');button.textContent=name;button.style.cssText='padding:4px 8px;border:1px solid var(--ui-line);border-radius:3px;background:var(--ui-panel);color:var(--ui-text)';button.onclick=()=>theme(value);controls.append(button);}document.body.append(controls);theme(dark);
</script>`;
http.createServer((req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]);
  if (name === '/narrow') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<html><body style="margin:0;background:#202124;color:white"><p>360px map-pane fixture</p><iframe title="Narrow map" src="/" style="width:360px;height:600px;border:0"></iframe></body></html>');
  }
  if (name === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(fs.readFileSync(path.join(root, 'heatmap-app/index.html'), 'utf8')
      .replace(/<script type="module" src="src\/main.js[^>]*><\/script>/, fixture));
  }
  const file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); return res.end();
  }
  res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'application/javascript' : 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(4923, '127.0.0.1', () => console.log('Local style QA: http://127.0.0.1:4923 · /narrow'));
