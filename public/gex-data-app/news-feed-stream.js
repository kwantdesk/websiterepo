import {newsFeedRows,newsHeadlineMatches,newsArticlePresentation,newsDisplayText} from './news-feed-model.js?v=20261103';

// Reference26k4mykzwgrj-.js modules555465/835063/691333/357456: headline stream,
// maxfive topics/tickers, firstnonneutral sentiment, article modal and Search....
// No private socket, unsupported CONTAINS request, publisher URL or body invented.
export const NEWS_STREAM_CSS=`
.gex-news-stream{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--site-background);color:var(--site-foreground);font:inherit}
.gex-news-search{flex:none;display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--site-border)}
.gex-news-search input{box-sizing:border-box;min-width:100px;width:min(360px,100%);border:1px solid var(--site-border);border-radius:3px;background:var(--site-surface);color:var(--site-foreground);padding:7px 10px;font:inherit;font-size:12px;outline:none;box-shadow:none}
.gex-news-search small{color:var(--site-muted);font-size:11px;white-space:nowrap}
.tool-controls>.gex-news-search{padding:0;border:0;min-width:120px;flex:1}.tool-controls>.gex-news-search input{min-width:120px}
.gex-news-list{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;overflow-anchor:none}
.gex-news-row{position:relative;display:block;width:100%;box-sizing:border-box;min-height:0;min-width:0;margin:0;padding:4px 12px;border:0;border-radius:0;background:transparent;color:inherit;text-align:left;font:inherit;font-size:11px;line-height:1.55;overflow:hidden;white-space:normal;text-overflow:clip;cursor:pointer;box-shadow:none}
.gex-news-row::after{position:absolute;content:"";left:0;right:0;bottom:0;height:1px;background:var(--site-border);pointer-events:none}
.gex-news-row:hover,.gex-news-row:focus-visible{background:var(--site-surface);outline:none}
.gex-news-headline{display:block;margin:0;font-size:12px;font-weight:700;line-height:1.3;white-space:normal;text-overflow:clip;color:var(--site-foreground)}
.gex-news-meta{display:block;margin:0;color:var(--site-muted);font-size:11px;font-weight:600;line-height:1.55;white-space:normal;text-overflow:clip}
.gex-news-meta>span:nth-child(even){margin:0 7px}
.gex-news-meta .bullish{color:var(--site-bullish,var(--site-primary))}.gex-news-meta .bearish{color:var(--site-bearish,var(--site-danger))}
.gex-news-more{flex:none;align-self:center;margin:10px;padding:7px 14px;border:1px solid var(--site-border);border-radius:3px;background:var(--site-surface);color:var(--site-foreground);font:inherit;cursor:pointer}.gex-news-more[hidden]{display:none}
.gex-news-empty{padding:32px 14px;text-align:center;color:var(--site-muted)}
.gex-news-article{color:var(--site-foreground);font:inherit}.gex-news-article .gex-news-meta{margin-bottom:18px}.gex-news-body{line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}.gex-news-body p{margin:0 0 1em}.gex-news-body a{color:var(--site-primary)}
`;
const safeURL=value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}};
const ALLOWED=new Set(['P','BR','STRONG','B','EM','I','U','S','UL','OL','LI','BLOCKQUOTE','H1','H2','H3','H4','CODE','PRE','TABLE','THEAD','TBODY','TR','TH','TD','HR']);
const DROP=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','LINK','META','BASE','VIDEO','AUDIO','NOSCRIPT']);

/** Rebuild trusted text/formatting only; no original HTML nodes or handlers survive. */
export function renderNewsBody(host,body){
  host.replaceChildren();const doc=host.ownerDocument;
  if(typeof body!=='string'||!body.trim()){host.textContent='Article body is not available.';return;}
  const Parser=doc.defaultView?.DOMParser;
  if(!Parser){host.textContent=body;return;}
  const parsed=new Parser().parseFromString(body,'text/html');
  const append=(parent,node)=>{
    if(node.nodeType===3){parent.append(doc.createTextNode(node.textContent));return;}
    if(node.nodeType!==1||DROP.has(node.tagName))return;
    if(node.tagName==='IMG'){if(node.getAttribute('alt'))parent.append(doc.createTextNode(node.getAttribute('alt')));return;}
    let target=parent;
    if(node.tagName==='A'){const href=safeURL(node.getAttribute('href'));if(href){target=doc.createElement('a');target.href=href;target.target='_blank';target.rel='noopener noreferrer';parent.append(target);}}
    else if(ALLOWED.has(node.tagName)){target=doc.createElement(node.tagName.toLowerCase());parent.append(target);}
    for(const child of node.childNodes)append(target,child);
  };
  for(const child of parsed.body.childNodes)append(host,child);
}

export function createNewsFeedStream({host,payload={data:[]},timeZone='UTC',showDataDialog,loadArticle,onLoadMore,onRows,onCursorChange,search='',onSearch,searchHost}={}){
  if(!host?.ownerDocument)throw Error('A News Feed host is required.');
  const doc=host.ownerDocument,make=(tag,className,text)=>{const node=doc.createElement(tag);node.className=className||'';if(text!==undefined)node.textContent=String(text);return node;};
  const root=make('section','gex-news-stream'),style=make('style','',NEWS_STREAM_CSS),toolbar=make('div','gex-news-search'),input=make('input'),counter=make('small'),list=make('div','gex-news-list'),more=make('button','gex-news-more','Load more');
  input.type='search';input.placeholder='Search...';input.value=String(search);input.setAttribute('aria-label','Search loaded news headlines');input.title='Search the licensed headlines loaded here. Load more to search older articles.';
  input.dataset.control='newsSearch';
  more.type='button';list.setAttribute('role','region');list.setAttribute('aria-label','News articles');toolbar.append(input,counter);root.append(style,...(searchHost?[]:[toolbar]),list,more);host.replaceChildren(root);if(searchHost)searchHost.prepend(toolbar);
  let rows=[],destroyed=false,current=payload,loadingMore=false,zone=timeZone;const nodes=new Map(),heights=new Map(),details=new Map(),dialogs=new Set();
  const metadata=(row,parent)=>{
    const model=newsArticlePresentation(row,{timeZone:zone}),items=[model.time,...[model.topics.join(', ')+(model.moreTopics?` + ${model.moreTopics}`:''),model.tickers.join(', ')+(model.moreTickers?` + ${model.moreTickers}`:'')].filter(Boolean)];
    parent.replaceChildren();items.forEach((value,index)=>{if(index)parent.append(make('span','','•'));parent.append(make('span','',value));});
    if(model.sentiment){parent.append(make('span','','•'));parent.append(make('span',model.sentiment.includes('BULLISH')?'bullish':model.sentiment.includes('BEARISH')?'bearish':'',model.sentiment.toLowerCase().replaceAll('_',' ').replace(/\b\w/g,value=>value.toUpperCase())));}
  };
  const open=async row=>{
    if(destroyed||!showDataDialog)return;
    let body,dialog;
    const build=target=>{dialog=target;const modalDoc=target.ownerDocument,content=modalDoc.createElement('section');content.className='gex-news-article';const sheet=modalDoc.createElement('style');sheet.textContent=NEWS_STREAM_CSS;const meta=modalDoc.createElement('div');meta.className='gex-news-meta';metadata(row,meta);body=modalDoc.createElement('div');body.className='gex-news-body';content.append(sheet,meta,body);target.append(content);};
    const opened=showDataDialog(newsDisplayText(row.title)||'News article',build);dialog=opened||dialog;if(dialog){dialogs.add(dialog);dialog.addEventListener('close',()=>dialogs.delete(dialog),{once:true});}
    if(!body)return;
    if(typeof row.body==='string'){renderNewsBody(body,row.body);return;}
    if(!loadArticle){renderNewsBody(body,null);return;}
    body.setAttribute('aria-busy','true');
    try{
      const key=String(row.id);let job=details.get(key);
      if(!job){if(details.size>=32)details.delete(details.keys().next().value);job=Promise.resolve(loadArticle(row)).then(result=>{const article=result?.data?newsFeedRows(result).find(article=>article.id===row.id):result;if(!article||article.id!==row.id)throw Error('This article is unavailable from the connected news feed.');return article;});details.set(key,job);job.catch(()=>details.delete(key));}
      const article=await job;if(!destroyed&&dialogs.has(dialog))renderNewsBody(body,article.body);
    }catch(error){if(!destroyed&&dialogs.has(dialog))body.textContent=error.message||'The article could not be loaded.';}
    finally{body.removeAttribute('aria-busy');}
  };
  const paint=()=>{
    const visible=rows.filter(row=>newsHeadlineMatches(row,input.value)),keep=new Set();
    // The reference virtualizes dynamic-height articles. Preserve all acquired
    // records/cursors while bounding DOM work when readers load older pages.
    for(const [key,node]of nodes){const height=node.getBoundingClientRect?.().height;if(height>0)heights.set(key,height);}
    let start=0,end=visible.length,above=0,below=0;
    const rowHeight=row=>heights.get(String(row.id??`${row.publishedTime}:${row.title}`))??50;
    if(visible.length>200){const offsets=[0];for(const row of visible)offsets.push(offsets.at(-1)+rowHeight(row));const top=Math.max(0,list.scrollTop-12*50),bottom=list.scrollTop+(list.clientHeight||600)+12*50;while(start<visible.length&&offsets[start+1]<top)start++;end=start;while(end<visible.length&&offsets[end]<bottom)end++;above=offsets[start];below=offsets.at(-1)-offsets[end];}
    list.querySelector('.gex-news-spacer-top')?.remove();list.querySelector('.gex-news-spacer-bottom')?.remove();
    let index=0;if(above){const spacer=make('div','gex-news-spacer-top');spacer.style.height=above+'px';spacer.setAttribute('aria-hidden','true');list.insertBefore(spacer,list.children[0]??null);index++;}
    for(const row of visible.slice(start,end)){const key=String(row.id??`${row.publishedTime}:${row.title}`);keep.add(key);let node=nodes.get(key);if(!node){node=make('button','gex-news-row');node.type='button';node.append(make('span','gex-news-headline'),make('span','gex-news-meta'));node.addEventListener('click',()=>open(node.article));nodes.set(key,node);}node.article=row;const signature=JSON.stringify([row.title,row.publishedTime,row.topics,row.tickers,zone]);if(node.signature!==signature){node.children[0].textContent=newsDisplayText(row.title??'—');metadata(row,node.children[1]);node.signature=signature;}if(list.children[index]!==node)list.insertBefore(node,list.children[index]??null);index++;}
    for(const [key,node]of nodes)if(!keep.has(key)){node.remove();nodes.delete(key);}
    if(below){const spacer=make('div','gex-news-spacer-bottom');spacer.style.height=below+'px';spacer.setAttribute('aria-hidden','true');list.append(spacer);}
    list.querySelector('.gex-news-empty')?.remove();if(!visible.length)list.append(make('p','gex-news-empty',rows.length?'No loaded headlines match your search.':'There is no data to display.'));
    counter.textContent=input.value.trim()?`${visible.length} / ${rows.length} loaded`:'';more.hidden=!current.nextSearchAfter;more.disabled=loadingMore||!onLoadMore;
  };
  input.addEventListener('input',event=>{event.stopPropagation();paint();onSearch?.(input.value);});
  list.addEventListener('scroll',paint,{passive:true});
  more.addEventListener('click',async()=>{if(loadingMore||destroyed||!onLoadMore)return;loadingMore=true;more.disabled=true;try{await onLoadMore(current.nextSearchAfter);}finally{loadingMore=false;if(!destroyed)paint();}});
  const rowKey=row=>String(row.id??`${row.publishedTime}:${row.title}`);
  const controller={root,searchInput:input,get rows(){return rows;},get cursor(){return current.nextSearchAfter??null;},get visibleRows(){return rows.filter(row=>newsHeadlineMatches(row,input.value));},setSearch(value){input.value=String(value??'');paint();},update(next,{timeZone:nextZone=zone,search:nextSearch,refresh=false,append=false}={}){
    if(destroyed)return false;const top=list.scrollTop,nextRows=newsFeedRows(next),newKeys=new Set(nextRows.map(rowKey)),retainingOlder=refresh&&rows.some(row=>!newKeys.has(rowKey(row)));
    const merged=refresh||append?new Map([...rows,...nextRows].map(row=>[rowKey(row),row])):new Map(nextRows.map(row=>[rowKey(row),row]));
    rows=[...merged.values()].sort((a,b)=>(b.publishedTime??-Infinity)-(a.publishedTime??-Infinity));zone=nextZone;current=retainingOlder?{...next,nextSearchAfter:current.nextSearchAfter}:next;
    if(nextSearch!==undefined)input.value=String(nextSearch);paint();list.scrollTop=top;onRows?.(rows);onCursorChange?.(current.nextSearchAfter??null);return true;
  },destroy(){if(destroyed)return;destroyed=true;for(const dialog of dialogs)dialog.close?.();dialogs.clear();details.clear();nodes.clear();heights.clear();toolbar.remove();root.remove();}};
  controller.update(payload);return controller;
}
