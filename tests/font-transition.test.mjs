import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {acquireCockpitTypography} from '../src/lib/cockpitTypography.ts';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('overlapping route shells cannot remove another workspace font scope',()=>{
 const classes=new Set(['owner-preference']),body={classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}};
 const old=acquireCockpitTypography(body),next=acquireCockpitTypography(body);old();old();assert.ok(classes.has('kwant-cockpit-ui'));next();assert.ok(!classes.has('kwant-cockpit-ui'));assert.ok(classes.has('owner-preference'));
});
test('workspace font scope is acquired before paint while theme/preferences remain passive effects',()=>{
 const source=read('src/components/AppSidebar.tsx');assert.match(source,/useLayoutEffect\(\(\) => acquireCockpitTypography\(document.body\), \[\]\)/);assert.doesNotMatch(source,/return \(\) => body.classList.remove/);assert.match(source,/useEffect\(\(\) => \{[\s\S]*startRendererHealthRecorder/);
});
test('all embedded entry points preload both canonical weights and block fallback swaps',()=>{
 const css=read('public/fonts/aleph/aleph.css');assert.equal((css.match(/font-display: block/g)||[]).length,2);assert.doesNotMatch(css,/font-display: swap/);
 for(const app of ['gex-data-app','kwanty-app','heatmap-app']){const html=read('public/'+app+'/index.html');for(const weight of ['Regular','Bold'])assert.match(html,new RegExp('rel="preload"[^>]+Aleph-'+weight+'\\.ttf'));assert.match(html,/aleph\.css\?v=20261027-stable-font/);if(app!=='heatmap-app')assert.doesNotMatch(read('public/'+app+'/site.css'),/@font-face/);}
 const layout=read('src/app/layout.tsx');assert.match(layout,/import "\.\.\/\.\.\/public\/fonts\/aleph\/aleph.css"/);assert.match(layout,/Aleph-Regular.ttf/);assert.match(layout,/Aleph-Bold.ttf/);
});
