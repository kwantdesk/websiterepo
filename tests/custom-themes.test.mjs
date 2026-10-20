import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultTheme} from '../src/lib/theme.ts';
import {defaultChartSettings} from '../src/lib/chartSettings.ts';
import {CUSTOM_THEMES_KEY,CUSTOM_THEMES_EVENT,saveCustomTheme,readCustomThemes,customThemeAppearance} from '../src/lib/customThemes.ts';
import {captureBrowserPreferences,hydrateUserPreferences} from '../src/lib/userPreferences.ts';

const data=new Map(),events=[];
let full=false;
const storage={get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(full)throw new Error('quota');data.set(key,String(value));},removeItem:key=>data.delete(key)};
globalThis.window={localStorage:storage,dispatchEvent:event=>events.push(event.type),requestAnimationFrame:fn=>{fn();return 0;}};
globalThis.document={documentElement:{style:{setProperty(){}},dataset:{}},querySelector:()=>null};
globalThis.CustomEvent=class{constructor(type){this.type=type;}};
const reset=()=>{data.clear();events.length=0;full=false;};
const palette={...defaultChartSettings,upColor:'#123456',downColor:'#654321',borderUpColor:'#234567',borderDownColor:'#765432',wickUpColor:'#345678',wickDownColor:'#876543',backgroundColor:'#010203',gridColor:'#112233',gridLines:false};

test('named themes append, survive reload, and snapshot every chart colour independently',()=>{
  reset();
  const first=saveCustomTheme('  My midnight  ',defaultTheme,palette);
  assert.equal(first.ok,true);assert.equal(first.theme.name,'My midnight');
  const second=saveCustomTheme('Second', {...defaultTheme,primary:'#FF00FF'}, {...palette,upColor:'#AABBCC'});
  assert.equal(second.ok,true);assert.notEqual(first.theme.id,second.theme.id);
  const loaded=readCustomThemes();assert.equal(loaded.ok,true);
  assert.deepEqual(loaded.themes.map(t=>t.name),['My midnight','Second']);
  for(const key of Object.keys(first.theme.chartColors))assert.equal(loaded.themes[0].chartColors[key],palette[key]);
  assert.equal(loaded.themes[0].colors.chartBackground,palette.backgroundColor);
  assert.equal(first.theme.colors.primary,defaultTheme.primary);
  assert.ok(events.includes(CUSTOM_THEMES_EVENT));assert.ok(events.includes('kwantdesk:preferences-changed'));
});

test('applying a saved theme restores its colours but preserves timezone and precision',()=>{
  reset();const saved=saveCustomTheme('Exact wicks',defaultTheme,palette);
  const current={...defaultChartSettings,timezone:'Australia/Brisbane',precision:'4',colorBarsPreviousClose:true};
  const applied=customThemeAppearance(saved.theme,current);
  for(const key of Object.keys(saved.theme.chartColors))assert.equal(applied.chartSettings[key],palette[key]);
  assert.equal(applied.chartSettings.timezone,current.timezone);assert.equal(applied.chartSettings.precision,current.precision);
  assert.equal(applied.chartSettings.colorBarsPreviousClose,true);assert.equal(applied.chartSettings.themeLinked,true);
});

test('empty, long and duplicate names do not replace existing themes',()=>{
  reset();saveCustomTheme('Mine',defaultTheme,palette);const before=data.get(CUSTOM_THEMES_KEY);
  for(const name of [' ', 'x'.repeat(61),' MINE '])assert.equal(saveCustomTheme(name,defaultTheme,palette).ok,false);
  assert.equal(data.get(CUSTOM_THEMES_KEY),before);
});

test('malformed library and quota refusal cannot silently destroy a saved library',()=>{
  reset();data.set(CUSTOM_THEMES_KEY,'{broken');assert.equal(readCustomThemes().ok,false);
  assert.equal(saveCustomTheme('New',defaultTheme,palette).ok,false);assert.equal(data.get(CUSTOM_THEMES_KEY),'{broken');
  reset();saveCustomTheme('Mine',defaultTheme,palette);const before=data.get(CUSTOM_THEMES_KEY);full=true;
  assert.equal(saveCustomTheme('New',defaultTheme,palette).ok,false);assert.equal(data.get(CUSTOM_THEMES_KEY),before);full=false;
});

test('custom theme library is included in account preferences and UI places it after built-ins',()=>{
  reset();saveCustomTheme('Mine',defaultTheme,palette);
  assert.equal(captureBrowserPreferences().values[CUSTOM_THEMES_KEY],data.get(CUSTOM_THEMES_KEY));
  const source=readFileSync(new URL('../src/components/KwantifySettingsWorkspace.tsx',import.meta.url),'utf8');
  assert.ok(source.indexOf('>My Themes</h3>')>source.indexOf('{themePresets.map'));
  assert.ok(source.indexOf('>Save as New Theme</button>')>source.indexOf('<h2 className={sectionTitle}>Chart Colors</h2>'));
  assert.match(source,/saveCustomTheme\(newThemeName, themeSettingsRef.current, chartSettingsRef.current\)/);
});

test('a theme saved during same-account hydration is not rolled back; other owners are isolated',async()=>{
  for(const owner of ['owner','other']){
    reset();data.set('kwantdesk:active-preferences-owner:v1',owner);
    let resolveCloud;const cloud=new Promise(resolve=>{resolveCloud=resolve;});
    const supabase={from:()=>({select:()=>{const chain={eq:()=>chain,maybeSingle:()=>cloud};return chain;},upsert:async()=>({error:null})})};
    const pending=hydrateUserPreferences(supabase,{id:'owner',user_metadata:{}});
    saveCustomTheme('Created while loading',defaultTheme,palette);
    resolveCloud({data:{preferences:{version:1,complete:true,updatedAt:'2026-10-20T00:00:00Z',values:{}}},error:null});
    await pending;
    assert.equal(readCustomThemes().themes.length,owner==='owner'?1:0);
  }
});
