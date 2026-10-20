import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {syncThemeSettings,useThemeColour} from '../public/kwanty-app/theme-settings.js';
import {installTheme as installKwanty,themePaint} from '../public/kwanty-app/site-theme.js';
import {installTheme as installGex,themePaint as gexPaint} from '../public/gex-data-app/site-theme.js?v=1';
import {exposureLegs,HEAT_METRICS} from '../public/gex-data-app/exposure-models.js';
import {OPTION_COLORS} from '../public/gex-data-app/options-models.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const palettes=[
  {background:'#10051f',foreground:'#f4eaff',primary:'#a855f7',accent:'#e879f9',bullish:'#22c55e',bearish:'#f43f5e',muted:'#a8a29e',warning:'#fbbf24'},
  {background:'#fdfdfd',foreground:'#161616',primary:'#0284c7',accent:'#0891b2',bullish:'#15803d',bearish:'#b91c1c',muted:'#57534e',warning:'#a16207'},
];
function environment(){const oldDocument=globalThis.document,oldFetch=globalThis.fetch;globalThis.document={documentElement:{style:{setProperty(){},removeProperty(){}}}};globalThis.fetch=async()=>({ok:true,json:async()=>[]});return()=>{globalThis.document=oldDocument;globalThis.fetch=oldFetch;};}

test('GEX DATA palette colours affect chart roles, retain site surfaces and reset cleanly',async()=>{
  const restore=environment(),removed=[];
  document.documentElement.style.removeProperty=key=>removed.push(key);
  try{
    await installGex({...palettes[0],bullish:'#aaff00',bearish:'#ff3366',chartPrimary:'#ffee00',chartHeader:'#bbbbbb',chartStrike:'#cccccc'});
    assert.equal(gexPaint('#00ff00'),'#aaff00');assert.equal(gexPaint('#ff0000'),'#ff3366');
    assert.equal(gexPaint('#7d1ad6'),'#ffee00');
    assert.equal(document.documentElement.style.backgroundColor,palettes[0].background);
    await installGex(palettes[1]);
    assert.equal(gexPaint('#00ff00'),palettes[1].bullish);assert.equal(gexPaint('#7d1ad6'),palettes[1].primary);
    for(const key of ['chartPrimary','chartHeader','chartStrike'])assert.ok(removed.includes('--site-'+key));
  }finally{restore();}
});

test('every State Greek and major defaults follows multiple themes, preserving explicit custom styles',async()=>{
  const restore=environment();try{
    const app=read('public/kwanty-app/app.js');
    const context={themePaint,structuredClone};
    vm.runInNewContext(app.slice(app.indexOf('const defaults='),app.indexOf('let saved={}'))+';globalThis.make=settingsDefaults;',context);
    const current={gamma:{color:'#ffffff',size:9,display:false},gamma_neg:{color:'#123456',isCustomized:true,size:4},background:'#ffffff',spotColor:'#ffffff'};
    for(const palette of palettes){
      await installKwanty(palette);const fresh=context.make('state');
      syncThemeSettings(current,fresh,{palette,light:palette.background==='#fdfdfd',timeZone:'Europe/London'});
      for(const key of ['delta','gamma','vanna','charm','delta_neg','vanna_neg','charm_neg','major_long_gamma','major_short_gamma','major_call_gamma','major_put_gamma','time_marker'])assert.equal(current[key].color,fresh[key].color,key);
      assert.equal(current.gamma.color,palette.accent);assert.equal(current.gamma.size,9);assert.equal(current.gamma.display,false);
      assert.equal(current.gamma_neg.color,'#123456');assert.equal(current.background,palette.background);assert.equal(current.spotColor,palette.foreground);
    }
    current.backgroundIsCustomized=true;current.background='#fedcba';current.spotIsCustomized=true;current.spotColor='#abcdef';
    syncThemeSettings(current,context.make('state'),{palette:palettes[0],light:false,timeZone:'UTC'});
    assert.equal(current.background,'#fedcba');assert.equal(current.spotColor,'#abcdef');
  }finally{restore();}
});

test('all saved orderflow series discard only non-custom colour snapshots',()=>{
  const current={series:{zgr:{color:'#ffffff',negativeColor:'#123456',negativeIsCustomized:true,showPositive:false},zvanna:{color:'#abcdef',isCustomized:true,negativeColor:'#777777'},invalid:null}};
  syncThemeSettings(current,{}, {palette:{},light:false,timeZone:'UTC'});
  assert.equal(current.series.zgr.color,undefined);assert.equal(current.series.zgr.negativeColor,'#123456');assert.equal(current.series.zgr.showPositive,false);
  assert.equal(current.series.zvanna.color,'#abcdef');assert.equal(current.series.zvanna.negativeColor,undefined);
});

test('all KWANTY packages refresh saved candle defaults and legacy aliases without losing custom colours',async()=>{
  const restore=environment();try{
    const app=read('public/kwanty-app/app.js'),context={themePaint,structuredClone};
    vm.runInNewContext(app.slice(app.indexOf('const defaults='),app.indexOf('let saved={}'))+';globalThis.make=settingsDefaults;',context);
    for(const pkg of ['classic','state','orderflow']){
      const current={candleUp:{color:'#0086e9',display:true},candleDown:{color:'#504b4b',display:false},spot_candle_up:{color:'#0086e9'},spot_candle_down:{color:'#504b4b',display:false}};
      for(const palette of palettes){
        await installKwanty(palette);const fresh=context.make(pkg);
        assert.equal(fresh.candleUp.color,palette.bullish,pkg);assert.equal(fresh.candleDown.color,palette.bearish,pkg);
        syncThemeSettings(current,fresh,{palette,light:false,timeZone:'UTC'});
        assert.equal(current.candleUp.color,palette.bullish);assert.equal(current.candleDown.color,palette.bearish);
        assert.equal(current.spot_candle_up.color,palette.bullish);assert.equal(current.spot_candle_down.color,palette.bearish);
        assert.equal(current.candleDown.display,false);assert.equal(current.spot_candle_down.display,false);
      }
      current.candleUp={color:'#112233',isCustomized:true};current.spot_candle_down={color:'#445566',isCustomized:true};
      syncThemeSettings(current,context.make(pkg),{palette:palettes[0],light:false,timeZone:'UTC'});
      assert.equal(current.candleUp.color,'#112233');assert.equal(current.spot_candle_down.color,'#445566');
    }
  }finally{restore();}
});

test('per-field theme reset unpins an old white background without resetting any other preferences',()=>{
  const current={background:'#f5f7ff',backgroundIsCustomized:true,spotColor:'#abcdef',spotIsCustomized:true,gamma:{color:'#123456',isCustomized:true,size:8,display:false},series:{zgr:{color:'#abcdef',isCustomized:true,negativeColor:'#fedcba',negativeIsCustomized:true,showPositive:false}}};
  useThemeColour(current,'background');syncThemeSettings(current,{gamma:{color:'#eeeeee'}},{palette:palettes[0],light:false,timeZone:'UTC'});
  assert.equal(current.background,palettes[0].background);assert.equal(current.backgroundIsCustomized,undefined);
  assert.equal(current.spotColor,'#abcdef');assert.equal(current.gamma.color,'#123456');assert.equal(current.gamma.size,8);
  useThemeColour(current,'gamma');syncThemeSettings(current,{gamma:{color:'#987654'}},{palette:palettes[0],light:false,timeZone:'UTC'});
  assert.equal(current.gamma.color,'#987654');assert.equal(current.gamma.size,8);assert.equal(current.gamma.display,false);
  useThemeColour(current,'series:zgr:positive');assert.equal(current.series.zgr.color,undefined);assert.equal(current.series.zgr.negativeColor,'#fedcba');assert.equal(current.series.zgr.showPositive,false);
  const editor=read('public/kwanty-app/settings-editor.js');assert.match(editor,/Use theme background/);assert.match(editor,/useThemeColour\(settings\(\),key\);refresh\(\);persist\(\);redraw\(\)/);
});

test('existing GEX exposure and heat-map metric objects resolve live colours, not boot-time white',async()=>{
  const restore=environment();try{
    const net=HEAT_METRICS.find(metric=>metric.group==='Net'),call=HEAT_METRICS.find(metric=>metric.group==='Call'),put=HEAT_METRICS.find(metric=>metric.group==='Put');
    for(const palette of palettes){await installGex(palette);
      assert.equal(net.maxColor,palette.bullish);assert.equal(net.minColor,palette.bearish);assert.equal(call.maxColor,palette.bullish);assert.equal(put.minColor,palette.bearish);
      assert.deepEqual(exposureLegs({call:5,put:-2},'SPLIT').map(leg=>leg.color),[palette.bullish,palette.bearish]);
      assert.ok(OPTION_COLORS.emptyBar.startsWith('rgba('));assert.ok(OPTION_COLORS.emptyBar.includes(palette.muted==='#57534e'?'87,83,78':'168,162,158'));
    }
  }finally{restore();}
});

test('both theme installers keep palette/canvas changes working when the static catalogue fails, and retry',async()=>{
  for(const file of ['kwanty-app','gex-data-app']){
    const properties={};let calls=0;
    const context={document:{documentElement:{style:{setProperty:(key,value)=>properties[key]=value}}},URL,TextEncoder,fetch:async()=>{calls++;if(calls===1)throw Error('Offline style download');return {ok:true,json:async()=>[]};}};
    const source=read('public/'+file+'/site-theme.js').replaceAll('export ','').replaceAll('import.meta.url',JSON.stringify('https://test.local/'+file+'/site-theme.js'));
    vm.runInNewContext(source+';globalThis.install=installTheme;globalThis.paint=themePaint;',context);
    await context.install(palettes[0]);assert.equal(properties['--site-background'],palettes[0].background);assert.equal(context.paint('#00ff00'),palettes[0].bullish);
    await context.install(palettes[1]);assert.equal(calls,2);assert.equal(properties['--site-background'],palettes[1].background);
    await context.install(palettes[0]);assert.equal(calls,2);
  }
});
