import test from 'node:test';
import assert from 'node:assert/strict';
import {newsArticleRequest,newsArticlePresentation,newsHeadlineMatches,newsFeedRows,newsDisplayText,validateNewsFeedRequest} from '../public/gex-data-app/news-feed-model.js';
import {createNewsFeedStream,renderNewsBody,NEWS_STREAM_CSS} from '../public/gex-data-app/news-feed-stream.js';

class Node extends EventTarget{
  constructor(tag,doc){super();this.tagName=tag.toUpperCase();this.nodeType=tag==='#text'?3:1;this.ownerDocument=doc;this.childNodes=[];this.attributes={};this.dataset={};this.style={};this.parentNode=null;this.className='';this.scrollTop=0;this._text='';}
  get children(){return this.childNodes.filter(node=>node.nodeType===1);}
  get textContent(){return this._text+this.childNodes.map(node=>node.textContent).join('');}
  set textContent(value){this.replaceChildren();this._text=String(value);}
  set innerHTML(_){throw Error('Unsafe HTML insertion');}
  append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.childNodes.push(node);}}
  prepend(...nodes){for(const node of nodes.reverse())this.insertBefore(node,this.childNodes[0]??null);}
  insertBefore(node,before){node.remove();node.parentNode=this;this.childNodes.splice(before?this.childNodes.indexOf(before):this.childNodes.length,0,node);}
  replaceChildren(...nodes){for(const child of this.childNodes)child.parentNode=null;this.childNodes=[];this._text='';this.append(...nodes);}
  remove(){if(this.parentNode){this.parentNode.childNodes=this.parentNode.childNodes.filter(child=>child!==this);this.parentNode=null;}}
  setAttribute(key,value){this.attributes[key]=String(value);}
  getAttribute(key){return this.attributes[key]??null;}
  removeAttribute(key){delete this.attributes[key];}
  querySelector(selector){return this.childNodes.flatMap(node=>[node,node.querySelector(selector)]).find(node=>node?.className.split(' ').includes(selector.slice(1)))??null;}
  close(){this.dispatchEvent(new Event('close'));this.remove();}
}
const document=()=>{const doc={defaultView:{},createElement:tag=>new Node(tag,doc),createTextNode:value=>{const node=new Node('#text',doc);node.textContent=value;return node;}};return doc;};
const row=(id,title='Federal Reserve outlook')=>({id,title,publishedTime:1793635750000,topics:['Markets','Tech'],tickers:[{ticker:'SPY',sentiment:'NEUTRAL'}]});

test('headline search is explicit local substring matching and never invents a public CONTAINS operator',()=>{
  assert.equal(newsHeadlineMatches(row(1),' federal   reserve '),true);assert.equal(newsHeadlineMatches(row(1),'NASDAQ'),false);
  const base={filter:{tickers:['SPY']},filterExpression:{field:'TITLE',operation:'EQUALS',values:['Federal Reserve outlook']},searchAfter:['1'],includes:['TITLE']};
  const body=newsArticleRequest(row(42),base);
  assert.deepEqual(body.filterExpression,base.filterExpression);
  assert.deepEqual(body.timeRange,{startTime:new Date(row(42).publishedTime).toISOString(),endTime:new Date(row(42).publishedTime+1).toISOString()});
  assert.equal(body.includeBody,true);assert.equal(body.size,100);assert.equal(body.searchAfter,undefined);assert.equal(body.includes,undefined);validateNewsFeedRequest(body);assert.ok(base.searchAfter);
  assert.throws(()=>validateNewsFeedRequest({filterExpression:{field:'ID',operation:'EQUALS',values:[42]}}));
  assert.throws(()=>validateNewsFeedRequest({filterExpression:{field:'TITLE',operation:'CONTAINS',values:['Fed']}}));
  assert.throws(()=>newsArticleRequest({title:'Missing ID'}));
});
test('news display decodes publisher entities, including nested escapes, but raw licensed records stay unchanged',()=>{
  assert.equal(newsDisplayText('M&amp;A &quot;deal&quot; &#39;terms&#39; &#x1F680;'),'M&A "deal" \'terms\' 🚀');
  assert.equal(newsDisplayText('M&amp;amp;A'),'M&A');assert.equal(newsDisplayText('&amp;lt;img src=x onerror=bad()&amp;gt;'),'<img src=x onerror=bad()>');
  assert.equal(newsDisplayText('&#0; &#xD800; &#x110000;'),'� � �');assert.equal(newsDisplayText('&unknown;'),'&unknown;');
  const article={...row(1,'M&amp;A deal &amp; outlook'),topics:['M&amp;A','Earnings Beats']},saved=structuredClone(article),converted=newsFeedRows({data:[article]})[0];
  assert.equal(converted.title,article.title);assert.deepEqual(converted.topics,article.topics);assert.deepEqual(article,saved);assert.equal(converted.newsTitle,'M&A deal & outlook');assert.equal(converted.newsTopics,'M&A, Earnings Beats');
  assert.equal(newsArticlePresentation(article).title,'M&A deal & outlook');assert.equal(newsArticlePresentation(article).topics[0],'M&A');assert.equal(newsHeadlineMatches(article,'M&A deal & outlook'),true);assert.equal(newsHeadlineMatches(article,'M&amp;A deal'),true);
});
test('encoded tag-like headlines and topics remain literal text in native accessible row buttons',()=>{
  const doc=document(),host=doc.createElement('div'),article={...row(1,'&amp;lt;img src=x onerror=bad()&amp;gt; M&amp;A'),topics:['&lt;script&gt;bad()&lt;/script&gt;','M&amp;A']};
  const view=createNewsFeedStream({host,payload:{data:[article]}}),button=view.root.querySelector('.gex-news-row');
  assert.equal(button.tagName,'BUTTON');assert.equal(button.getAttribute('role'),null,'native button semantics must remain discoverable');assert.equal(button.children[0].textContent,'<img src=x onerror=bad()> M&A');
  assert.match(button.textContent,/<script>bad\(\)<\/script>/);assert.ok(!button.children.some(child=>['IMG','SCRIPT'].includes(child.tagName)));
  view.setSearch('<img src=x');assert.equal(view.visibleRows.length,1);view.destroy();
});
test('reference headline metadata caps topics/tickers at five and selects first genuine nonneutral sentiment',()=>{
  const article={...row(1),topics:Array.from({length:7},(_,i)=>`Topic ${i}`),tickers:Array.from({length:8},(_,i)=>({ticker:`T${i}`,sentiment:i===3?'MODERATELY_BEARISH':i===4?'EXTREMELY_BULLISH':'NEUTRAL'}))};
  const p=newsArticlePresentation(article,{timeZone:'Australia/Brisbane'});assert.equal(p.topics.length,5);assert.equal(p.moreTopics,2);assert.equal(p.tickers.length,5);assert.equal(p.moreTickers,3);assert.equal(p.sentiment,'MODERATELY_BEARISH');assert.match(p.time,/November 3, 2026 at/);
  assert.equal(newsArticlePresentation(row(1)).sentiment,null);
});
test('actual stream renders readable headline rows, local search, preserved IDs/scroll and manual source pagination',async()=>{
  const doc=document(),host=doc.createElement('div');let stored,moreCalls=0;
  const controller=createNewsFeedStream({host,payload:{data:[row(1),row(2,'NVIDIA earnings')],nextSearchAfter:['cursor']},onRows:rows=>{stored=rows;},onLoadMore:async()=>{moreCalls++;}});
  assert.equal(controller.rows,stored);assert.equal(host.children[0],controller.root);assert.match(host.textContent,/Federal Reserve outlook/);assert.doesNotMatch(host.textContent,/publishedTime|newsTickers/);
  const list=controller.root.querySelector('.gex-news-list'),first=list.children[0];list.scrollTop=123;
  controller.update({data:[row(1),row(2,'Updated earnings')],nextSearchAfter:['cursor']});assert.equal(list.children[0],first);assert.equal(list.scrollTop,123);
  controller.setSearch('earnings');assert.equal(controller.visibleRows.length,1);assert.match(controller.root.textContent,/1 \/ 2 loaded/);
  const more=controller.root.querySelector('.gex-news-more');more.dispatchEvent(new Event('click'));await Promise.resolve();assert.equal(moreCalls,1);
  controller.setSearch('missing');assert.match(list.textContent,/No loaded headlines/);assert.equal(controller.rows.length,2);
  controller.destroy();assert.equal(host.children.length,0);assert.equal(controller.update({data:[]}),false);
});
test('article modal fetches the exact source record on demand, shares concurrent requests and closes on disposal',async()=>{
  const doc=document(),host=doc.createElement('div'),dialogs=[];let calls=0,finish;
  const controller=createNewsFeedStream({host,payload:{data:[row(1)]},showDataDialog:(_title,build)=>{const dialog=doc.createElement('dialog');dialogs.push(dialog);build(dialog);return dialog;},loadArticle:async article=>{calls++;await new Promise(resolve=>{finish=resolve;});return {data:[{...article,body:'Verified article body'}]};}});
  const button=controller.root.querySelector('.gex-news-row');button.dispatchEvent(new Event('click'));button.dispatchEvent(new Event('click'));assert.equal(calls,1);assert.equal(dialogs.length,2);
  finish();await new Promise(resolve=>setTimeout(resolve,0));assert.ok(dialogs.every(dialog=>dialog.textContent.includes('Verified article body')));
  controller.destroy();assert.ok(dialogs.every(dialog=>!dialog.parentNode));
});
test('live refresh retains loaded older articles, old pagination cursor and scroll; append advances that cursor',()=>{
  const doc=document(),host=doc.createElement('div'),searchHost=doc.createElement('div');let cursor,search;
  const old={...row(1,'Older article'),publishedTime:1000},middle={...row(2,'Middle article'),publishedTime:2000},latest={...row(3,'Latest article'),publishedTime:3000};
  const view=createNewsFeedStream({host,searchHost,payload:{data:[middle,old],nextSearchAfter:['old-tail']},onCursorChange:value=>{cursor=value;},onSearch:value=>{search=value;}});
  const list=view.root.querySelector('.gex-news-list');list.scrollTop=70;
  view.update({data:[latest,middle],nextSearchAfter:['fresh-page']},{refresh:true});
  assert.deepEqual(view.rows.map(row=>row.id),[3,2,1]);assert.deepEqual(cursor,['old-tail']);assert.equal(list.scrollTop,70);
  const oldest={...row(0,'Oldest article'),publishedTime:0};view.update({data:[oldest],nextSearchAfter:['next-tail']},{append:true});assert.deepEqual(view.rows.map(row=>row.id),[3,2,1,0]);assert.deepEqual(cursor,['next-tail']);
  view.searchInput.value='Older';view.searchInput.dispatchEvent(new Event('input'));assert.equal(search,'Older');assert.equal(view.searchInput.dataset.control,'newsSearch');assert.equal(searchHost.children.length,1);
  view.destroy();assert.equal(searchHost.children.length,0);
});
test('body renderer reconstructs safe text and formatting, strips scripts/images/handlers and rejects dangerous links',()=>{
  const doc=document(),parsed=doc.createElement('body'),p=doc.createElement('p'),script=doc.createElement('script'),a=doc.createElement('a'),bad=doc.createElement('a'),img=doc.createElement('img');
  p.append(doc.createTextNode('Body'));p.setAttribute('onclick','bad()');script.append(doc.createTextNode('execute()'));a.setAttribute('href','https://example.com/article');a.append(doc.createTextNode('Source'));bad.setAttribute('href','javascript:bad()');bad.append(doc.createTextNode('Unsafe link'));img.setAttribute('src','https://example.com/tracker');img.setAttribute('alt','Description');parsed.append(p,script,a,bad,img);
  doc.defaultView.DOMParser=class{parseFromString(){return {body:parsed};}};const host=doc.createElement('div');renderNewsBody(host,'input HTML');
  assert.equal(host.textContent,'BodySourceUnsafe linkDescription');assert.equal(host.children[0].getAttribute('onclick'),null);assert.equal(host.children[1].href,'https://example.com/article');assert.equal(host.children[1].rel,'noopener noreferrer');assert.ok(!host.children.some(node=>['SCRIPT','IMG'].includes(node.tagName)));
  assert.doesNotMatch(NEWS_STREAM_CSS,/#[a-f0-9]{3,8}\b/i);
});
test('large article histories stay complete while the reference-style virtual viewport bounds rendered rows',()=>{
  const doc=document(),host=doc.createElement('div'),articles=Array.from({length:1000},(_,i)=>({...row(i,`Headline ${i}`),publishedTime:100000-i}));
  const view=createNewsFeedStream({host,payload:{data:articles,nextSearchAfter:['tail']}}),list=view.root.querySelector('.gex-news-list');
  assert.equal(view.rows.length,1000);assert.ok(list.children.filter(node=>node.className==='gex-news-row').length<60);assert.ok(list.querySelector('.gex-news-spacer-bottom'));
  list.scrollTop=40000;list.dispatchEvent(new Event('scroll'));assert.ok(list.querySelector('.gex-news-spacer-top'));assert.ok(list.children.filter(node=>node.className==='gex-news-row').length<70);assert.deepEqual(view.cursor,['tail']);
  view.setSearch('Headline 999');assert.equal(view.visibleRows.length,1);assert.match(list.textContent,/Headline 999/);assert.equal(view.rows.length,1000);
});
