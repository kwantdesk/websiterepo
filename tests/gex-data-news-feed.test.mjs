import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {NEWS_TOPICS,NEWS_TOPIC_CHOICES,newsTopicLabel,NEWS_SENTIMENTS,NEWS_FEED_COLUMNS,newsDayRange,newsFeedRequest,validateNewsFeedRequest,newsFeedRows,renderNewsFeed} from '../public/gex-data-app/news-feed-model.js';
import {GEX_DATA_TOOLS,validateGexDataRequest} from '../src/lib/gexDataPolicy.ts';
import {formatTableValue} from '../public/gex-data-app/table-view.js';

test('News Feed uses its documented news surface and all121topics/seven per-ticker sentiments',()=>{
  assert.deepEqual(GEX_DATA_TOOLS['news-articles'],{surface:'news'});
  assert.equal(NEWS_TOPICS.length,121);assert.equal(new Set(NEWS_TOPICS).size,121);assert.equal(NEWS_SENTIMENTS.length,7);
  assert.equal(newsFeedRequest().size,100);assert.equal(newsFeedRequest().includeBody,undefined);
});
test('complete licensed topic choices retain exact acronym/punctuation labels independently of loaded articles',()=>{
 assert.equal(NEWS_TOPIC_CHOICES.length,121);assert.deepEqual(NEWS_TOPIC_CHOICES.slice(0,3),[{value:'AFTER_HOURS_CENTER',label:'After-Hours Center'},{value:'ANALYST_COLOR',label:'Analyst Color'},{value:'ANALYST_RATINGS',label:'Analyst Ratings'}]);
 const labels={WIIM:'WIIM',ESG:'ESG',FDA:'FDA',ETFS:'ETFs',IPOS:'IPOs',M_AND_A:'M&A',ECON_NUMBERS:'Econ #s',BROAD_US_EQUITY_ETFS:'Broad U.S. Equity ETFs',MOVERS_AND_SHAKERS:'Movers & Shakers',SPACE:'SPACE',MARKET_MOVING_EXCLUSIVES:'Market-Moving Exclusives',PRE_MARKET_OUTLOOK:'Pre-Market Outlook'};
 for(const[key,label]of Object.entries(labels)){assert.equal(newsTopicLabel(key),label);assert.equal(newsTopicLabel(label),label);assert.equal(NEWS_TOPIC_CHOICES.find(item=>item.value===key).label,label);assert.deepEqual(newsFeedRequest({newsTopic:label}).filter.topics,[key]);}
 assert.equal(newsTopicLabel('PRODUCT_LAUNCHES'),'PRODUCT_LAUNCHES','unlisted observed response tags must not acquire an invented display alias');assert.equal(newsTopicLabel('Publisher Custom Tag'),'Publisher Custom Tag');
 const article={id:1,publishedTime:1000,title:'Example',topics:['WIIM','FDA','PRODUCT_LAUNCHES']},before=structuredClone(article),row=newsFeedRows({data:[article]})[0];assert.equal(row.newsTopics,'WIIM, FDA, PRODUCT_LAUNCHES');assert.deepEqual(article,before);
});
test('request adapter preserves licensed filters, cursor and expressions while excluding unsupported session/sort selectors',()=>{
  const base={sessionDate:'2026-11-02',aggregationPeriod:'5m',sort:{field:'PREMIUM'},filter:{ticker:'QQQ'},searchAfter:['123','456'],filterExpression:{field:'TITLE',operation:'EQUALS',values:['Research']}};
  const saved=structuredClone(base),body=newsFeedRequest({tickerOptional:'SPY',newsTopic:'Earnings Beats',newsSentiment:'EXTREMELY_BULLISH',newsBody:'SHOW'},base);
  assert.deepEqual(body,{filter:{tickers:['QQQ'],topics:['EARNINGS_BEATS'],sentiments:['EXTREMELY_BULLISH']},filterExpression:base.filterExpression,searchAfter:base.searchAfter,includeBody:true,size:100});
  assert.deepEqual(validateGexDataRequest('news-articles',body),body);assert.deepEqual(base,saved);
  assert.deepEqual(newsFeedRequest({tickerOptional:'AAPL, NVDA',newsTopic:'EARNINGS,TECH',newsSentiment:'NEUTRAL, SLIGHTLY_BULLISH'}).filter,{tickers:['AAPL','NVDA'],topics:['EARNINGS','TECH'],sentiments:['NEUTRAL','SLIGHTLY_BULLISH']});
  assert.throws(()=>newsFeedRequest({}, {filter:{expirationDates:['2026-11-06']}}),/non-news/);
});
test('historical news dates use the actual website time zone and both US daylight-saving transitions',()=>{
  assert.deepEqual(newsDayRange('2026-11-03','Australia/Brisbane'),{startTime:'2026-11-02T14:00:00.000Z',endTime:'2026-11-03T14:00:00.000Z'});
  for(const [date,hours]of [['2026-03-08',23],['2026-11-01',25]]){const range=newsDayRange(date,'America/New_York');assert.equal(Date.parse(range.endTime)-Date.parse(range.startTime),hours*3600000);}
  const body=newsFeedRequest({mode:'historical',date:'2026-11-03'}, {sessionDate:'2026-11-02'}, {timeZone:'Australia/Brisbane'});
  assert.deepEqual(body.timeRange,newsDayRange('2026-11-02','Australia/Brisbane'));assert.equal(body.sessionDate,undefined);
  for(const date of ['2026-02-30','not-date'])assert.throws(()=>newsDayRange(date));
  assert.throws(()=>newsDayRange('2026-11-02','invented-zone'));
});
test('server rejects forbidden selectors, invalid taxonomy/projection/body/cursor and malformed expression before transport',()=>{
  const invalid=[{sessionDate:'2026-11-02'},{snapshotTime:'2026-11-02T10:00Z'},{aggregationPeriod:'1m'},{sort:{field:'TITLE'}},{includeBody:'true'},{includes:['BODY']},{includes:['SENTIMENT']},{includes:['TITLE'],excludes:['ID']},{size:101},{filter:{sentiments:['BULLISH']}},{filter:{topics:['INVENTED']}},{filter:{tickers:[null]}},{searchAfter:{}},{searchAfter:[]},{timeRange:{startTime:'2026-11-02T10:00Z',endTime:'2026-11-02T09:00Z'}},{filterExpression:{conjunction:'AND',filters:[]}},{filterExpression:{field:'PREMIUM',operation:'=',values:[20]}},{filterExpression:{field:'TICKER',operation:'=',values:[]}}];
  for(const body of invalid)assert.throws(()=>validateGexDataRequest('news-articles',body),JSON.stringify(body));
  validateNewsFeedRequest({includes:['ID','PUBLISHED_TIME','TICKER','TITLE','TOPICS'],includeBody:true,filter:{topics:['M&A','Econ #s'],sentiments:['NEUTRAL']}});
  let expression={field:'BODY',operation:'EQ',value:'rates'};for(let i=0;i<7;i++)expression={conjunction:'AND',filters:[expression]};assert.throws(()=>validateNewsFeedRequest({filterExpression:expression}),/expression/);
});
test('actual source records preserve exact publication/ID/body and individual ticker sentiment without fabricated totals',()=>{
  const row={id:412057,publishedTime:1747137612000,title:'<img src=x onerror=evil()>',topics:['EARNINGS_BEATS'],tickers:[{ticker:'AAPL',sentiment:'MODERATELY_BULLISH'},{ticker:'NVDA',sentiment:'SLIGHTLY_BEARISH'}],body:'<script>unsafe()</script>'};
  const payload={data:[row]},[result]=newsFeedRows(payload);
  for(const key of Object.keys(row))assert.deepEqual(result[key],row[key]);
  assert.equal(result.newsSentiments,'AAPL: Moderately Bullish · NVDA: Slightly Bearish');assert.equal(result.newsTickers,'AAPL, NVDA');assert.equal(result.newsTopics,'Earnings Beats');
  assert.notEqual(result.tickers,row.tickers);assert.equal(formatTableValue(result.title,NEWS_FEED_COLUMNS.find(column=>column.key==='title')),row.title);
  const projected=newsFeedRows({data:[{title:'Headline',publishedTime:null,body:null}]});assert.equal(projected[0].newsSentiments,null);
  for(const data of [null,{},[null],[{publishedTime:'123'}],[{tickers:['AAPL']}],[{body:{html:'x'}}]])assert.throws(()=>newsFeedRows({data}));
});
test('render adapter uses the real sortable table, source publication order and opt-in body column',()=>{
  const payload={data:[{id:1,publishedTime:1000,title:'One',tickers:[{ticker:'AAPL',sentiment:'NEUTRAL'}]}],nextSearchAfter:['1000','1']};let table,summary;
  const adapters={showTable:(...args)=>{table=args;},setSummary:value=>{summary=value;}};
  const rows=renderNewsFeed(payload,adapters);assert.equal(table[0],rows);assert.ok(!table[1].some(column=>column.key==='body'));assert.deepEqual(table[3],{sortKey:'publishedTime',sortDirection:-1});assert.equal(summary.at(-1)[1],'Available');
  renderNewsFeed(payload,adapters,{newsBody:'SHOW'});assert.ok(table[1].some(column=>column.key==='body'));
});

test('actual News toolbar consumes the complete verified topic choices without flattening labels',()=>{
 const source=readFileSync(new URL('../public/gex-data-app/app.js',import.meta.url),'utf8'),expression=/newsTopic:(\[\['','All topics'\],[^\n]+\]),/.exec(source)?.[1];assert.ok(expression);
 const options=JSON.parse(JSON.stringify(vm.runInNewContext(expression,{NEWS_TOPIC_CHOICES})));assert.equal(options.length,122);assert.deepEqual(options[0],['','All topics']);for(const item of NEWS_TOPIC_CHOICES)assert.deepEqual(options.find(option=>option[0]===item.value),[item.value,item.label]);assert.deepEqual(options.find(option=>option[0]==='M_AND_A'),['M_AND_A','M&A']);
});
