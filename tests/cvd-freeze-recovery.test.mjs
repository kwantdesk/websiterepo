import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {cvdSeriesRegressed} from '../src/lib/cvdRenderContinuity.ts';
import {calculateIndicatorSeries} from '../src/lib/chartIndicatorEngine.ts';

const series=(start,count)=>[{
  key:'cvd',label:'CVD',kind:'candlestick',placement:'pane',color:'#fff',
  data:Array.from({length:count},(_,i)=>({time:start+i,value:i+1,open:i,high:i+2,low:i-1,close:i+1})),
}];
const theme={primary:'#fff',secondary:'#aaa',positive:'#0f0',negative:'#f00',muted:'#888'};
const timestamp=Date.UTC(2026,9,19,14,0);
const candle=(i,ask=800,bid=200)=>({timestamp:timestamp+i*60000,
  open:100,high:101,low:99,close:100,volume:ask+bid,askVolume:ask,bidVolume:bid,
  delta:ask-bid,deltaClose:ask-bid,
});
const calculate=(candles,settings={},indicatorId='cumulative-volume-delta')=>calculateIndicatorSeries({
  indicatorId,instanceId:'cvd',enabled:true,settings,
},candles,theme,{instrument:'NQ',tickSize:0.25});

test('shorter but advancing verified CVD cannot stay trapped behind an older long snapshot',()=>{
  const old=series(0,1000);
  for(let tail=1000;tail<1020;tail++){
    assert.equal(cvdSeriesRegressed(old,series(tail-79,80)),false,`live endpoint ${tail} must advance`);
  }
});

test('same-candle live changes must paint despite a partial historical reconciliation',()=>{
  const old=series(0,100),next=series(0,80);
  next[0].data.at(-1).time=99;
  next[0].data.at(-1).close=250;
  next[0].data.at(-1).value=250;
  next[0].data.at(-1).high=260;
  assert.equal(cvdSeriesRegressed(old,next),false);
});

test('normal rolling history eviction is not a CVD regression even at the same endpoint',()=>{
  const old=series(0,100),next=series(40,60);
  next[0].data.at(-1).close=old[0].data.at(-1).close;
  next[0].data.at(-1).value=old[0].data.at(-1).value;
  assert.equal(cvdSeriesRegressed(old,next),false);
});

test('empty and genuinely older snapshots still cannot erase the proven live tail',()=>{
  assert.equal(cvdSeriesRegressed(series(0,100),[]),true);
  assert.equal(cvdSeriesRegressed(series(0,100),series(0,80)),true);
});

test('live CVD derives signed volume from classified side totals, not a stale delta cache',()=>{
  for(const indicatorId of ['cumulative-volume-delta','delta-cumulative-candlestick','delta-cumulative-histogram']){
    const [result]=calculate([candle(0),{...candle(1,100,900),delta:0,deltaClose:0}],{},indicatorId);
    assert.deepEqual(result.data.map(p=>p.close),[600,-200],indicatorId);
  }
});

test('missing trade counts are unavailable, not a fake flat aggregate-trade CVD',()=>{
  const [result]=calculate([candle(0)],{inputData:'Aggregate Trades'});
  assert.equal(result,undefined);
  const [recovered]=calculate([
    {...candle(0),askTrades:8,bidTrades:2},candle(1),{...candle(2),askTrades:1,bidTrades:9},
  ],{inputData:'Aggregate Trades'});
  assert.deepEqual(recovered.data.map(p=>p.close),[6,-8]);
  assert.equal(recovered.data[1].breakBefore,true);
});

function paneReconciler(){
  const source=readFileSync(new URL('../src/components/ChartIndicatorPanes.tsx',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('  const cvdSeriesCacheRef ='),source.indexOf('  const groups = useSuperTrendLivePanes'));
  assert.ok(code.length>0);
  let ref;
  const run=new Function('useRef','coordinateScope','baseGroups','isCvdIndicator','cvdSeriesRegressed',
    ts.transpileModule(`${code}\nreturn continuityGroups;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText);
  return (groups,scope='NQ:1m')=>run(value=>ref??=( {current:value} ),scope,groups,
    id=>id==='cumulative-volume-delta',cvdSeriesRegressed);
}
const group=(data,settings={})=>({key:'cvd-instance',indicatorId:'cumulative-volume-delta',series:data,settings});

test('actual pane cache advances through a long-history to short-live transition without a stuck syncing frame',()=>{
  const render=paneReconciler();
  render([group(series(0,1000))]);
  for(let end=1000;end<1020;end++){
    const [result]=render([group(series(end-79,80))]);
    assert.equal(result.series[0].data.at(-1).time,end);
    assert.notEqual(result.statusLabel,'SYNCING EXECUTIONS');
  }
});

test('actual pane cache cannot pin old data across calculation-setting changes, removal or symbol changes',()=>{
  const render=paneReconciler();
  render([group(series(0,1000),{periodValue:1})]);
  const [changed]=render([group(series(0,20),{periodValue:2})]);
  assert.equal(changed.series[0].data.length,20);
  const [missingInput]=render([group([],{inputData:'Aggregate Trades'})]);
  assert.deepEqual(missingInput.series,[]);
  render([]);
  assert.equal(render([group(series(0,5),{periodValue:2})])[0].series[0].data.length,5);
  assert.deepEqual(render([group([],{periodValue:2})],'ES:1m')[0].series,[]);
});

test('actual pane scope changes with instrument/timeframe/contract even when the live pane ID is unchanged',()=>{
  const chart=readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
  const scope=chart.match(/coordinateScope=\{`([^`]+)`\}/)?.[1];
  assert.ok(scope);
  for(const identity of ['chartFrameWorkKey','instrument','timeframe','contractSymbol','replayTimestampMs'])assert.ok(scope.includes(identity),identity);
});
