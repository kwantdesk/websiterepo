import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {contractStatisticsValue,contractStatisticsPercentage,contractStatisticsTooltipRows} from '../../public/gex-data-app/contract-statistics-interaction-model.js';
import {contractStatisticsRows,contractSideStatisticsRows,drawProportionChart,OPTION_COLORS} from '../../public/gex-data-app/options-models.js';
import {currencyAbbreviated} from '../../public/gex-data-app/number-format.js';

const source=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
function actual(name){const start=source.indexOf('  function '+name+'('),end=source.indexOf('\n  function ',start+1);assert.ok(start>=0&&end>start);return source.slice(start,end);}
const label=row=>row.parts.map(part=>part.text).join('');

test('Source precision differs intentionally between ordinary Statistics trade counts and Side Statistics trade counts',()=>{
  assert.equal(contractStatisticsValue(1234),'1.23 K');
  assert.equal(contractStatisticsValue(1234,{sideMode:'TRADE_COUNT'}),'1 K');
  assert.equal(contractStatisticsValue(1234,{sideMode:'VOLUME'}),'1.23 K');
  assert.equal(contractStatisticsValue(1234567,{money:true}),'$1.23 M');
  assert.equal(contractStatisticsPercentage(.333333),'33.33%');
});

test('Source tooltip has category, aligned singular Put/Call labels and independently computed actual-value percentages',()=>{
  const row=contractStatisticsRows({CALL:{premium:3000000},PUT:{premium:1000000}})[0],before=structuredClone(row);
  const tooltip=contractStatisticsTooltipRows(row);
  assert.equal(tooltip[0],'Premium');assert.deepEqual(tooltip[1].columns[0],['Put:','Call:']);
  assert.deepEqual(tooltip[1].columns[1].map(label),['$1 M (25.00%)','$3 M (75.00%)']);
  assert.deepEqual(tooltip[1].columns[1].map(row=>row.parts[0].tone),['bearish','bullish']);
  assert.deepEqual(tooltip[1].columnAlignments,['left','right']);assert.deepEqual(row,before);
});

test('Zero-total neutral half-bar placeholders have zero actual values and zero tooltip percentages',()=>{
  for(const row of [...contractStatisticsRows({}),...contractSideStatisticsRows({},'TRADE_COUNT')]){
    assert.equal(row.leftFraction,.5);assert.equal(row.rightFraction,.5);assert.equal(row.leftColor,OPTION_COLORS.emptyBar);assert.equal(row.rightColor,OPTION_COLORS.emptyBar);
    const tooltip=contractStatisticsTooltipRows(row,{sideMode:'TRADE_COUNT'});
    assert.ok(tooltip[1].columns[1].every(value=>label(value).endsWith('(0.00%)')));
    assert.equal(row.call,0);assert.equal(row.put,0);
  }
});

function harness(controls={}){
  const specs=[],summary=[],labels=[],env={getControl:key=>controls[key]??'',contractStatisticsRows,contractSideStatisticsRows,drawProportionChart,
    contractStatisticsValue,contractStatisticsPercentage,contractStatisticsTooltipRows,compact:(value,money)=>money?currencyAbbreviated(value,2):String(value),
    CHART_COLORS:{call:'green',put:'red',primary:'primary',grid:'grid'},quantCanvas:spec=>specs.push(spec),setSummary:value=>summary.push(value),
    element:(tag,cls,text)=>({tag,className:cls,textContent:text,style:{},children:[],append(node){this.children.push(node);}}),
  };
  vm.runInNewContext(['renderContractStatsQuant','renderSideStatsQuant','renderProportionBars','chartTooltipRow'].map(actual).join('\n')+'\nthis.api={renderContractStatsQuant,renderSideStatsQuant,chartTooltipRow};',env);
  const ctx=new Proxy({measureText:text=>({width:String(text).length*7}),fillText:text=>labels.push(text)},
    {get:(target,key)=>key in target?target[key]:(...values)=>assert.ok(values.filter(value=>typeof value==='number').every(Number.isFinite)),set:(target,key,value)=>{target[key]=value;return true;}});
  return {specs,summary,labels,renderStats:env.api.renderContractStatsQuant,renderSide:env.api.renderSideStatsQuant,draw:()=>specs[0].draw(ctx,800,480),row:env.api.chartTooltipRow};
}

test('Actual Statistics renderer includes selected ticker, preserves row ordering and shows percent-bearing tooltips',()=>{
  const payload={data:{CALL:{premium:3000,volume:600,tradeCount:1234},PUT:{premium:1000,volume:400,tradeCount:1234}}},before=structuredClone(payload),h=harness({tickerOptional:'SPY'});
  h.renderStats(payload);h.draw();assert.equal(h.specs[0].title,'Contract Statistics - SPY');assert.deepEqual(Array.from(h.specs[0].items,row=>row.label),['Premium','Volume','Trade Count']);
  const tooltip=h.specs[0].tooltipRows(null,0,{pointerY:9});assert.deepEqual(Array.from(tooltip[1].columns[1],label),['$1 K (25.00%)','$3 K (75.00%)']);
  assert.ok(h.labels.includes('1.23 K (50.00%)'));assert.deepEqual(payload,before);
});

for(const mode of ['PREMIUM','VOLUME','TRADE_COUNT']){
  test(`Actual Side Statistics ${mode} uses only its populated metric with consistent header/bar/tooltip precision`,()=>{
    const field={PREMIUM:'premium',VOLUME:'volume',TRADE_COUNT:'tradeCount'}[mode],payload={data:{CALL:{ABOVE_ASK:{[field]:1234}},PUT:{ABOVE_ASK:{[field]:1234}}}},before=structuredClone(payload),h=harness({tickerOptional:'SPY',sideMetric:mode});
    h.renderSide(payload);h.draw();const expected=mode==='PREMIUM'?'$1.23 K':mode==='VOLUME'?'1.23 K':'1 K';
    assert.match(h.specs[0].title,/ - SPY$/);assert.equal(h.specs[0].legend[0].value,expected);assert.equal(h.specs[0].legend[1].value,expected);
    assert.deepEqual(Array.from(h.specs[0].items,row=>row.label),['Above Ask','Ask','Mid Market','Bid','Below Bid']);
    const tooltip=h.specs[0].tooltipRows(null,0,{pointerY:9});assert.deepEqual(Array.from(tooltip[1].columns[1],label),[expected+' (50.00%)',expected+' (50.00%)']);assert.ok(h.labels.includes(expected+' (50.00%)'));assert.deepEqual(payload,before);
    const dom=h.row(tooltip[1],1);assert.equal(dom.children[1].style.textAlign,'right');assert.equal(dom.children[1].children[0].children[0].style.color,'red');assert.equal(dom.children[1].children[1].children[0].style.color,'green');
  });
}

test('All-market titles remain unsuffixed and do not invent a default ticker',()=>{
  const stats=harness();stats.renderStats({data:{}});assert.equal(stats.specs[0].title,'Contract Statistics');
  const side=harness({sideMetric:'PREMIUM'});side.renderSide({data:{}});assert.equal(side.specs[0].title,'Contract Side Statistics (Premium)');
});
