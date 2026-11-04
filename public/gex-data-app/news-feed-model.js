// Licensed contract: https://quantdata.us/api/docs/endpoints/news-articles (2026-11-03).
// Pure adapters; no fetching, timers, synthetic articles, or HTML execution.
export const NEWS_SENTIMENTS=Object.freeze(['EXTREMELY_BEARISH','MODERATELY_BEARISH','SLIGHTLY_BEARISH','NEUTRAL','SLIGHTLY_BULLISH','MODERATELY_BULLISH','EXTREMELY_BULLISH']);
export const NEWS_TOPICS=Object.freeze(`AFTER_HOURS_CENTER ANALYST_COLOR ANALYST_RATINGS ASIA ASSET_SALES BINARY_OPTIONS BIOTECH BONDS BROAD_US_EQUITY_ETFS BUYBACKS CANNABIS COMMODITIES CONTRACTS CROWDSOURCING CRYPTOCURRENCY CURRENCY_ETFS DIVIDENDS DOWNGRADES EARNINGS EARNINGS_BEATS EARNINGS_MISSES ECON_NUMBERS ECONOMICS EDUCATION EMERGING_MARKET_ETFS EMERGING_MARKETS ENTERTAINMENT ENTREPRENEURSHIP EQUITIES ESG ETFS EUROZONE EVENTS EXCLUSIVES FDA FEDERAL_RESERVE FINANCIAL_ADVISORS FINANCING FINTECH FOREX FUTURES GAMING GENERAL GLOBAL GOVERNMENT GUIDANCE HEALTH_CARE HEDGE_FUNDS HOT INITIATION INSIDER_TRADES INSURANCE INTERVIEW INTRADAY_UPDATE IPOS LARGE_CAP LATIN_AMERICA LEGAL LONG_IDEAS M_AND_A MACRO_ECONOMIC_EVENTS MACRO_NOTIFICATION MANAGEMENT MARKET_MOVING_EXCLUSIVES MARKET_SUMMARY MARKETS MEDIA MID_CAP MOVERS MOVERS_AND_SHAKERS MUTUAL_FUNDS NEW_ETFS NEWS OFFERINGS OPINION OPTIONS PENNY_STOCKS PERSONAL_FINANCE POLITICS PRE_MARKET_OUTLOOK PREDICTION_MARKETS PRESS_RELEASES PREVIEWS PRICE_TARGET PRIVATE_MARKETS PSYCHEDELICS PSYCHOLOGY REAL_ESTATE REGULATIONS REIT REITERATION RESTAURANTS RETAIL_SALES REVIEWS RUMORS SEC SECTOR_ETFS SHORT_IDEAS SHORT_SELLERS SIGNALS SMALL_BUSINESS SMALL_CAP SMALL_CAP_ANALYSIS SOCIAL_MEDIA SPACE SPECIALTY_ETFS SPORTS SPORTS_BETTING STARTUPS STOCK_SPLIT SUCCESS_STORIES TECH TECHNICALS TERMINATION TOP_STORIES TOPICS TRADING_IDEAS TRAVEL TREASURIES UPGRADES WIIM`.split(' '));
const TOP=['filter','filterExpression','timeRange','size','searchAfter','includes','excludes','includeBody'];
const PROJECTION=['ID','PUBLISHED_TIME','TICKER','TITLE','TOPICS'];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const present=value=>value!==undefined&&value!==null&&value!=='';
const list=value=>(Array.isArray(value)?value:[value]).map(value=>String(value).trim()).filter(Boolean);
const field=value=>String(value).replace(/[^a-z0-9]/gi,'').toUpperCase();
const topicMap=new Map(NEWS_TOPICS.map(value=>[field(value),value]));topicMap.set('ECONS','ECON_NUMBERS');topicMap.set('MA','M_AND_A');topicMap.set('MOVERSSHAKERS','MOVERS_AND_SHAKERS');
const canonicalTopic=value=>topicMap.get(field(value));
const readable=value=>String(value).replaceAll('_',' ').toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase());
// Exact search-index display strings published by the121-topic public contract.
// Most labels are simple titlecase; these punctuation/acronym cases are not.
const NEWS_TOPIC_LABEL_EXCEPTIONS=Object.freeze({AFTER_HOURS_CENTER:'After-Hours Center',BROAD_US_EQUITY_ETFS:'Broad U.S. Equity ETFs',CURRENCY_ETFS:'Currency ETFs',ECON_NUMBERS:'Econ #s',EMERGING_MARKET_ETFS:'Emerging Market ETFs',ESG:'ESG',ETFS:'ETFs',FDA:'FDA',IPOS:'IPOs',M_AND_A:'M&A',MARKET_MOVING_EXCLUSIVES:'Market-Moving Exclusives',MOVERS_AND_SHAKERS:'Movers & Shakers',NEW_ETFS:'New ETFs',PRE_MARKET_OUTLOOK:'Pre-Market Outlook',REIT:'REIT',SEC:'SEC',SECTOR_ETFS:'Sector ETFs',SPACE:'SPACE',SPECIALTY_ETFS:'Specialty ETFs',WIIM:'WIIM'});
const NEWS_ENTITIES=Object.freeze({amp:'&',AMP:'&',lt:'<',LT:'<',gt:'>',GT:'>',quot:'"',QUOT:'"',apos:"'",nbsp:'\u00a0',ndash:'–',mdash:'—',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',hellip:'…',bull:'•',middot:'·',copy:'©',reg:'®',trade:'™',euro:'€',pound:'£',yen:'¥',cent:'¢',sect:'§',plusmn:'±',times:'×',divide:'÷',deg:'°',micro:'µ',laquo:'«',raquo:'»',frac14:'¼',frac12:'½',frac34:'¾'});
/** Display text only. Bounded nested decoding never creates/parses an HTML node. */
export function newsDisplayText(value){
  let text=String(value??'');
  for(let pass=0;pass<4;pass++){
    const next=text.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][a-z\d]+);/gi,(original,entity)=>{
      if(entity[0]!=='#')return Object.hasOwn(NEWS_ENTITIES,entity)?NEWS_ENTITIES[entity]:original;
      const hex=entity[1]?.toLowerCase()==='x',code=Number.parseInt(entity.slice(hex?2:1),hex?16:10);
      return code>0&&code<=0x10ffff&&(code<0xd800||code>0xdfff)?String.fromCodePoint(code):'\ufffd';
    });
    if(next===text)break;text=next;
  }
  return text;
}
export const newsTopicLabel=value=>{const text=newsDisplayText(value),known=canonicalTopic(text);return known?NEWS_TOPIC_LABEL_EXCEPTIONS[known]??readable(known):text;};
export const NEWS_TOPIC_CHOICES=Object.freeze(NEWS_TOPICS.map(value=>Object.freeze({value,label:newsTopicLabel(value)})));
export const NEWS_FEED_COLUMNS=Object.freeze([
  {key:'publishedTime',id:'date',label:'Date',type:'date',width:125},
  {key:'publishedTime',id:'time',label:'Time',type:'time',width:140},
  {key:'newsTitle',id:'title',label:'Headline',type:'text',width:600},
  {key:'newsTickers',id:'tickers',label:'Tickers',type:'text',width:160},
  {key:'newsSentiments',id:'sentiment',label:'Per-Ticker Sentiment',type:'text',width:280},
  {key:'newsTopics',id:'topics',label:'Topics',type:'text',width:280},
  {key:'body',id:'body',label:'Article Body',type:'text',width:650},
].map(Object.freeze));

/** A website-zone calendar day, including 23/25-hour DST days. End is exclusive. */
export function newsDayRange(date,timeZone='UTC'){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Choose a valid news date.');
  const start=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(start)||new Date(start).toISOString().slice(0,10)!==date)throw Error('Choose a valid news date.');
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const midnight=target=>{let value=target;for(let i=0;i<5;i++){const p=Object.fromEntries(formatter.formatToParts(value).map(p=>[p.type,p.value]));const shown=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));const difference=target-shown;value+=difference;if(!difference)return new Date(value).toISOString();}throw Error('The selected news date has no resolvable midnight in this time zone.');};
  return {startTime:midnight(start),endTime:midnight(start+86400000)};
}

/** Call after shared filters/overrides; session dates are converted, never sent. */
export function newsFeedRequest(controls={},baseBody={}, {timeZone='UTC'}={}){
  if(!object(controls)||!object(baseBody))throw Error('Invalid news request.');
  const body=Object.fromEntries(TOP.filter(key=>Object.hasOwn(baseBody,key)).map(key=>[key,structuredClone(baseBody[key])]));
  const original=baseBody.filter??{};if(!object(original))throw Error('Invalid news filter.');
  // Unsupported option/equity filters must not silently turn into unfiltered news.
  if(Object.keys(original).some(key=>!['ticker','tickers','topic','topics','sentiment','sentiments'].includes(key)))throw Error('A non-news filter cannot be applied to News Feed.');
  const filter={};
  const controlList=value=>typeof value==='string'?value.split(','):value;
  const tickers=original.tickers??original.ticker??controlList(controls.tickerOptional??controls.ticker);
  if(present(tickers)&&list(tickers).length)filter.tickers=list(tickers).map(value=>value.toUpperCase());
  for(const [key,control]of [['topics','newsTopic'],['sentiments','newsSentiment']]){
    const value=original[key]??original[key.slice(0,-1)]??controlList(controls[control]);
    if(present(value)&&list(value).length)filter[key]=list(value).map(value=>key==='topics'?canonicalTopic(value)||value:value.toUpperCase());
  }
  if(Object.keys(filter).length)body.filter=filter;else delete body.filter;
  if(controls.mode==='historical'&&!body.timeRange)body.timeRange=newsDayRange(baseBody.sessionDate||controls.date,timeZone);
  if(Object.hasOwn(controls,'newsBody')){if(!['SHOW','HIDE','',true,false].includes(controls.newsBody))throw Error('Choose Show or Hide article bodies.');body.includeBody=controls.newsBody==='SHOW'||controls.newsBody===true;}
  body.size??=100;validateNewsFeedRequest(body);return body;
}

export function validateNewsFeedRequest(body){
  if(!object(body)||Object.keys(body).some(key=>!TOP.includes(key)))throw Error('Unsupported News Feed request field.');
  if(body.size!==undefined&&(!Number.isInteger(body.size)||body.size<1||body.size>100))throw Error('News page size must be between 1 and 100.');
  if(body.includeBody!==undefined&&typeof body.includeBody!=='boolean')throw Error('Article-body selection must be boolean.');
  if(body.timeRange!==undefined){const range=body.timeRange;if(!object(range)||Object.keys(range).some(key=>!['startTime','endTime'].includes(key))||typeof range.startTime!=='string'||typeof range.endTime!=='string'||!Number.isFinite(Date.parse(range.startTime))||!Number.isFinite(Date.parse(range.endTime))||Date.parse(range.endTime)<=Date.parse(range.startTime)||Date.parse(range.endTime)-Date.parse(range.startTime)>93*86400000)throw Error('Choose a valid news time range of at most three months.');}
  if(body.includes!==undefined&&body.excludes!==undefined)throw Error('Choose includes or excludes, not both.');
  for(const key of ['includes','excludes'])if(body[key]!==undefined&&(!Array.isArray(body[key])||body[key].some(value=>!PROJECTION.some(allowed=>field(allowed)===field(value)))))throw Error('Unsupported news projection field.');
  if(body.searchAfter!==undefined&&(!Array.isArray(body.searchAfter)||!body.searchAfter.length||body.searchAfter.length>10||body.searchAfter.some(value=>!['string','number'].includes(typeof value)||(typeof value==='number'&&!Number.isFinite(value)))))throw Error('Invalid news pagination cursor.');
  const filter=body.filter;if(filter!==undefined){
    if(!object(filter)||Object.keys(filter).some(key=>!['ticker','tickers','topic','topics','sentiment','sentiments'].includes(key)))throw Error('Unsupported news filter.');
    for(const [key,value]of Object.entries(filter)){
      if((Array.isArray(value)?value:[value]).some(entry=>typeof entry!=='string'))throw Error('Invalid news '+key+'.');
      const entries=list(value);if(!entries.length||entries.length>121||entries.some(entry=>key.startsWith('ticker')?!/^[A-Z0-9./^_-]{1,16}$/i.test(entry):key.startsWith('topic')?!canonicalTopic(entry):!NEWS_SENTIMENTS.includes(entry)))throw Error('Invalid news '+key+'.');
    }
  }
  if(body.filterExpression!==undefined){
    let terminals=0;const walk=(node,depth)=>{
      if(!object(node)||depth>5)throw Error('Invalid news filter expression.');
      if(node.filters!==undefined){if(!['AND','OR'].includes(node.conjunction)||!Array.isArray(node.filters)||!node.filters.length||Object.keys(node).some(key=>!['conjunction','filters'].includes(key)))throw Error('Invalid news filter group.');node.filters.forEach(child=>walk(child,depth+1));return;}
      const values=node.values??node.value,entries=Array.isArray(values)?values:[values];
      if(++terminals>100||Object.keys(node).some(key=>!['field','operation','value','values'].includes(key))||!['PUBLISHEDTIME','TICKER','SYMBOL','TITLE','TOPICS','BODY','SENTIMENT'].includes(field(node.field))||typeof node.operation!=='string'||!['=','==','EQ','EQUAL','EQUALS','!=','<>','NEQ','NOT_EQUALS','NOT_EQUAL','DOES_NOT_EQUAL','>','GT','GREATER','GREATER_THAN','>=','GTE','GE','GREATER_OR_EQUAL','GREATER_THAN_OR_EQUAL_TO','<','LT','LESS','LESS_THAN','<=','LTE','LE','LESS_OR_EQUAL','LESS_THAN_OR_EQUAL_TO'].includes(node.operation.toUpperCase())||!entries.length||entries.length>500||entries.some(value=>!present(value)||!['number','string'].includes(typeof value)||(typeof value==='number'&&!Number.isFinite(value))))throw Error('Invalid news terminal filter.');
    };walk(body.filterExpression,0);
  }
}

export function newsFeedRows(payload){
  if(!object(payload)||!Array.isArray(payload.data))throw Error('Invalid licensed news response.');
  return payload.data.map(row=>{
    if(!object(row)||(row.id!=null&&!Number.isSafeInteger(row.id))||(row.publishedTime!=null&&(!Number.isSafeInteger(row.publishedTime)||!Number.isFinite(new Date(row.publishedTime).getTime())))||(row.title!=null&&typeof row.title!=='string')||(row.body!=null&&typeof row.body!=='string')||(row.topics!=null&&(!Array.isArray(row.topics)||row.topics.some(topic=>typeof topic!=='string')))||(row.tickers!=null&&(!Array.isArray(row.tickers)||row.tickers.some(entry=>!object(entry)||(entry.ticker!=null&&typeof entry.ticker!=='string')||(entry.sentiment!=null&&typeof entry.sentiment!=='string')))))throw Error('Invalid licensed news article.');
    return {...structuredClone(row),newsTitle:row.title==null?null:newsDisplayText(row.title),newsTickers:row.tickers?.map(entry=>newsDisplayText(entry.ticker??'—')).join(', ')??null,newsSentiments:row.tickers?.map(entry=>`${newsDisplayText(entry.ticker??'—')}: ${entry.sentiment==null?'—':readable(entry.sentiment)}`).join(' · ')??null,newsTopics:row.topics?.map(newsTopicLabel).join(', ')??null};
  });
}

/** Licensed probe2026-11-03: ID DSL rejects400; this exacttime window returns200. */
export function newsArticleRequest(article,baseBody={}){
  if(!object(article)||!Number.isSafeInteger(article.id)||!Number.isSafeInteger(article.publishedTime)||!Number.isFinite(new Date(article.publishedTime).getTime()))throw Error('A recorded article ID and publication timestamp are required.');
  const body=newsFeedRequest({},baseBody);
  body.timeRange={startTime:new Date(article.publishedTime).toISOString(),endTime:new Date(article.publishedTime+1).toISOString()};
  delete body.searchAfter;delete body.includes;delete body.excludes;
  body.size=100;body.includeBody=true;validateNewsFeedRequest(body);return body;
}

/** Search the actually acquired headlines; this never implies unrequested pages. */
export function newsHeadlineMatches(article,search=''){
  const query=newsDisplayText(search).trim().replace(/\s+/g,' ').toLocaleLowerCase();
  return !query||newsDisplayText(article.title).replace(/\s+/g,' ').toLocaleLowerCase().includes(query);
}

/** Source renderer uses first non-neutral sentiment and at most five tags each. */
const newsClockFormatters=new Map();
export function newsArticlePresentation(article,{timeZone='UTC'}={}){
  const topics=Array.isArray(article.topics)?article.topics:[],tickers=Array.isArray(article.tickers)?article.tickers:[];
  let formatters=newsClockFormatters.get(timeZone);if(!formatters){formatters=[new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'long',day:'numeric'}),new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',minute:'2-digit',hour12:true})];if(newsClockFormatters.size>=8)newsClockFormatters.delete(newsClockFormatters.keys().next().value);newsClockFormatters.set(timeZone,formatters);}
  // Reference date formatter762898: DDD 'at' t (long date and local minute clock).
  const time=Number.isSafeInteger(article.publishedTime)?`${formatters[0].format(article.publishedTime)} at ${formatters[1].format(article.publishedTime)}`:'—';
  return {title:newsDisplayText(article.title??'—'),time,topics:topics.slice(0,5).map(newsTopicLabel),moreTopics:Math.max(0,topics.length-5),tickers:tickers.slice(0,5).map(entry=>newsDisplayText(entry.ticker??'—')),moreTickers:Math.max(0,tickers.length-5),sentiment:tickers.find(entry=>entry.sentiment&&entry.sentiment!=='NEUTRAL')?.sentiment??null};
}

/** Reuses the site's actual sortable/searchable/resizable table; details stay text. */
export function renderNewsFeed(payload,{showTable,setSummary},controls={}){
  const rows=newsFeedRows(payload),columns=NEWS_FEED_COLUMNS.filter(column=>column.key!=='body'||controls.newsBody==='SHOW'||controls.newsBody===true);
  showTable(rows,columns,null,{sortKey:'publishedTime',sortDirection:-1});
  setSummary([['Loaded articles',rows.length.toLocaleString()],['Tickers',new Set(rows.flatMap(row=>row.tickers?.map(entry=>entry.ticker).filter(Boolean)||[])).size.toLocaleString()],['More pages',payload.nextSearchAfter?'Available':'No']]);
  return rows;
}
