import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {DEFAULT_PALETTE,normalizeHeatPalette,paletteLut,paletteRenderKey,paletteCssGradient} from '../public/heatmap-app/src/palettes.js';
import {setWebsiteThemeColors} from '../public/heatmap-app/src/ui-themes.js?v=20261017-aleph-font';

test('new and restored automatic settings follow the website theme; manual choices survive',()=>{
 assert.equal(DEFAULT_PALETTE,'auto');assert.equal(normalizeHeatPalette('auto'),'auto');assert.equal(normalizeHeatPalette(undefined),'auto');
 assert.equal(normalizeHeatPalette('cyan-magenta'),'cyan-magenta');assert.equal(normalizeHeatPalette('white-pink-blue'),'white-pink-blue');
 const dark={background:'#000000',chartBackground:'#000000',foreground:'#ffffff',primary:'#ff0080',secondary:'#9900ff',accent:'#ffcc00'};
 setWebsiteThemeColors(dark);const key=paletteRenderKey('auto'),before=[...paletteLut('auto')],manual=[...paletteLut('cyan-magenta')];
 setWebsiteThemeColors({...dark,background:'#ffffff',chartBackground:'#ffffff',primary:'#0033cc',secondary:'#00cc99',accent:'#ff4400'});
 assert.notEqual(paletteRenderKey('auto'),key);assert.notDeepEqual([...paletteLut('auto')],before);assert.deepEqual([...paletteLut('auto').slice(0,3)],[255,255,255]);
 assert.deepEqual([...paletteLut('cyan-magenta')],manual);assert.ok(paletteCssGradient('auto').startsWith('linear-gradient'));
});

test('actual theme button handler selects, persists and renders automatic mode',()=>{
 const source=readFileSync(new URL('../public/heatmap-app/src/main.js',import.meta.url),'utf8');
 const ast=ts.createSourceFile('main.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let callback;
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==="$('useWebsiteTheme').addEventListener")callback=n.arguments[1].body.getText(ast);ts.forEachChild(n,visit);}visit(ast);
 assert.ok(callback);callback=callback.replaceAll('this.#','this.');
 const calls=[],state={settings:{palette:'cyan-magenta'},syncPaletteControls(){calls.push('sync');},saveSettings(){calls.push(this.settings.palette);},requestRender(){calls.push('render');}};
 new Function(callback).call(state);assert.equal(state.settings.palette,'auto');assert.deepEqual(calls,['sync','auto','render']);
 const html=readFileSync(new URL('../public/heatmap-app/index.html',import.meta.url),'utf8');assert.ok(html.indexOf('id="useWebsiteTheme"')<html.indexOf('id="heatGradientPresets"'));
});
