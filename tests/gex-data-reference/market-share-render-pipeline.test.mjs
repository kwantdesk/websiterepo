import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {marketShareModel,MARKET_SHARE_MODES} from '../../public/gex-data-app/options-models.js';
import {marketShareTooltipRows,marketShareFormatValue} from '../../public/gex-data-app/market-share-interaction-model.js';
const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8'),row=value=>({equityCallVolume:value,equityPutVolume:0,indexVolume:0,equityCallTradeCount:value,equityPutTradeCount:0,indexTradeCount:0,equityCallPremium:value,equityPutPremium:0,indexPremium:0});
function harness(chart,mode='EQUITY_VOLUME'){
 let configuration,barOptions;const env={getControl:key=>({shareMode:mode,shareView:'EXCHANGE_GROUP',shareChart:chart}[key]),marketShareModel,MARKET_SHARE_MODES,marketShareTooltipRows,marketShareFormatValue,CHART_COLORS:{primary:'#fff',grid:'#333'},niceTicks:()=>[],compact:String,setSummary(){},quantCanvas(options){configuration=options;},drawMarketSharePie(){return {centerX:0,centerY:0,radius:10,cumulativeAngles:[1/3,1]};},drawMarketShareBars(_ctx,_w,_h,model,options){barOptions=options;return model.barRows.map((_entry,index)=>({index,y:index*10,height:9}));}};
 vm.runInNewContext(source.slice(source.indexOf('  function renderMarketShareQuant('),source.indexOf('  function renderIvRankQuant('))+'\nthis.render=renderMarketShareQuant;',env);env.render({data:{BATS:row(10),EDGX:row(40),BOST:row(100)}});configuration.draw({},600,400);return {configuration,get barOptions(){return barOptions;}};
}
test('actual Market Share pie and bar delegate venue-only grouped tooltips without fabricated aggregate heading',()=>{
 const pie=harness('pie'),bar=harness('bar'),expected=['BZX: 10 (6.67%)','C2: 0 (0.00%)','CBOE: 0 (0.00%)','EDGX: 40 (26.67%)'];assert.deepEqual(pie.configuration.tooltipRows(null,0,{pointerX:0,pointerY:-5}),expected);assert.deepEqual(bar.configuration.tooltipRows(null,0,{pointerX:20,pointerY:15}),expected);assert.deepEqual(pie.configuration.tooltipRows(null,0,{pointerX:100,pointerY:100}),[]);
});
test('actual Market Share bar formatter uses source mode precision and retains unmodified axes/model values',()=>{
 for(const [mode,expected]of [['TOTAL_TRADE_COUNT','1 M'],['TOTAL_VOLUME','1.23 M'],['TOTAL_PREMIUM','$1.23 M']]){const h=harness('bar',mode);assert.equal(h.barOptions.formatValue(1234567),expected);assert.equal(h.barOptions.formatPercent(1/3),'33.33%');}
});
